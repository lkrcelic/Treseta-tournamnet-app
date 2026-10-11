import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {replayRatings} from "@/app/_lib/service/admin/recalc";

// A round between two teams is two matches.
export const MATCHES_PER_ROUND = 2;

export async function lockRound(tx: Prisma.TransactionClient, roundId: number) {
  const [round] = await tx.$queryRaw<{id: number, open: boolean}[]>`
      SELECT id, open FROM "Round" WHERE id = ${roundId} FOR UPDATE`;
  return round;
}

// Marks the round as played, recomputes both teams' standings and the ratings.
// Call it inside a transaction that holds the round lock, so it runs once per round.
export async function closeRound(tx: Prisma.TransactionClient, roundId: number): Promise<void> {
  const round = await tx.round.update({
    where: {id: roundId},
    data: {open: false, active: false},
    include: {
      leagueRounds: {select: {league_id: true}},
    },
  });

  for (const {league_id} of round.leagueRounds) {
    await tx.$executeRaw`CALL update_team_score(${round.team1_id}, ${league_id})`;
    await tx.$executeRaw`CALL update_team_score(${round.team2_id}, ${league_id})`;
  }

  // the whole season again (Glicko-2 rates a night as one period, so tonight's earlier rounds are rated again with
  // this one); an admin's replay and this one must not interleave, which replayRatings' lock takes care of
  await replayRatings(tx);
}

// Finishes a round by hand (admin). Does nothing if it is already finished, and refuses a round that wasn't played,
// so a stray call can't count an unplayed round as a draw or update ratings twice.
export async function finishRound(round_id: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await lockRound(tx, round_id);
    if (!round) {
      throw new InvalidResultError("Round not found.");
    }
    if (!round.open) {
      return;
    }

    const playedMatches = await tx.match.count({where: {round_id: round_id}});
    if (playedMatches < MATCHES_PER_ROUND) {
      throw new InvalidResultError(`Only ${playedMatches} of ${MATCHES_PER_ROUND} matches of this round are played.`);
    }

    await closeRound(tx, round_id);
  }, {timeout: 20000});
}
