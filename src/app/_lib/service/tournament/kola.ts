import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {isByeTeam} from "@/app/_lib/bye";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {addCompetitionTable, NotFoundError} from "@/app/_lib/service/admin/tables";
import {replayRatings} from "@/app/_lib/service/admin/recalc";
import {createByeMatches} from "@/app/_lib/service/round/insertPairRounds";
import {firstKoloPairs, KoloPair, swissPairs} from "@/app/_lib/matching/tournamentPairing";
import {draftIsStale, KOLO_MAX, opponentsOf, rankTeams, TableResult, tournamentTotals} from "@/app/_lib/tournaments";
import {lockTournament} from "./lock";
import {TOURNAMENT_NOT_FOUND} from "./tournaments";

// A tournament's Kolos (Turniri · Kola). A Kolo is made as a draft only the admins see (Skica Kola N): Kolo 1 drawn
// at random once sign-ups are closed, every later one paired by the standings once the Kolo before it is played to
// the end. Objavi kolo publishes it; publishing Kolo 1 starts the tournament. Players never see a draft.

type Tx = Prisma.TransactionClient;

// Publishing a Kolo made from other teams than the ones that play now (a team signed off, came in, left or was
// excluded or let back after it was made; a later Kolo's draft is made by itself as soon as the Kolo before it ends)
export const STALE_DRAFT = "STALE_DRAFT";
export const STALE_DRAFT_ERROR = "Popis ekipa se promijenio nakon što je kolo složeno. Složi ga ponovo pa objavi.";

export class StaleDraftError extends Error {
  constructor() {
    super(STALE_DRAFT_ERROR);
    this.name = "StaleDraftError";
  }
}

export type MadeKolo = {number: number; tables: number; repeats: KoloPair[]};

const roundSelect = {
  id: true,
  round_number: true,
  status: true,
  open: true,
  team1_id: true,
  team2_id: true,
  team1_wins: true,
  team2_wins: true,
  active: true,
  attendance: true,
  matches_per_round: true,
  matches: {select: {player_pair1_score: true, player_pair2_score: true}},
} as const;

// The teams a Kolo is made from: in the tournament, active (Aktivna) and not excluded
export const PLAYING = {status: "REGISTERED", active: true, excluded_at: null} as const;

export async function playingTeams(tx: Tx, tournamentId: number): Promise<number[]> {
  const rows = await tx.tournamentTeam.findMany({where: {tournament_id: tournamentId, ...PLAYING}, select: {team_id: true}, orderBy: {registered_at: "asc"}});
  return rows.map((r) => r.team_id);
}

async function tournamentRounds(tx: Tx, tournamentId: number) {
  return tx.round.findMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}, select: roundSelect});
}

type RoundRow = Awaited<ReturnType<typeof tournamentRounds>>[number];

const lastPublished = (rounds: RoundRow[]) => Math.max(0, ...rounds.filter((r) => r.status === "PUBLISHED").map((r) => r.round_number ?? 0));

export async function dropTables(tx: Tx, ids: number[]) {
  if (ids.length === 0) return;
  await tx.ongoingMatch.deleteMany({where: {round_id: {in: ids}}});
  await tx.match.deleteMany({where: {round_id: {in: ids}}});
  await tx.round.deleteMany({where: {id: {in: ids}}});
}

