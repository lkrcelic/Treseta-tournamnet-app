import "./helpers/memoryStorage";
import assert from "node:assert/strict";
import {test} from "node:test";
import {TeamSide} from "@/app/_interfaces/side";
import {RoundExtendedResponse} from "@/app/_interfaces/round";
import {myTeamIsTeam1} from "@/app/_hooks/useOpenTable";
import {HAND_POINTS, MATCH_THRESHOLD, matchWinner} from "@/app/_lib/game/scoring";
import {InvalidResultError, normalizeResult} from "@/app/_lib/validation/validateResult";
import {enterHand, HandPlan} from "./helpers/handEntry";

// The scoreboard end to end without a database: hands are entered through the same store steps as the screens,
// checked like the API does (normalizeResult), and added to the match score like createResult does, which refuses
// hands once the match has a winner.

class Match {
  scores: [number, number] = [0, 0];
  hands: [number, number][] = [];

  constructor(readonly id = 1) {}

  get winner(): TeamSide | null {
    return matchWinner(this.scores[0], this.scores[1], MATCH_THRESHOLD);
  }

  play(plan: HandPlan) {
    if (this.winner !== null) throw new InvalidResultError("This match is already over, finish it instead of adding a hand.");
    const sent = enterHand(this.id, plan);
    const saved = normalizeResult(sent);
    // what the phone showed is what the server stores
    assert.deepEqual(saved, sent, `client and server disagree on ${JSON.stringify(plan)}`);
    this.scores = [this.scores[0] + saved.team1_game_points, this.scores[1] + saved.team2_game_points];
    this.hands.push([saved.team1_game_points, saved.team2_game_points]);
    return saved;
  }
}

test("a normal hand: the typed team gets its points, the other the rest of 11", () => {
  const m = new Match();
  m.play({typedFor: 1, typed: "8"});
  assert.deepEqual(m.scores, [8, 3]);
});

test("points typed for the other team still count for the right side", () => {
  const m = new Match();
  m.play({typedFor: 2, typed: "7"});
  assert.deepEqual(m.scores, [4, 7]);
});

test("a custom hand keeps both teams' points", () => {
  const m = new Match();
  const saved = m.play({custom: ["14", "3"]});
  assert.equal(saved.custom, true);
  assert.deepEqual(m.scores, [14, 3]);
});

test("a whole match: the first team over 41 wins and no more hands are taken", () => {
  const m = new Match();
  const hands: HandPlan[] = [
    {typedFor: 1, typed: "8"}, // 8 : 3
    {typedFor: 2, typed: "6"}, // 5 : 6
    {custom: ["14", "3"]}, // 14 : 3 with akuže
    {typedFor: 1, typed: "11"}, // 11 : 0
    {typedFor: 1, typed: "0"}, // 0 : 11
  ];
  for (const h of hands) m.play(h);
  assert.deepEqual(m.scores, [38, 23]);
  assert.equal(m.winner, null);

  m.play({typedFor: 1, typed: "6"}); // 6 : 5
  assert.deepEqual(m.scores, [44, 28]);
  assert.equal(m.winner, 1);
  assert.throws(() => m.play({typedFor: 2, typed: "9"}), /already over/);
  assert.equal(m.hands.length, 6);
});

test("both teams over 41 in the same hand: the higher score wins; a tie plays on", () => {
  const m = new Match();
  m.scores = [38, 39];
  m.play({custom: ["4", "3"]}); // 42 : 42
  assert.equal(m.winner, null);
  m.play({typedFor: 2, typed: "5"}); // 6 : 5
  assert.deepEqual(m.scores, [48, 47]);
  assert.equal(m.winner, 1);
});

test("phone and server agree on every possible hand", () => {
  let checked = 0;
  for (const typedFor of [1, 2] as TeamSide[]) {
    for (let points = 0; points <= HAND_POINTS; points++) {
      const sent = enterHand(1, {typedFor, typed: String(points)});
      assert.equal(sent.team1_game_points + sent.team2_game_points, HAND_POINTS);
      assert.deepEqual(normalizeResult(sent), sent);
      checked++;
    }
  }
  for (let a = 0; a <= 20; a++) {
    for (let b = 0; b <= 20; b++) {
      if (a === 0 && b === 0) continue;
      const sent = enterHand(1, {custom: [String(a), String(b)]});
      assert.deepEqual([sent.team1_game_points, sent.team2_game_points, sent.custom], [a, b, true]);
      assert.deepEqual(normalizeResult(sent), sent);
      checked++;
    }
  }
  assert.equal(checked, 2 * 12 + 21 * 21 - 1);
});

// Which team the scoreboard shows on the left (green): the viewer's own
const round = {
  team1: {team_id: 1, team_name: "Dalmatinci", teamPlayers: [{player: {id: 10}}, {player: {id: 11}}]},
  team2: {team_id: 2, team_name: "Zagorci", teamPlayers: [{player: {id: 20}}, {player: {id: 21}}]},
} as unknown as Pick<RoundExtendedResponse, "team1" | "team2">;

test("the viewer's team is on the left; someone who isn't playing sees team 1 on the left", () => {
  assert.equal(myTeamIsTeam1(round, 11), true);
  assert.equal(myTeamIsTeam1(round, 20), false);
  assert.equal(myTeamIsTeam1(round, 99), true); // e.g. an admin watching
  assert.equal(myTeamIsTeam1(round, null), true);
});
