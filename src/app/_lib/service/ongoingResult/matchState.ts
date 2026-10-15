import {Prisma} from "@prisma/client";
import {MATCH_THRESHOLD, matchState, MatchState} from "@/app/_lib/game/scoring";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";

// The match being played as the rules see it: its hands replayed in the order they were entered
export async function ongoingMatchState(
  tx: Prisma.TransactionClient,
  matchId: number,
  threshold: number | null,
): Promise<MatchState> {
  const hands = await tx.ongoingResult.findMany({
    where: {match_id: matchId},
    orderBy: {result_id: "asc"},
    select: {team1_game_points: true, team2_game_points: true, dosta_side: true},
  });
  return matchState(hands, threshold ?? MATCH_THRESHOLD);
}

// Refuses a change that leaves a "s ovim dosta" call that can't stand (the transaction is rolled back)
export function assertCallStands(state: MatchState) {
  if (state.callError) throw new InvalidResultError(state.callError);
}
