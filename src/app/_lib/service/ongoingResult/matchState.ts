import {Prisma} from "@prisma/client";
import {DEFAULT_MATCH_END, MATCH_THRESHOLD, MatchEnd, matchState, MatchState} from "@/app/_lib/game/scoring";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";

// The match being played as the rules see it: its hands replayed in the order they were entered, by its table's rule
// ("s ovim dosta" or "na prolaz")
export async function ongoingMatchState(
  tx: Prisma.TransactionClient,
  matchId: number,
  threshold: number | null,
): Promise<MatchState> {
  const hands = await tx.ongoingResult.findMany({
    where: {match_id: matchId},
    orderBy: {result_id: "asc"},
    select: {
      team1_game_points: true,
      team2_game_points: true,
      team1_zvanja3: true,
      team1_zvanja4: true,
      team2_zvanja3: true,
      team2_zvanja4: true,
      dosta_side: true,
    },
  });
  const match = await tx.ongoingMatch.findUnique({where: {id: matchId}, select: {round: {select: {match_end: true}}}});
  return matchState(hands, threshold ?? MATCH_THRESHOLD, match?.round?.match_end ?? DEFAULT_MATCH_END);
}

// "Na prolaz" has no custom hand on the players' screens (Kaput takes its key); an admin's correction may be one
export function assertPlayersHand(custom: boolean, end: MatchEnd | null, admin: boolean) {
  if (custom && !admin && end === "NA_PROLAZ") throw new InvalidResultError(NO_CUSTOM_NA_PROLAZ);
}

export const NO_CUSTOM_NA_PROLAZ = "Na prolaz nema ručnog unosa: upiši igru normalno (Kaput je 11 : 0).";

// Refuses a change that leaves a "s ovim dosta" call that can't stand (the transaction is rolled back)
export function assertCallStands(state: MatchState) {
  if (state.callError) throw new InvalidResultError(state.callError);
}
