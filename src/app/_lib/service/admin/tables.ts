import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {isByeTeam} from "@/app/_lib/bye";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {createByeMatches} from "@/app/_lib/service/round/insertPairRounds";
import {isRatedRound, recalcTeamScores, replayRatings} from "./recalc";
import {teamSmokers} from "@/app/_lib/service/team/smokers";
import {draftLetters, RoundStatus, roundStatusOf} from "@/app/_lib/roundStatus";
import {newTableNumber, planSeats} from "@/app/_lib/tableSeats";
import {leagueNight} from "@/app/_lib/dates";
import {lockTournament} from "@/app/_lib/service/tournament/lock";
import {can} from "@/app/_lib/auth/permissions";
import {canManageTournament, NOT_YOUR_TOURNAMENT} from "@/app/_lib/auth/ownership";
import {ForbiddenError} from "@/app/_lib/auth/forbidden";
import type {Viewer} from "@/app/_lib/players/privacy";

// Admin edits of a night's tables (a "round number" of a league on a date is a set of tables, one Round row each), and
// of a tournament's Kolo (its tables with that round number). A table whose teams change loses what was played at it;
// standings and, when a counted result changed, ratings are recalculated in the same transaction.

type Tx = Prisma.TransactionClient;
type TableRound = {
  id: number;
  team1_id: number;
  team2_id: number;
  open: boolean;
  round_number: number | null;
  round_date: Date | null;
  table_number: number | null;
  status: RoundStatus;
  published_at: Date | null;
  draft_order: number | null;
  matches_per_round: number;
  declarations: boolean;
};

// What a table belongs to: a league's night or a tournament's Kolo
export type Competition = {kind: "league"; id: number} | {kind: "tournament"; id: number};

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

const tableSelect = {
  id: true,
  team1_id: true,
  team2_id: true,
  open: true,
  round_number: true,
  round_date: true,
  table_number: true,
  status: true,
  published_at: true,
  draft_order: true,
  matches_per_round: true,
  declarations: true,
} as const;

// The competition's edit lock: a league's is the one round creation takes, a tournament's is lockTournament
async function lockCompetition(tx: Tx, c: Competition) {
  if (c.kind === "league") await tx.$executeRaw`SELECT pg_advisory_xact_lock(${c.id})`;
  else await lockTournament(tx, c.id);
}

// The league's edit lock, for a change of its nights that round creation mustn't cross
export const lockLeague = (tx: Tx, leagueId: number) => lockCompetition(tx, {kind: "league", id: leagueId});

// The league or tournament a table belongs to (null: it doesn't exist)
export async function tableCompetition(roundId: number, db: Tx | typeof prisma = prisma): Promise<Competition | null> {
  const [league, tournament] = await Promise.all([
    db.leagueRound.findFirst({where: {round_id: roundId}, select: {league_id: true}}),
    db.tournamentRound.findFirst({where: {round_id: roundId}, select: {tournament_id: true}}),
  ]);
  if (league) return {kind: "league", id: league.league_id};
  if (tournament) return {kind: "tournament", id: tournament.tournament_id};
  return null;
}

/**
 * Whose table it is (DECISIONS #86). The scorepad routes get only a round id — no league, no tournament — so they look
 * up what the table belongs to: a league night is the admin's, a tournament's Kolo is whoever runs that tournament.
 * Two indexed lookups and then one row by its key, so it costs next to nothing before the write.
 */
export async function refuseUnlessMyTable(roundId: number, viewer: Viewer): Promise<void> {
  const competition = await tableCompetition(roundId);
  if (!competition) throw new NotFoundError("Stol ne postoji.");
  if (competition.kind === "league") {
    if (!can(viewer, "league.manage")) throw new ForbiddenError();
    return;
  }
  const tournament = await prisma.tournament.findUnique({where: {tournament_id: competition.id}, select: {created_by: true}});
  if (!tournament || !canManageTournament(viewer, tournament)) throw new ForbiddenError(NOT_YOUR_TOURNAMENT);
}

// The table and the league or tournament it belongs to, with that locked for edits (same lock as round creation)
async function loadTable(tx: Tx, roundId: number): Promise<{table: TableRound; competition: Competition}> {
  const competition = await tableCompetition(roundId, tx);
  if (!competition) {
    if (await tx.round.count({where: {id: roundId}})) throw new InvalidResultError("Ovaj stol nije dio lige.");
    throw new NotFoundError("Stol ne postoji.");
  }
  await lockCompetition(tx, competition);
  // read after the lock, so a concurrent edit of the same round is seen
  const table = await tx.round.findUniqueOrThrow({where: {id: roundId}, select: tableSelect});
  return {table, competition};
}

