import {TARGET_RAISE} from "@/app/_lib/game/scoring";

// Vrijeme partije: every match has a time limit, 45 minutes unless its table, its league (or, later, its tournament)
// says otherwise, counted from the start of the match (Tko igra · Započni igru for the first, the moment it opens for
// the second). When the time is up the match ends at once with the score entered then: the team with more points wins
// it, and a hand still being entered isn't taken. With the score level one more hand is played, and the match ends
// after it.
//
// Treseta's own rule: every time the target goes up (41 → 51 → 61 …, the teams level at or above it), the match gets
// TARGET_RAISE_MINUTES more minutes, and so does every hand of a "na prolaz" match that leaves the teams level at or
// above the target (MatchState.extensions). The deadline is therefore counted from the hands the match has, not stored up:
// an edit of an old hand puts it exactly where the hands say it belongs (service/match/timeLimit.ts, syncDeadline).
// Framework free so it can be unit tested.

export const GAME_MINUTES_DEFAULT = 45;
export const GAME_MINUTES_MIN = 5;
export const GAME_MINUTES_MAX = 180;
export const GAME_MINUTES_ERROR = `Vrijeme partije je od ${GAME_MINUTES_MIN} do ${GAME_MINUTES_MAX} minuta.`;

// what a raised target is worth: the teams play on, so the clock gives them five more minutes
export const TARGET_RAISE_MINUTES = 5;

// the warning on the scorepad's main screen ("Još 5:00 do kraja partije"), and the red timer from then on
export const TIME_WARNING_MS = 5 * 60_000;

// How many times the target went up: 41 → 51 is one, 41 → 61 is two (scoring.ts raises it by TARGET_RAISE). A target
// below the threshold, which can't happen, counts as none.
export function targetRaises(target: number, threshold: number): number {
  return Math.max(0, Math.round((target - threshold) / TARGET_RAISE));
}

// when a match that started at `startedAt` runs out of time: its minutes, plus five for every raise of the target
export function matchDeadline(startedAt: Date, minutes: number, raises = 0): Date {
  return new Date(startedAt.getTime() + (minutes + raises * TARGET_RAISE_MINUTES) * 60_000);
}

// on_time: before the time is up (or no limit); extra_hand: the score is level after the time, so one more hand is
// played; too_late: refused (the match ends with the score entered when the time was up)
export type HandTiming = "on_time" | "extra_hand" | "too_late";

export function handTiming({now, endsAt, tied}: {now: Date; endsAt: Date | null; tied: boolean}): HandTiming {
  if (!endsAt || now.getTime() <= endsAt.getTime()) return "on_time";
  return tied ? "extra_hand" : "too_late";
}

// After the extra hand of a level score: the match ends now unless the score is still level (then one more hand). A
// hand that levels the teams at or above the target raises it instead, and the raise gives the match five more
// minutes, so the deadline is no longer past and the match plays on.
export function closesAfterHand(timing: HandTiming, tied: boolean): boolean {
  return timing === "extra_hand" && !tied;
}

// A match nobody is finishing: closed by itself as soon as the time is up, unless the score is level
export function closesByTime({now, endsAt, tied}: {now: Date; endsAt: Date | null; tied: boolean}): boolean {
  return endsAt != null && !tied && now.getTime() > endsAt.getTime();
}

// The winner of a match closed by time: the team with more points (1 or 2); null when level
export function timeWinner(score1: number, score2: number): 1 | 2 | null {
  if (score1 === score2) return null;
  return score1 > score2 ? 1 : 2;
}

// "23:41", "5:00", "0:07": the time left on the scorepad (never below 0:00)
export function clockLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
