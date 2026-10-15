import {prisma} from "@/app/_lib/prisma";
import {MatchAllIncluded, transformMatch} from "@/app/_lib/helpers/databaseHelpers";
import {MATCH_THRESHOLD, matchState} from "@/app/_lib/game/scoring";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {closeRound, lockRound, MATCHES_PER_ROUND} from "@/app/_lib/service/round/finish";
import {combineDateAndTime} from "@/app/_lib/dates";

export class MatchAlreadyFinishedError extends Error {
  constructor() {
    super("This match was already finished.");
    this.name = "MatchAlreadyFinishedError";
  }
}

export type FinishMatchOutcome = {
  roundId: number | null;
  roundFinished: boolean;
  nextOngoingMatchId: number | null;
};

// Stores a finished match and moves the round on: starts the next match, or closes the round and updates the
// standings and ratings once both matches are played. Everything happens in one transaction holding a lock on the
// match, so when two phones tap "Završi meč" at the same time only the first one counts.
export async function finishOngoingMatch(ongoingMatchId: number): Promise<FinishMatchOutcome> {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{id: number}[]>`
        SELECT id FROM "OngoingMatch" WHERE id = ${ongoingMatchId} FOR UPDATE`;
    if (!locked) {
      throw new MatchAlreadyFinishedError();
    }

    const ongoingMatch = await tx.ongoingMatch.findUniqueOrThrow({
      where: {id: ongoingMatchId},
      include: {results: {orderBy: {result_id: "asc"}}},
    });

    const threshold = ongoingMatch.score_threshold ?? MATCH_THRESHOLD;
    const {winner, target} = matchState(ongoingMatch.results, threshold);
    if (winner === null) {
      throw new InvalidResultError(`Neither team has reached ${target} yet.`);
    }

    await tx.match.create({
      data: {
        ...transformMatch(ongoingMatch as MatchAllIncluded, winner),
        // the ongoing match stores only the time of day; the finished match keeps a full timestamp
        start_time: combineDateAndTime(ongoingMatch.match_date, ongoingMatch.start_time),
        end_time: new Date(),
      },
    });
    await tx.ongoingMatch.delete({where: {id: ongoingMatchId}});

    const roundId = ongoingMatch.round_id;
    if (roundId == null) {
      return {roundId: null, roundFinished: false, nextOngoingMatchId: null};
    }

    await lockRound(tx, roundId);
    await tx.round.update({
      where: {id: roundId},
      data: winner === 1 ? {team1_wins: {increment: 1}} : {team2_wins: {increment: 1}},
    });

    const playedMatches = await tx.match.count({where: {round_id: roundId}});
    if (playedMatches >= MATCHES_PER_ROUND) {
      await closeRound(tx, roundId);
      return {roundId, roundFinished: true, nextOngoingMatchId: null};
    }

    // the next match starts from the round's threshold again (41), whatever this one was raised to
    const now = new Date();
    const nextMatch = await tx.ongoingMatch.create({
      data: {round_id: roundId, score_threshold: threshold, match_date: now, start_time: now},
    });
    return {roundId, roundFinished: false, nextOngoingMatchId: nextMatch.id};
  }, {timeout: 20000});
}