// The next Kolo's pairs: drawn for Kolo 1, by the standings after the published Kolos for the others
async function pairsFor(tx: Tx, number: number, rounds: RoundRow[], teamIds: number[]): Promise<{pairs: KoloPair[]; repeats: KoloPair[]}> {
  if (number === 1) return {pairs: firstKoloPairs(teamIds), repeats: []};
  const results: TableResult[] = rounds
    .filter((r) => r.status === "PUBLISHED")
    .map((r) => ({
      kolo: r.round_number ?? 0,
      team1Id: r.team1_id,
      team2Id: r.team2_id,
      team1Wins: r.team1_wins,
      team2Wins: r.team2_wins,
      open: r.open,
      started: true,
      diff: r.matches.reduce((sum, m) => sum + m.player_pair1_score - m.player_pair2_score, 0),
      scored: r.attendance !== "SKIPPED",
      matches: r.matches_per_round,
    }));
  const totals = tournamentTotals(teamIds, results);
  const names = new Map((await tx.team.findMany({where: {team_id: {in: teamIds}}, select: {team_id: true, team_name: true}})).map((t) => [t.team_id, t.team_name]));
  const opponents = opponentsOf(results);
  const ranked = rankTeams(teamIds.map((id) => ({id, name: names.get(id) ?? "", totals: totals.get(id)!})), results);
  return swissPairs(ranked.map((t) => ({id: t.id, points: t.totals.points, difference: t.totals.difference, opponents: opponents.get(t.id) ?? []})));
}

// Složi Kolo N (and Složi ponovo with redo): makes the next Kolo's draft, or makes the waiting one again. Without redo a
// draft that is already there is kept (two taps make one draft).
export async function makeKoloDraft(tournamentId: number, {redo = false}: {redo?: boolean} = {}): Promise<MadeKolo> {
  return prisma.$transaction(async (tx) => {
    await lockTournament(tx, tournamentId);
    const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}});
    if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
    if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");

    const rounds = await tournamentRounds(tx, tournamentId);
    const last = lastPublished(rounds);
    const number = last + 1;
    if (number > t.rounds) throw new InvalidResultError("Sva kola su već objavljena.");
    const draft = rounds.filter((r) => r.status !== "PUBLISHED");
    if (draft.length > 0 && !redo) return {number, tables: draft.length, repeats: []};

    // Otvorene prijave: the teams keep coming all tournament, so Kolo 1 is made from whoever is here (DECISIONS #88)
    if (number === 1 && t.registrations_open && !t.open_signups) throw new InvalidResultError("Prvo zatvori prijave, zatim složi Kolo 1.");
    if (number > 1 && rounds.some((r) => r.status === "PUBLISHED" && r.round_number === last && r.open)) {
      throw new InvalidResultError(`Kolo ${last} još traje: sljedeće se slaže kad svi stolovi završe.`);
    }
    // only the teams that play: in, active and not excluded (Slobodna runda, inactive and excluded teams get no pair)
    const teams = await playingTeams(tx, tournamentId);
    if (teams.length < 2) throw new InvalidResultError("Za kolo trebaju barem dvije aktivne ekipe.");

    await dropTables(tx, draft.map((r) => r.id));
    const {pairs, repeats} = await pairsFor(tx, number, rounds, teams);
    for (let i = 0; i < pairs.length; i++) {
      const [team1, team2] = pairs[i];
      const bye = isByeTeam(team1) || isByeTeam(team2);
      const round = await tx.round.create({
        data: {
          round_number: number,
          round_date: t.date,
          team1_id: team1,
          team2_id: team2,
          table_number: i + 1,
          status: "DRAFT",
          matches_per_round: t.matches_per_round,
          // with zvanja or "bez zvanja", and to 41 or 51, as the tournament says when the Kolo is made
          declarations: t.declarations,
          score_threshold: t.score_threshold,
          match_end: t.match_end,
          // the bye's table is won by the real team at once (2:0, 1:0 at a table of one match), as in a league
          ...(bye && {
            team1_wins: isByeTeam(team1) ? 0 : t.matches_per_round,
            team2_wins: isByeTeam(team1) ? t.matches_per_round : 0,
            open: false,
          }),
          tournamentRounds: {create: {tournament_id: tournamentId}},
        },
        select: {id: true},
      });
      if (bye) await createByeMatches(tx, round.id, team1, t.date, t.matches_per_round, t.score_threshold);
    }
    return {number, tables: pairs.length, repeats};
  }, {timeout: 30_000});
}

