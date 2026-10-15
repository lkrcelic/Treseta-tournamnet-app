"use client";

import {createOngoingResultAPI} from "@/app/_fetchers/ongoingResult/create";
import {getOngoingResultAPI} from "@/app/_fetchers/ongoingResult/getOne";
import {updateOngoingResultAPI} from "@/app/_fetchers/ongoingResult/updateOne";
import useResultStore from "@/app/_store/game/resultStore";

// Hand entry shared by the phone screen and the desktop entry panel. The entered hand lives in the result store
// (persisted, so a reload mid-entry keeps it).

export function startNewHand(matchId: number) {
  useResultStore.getState().resetResult();
  useResultStore.getState().setMatchId(matchId);
}

// Loads a saved hand into the store for editing
export async function openHandForEdit(resultId: number) {
  const result = await getOngoingResultAPI(resultId);
  useResultStore.getState().setResultData(result);
  return result;
}

// The phone enters a hand on one screen opened from the scoreboard, so the scoreboard is one history entry behind it,
// and saving goes back there instead of pushing the scoreboard again (the phone's back button then doesn't lead into
// the finished entry). Not known after a reload mid-entry.
let entryOpenedFrom: number | null = null;

export function markEntryOpened(matchId: number) {
  entryOpenedFrom = matchId;
}

// true once per entry: the caller may go back one entry to reach the scoreboard
export function takeEntryOrigin(matchId: number): boolean {
  const fromBoard = entryOpenedFrom === matchId;
  entryOpenedFrom = null;
  return fromBoard;
}

export function discardHand() {
  useResultStore.getState().resetResult();
}

// Saves the entered hand (new, or an update of `resultId`). Throws with the server's message when it is refused.
// Saving a hand clears its "s ovim dosta" call: the scoreboard asks again after a custom hand.
export async function saveHand(matchId: number, resultId?: number | string | null) {
  const {team1_game_points, team2_game_points, custom} = useResultStore.getState().resultData;
  const data = {match_id: matchId, team1_game_points, team2_game_points, custom};

  if (resultId) {
    await updateOngoingResultAPI({resultId: String(resultId), result: data});
    markHand(matchId, {flash: Number(resultId), askDosta: custom ? Number(resultId) : undefined});
  } else {
    const saved = await createOngoingResultAPI({result: data});
    const added = saved?.result_id ?? null;
    markHand(matchId, {added, askDosta: custom && added != null ? added : undefined});
  }
  discardHand();
}

// Marks a saved custom hand (its points unchanged) as the one where `side` called "s ovim dosta"
export async function callDosta(matchId: number, resultId: number, points: [number, number], side: 1 | 2) {
  const [team1_game_points, team2_game_points] = points;
  const data = {match_id: matchId, team1_game_points, team2_game_points, custom: true, dosta_side: side};
  await updateOngoingResultAPI({resultId: String(resultId), result: data});
}

// Remembers which hand was just added or edited, so the scoreboard can animate it when it loads again, and the
// custom hand to ask "s ovim dosta" about
type Mark = {added?: number | null; flash?: number; askDosta?: number};
const marks = new Map<number, Mark & {at: number}>();

function markHand(matchId: number, mark: Mark) {
  marks.set(matchId, {...mark, at: Date.now()});
}

// Read once: the mark is cleared, and ignored when older than 10 s
export function takeHandMark(matchId: number): Mark | null {
  const m = marks.get(matchId);
  marks.delete(matchId);
  if (!m || Date.now() - m.at > 10000) return null;
  return m;
}

// Totals shown before leaving the scoreboard, so the count-up starts from them when it comes back
const lastTotals = new Map<number, [number, number]>();
export function rememberTotals(matchId: number, totals: [number, number]) {
  lastTotals.set(matchId, totals);
}
export function previousTotals(matchId: number): [number, number] | undefined {
  return lastTotals.get(matchId);
}