// The other tables of the same round number on the same night; in a tournament, of the same Kolo
function sameRound(tx: Tx, c: Competition, t: {round_number: number | null; round_date: Date | null}) {
  return tx.round.findMany({
    where:
      c.kind === "league"
        ? {leagueRounds: {some: {league_id: c.id}}, round_number: t.round_number, round_date: t.round_date}
        : {tournamentRounds: {some: {tournament_id: c.id}}, round_number: t.round_number},
    select: tableSelect,
    orderBy: [{table_number: "asc"}, {id: "asc"}],
  });
}

// A league's table seats the league's teams; a tournament's, the teams in it (not the ones waiting)
async function assertTeams(tx: Tx, c: Competition, teamIds: number[]) {
  const real = teamIds.filter((id) => !isByeTeam(id));
  if (c.kind === "league") {
    const count = await tx.leagueTeam.count({where: {league_id: c.id, team_id: {in: real}}});
    if (count !== new Set(real).size) throw new InvalidResultError("Obje ekipe moraju biti iz ove lige.");
    return;
  }
  const count = await tx.tournamentTeam.count({where: {tournament_id: c.id, team_id: {in: real}, status: "REGISTERED"}});
  if (count !== new Set(real).size) throw new InvalidResultError("Obje ekipe moraju biti prijavljene na turnir.");
}

// Drops what was played at a table and seats the given teams. A table with the bye is settled right away (2:0, its
// matches on the table's night; 1:0 at a tournament's table of one match). A smoking table stays one; the smokers it counts are the new teams'. Who played goes
// too (a lineup picked on Start Game, or a roster saved by freezeRosterLineups): the table is played again, and its new
// lineup is picked then.
async function reseat(tx: Tx, table: TableRound, team1Id: number, team2Id: number) {
  const roundId = table.id;
  await tx.ongoingMatch.deleteMany({where: {round_id: roundId}});
  await tx.match.deleteMany({where: {round_id: roundId}});
  await tx.roundPlayer.deleteMany({where: {round_id: roundId}});
  const bye = isByeTeam(team1Id) || isByeTeam(team2Id);
  const smokers = await teamSmokers([team1Id, team2Id], tx);
  await tx.round.update({
    where: {id: roundId},
    data: {
      team1_id: team1Id,
      team2_id: team2Id,
      team1_smokers: smokers.get(team1Id) ?? 0,
      team2_smokers: smokers.get(team2Id) ?? 0,
      team1_wins: bye && !isByeTeam(team1Id) ? 2 : 0,
      team2_wins: bye && !isByeTeam(team2Id) ? 2 : 0,
      open: !bye,
      active: false,
    },
  });
  if (bye) await createByeMatches(tx, roundId, team1Id, table.round_date ?? leagueNight());
}

// After tables changed: the season rows of every team involved (a league's; a tournament's standings are counted from
// its tables when they are read), and ratings if a rated result was undone or added
async function settle(tx: Tx, c: Competition, before: TableRound[], after: TableRound[]) {
  const teams = [...before, ...after].flatMap((t) => [t.team1_id, t.team2_id]);
  if (c.kind === "league") await recalcTeamScores(tx, c.id, teams);
  if (before.some(isRatedRound) || after.some(isRatedRound)) await replayRatings(tx);
}

export type PairChange = {roundId: number; team1Id: number; team2Id: number};

