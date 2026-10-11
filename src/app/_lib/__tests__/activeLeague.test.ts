import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {pickActiveLeague} from "@/app/_lib/league";

describe("pickActiveLeague", () => {
  it("picks the league with the latest round night", () => {
    const leagues = [
      {league_id: 3, last_played: null},
      {league_id: 2, last_played: "2025-03-11"},
      {league_id: 1, last_played: "2024-06-04"},
    ];
    assert.equal(pickActiveLeague(leagues), 2);
  });

  it("a new league takes over with its first round", () => {
    const leagues = [
      {league_id: 3, last_played: "2025-10-07"},
      {league_id: 2, last_played: "2025-06-03"},
    ];
    assert.equal(pickActiveLeague(leagues), 3);
  });

  it("two leagues playing the same night: the newer one", () => {
    const leagues = [
      {league_id: 1, last_played: "2025-10-07"},
      {league_id: 4, last_played: "2025-10-07"},
    ];
    assert.equal(pickActiveLeague(leagues), 4);
  });

  it("nothing played yet: the newest league", () => {
    assert.equal(pickActiveLeague([{league_id: 1, last_played: null}, {league_id: 5, last_played: null}]), 5);
  });

  it("no leagues: null", () => {
    assert.equal(pickActiveLeague([]), null);
  });
});