// Objavi kolo: the draft's tables go out to the players. Publishing Kolo 1 starts the tournament: sign-ups are closed
// for good and the waiting list stays as it is.
export async function publishKolo(tournamentId: number, number: number): Promise<{publishedAt: string}> {
  return prisma.$transaction(async (tx) => {
    await lockTournament(tx, tournamentId);
    const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}});
    if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
    if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");
    const rounds = await tournamentRounds(tx, tournamentId);
    const tables = rounds.filter((r) => r.round_number === number && r.status !== "PUBLISHED");
    if (tables.length === 0) throw new NotFoundError("Skica tog kola ne postoji.");
    if (rounds.some((r) => r.status === "PUBLISHED" && r.round_number === number - 1 && r.open)) {
      throw new InvalidResultError(`Kolo ${number - 1} još traje.`);
    }
    const draft = tables.map((r) => ({team1Id: r.team1_id, team2Id: r.team2_id}));
    if (draftIsStale(draft, await playingTeams(tx, tournamentId))) throw new StaleDraftError();
    const now = new Date();
    await tx.round.updateMany({where: {id: {in: tables.map((r) => r.id)}}, data: {status: "PUBLISHED", published_at: now, draft_order: null}});
    // the tournament starts: the arrival window is over (who plays was decided by the draft) and sign-ups close —
    // unless it has Otvorene prijave, where they stay open until the last Kolo is made (DECISIONS #88)
    if (number === 1) {
      await tx.tournament.update({
        where: {tournament_id: tournamentId},
        data: {started_at: now, ...(t.open_signups ? {} : {registrations_open: false}), arrival_closed_at: t.arrival_closed_at ?? now},
      });
    }
    return {publishedAt: now.toISOString()};
  }, {timeout: 30_000});
}

// Once every table of the last Kolo published is played, the next Kolo's draft is made by itself. The admin publishes
// it, unless the tournament has Automatska kola on just then: then it goes out at once. Called after a tournament's
// table closes and when the admin's page is read; quiet when it isn't time.
export async function ensureNextKoloDraft(tournamentId: number): Promise<void> {
  const t = await prisma.tournament.findUnique({where: {tournament_id: tournamentId}, select: {started_at: true, cancelled_at: true, rounds: true}});
  if (!t || !t.started_at || t.cancelled_at) return;
  const rounds = await prisma.round.findMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}, select: {round_number: true, status: true, open: true}});
  const last = Math.max(0, ...rounds.filter((r) => r.status === "PUBLISHED").map((r) => r.round_number ?? 0));
  if (last === 0 || last >= t.rounds) return;
  if (rounds.some((r) => r.status !== "PUBLISHED")) return;
  if (rounds.some((r) => r.round_number === last && r.open)) return;
  try {
    const {number} = await makeKoloDraft(tournamentId);
    // the setting as it is now, not as it was when the tournament was made
    const now = await prisma.tournament.findUnique({where: {tournament_id: tournamentId}, select: {auto_publish: true}});
    if (now?.auto_publish) await publishKolo(tournamentId, number);
  } catch (error) {
    // another request made or published it first, or the admin changed something meanwhile: the page shows what is there
    if (!(error instanceof InvalidResultError) && !(error instanceof NotFoundError) && !(error instanceof StaleDraftError)) throw error;
  }
}

// Dodaj kolo (Kola's +): the tournament gets Kolo n, one more than it had. A second tap that finds Kolo n already there
// changes nothing. A tournament played to the end goes on: its next Kolo's draft comes as after any other Kolo.
export async function addKolo(tournamentId: number, n: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockTournament(tx, tournamentId);
    const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}, select: {rounds: true, cancelled_at: true}});
    if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
    if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");
    if (n === t.rounds) return;
    if (n !== t.rounds + 1) throw new InvalidResultError(`Turnir ima ${t.rounds} kola: novo je Kolo ${t.rounds + 1}.`);
    if (n > KOLO_MAX) throw new InvalidResultError(`Turnir ima najviše ${KOLO_MAX} kola.`);
    await tx.tournament.update({where: {tournament_id: tournamentId}, data: {rounds: n}});
  });
  await ensureNextKoloDraft(tournamentId);
}