// Seats two teams at a table. A team that sits at another table of the same round swaps places with the team it
// replaces, so every team still plays once in the round. A team seated with the bye (Slobodna runda) wins the table
// 2:0 at once; a bye table whose team is taken away is left empty and removed. Returns the tables that changed (a
// removed one with both its teams the bye).
export async function editTablePair(roundId: number, team1Id: number, team2Id: number): Promise<PairChange[]> {
  if (team1Id === team2Id) throw new InvalidResultError("Ekipa ne može igrati sama protiv sebe.");
  return prisma.$transaction(async (tx) => {
    const {table, competition} = await loadTable(tx, roundId);
    await assertTeams(tx, competition, [team1Id, team2Id]);

    const tables = await sameRound(tx, competition, table);
    const seats = planSeats(new Map(tables.map((t) => [t.id, [t.team1_id, t.team2_id]])), roundId, [team1Id, team2Id]);

    const changed = tables.filter((t) => {
      const [a, b] = seats.get(t.id)!;
      return a !== t.team1_id || b !== t.team2_id;
    });
    for (const t of changed) {
      const [a, b] = seats.get(t.id)!;
      if (isByeTeam(a) && isByeTeam(b)) await dropTable(tx, t.id);
      else if (a === b) throw new InvalidResultError("Ekipa ne može igrati sama protiv sebe.");
      else await reseat(tx, t, a, b);
    }
    const after = await tx.round.findMany({where: {id: {in: changed.map((t) => t.id)}}, select: tableSelect});
    await settle(tx, competition, changed, after);
    return changed.map((t) => ({roundId: t.id, team1Id: seats.get(t.id)![0], team2Id: seats.get(t.id)![1]}));
  }, {timeout: 30000});
}

async function dropTable(tx: Tx, roundId: number) {
  await tx.ongoingMatch.deleteMany({where: {round_id: roundId}});
  await tx.match.deleteMany({where: {round_id: roundId}});
  await tx.round.delete({where: {id: roundId}});
}

// Removes a table and everything played at it. Returns what it belonged to.
export async function removeTable(roundId: number): Promise<Competition> {
  return prisma.$transaction(async (tx) => {
    const {table, competition} = await loadTable(tx, roundId);
    await dropTable(tx, roundId);
    await settle(tx, competition, [table], []);
    return competition;
  }, {timeout: 30000});
}

// Adds a table to a round that exists on that night; its teams must not be playing in that round yet (the bye can be
// at several tables). A team seated with the bye wins the table 2:0 at once, and a published round counts it in the
// standings. The table is published (or not) as the round's other tables are.
export async function addTable(leagueId: number, roundDate: Date, roundNumber: number, team1Id: number, team2Id: number): Promise<number> {
  return addCompetitionTable({kind: "league", id: leagueId}, roundDate, roundNumber, team1Id, team2Id);
}

// The same for a league's night or a tournament's Kolo (roundDate: a tournament's date, which every Kolo has). A new
// table of a tournament plays as many matches as its Kolo's other tables.
export async function addCompetitionTable(c: Competition, roundDate: Date, roundNumber: number, team1Id: number, team2Id: number): Promise<number> {
  if (team1Id === team2Id) throw new InvalidResultError("Ekipa ne može igrati sama protiv sebe.");
  return prisma.$transaction(async (tx) => {
    await lockCompetition(tx, c);
    await assertTeams(tx, c, [team1Id, team2Id]);
    const tables = await sameRound(tx, c, {round_number: roundNumber, round_date: roundDate});
    if (tables.length === 0) throw new NotFoundError("To kolo ne postoji.");
    const seated = new Set(tables.flatMap((t) => [t.team1_id, t.team2_id]));
    if ([team1Id, team2Id].some((id) => !isByeTeam(id) && seated.has(id))) throw new InvalidResultError("Ekipa već igra u ovom kolu.");

    const bye = isByeTeam(team1Id) || isByeTeam(team2Id);
    const status = roundStatusOf(tables);
    const tableNumber = newTableNumber(tables, bye);
    const smokers = await teamSmokers([team1Id, team2Id], tx);
    const {matches_per_round: matches, declarations} = tables[0];
    const round = await tx.round.create({
      data: {
        round_number: roundNumber,
        round_date: tables[0].round_date ?? roundDate,
        team1_id: team1Id,
        team2_id: team2Id,
        table_number: tableNumber,
        team1_smokers: smokers.get(team1Id) ?? 0,
        team2_smokers: smokers.get(team2Id) ?? 0,
        status,
        published_at: status === "PUBLISHED" ? tables[0].published_at : null,
        // a draft's table is part of its Skica A, B…
        draft_order: status === "PUBLISHED" ? null : tables[0].draft_order,
        matches_per_round: matches,
        // a Kolo's new table plays as its others do: with zvanja or "bez zvanja"
        declarations,
        ...(bye && {team1_wins: isByeTeam(team1Id) ? 0 : matches, team2_wins: isByeTeam(team1Id) ? matches : 0, open: false}),
        ...(c.kind === "league" ? {leagueRounds: {create: {league_id: c.id}}} : {tournamentRounds: {create: {tournament_id: c.id}}}),
      },
      select: tableSelect,
    });
    if (bye) {
      await createByeMatches(tx, round.id, team1Id, round.round_date ?? roundDate, matches);
      await settle(tx, c, [], [round]);
    }
    return round.id;
  }, {timeout: 30000});
}

