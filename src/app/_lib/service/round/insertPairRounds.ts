import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {SeatedPair} from "@/app/_lib/matching/smokingTables";
import {isByeTeam} from "@/app/_lib/bye";
import {DRAFT_WAITING_ERROR, UNPUBLISHED_STATUSES} from "@/app/_lib/roundStatus";
import {leagueNight} from "@/app/_lib/dates";
import {MATCHES_PER_ROUND} from "@/app/_lib/service/round/finish";
import {BYE_MATCH_POINTS, MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {ensureLeagueNight} from "@/app/_lib/service/league/nights";
import {Slot} from "@/app/_lib/locations";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";

export type CreatedRounds = {
  firstRoundNumber: number;
  // the night they are on (YYYY-MM-DD): tonight in league time, until 06:00 the night before (leagueNight)
  date: string;
};

export type BatchSmoking = {
  // smokers on each team's roster, kept with every table for the smoking rotation
  smokers?: ReadonlyMap<number, number>;
  // the smoking tables Create Round was sent, remembered for the league's next round creation; undefined leaves the
  // remembered ones as they are
  tables?: number[];
};

// Novo kolo while tonight's rounds still wait in Skica: they are published or discarded first
export class DraftWaitingError extends Error {
  constructor() {
    super(DRAFT_WAITING_ERROR);
    this.name = "DraftWaitingError";
  }
}

// How many of tonight's tables in the league are not published yet (a draft or approved round), at one place of a
// two-place night (slot; null: a one-place night)
export function tonightDraftTables(leagueId: number, db: Prisma.TransactionClient | typeof prisma = prisma, slot: Slot | null = null): Promise<number> {
  return db.round.count({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_date: leagueNight(), status: {in: UNPUBLISHED_STATUSES}, location_slot: slot},
  });
}

// Liga na dvije lokacije: tonight's rounds are made for one place of a two-place night (slot), with that place's teams
// only (Podjela), and with no place on a one-place night
async function checkPlace(tx: Prisma.TransactionClient, leagueId: number, night: Date, slot: Slot | null, teamIds: number[]) {
  const row = await tx.leagueNight.findUnique({
    where: {league_id_night: {league_id: leagueId, night}},
    select: {second_location_id: true, location: {select: {name: true}}, secondLocation: {select: {name: true}}, league: {select: {location: {select: {name: true}}}}},
  });
  const twoPlaces = row?.second_location_id != null;
  if (!twoPlaces) {
    if (slot != null) throw new InvalidResultError("Večeras se igra na jednoj lokaciji.");
    return;
  }
  if (slot == null) throw new InvalidResultError("Večeras se igra na dvije lokacije: odaberi lokaciju.");
  const real = Array.from(new Set(teamIds.filter((id) => !isByeTeam(id))));
  const placed = await tx.leagueNightTeam.findMany({where: {league_id: leagueId, night, team_id: {in: real}, slot}, select: {team_id: true}});
  if (placed.length === real.length) return;
  const here = new Set(placed.map((p) => p.team_id));
  const names = await tx.team.findMany({where: {team_id: {in: real.filter((id) => !here.has(id))}}, select: {team_name: true}});
  const place = slot === 1 ? (row?.location ?? row?.league.location)?.name : row?.secondLocation?.name;
  throw new InvalidResultError(`Nisu na lokaciji ${place ?? slot}: ${names.map((n) => n.team_name).join(", ")}. Promijeni Podjelu ili ih isključi.`);
}

