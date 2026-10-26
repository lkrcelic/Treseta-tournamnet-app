import assert from "node:assert/strict";
import {test} from "node:test";
import {LeagueCreateRequestValidation, MAX_NIGHTS_ERROR} from "../../_interfaces/league";
import {NETWORK_ERROR, networkError} from "../../_fetchers/errorMessage";
import {zodMessage} from "../validation/zodMessage";
import {z} from "zod";
import {lookupErrorResponse} from "../apiErrors";

test("an API's zod error message is ours (Croatian) or the route's fallback, never zod's English", () => {
  const fallback = "Liga nije napravljena.";
  const message = (body: unknown) => {
    const parsed = LeagueCreateRequestValidation.safeParse(body);
    assert.equal(parsed.success, false);
    return parsed.success ? "" : zodMessage(parsed.error, fallback);
  };
  assert.equal(message({league_name: " "}), "Ime lige je obavezno.");
  assert.equal(message({league_name: "Jesen", start_date: "2026-10-01", end_date: "2026-09-01"}), "Kraj mora biti nakon početka.");
  assert.equal(message({league_name: "Jesen", start_date: "1.10.2026"}), "Datum mora biti u obliku GGGG-MM-DD.");
  // zod's own messages ("Expected string, received number", "Required") are English: the fallback instead
  assert.equal(message({league_name: 7}), fallback);
  assert.equal(message({}), fallback);
  assert.equal(message({league_name: "Jesen", play_day: 9}), fallback);
});

test("too many league nights is counted with the noun's form", () => {
  assert.equal(MAX_NIGHTS_ERROR, "Liga može imati najviše 120 večeri.");
});

test("a request that never reached the server reads in Croatian, not the browser's English", () => {
  // Chrome's and Safari's own messages
  for (const browser of [new TypeError("Failed to fetch"), new TypeError("Load failed")]) {
    const mapped = networkError(browser);
    assert.ok(mapped instanceof Error);
    assert.equal(mapped.message, NETWORK_ERROR);
  }
  assert.equal(NETWORK_ERROR, "Provjeri vezu i pokušaj ponovno.");
  // an abort is passed on, so callers can still tell it apart
  const abort = new DOMException("The user aborted a request.", "AbortError");
  assert.equal(networkError(abort), abort);
});

test("a GET of one row (e.g. GET /api/teams/[id]) answers a server fault with a logged 500, never a silent 400", async (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const fallback = "Ekipa se nije učitala.";
  // a database outage, and a response that fails its own validation (a null the schema disallows)
  const invalidResponse = z.object({team_name: z.string()}).safeParse({team_name: null});
  assert.equal(invalidResponse.success, false);
  for (const fault of [new Error("Can't reach database server"), invalidResponse.success ? null : invalidResponse.error]) {
    const response = lookupErrorResponse(fault, fallback);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {error: fallback});
  }
  assert.equal(logged.mock.callCount(), 2);
});
