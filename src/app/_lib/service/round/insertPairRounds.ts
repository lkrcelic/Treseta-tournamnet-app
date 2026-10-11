import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {TeamPair} from "@/app/_lib/matching/multipleRoundMatching";
import {BYE_TEAM_ID, isByeTeam} from "@/app/_lib/bye";
import {leagueDate} from "@/app/_lib/dates";
import {MATCHES_PER_ROUND} from "@/app/_lib/service/round/finish";
import {BYE_MATCH_POINTS, MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {ensureLeagueNight} from "@/app/_lib/service/league/nights";

export type CreatedRounds = {
  firstRoundNumber: number;
  // true when the same rounds were already created and not started yet, so nothing new was created
  alreadyCreated: boolean;
};

// Creates the rounds for one or more round numbers of a league in a single transaction.
// If the admin submits the same teams again (back button, double click) while the previous batch hasn't been
// started yet, the existing rounds are returned instead of creating duplicates.
export async function insertRoundBatch(roundsPairs: TeamPair[][], leagueId: number): Promise<CreatedRounds> {
  return prisma.$transaction(async (tx) => {
    // One round creation per league at a time
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${leagueId})`;

    const teamIds = new Set(roundsPairs.flat().flatMap((pair) => [pair.teamOne.id, pair.teamTwo.id]));
    const existingRoundNumber = await findUnstartedBatch(tx, leagueId, teamIds);
    if (existingRoundNumber !== null) {
      return {firstRoundNumber: existingRoundNumber, alreadyCreated: true};
    }

    const maxRound = await tx.round.aggregate({
      _max: {round_number: true},
      where: {leagueRounds: {some: {league_id: leagueId}}},
    });
    const firstRoundNumber = (maxRound._max.round_number ?? 0) + 1;

    const roundDate = leagueDate();
    for (let i = 0; i < roundsPairs.length; i++) {
      await insertRounds(tx, roundsPairs[i], leagueId, firstRoundNumber + i, roundDate);
    }
    await ensureLeagueNight(tx, leagueId, roundDate);

    return {firstRoundNumber, alreadyCreated: false};
  }, {timeout: 30000});
}

async function insertRounds(tx: Prisma.TransactionClient, pairs: TeamPair[], leagueId: number, roundNumber: number, roundDate: Date) {
  for (let index = 0; index < pairs.length; index++) {
    const pair = pairs[index];
    const isByeRound = isByeTeam(pair.teamOne.id) || isByeTeam(pair.teamTwo.id);

    const round = await tx.round.create({
      data: {
        round_number: roundNumber,
        round_date: roundDate,
        team1_id: pair.teamOne.id,
        team2_id: pair.teamTwo.id,
        table_number: index + 1,
        // A bye round counts as won 2:0 by the real team and is closed right away
        ...(isByeRound && {
          team1_wins: isByeTeam(pair.teamOne.id) ? 0 : 2,
          team2_wins: isByeTeam(pair.teamOne.id) ? 2 : 0,
          open: false,
        }),
        leagueRounds: {create: {league_id: leagueId}},
      },
    });

    if (isByeRound) {
      await createByeMatches(tx, round.id, pair.teamOne.id);
      const realTeamId = isByeTeam(pair.teamOne.id) ? pair.teamTwo.id : pair.teamOne.id;
      await tx.$executeRaw`CALL update_team_score(${realTeamId}, ${leagueId})`;
    }
  }
}

/**
 * Create the automatic matches of a bye round: the real team wins every match BYE_MATCH_POINTS:0 (5:0)
 */
export async function createByeMatches(tx: Prisma.TransactionClient, roundId: number, team1Id: number): Promise<void> {
  const isByeTeam1 = isByeTeam(team1Id);

  for (let i = 0; i < MATCHES_PER_ROUND; i++) {
    await tx.match.create({
      data: {
        round_id: roundId,
        player_pair1_score: isByeTeam1 ? 0 : BYE_MATCH_POINTS,
        player_pair2_score: isByeTeam1 ? BYE_MATCH_POINTS : 0,
        score_threshold: MATCH_THRESHOLD,
        match_date: leagueDate(),
      },
    });
  }
}

// The pairs that already meet in today's rounds of the league (bye tables included), so tonight's new rounds can
// keep them apart
export async function pairsPlayedToday(leagueId: number): Promise<[number, number][]> {
  const rounds = await prisma.round.findMany({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_date: leagueDate()},
    select: {team1_id: true, team2_id: true},
  });
  return rounds.map((r) => [r.team1_id, r.team2_id]);
}

// The first of today's not-yet-started rounds in this league that is for exactly these teams (a resubmission of a
// batch that was already created). Bye rounds are closed right away, so they don't count as started.
async function findUnstartedBatch(tx: Prisma.TransactionClient, leagueId: number, teamIds: Set<number>): Promise<number | null> {
  const todaysRounds = await tx.round.findMany({
    where: {
      leagueRounds: {some: {league_id: leagueId}},
      round_date: leagueDate(),
    },
    select: {
      round_number: true,
      team1_id: true,
      team2_id: true,
      open: true,
      active: true,
      _count: {select: {matches: true, ongoingMatches: true}},
    },
  });

  const isByeRound = (r: typeof todaysRounds[number]) => isByeTeam(r.team1_id) || isByeTeam(r.team2_id);
  const isStarted = (r: typeof todaysRounds[number]) =>
    !isByeRound(r) && (!r.open || r.active || r._count.matches > 0 || r._count.ongoingMatches > 0);

  const lastStartedRoundNumber = Math.max(-Infinity, ...todaysRounds.filter(isStarted).map((r) => r.round_number));
  const pending = todaysRounds.filter((r) => r.round_number > lastStartedRoundNumber);
  if (pending.length === 0) return null;

  const realTeams = (ids: number[]) => ids.filter((id) => id !== BYE_TEAM_ID).sort((a, b) => a - b).join(",");
  const wanted = realTeams(Array.from(teamIds));

  // The earliest pending round number played by exactly these teams
  const roundNumbers = Array.from(new Set(pending.map((r) => r.round_number))).sort((a, b) => a - b);
  for (const roundNumber of roundNumbers) {
    const teams = pending.filter((r) => r.round_number === roundNumber).flatMap((r) => [r.team1_id, r.team2_id]);
    if (realTeams(teams) === wanted) return roundNumber;
  }
  return null;
}
