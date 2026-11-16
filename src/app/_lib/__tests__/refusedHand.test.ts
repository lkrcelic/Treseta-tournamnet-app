import "./helpers/memoryStorage";
import assert from "node:assert/strict";
import {afterEach, beforeEach, test} from "node:test";
import useResultStore from "@/app/_store/game/resultStore";
import {TIME_UP} from "@/app/_lib/service/ongoingResult/create";
import {MATCH_CLOSED_TEXT, matchClosed, saveHand, saveRefusal} from "@/app/ongoing-match/ui/handFlow";
import {NETWORK_ERROR} from "@/app/_fetchers/errorMessage";
import {enterHand, resetHand} from "./helpers/handEntry";

// Spremi refused on the players' Igra step: a match closed meanwhile (Vrijeme partije ran out, or a teammate finished
// it) is told apart from any other refusal, so the step says the hand wasn't saved and Na meč leads to the board (Bela's
// DECISIONS #83 and e721909; Treseta #2). A gone match is a 404 that getOngoingMatchAPI throws as OngoingMatchGoneError,
// which these tests can't tell by instanceof (they compile to ES5), so the check that says "closed" is passed in;
// Playwright's c4-kasna-igra plays it on the real build.

const MATCH = 7;
const realFetch = globalThis.fetch;

// The server as the phone sees it: Spremi's POST refused with `refusal`; the match's GET answers `match`
function server(refusal: string, match: 200 | "offline" = 200) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/ongoing-result" && init?.method === "POST") return Response.json({error: refusal}, {status: 400});
    if (url === `/api/ongoing-matches/${MATCH}`) {
      if (match === "offline") throw new TypeError("Failed to fetch");
      return Response.json({id: MATCH, results: []}, {status: match});
    }
    throw new Error(`unexpected request ${init?.method ?? "GET"} ${url}`);
  }) as typeof fetch;
}

// Spremi on a hand entered on the keypad (8 for team 2): the server's refusal
async function refusedSave(): Promise<unknown> {
  enterHand(MATCH, {typedFor: 2, typed: "8"});
  try {
    await saveHand(MATCH);
  } catch (error) {
    return error;
  }
  throw new Error("the hand was saved");
}

const points = () => [useResultStore.getState().resultData.team1_game_points, useResultStore.getState().resultData.team2_game_points];

beforeEach(resetHand);
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a hand refused because the time ran out, its match closed meanwhile: the step says the hand wasn't saved, not the refusal", async () => {
  server(TIME_UP);
  const error = await refusedSave();
  assert.equal((error as Error).message, TIME_UP);
  const asked: number[] = [];
  const gone = async (id: number) => (asked.push(id), true);
  assert.deepEqual(await saveRefusal(MATCH, error, gone), {closed: true, message: MATCH_CLOSED_TEXT});
  assert.deepEqual(asked, [MATCH]);
  // the hand stays on the step until Na meč drops it
  assert.deepEqual(points(), [3, 8]);
});

test("a hand refused while its match goes on keeps the server's message on the step, and Spremi", async () => {
  const won = "Meč je gotov – završi ga umjesto da dodaješ igru.";
  server(won);
  assert.deepEqual(await saveRefusal(MATCH, await refusedSave(), async () => false), {closed: false, message: won});
});

test("a match the phone can still read, or can't reach, isn't taken for closed", async () => {
  server(TIME_UP);
  assert.equal(await matchClosed(MATCH), false);
  server(TIME_UP, "offline");
  assert.equal(await matchClosed(MATCH), false);
  assert.deepEqual(await saveRefusal(MATCH, new Error(NETWORK_ERROR)), {closed: false, message: NETWORK_ERROR});
});