// Obriši kolo (the bin on every Kolo of Kola, whatever its state, DECISIONS #87): the tournament is one Kolo shorter
// and keeps at least one, and the Kolos after the deleted one move up a number. What is deleted is this Kolo's tables
// (the bye's too) and those of every made Kolo after it, because those were paired by its results — so deleting a
// Kolo nobody has made deletes nothing at all, and deleting Kolo 1 of a tournament being played clears what was
// played and leaves the plan ready to be made again. A Kolo someone has played at goes only with withResults (the
// admin saw the warning): its games, the ones being played too, go, and ratings are counted again without them. A
// second tap that finds it gone changes nothing. A tournament whose remaining Kolos are all played is over.
export async function deleteKolo(tournamentId: number, n: number, {withResults = false}: {withResults?: boolean} = {}): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await lockTournament(tx, tournamentId);
      const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}, select: {rounds: true, cancelled_at: true}});
      if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
      if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");
      if (n < 1 || n > t.rounds) return;
      // this Kolo and every Kolo after it that is made: those were paired by this one's results, so they go together
      const tables = await tx.round.findMany({
        where: {round_number: {gte: n}, tournamentRounds: {some: {tournament_id: tournamentId}}},
        select: {id: true, round_number: true, team1_id: true, team2_id: true, open: true, status: true, _count: {select: {matches: true, ongoingMatches: true}}},
      });
      // the tournament is always one Kolo shorter; what is deleted is the tables above, if there are any
      const left = t.rounds - 1;
      if (left < 1) throw new InvalidResultError("Turnir mora imati barem jedno kolo.");
      const real = tables.filter((r) => !isByeTeam(r.team1_id) && !isByeTeam(r.team2_id));
      const startedAt = real.filter((r) => !r.open || r._count.matches > 0 || r._count.ongoingMatches > 0);
      if (startedAt.length > 0 && !withResults) {
        const kola = Array.from(new Set(startedAt.map((r) => r.round_number ?? 0))).sort((a, b) => a - b);
        throw new InvalidResultError(
          `Za stolovima ${kola.length > 1 ? `kola ${kola.join(", ")}` : `Kola ${kola[0]}`} se već igra ili je odigrano: brisanje briše i rezultate. Potvrdi brisanje s rezultatima.`
        );
      }
      await dropTables(tx, tables.map((r) => r.id));
      await tx.tournament.update({where: {tournament_id: tournamentId}, data: {rounds: left}});
      // a table played to the end changed ratings: count them again without it
      if (real.some((r) => !r.open && r.status === "PUBLISHED")) await replayRatings(tx);
    },
    {timeout: 60_000}
  );
}

// The tournament a table belongs to (null for a league's table)
export async function tournamentOfRound(roundId: number): Promise<number | null> {
  const link = await prisma.tournamentRound.findFirst({where: {round_id: roundId}, select: {tournament_id: true}});
  return link?.tournament_id ?? null;
}

// After a table of a tournament closed: the next Kolo's draft, if it was the last table of its Kolo. Never fails the
// request that closed the table.
export async function afterTableClosed(roundId: number | null): Promise<void> {
  if (roundId == null) return;
  try {
    const tournamentId = await tournamentOfRound(roundId);
    if (tournamentId != null) await ensureNextKoloDraft(tournamentId);
  } catch (error) {
    console.error(error);
  }
}

// Novi stol in a tournament's Kolo (a draft or a published one), with two teams in the tournament or one and the bye
export async function addKoloTable(tournamentId: number, number: number, team1Id: number, team2Id: number): Promise<number> {
  const t = await prisma.tournament.findUnique({where: {tournament_id: tournamentId}, select: {date: true}});
  if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
  return addCompetitionTable({kind: "tournament", id: tournamentId}, t.date, number, team1Id, team2Id);
}