export type RoundSummary = {
  date: string; // YYYY-MM-DD
  // a round not published yet has a number only to keep its tables together: it is shown as Skica + its letter
  roundNumber: number;
  // "A", "B"… until it is published; null once it is
  letter: string | null;
  tables: number;
  // how far a published round got; a round not published yet is a draft or approved (Upravljanje ligom · Skica)
  status: "draft" | "approved" | "played" | "live" | "new";
};

// The league's rounds (a round number on a night), newest first, with how far they got
export async function listLeagueRounds(leagueId: number): Promise<RoundSummary[]> {
  const rounds = await prisma.round.findMany({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_number: {not: null}},
    select: {
      ...tableSelect,
      active: true,
      _count: {select: {matches: true, ongoingMatches: true}},
    },
  });
  const groups = new Map<string, typeof rounds>();
  for (const r of rounds) {
    const key = `${r.round_date?.toISOString().slice(0, 10) ?? ""}|${r.round_number}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const isBye = (r: (typeof rounds)[number]) => isByeTeam(r.team1_id) || isByeTeam(r.team2_id);
  // the letters of each night's rounds waiting in Skica
  const nights = new Map<string, {roundNumber: number; status: RoundStatus; draftOrder: number | null}[]>();
  groups.forEach((tables, key) => {
    const date = key.split("|")[0];
    nights.set(date, [...(nights.get(date) ?? []), {roundNumber: tables[0].round_number!, status: roundStatusOf(tables), draftOrder: tables[0].draft_order}]);
  });
  const letters = new Map(Array.from(nights, ([date, list]) => [date, draftLetters(list)]));
  return Array.from(groups, ([key, tables]) => {
    const [date, n] = key.split("|");
    const played = tables.filter((t) => !isBye(t));
    const publication = roundStatusOf(tables);
    const status: RoundSummary["status"] = publication === "DRAFT"
      ? "draft"
      : publication === "APPROVED"
        ? "approved"
        : played.length > 0 && played.every((t) => !t.open)
          ? "played"
          : played.some((t) => !t.open || t.active || t._count.matches > 0 || t._count.ongoingMatches > 0)
            ? "live"
            : "new";
    return {date, roundNumber: Number(n), letter: letters.get(date)?.get(Number(n)) ?? null, tables: tables.length, status};
  }).sort((a, b) => b.date.localeCompare(a.date) || b.roundNumber - a.roundNumber);
}

// Deletes every table of a round on a night, with what was played at them
export async function deleteLeagueRound(leagueId: number, roundDate: Date, roundNumber: number): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const league: Competition = {kind: "league", id: leagueId};
    await lockCompetition(tx, league);
    const tables = await sameRound(tx, league, {round_number: roundNumber, round_date: roundDate});
    if (tables.length === 0) throw new NotFoundError("To kolo ne postoji.");
    const ids = tables.map((t) => t.id);
    await tx.ongoingMatch.deleteMany({where: {round_id: {in: ids}}});
    await tx.match.deleteMany({where: {round_id: {in: ids}}});
    await tx.round.deleteMany({where: {id: {in: ids}}});
    await settle(tx, league, tables, []);
    return tables.length;
  }, {timeout: 60000});
}

// Deletes every table of a league's night, drafts too, with what was played at them (Datumi · Obrisati odigranu
// večer?). Returns how many tables went.
export async function deleteNightTables(tx: Tx, leagueId: number, night: Date): Promise<number> {
  await lockLeague(tx, leagueId);
  const tables = await tx.round.findMany({where: {leagueRounds: {some: {league_id: leagueId}}, round_date: night}, select: tableSelect});
  if (tables.length === 0) return 0;
  const ids = tables.map((t) => t.id);
  await tx.ongoingMatch.deleteMany({where: {round_id: {in: ids}}});
  await tx.match.deleteMany({where: {round_id: {in: ids}}});
  await tx.round.deleteMany({where: {id: {in: ids}}});
  await settle(tx, {kind: "league", id: leagueId}, tables, []);
  return tables.length;
}