// Creates the rounds for one or more round numbers of a league in a single transaction, every pair at its table, as
// drafts: players see them once an admin approves and publishes them (Upravljanje ligom · Skica). They are Skica A,
// B, C… in order; their round numbers only keep their tables apart until publishing numbers them. Refused
// (DraftWaitingError) while tonight's rounds still wait in Skica, which also stops a second click from creating them
// twice. slot: the place of a two-place night they are for (its own Skica, tables from Stol 1, its teams only); the
// other place's Skica doesn't stop them.
export async function insertRoundBatch(roundsPairs: SeatedPair[][], leagueId: number, smoking: BatchSmoking = {}, slot: Slot | null = null): Promise<CreatedRounds> {
  return prisma.$transaction(async (tx) => {
    // One round creation per league at a time
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${leagueId})`;
    if ((await tonightDraftTables(leagueId, tx, slot)) > 0) throw new DraftWaitingError();

    // a round created after midnight is still the evening's (until 06:00), so the night stays one night
    const roundDate = leagueNight();
    await checkPlace(tx, leagueId, roundDate, slot, roundsPairs.flat().flatMap((p) => [p.teamOne.id, p.teamTwo.id]));
    const date = roundDate.toISOString().slice(0, 10);
    const maxRound = await tx.round.aggregate({
      _max: {round_number: true},
      where: {leagueRounds: {some: {league_id: leagueId}}},
    });
    const firstRoundNumber = (maxRound._max.round_number ?? 0) + 1;

    for (let i = 0; i < roundsPairs.length; i++) {
      await insertRounds(tx, roundsPairs[i], leagueId, firstRoundNumber + i, i + 1, roundDate, smoking.smokers ?? new Map(), slot);
    }
    await ensureLeagueNight(tx, leagueId, roundDate);
    // a place's own smoking tables stay in its Novo kolo (CreateRoundDraft); the league remembers a one-place night's
    if (smoking.tables && slot == null) await tx.league.update({where: {league_id: leagueId}, data: {smoking_tables: smoking.tables}});

    return {firstRoundNumber, date};
  }, {timeout: 30000});
}

async function insertRounds(
  tx: Prisma.TransactionClient,
  pairs: SeatedPair[],
  leagueId: number,
  roundNumber: number,
  draftOrder: number,
  roundDate: Date,
  smokers: ReadonlyMap<number, number>,
  slot: Slot | null
) {
  for (const pair of pairs) {
    const isByeRound = isByeTeam(pair.teamOne.id) || isByeTeam(pair.teamTwo.id);

    const round = await tx.round.create({
      data: {
        round_number: roundNumber,
        round_date: roundDate,
        team1_id: pair.teamOne.id,
        team2_id: pair.teamTwo.id,
        table_number: pair.table,
        smoking_table: pair.smoking,
        team1_smokers: smokers.get(pair.teamOne.id) ?? 0,
        team2_smokers: smokers.get(pair.teamTwo.id) ?? 0,
        status: "DRAFT",
        draft_order: draftOrder,
        location_slot: slot,
        // A bye round counts as won 2:0 by the real team and is closed right away; the standings count it once the
        // round is published (publishNight)
        ...(isByeRound && {
          team1_wins: isByeTeam(pair.teamOne.id) ? 0 : 2,
          team2_wins: isByeTeam(pair.teamOne.id) ? 2 : 0,
          open: false,
        }),
        leagueRounds: {create: {league_id: leagueId}},
      },
    });

    if (isByeRound) await createByeMatches(tx, round.id, pair.teamOne.id, roundDate);
  }
}

/**
 * Create the automatic matches of a bye round: the real team wins every match BYE_MATCH_POINTS:0 (5:0) and is its
 * winner (winner_side), as with a no-show's matches, since a null winner_side reads as a match nobody won. night: the
 * round's night, the matches' date; matches: how many the table plays (a league's two, a tournament's one or two)
 */
// threshold: the points the table's matches are played to (a tournament's Igra se do; 41 in a league)
export async function createByeMatches(tx: Prisma.TransactionClient, roundId: number, team1Id: number, night: Date, matches = MATCHES_PER_ROUND, threshold = MATCH_THRESHOLD): Promise<void> {
  const isByeTeam1 = isByeTeam(team1Id);

  for (let i = 0; i < matches; i++) {
    await tx.match.create({
      data: {
        round_id: roundId,
        player_pair1_score: isByeTeam1 ? 0 : BYE_MATCH_POINTS,
        player_pair2_score: isByeTeam1 ? BYE_MATCH_POINTS : 0,
        winner_side: isByeTeam1 ? 2 : 1,
        score_threshold: threshold,
        match_date: night,
      },
    });
  }
}

// The pairs that already meet in tonight's rounds of the league (bye tables included, and the rounds played before
// midnight), so tonight's new rounds can keep them apart
export async function pairsPlayedToday(leagueId: number): Promise<[number, number][]> {
  const rounds = await prisma.round.findMany({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_date: leagueNight()},
    select: {team1_id: true, team2_id: true},
  });
  return rounds.map((r) => [r.team1_id, r.team2_id]);
}
