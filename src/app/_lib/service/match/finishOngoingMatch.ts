import {prisma} from "@/app/_lib/prisma";
import {MatchAllIncluded, transformMatch} from "@/app/_lib/helpers/databaseHelpers";
import {MATCH_THRESHOLD, matchState} from "@/app/_lib/game/scoring";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {closeRound, lockRound, MATCHES_PER_ROUND, roundAfterMatch, roundWinsIncrement} from "@/app/_lib/service/round/finish";
import {combineDateAndTime} from "@/app/_lib/dates";
import {timeWinner} from "@/app/_lib/gameTime";
import {matchClock} from "@/app/_lib/service/match/timeLimit";

export class MatchAlreadyFinishedError extends Error {
  constructor() {
    super("Ovaj meč je već završen.");
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
//
// byTime: Vrijeme partije is up, so the team with more points wins — unless the rules already decided the match (a
// team over the target, or one that called "s ovim dosta" and may have fewer points): that winner stands, as it would
// have after Završi meč. Refused before the deadline, and while nothing decides it and the score is level.
export async function finishOngoingMatch(ongoingMatchId: number, {byTime = false}: {byTime?: boolean} = {}): Promise<FinishMatchOutcome> {
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
    const {winner: byRules, target} = matchState(ongoingMatch.results, threshold);
    let winner = byRules;
    if (byTime) {
      if (!ongoingMatch.ends_at || ongoingMatch.ends_at.getTime() > Date.now()) {
        throw new InvalidResultError("Vrijeme partije još nije isteklo.");
      }
      // the rules first: a match won by "s ovim dosta" belongs to the team that called it, not to the one with more
      // points
      winner = byRules ?? timeWinner(ongoingMatch.player_pair1_score, ongoingMatch.player_pair2_score);
      if (winner === null) throw new InvalidResultError("Rezultat je izjednačen: igra se još jedna igra.");
    }
    if (winner === null) {
      throw new InvalidResultError(`Nijedna ekipa još nije došla do ${target}.`);
    }

    await tx.match.create({
      data: {
        ...transformMatch(ongoingMatch as MatchAllIncluded, winner),
        // the ongoing match stores only the time of day; the finished match keeps a full timestamp
        start_time: ongoingMatch.started_at ?? combineDateAndTime(ongoingMatch.match_date, ongoingMatch.start_time),
        end_time: new Date(),
        // the time decided it: no team had reached the target
        time_expired: byTime && byRules === null,
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
      data: roundWinsIncrement(winner),
    });

    const playedMatches = await tx.match.count({where: {round_id: roundId}});
    if (roundAfterMatch(playedMatches, MATCHES_PER_ROUND) === "close") {
      await closeRound(tx, roundId);
      return {roundId, roundFinished: true, nextOngoingMatchId: null};
    }

    // the next match starts from the round's threshold again (41), whatever this one was raised to, and its time
    // counts from when it opens
    const now = new Date();
    const nextMatch = await tx.ongoingMatch.create({
      data: {round_id: roundId, score_threshold: threshold, match_date: now, start_time: now, ...(await matchClock(tx, roundId, now))},
    });
    return {roundId, roundFinished: false, nextOngoingMatchId: nextMatch.id};
  }, {timeout: 20000});
}
