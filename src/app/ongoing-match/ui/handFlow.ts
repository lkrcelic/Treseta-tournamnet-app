"use client";

import {createOngoingResultAPI} from "@/app/_fetchers/ongoingResult/create";
import {getOngoingMatchAPI, OngoingMatchGoneError} from "@/app/_fetchers/ongoingMatch/getOne";
import {getOngoingResultAPI} from "@/app/_fetchers/ongoingResult/getOne";
import {updateOngoingResultAPI} from "@/app/_fetchers/ongoingResult/updateOne";
import useResultStore from "@/app/_store/game/resultStore";
import {NO_HAND_ZVANJA, zvanjaColumns} from "@/app/_lib/game/scoring";

// Hand entry shared by the phone screen and the desktop entry panel. The entered hand lives in the result store
// (persisted, so a reload mid-entry keeps it).

// `hands`: how many hands the board showed when the entry was opened. It rides along to the server, which holds the
// save back (HandsChangedError) when another phone at the table saved a hand meanwhile, so the same hand can't be
// counted twice without the player's word. Left out: no check (the desktop panel, which has the board next to it).
export function startNewHand(matchId: number, hands?: number) {
  useResultStore.getState().resetResult();
  useResultStore.getState().setMatchId(matchId);
  useResultStore.getState().setExpectedHands(hands ?? null);
}

// the hand count this entry started from (null: no check), e.g. to name the hand another phone added
export function handsAtOpen(): number | null {
  return useResultStore.getState().resultData.expected_hands ?? null;
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
// `force`: the player answered "Upiši i ovu" to a hand saved from another phone, so the hand count is left out and
// the hand is saved as it is.
export async function saveHand(matchId: number, resultId?: number | string | null, {force = false}: {force?: boolean} = {}) {
  const {team1_game_points, team2_game_points, custom, zvanja, expected_hands} = useResultStore.getState().resultData;
  // a custom hand has no zvanja (the store drops them when Custom is pressed)
  const counts = custom ? NO_HAND_ZVANJA : zvanjaColumns(zvanja.team1, zvanja.team2);
  const data = {match_id: matchId, team1_game_points, team2_game_points, ...counts, custom};

  if (resultId) {
    await updateOngoingResultAPI({resultId: String(resultId), result: data});
    markHand(matchId, {flash: Number(resultId), askDosta: custom ? Number(resultId) : undefined});
  } else {
    const saved = await createOngoingResultAPI({result: {...data, expected_hands: force ? null : expected_hands ?? null}});
    const added = saved?.result_id ?? null;
    markHand(matchId, {added, askDosta: custom && added != null ? added : undefined});
  }
  discardHand();
}

// Marks a saved custom hand (its points unchanged) as the one where `side` called "s ovim dosta"
export async function callDosta(matchId: number, resultId: number, points: [number, number], side: 1 | 2) {
  const [team1_game_points, team2_game_points] = points;
  const data = {match_id: matchId, team1_game_points, team2_game_points, ...NO_HAND_ZVANJA, custom: true, dosta_side: side};
  await updateOngoingResultAPI({resultId: String(resultId), result: data});
}

// A hand that wasn't saved: is the match over (Vrijeme partije ran out, or a teammate finished it)? Reading it closes
// it when its time is up (Bela's a0686e1).
export async function matchClosed(matchId: number): Promise<boolean> {
  try {
    await getOngoingMatchAPI(matchId);
    return false;
  } catch (error) {
    return error instanceof OngoingMatchGoneError;
  }
}

export const MATCH_CLOSED_TEXT = "Meč je već završen, pa ova igra nije spremljena.";

// What the Igra step shows when Spremi was refused. closed: the match is over (Vrijeme partije ran out, or a teammate
// finished it), so the step says the hand wasn't saved and Na meč leads to the board, which has followed the match to
// the next one or the table's result (Bela's a0686e1 and e721909, DECISIONS #83). Otherwise the server's message, and
// Spremi stays. isClosed: how the match is checked (a test passes its own).
export async function saveRefusal(matchId: number, error: unknown, isClosed = matchClosed): Promise<{closed: boolean; message: string}> {
  if (await isClosed(matchId)) return {closed: true, message: MATCH_CLOSED_TEXT};
  return {closed: false, message: error instanceof Error ? error.message : "Spremanje nije uspjelo."};
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
