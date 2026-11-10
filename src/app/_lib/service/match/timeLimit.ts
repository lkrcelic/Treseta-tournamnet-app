import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {closesByTime, GAME_MINUTES_DEFAULT, matchDeadline, targetRaises} from "@/app/_lib/gameTime";
import {MATCH_THRESHOLD, MatchState} from "@/app/_lib/game/scoring";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {finishOngoingMatch, MatchAlreadyFinishedError} from "@/app/_lib/service/match/finishOngoingMatch";

// Vrijeme partije on the server: a match gets its deadline when it starts, and a match whose time is up is closed with
// the score entered then, by whichever request comes first (the scorepads ask at the deadline and every few seconds
// after it, and so does /api/cron/tick once a scheduler calls it). Matches started before the limit came in have no
// deadline.

type Db = Prisma.TransactionClient | typeof prisma;

// A table's time limit: the table's own Vrijeme partije (an admin picks it when they unlock the table), else its
// league's. A tournament's own limit joins this line with the tournaments.
export async function gameMinutesOf(db: Db, roundId: number): Promise<number> {
  const round = await db.round.findUnique({
    where: {id: roundId},
    select: {
      game_minutes: true,
      leagueRounds: {select: {league: {select: {game_minutes: true}}}, take: 1},
    },
  });
  return round?.game_minutes ?? round?.leagueRounds[0]?.league.game_minutes ?? GAME_MINUTES_DEFAULT;
}

// started_at and ends_at of a match of this table starting now
export async function matchClock(db: Db, roundId: number, now = new Date()): Promise<{started_at: Date; ends_at: Date}> {
  return {started_at: now, ends_at: matchDeadline(now, await gameMinutesOf(db, roundId))};
}

/**
 * The deadline after the match's hands changed (saved, corrected or deleted): the table's minutes from the start of
 * the match, plus five for every raise of the target (41 → 51 → 61 …). Counted from the hands rather than added up as
 * they are played, so a correction of an old hand can only put the deadline where the hands say it belongs.
 *
 * A match that was already running when Vrijeme partije came in has no start and keeps no deadline.
 */
export async function syncDeadline(db: Db, matchId: number, state: MatchState, threshold: number | null): Promise<void> {
  const match = await db.ongoingMatch.findUnique({where: {id: matchId}, select: {round_id: true, started_at: true, ends_at: true}});
  if (!match?.started_at || match.round_id == null) return;
  const minutes = await gameMinutesOf(db, match.round_id);
  const ends = matchDeadline(match.started_at, minutes, targetRaises(state.target, threshold ?? MATCH_THRESHOLD));
  if (match.ends_at?.getTime() === ends.getTime()) return;
  await db.ongoingMatch.update({where: {id: matchId}, data: {ends_at: ends}});
}

// Closes a match by time (the team with more points wins) and moves its table on as Završi meč does. Quiet when
// another request closed it first or the score is level.
export async function closeByTime(ongoingMatchId: number): Promise<boolean> {
  try {
    await finishOngoingMatch(ongoingMatchId, {byTime: true});
    return true;
  } catch (error) {
    if (error instanceof MatchAlreadyFinishedError || error instanceof InvalidResultError) return false;
    throw error;
  }
}

// Closes every match whose time is up (of these tables, or all), unless its score is level (one more hand is played
// then). Answers with the tables whose match was closed.
export async function expireDueMatches({roundIds, matchId}: {roundIds?: number[]; matchId?: number} = {}): Promise<number[]> {
  const now = new Date();
  const due = await prisma.ongoingMatch.findMany({
    where: {
      ends_at: {lt: now},
      ...(roundIds && {round_id: {in: roundIds}}),
      ...(matchId != null && {id: matchId}),
    },
    select: {id: true, round_id: true, ends_at: true, player_pair1_score: true, player_pair2_score: true},
  });
  const closed: number[] = [];
  for (const m of due) {
    if (!closesByTime({now, endsAt: m.ends_at, tied: m.player_pair1_score === m.player_pair2_score})) continue;
    if ((await closeByTime(m.id)) && m.round_id != null) closed.push(m.round_id);
  }
  return closed;
}
