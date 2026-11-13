import {Prisma} from "@prisma/client";
import {replayRatings} from "@/app/_lib/service/admin/recalc";
import {RoundStatus} from "@/app/_lib/roundStatus";
import {Side} from "@/app/_lib/game/scoring";

// A round between two teams is two matches, unless the tournament plays one per Kolo (Round.matches_per_round).
export const MATCHES_PER_ROUND = 2;

export async function lockRound(tx: Prisma.TransactionClient, roundId: number) {
  const [round] = await tx.$queryRaw<{id: number, open: boolean, status: RoundStatus, score_threshold: number, matches_per_round: number}[]>`
      SELECT id, open, status, score_threshold, matches_per_round FROM "Round" WHERE id = ${roundId} FOR UPDATE`;
  return round;
}

// "Oba meča ove runde već su odigrana." / "Meč ove runde već je odigran." (a table of one match)
export function roundPlayedMessage(matchesPerRound: number): string {
  return matchesPerRound === 1 ? "Meč ove runde već je odigran." : "Oba meča ove runde već su odigrana.";
}

// What the round gets once one of its matches is stored: the winner's side counts one more won match
export function roundWinsIncrement(winner: Side) {
  return winner === 1 ? {team1_wins: {increment: 1}} : {team2_wins: {increment: 1}};
}

// After a match is stored: the round is played once it has its matches (the round's matches_per_round) ("close"), else its next match
// opens ("next")
export function roundAfterMatch(playedMatches: number, matchesPerRound: number): "close" | "next" {
  return playedMatches >= matchesPerRound ? "close" : "next";
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
