import {test} from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOM_HAND_MAX,
  dostaCallers,
  HAND_POINTS,
  handError,
  MATCH_THRESHOLD,
  matchState,
  matchWinner,
  NO_HAND_ZVANJA,
  NO_ZVANJA,
  PlayedHand,
  ratedMatch,
  TARGET_RAISE,
  canAddZvanje,
  handTotals,
  zvanjaColumns,
  zvanjaError,
  zvanjaPoints,
} from "@/app/_lib/game/scoring";
import {roundGames} from "@/app/_lib/rating/season";

test("the rules: 11 points a hand, matches to 41, a tie raises the target by 10", () => {
  assert.equal(HAND_POINTS, 11);
  assert.equal(MATCH_THRESHOLD, 41);
  assert.equal(TARGET_RAISE, 10);
  assert.equal(CUSTOM_HAND_MAX, 99);
});

test("a normal hand splits 11 between the teams", () => {
  assert.equal(handError(6, 5, false), null);
  assert.equal(handError(11, 0, false), null);
  assert.equal(handError(0, 11, false), null);
});

test("a normal hand that doesn't add up to 11 is refused", () => {
  assert.match(handError(6, 6, false)!, /mora biti 11/);
  assert.match(handError(14, 3, false)!, /mora biti 11/);
  assert.match(handError(5, 0, false)!, /mora biti 11/);
});

test("a custom hand is typed freely for each team, up to the limit", () => {
  assert.equal(handError(14, 3, true), null);
  assert.equal(handError(0, 4, true), null);
  assert.equal(handError(6, 5, true), null);
  assert.equal(handError(99, 99, true), null);
  assert.match(handError(100, 0, true)!, /više od 99/);
});

test("points can't be negative, fractional or both zero", () => {
  for (const custom of [false, true]) {
    assert.match(handError(12, -1, custom)!, /negativni/);
    assert.match(handError(5.5, 5.5, custom)!, /cijeli brojevi/);
    assert.match(handError(0, 0, custom)!, /barem jednoj ekipi/);
  }
});

test("a match is won by the first team to reach 41", () => {
  assert.equal(matchWinner(40, 39, MATCH_THRESHOLD), null);
  assert.equal(matchWinner(41, 30, MATCH_THRESHOLD), 1);
  assert.equal(matchWinner(25, 44, MATCH_THRESHOLD), 2);
});

test("both teams over 41: the higher score wins; a tie plays on", () => {
  assert.equal(matchWinner(43, 48, MATCH_THRESHOLD), 2);
  assert.equal(matchWinner(42, 42, MATCH_THRESHOLD), null);
  assert.equal(matchWinner(0, 0, MATCH_THRESHOLD), null);
});

// Hands as [team1, team2] points; a third value is the team that called "s ovim dosta" on the hand
const play = (...hands: [number, number, (1 | 2)?][]): PlayedHand[] =>
  hands.map(([a, b, dosta]) => ({team1_game_points: a, team2_game_points: b, ...NO_HAND_ZVANJA, dosta_side: dosta ?? null}));

test("a match without calls: the first team over 41 with more points wins", () => {
  const s = matchState(play([6, 5], [11, 0], [8, 3]));
  assert.deepEqual(s, {score1: 25, score2: 8, target: 41, winner: null, calledBy: null, callError: null});
  const won = matchState(play([30, 20], [11, 0]));
  assert.equal(won.winner, 1);
  assert.equal(won.target, 41);
});

test("level at or above the target: the match goes on to 51, then 61", () => {
  const tied = matchState(play([33, 33], [6, 5], [5, 6])); // 44 : 44
  assert.equal(tied.target, 51);
  assert.equal(tied.winner, null);

  // 50 : 49 would have won before; now a team has to reach 51
  assert.equal(matchState(play([33, 33], [6, 5], [5, 6], [6, 5])).winner, null);
  assert.equal(matchState(play([33, 33], [6, 5], [5, 6], [6, 5], [3, 8])).winner, 2); // 53 : 57

  const tiedAgain = matchState(play([45, 45], [6, 6])); // 45 : 45, then 51 : 51
  assert.equal(tiedAgain.target, 61);
});

test("41 : 41 is a tie: the target goes up unless someone called s ovim dosta", () => {
  assert.equal(matchState(play([35, 35], [6, 6])).target, 51);
  const called = matchState(play([35, 35], [6, 6, 2]));
  assert.deepEqual([called.winner, called.calledBy, called.target], [2, 2, 41]);
});

test("s ovim dosta wins for the calling team, even with fewer points", () => {
  const s = matchState(play([30, 44], [11, 0, 1])); // 41 : 44, team 1 called
  assert.equal(s.winner, 1);
  assert.equal(s.calledBy, 1);
  assert.equal(s.callError, null);
});

test("no call after a custom hand: the normal rules decide", () => {
  assert.equal(matchState(play([30, 20], [15, 10])).winner, 1); // 45 : 30
  assert.equal(matchState(play([30, 44], [11, 0])).winner, 2); // 41 : 44
});

test("a call by a team short of the target can't stand", () => {
  const s = matchState(play([20, 30], [5, 3, 1])); // 25 : 33
  assert.equal(s.calledBy, null);
  assert.match(s.callError!, /mora s tom igrom doći do 41/);
  assert.match(matchState(play([40, 40], [1, 2, 1], [0, 1, 2])).callError!, /samo jednom/);
});

test("a wrong call is a normal hand: 11 to the other team, and play goes on", () => {
  const s = matchState(play([38, 20], [0, 11])); // 38 : 31
  assert.deepEqual([s.winner, s.target], [null, 41]);
});

test("the question after a custom hand lists only the teams that reached the target with it", () => {
  assert.deepEqual(dostaCallers(play([30, 20], [11, 4])), [1]);
  assert.deepEqual(dostaCallers(play([35, 35], [6, 6])), [1, 2]); // 41 : 41
  assert.deepEqual(dostaCallers(play([30, 20], [5, 4])), []);
  assert.deepEqual(dostaCallers(play([44, 44], [3, 7])), [2]); // 47 : 51, the target is 51 by then
  assert.deepEqual(dostaCallers([]), []);
});

test("editing or deleting a hand plays the match again: a raised target or a call can go away", () => {
  const tied = play([33, 33], [6, 5], [5, 6]);
  assert.equal(matchState(tied).target, 51);
  assert.equal(matchState([tied[0], tied[1], {team1_game_points: 6, team2_game_points: 5, ...NO_HAND_ZVANJA}]).winner, 1); // 45 : 43
  assert.equal(matchState(tied.slice(0, 2)).target, 41); // the tying hand deleted

  const called = play([30, 44], [11, 0, 1]);
  assert.equal(matchState(called).winner, 1);
  assert.match(matchState([{team1_game_points: 20, team2_game_points: 44, ...NO_HAND_ZVANJA}, called[1]]).callError!, /doći do 41/);
});

test("the ratings count a s ovim dosta win as a win, whatever the points", () => {
  const dosta = {player_pair1_score: 41, player_pair2_score: 44, winner_side: 1};
  assert.deepEqual(ratedMatch(dosta), [1, 0]);
  assert.deepEqual(ratedMatch({player_pair1_score: 30, player_pair2_score: 45, winner_side: 2}), [0, 1]);
  // left without a winner by an edit: its points, as before
  assert.deepEqual(ratedMatch({player_pair1_score: 30, player_pair2_score: 20, winner_side: null}), [30, 20]);

  const round = {night: "2026-10-14", teamA: [1, 2], teamB: [3, 4], matches: [ratedMatch(dosta)], wins: [1, 0] as [number, number]};
  const games = roundGames(round);
  assert.equal(games[0].scoreA, 1);
});

// ---------- zvanja ----------

// a normal hand with zvanja: [team1 points, team2 points], each team's [threes, fours]
const withZvanja = ([a, b]: [number, number], [a3, a4]: [number, number], [b3, b4]: [number, number] = [0, 0]): PlayedHand => ({
  team1_game_points: a,
  team2_game_points: b,
  ...zvanjaColumns({3: a3, 4: a4}, {3: b3, 4: b4}),
  dosta_side: null,
});

test("zvanja are worth 3 and 4 a click, on top of the hand's 11 points", () => {
  assert.equal(zvanjaPoints({3: 2, 4: 1}), 10);
  assert.equal(zvanjaPoints(NO_ZVANJA), 0);
  assert.deepEqual(handTotals(withZvanja([6, 5], [2, 1])), [16, 5]);
  assert.deepEqual(handTotals(withZvanja([0, 11], [0, 0], [7, 0])), [0, 32]);
});

test("a match counts the hands' totals: zvanja take a team to 41", () => {
  // 30 : 25, then a hand of 6 : 5 with tri trice and napola (6) for team 1: 42 : 30
  const s = matchState([...play([30, 25]), withZvanja([6, 5], [2, 0])]);
  assert.deepEqual([s.score1, s.score2, s.winner], [42, 30, 1]);
  // without them it would be 36 : 30, nobody there yet
  assert.equal(matchState(play([30, 25], [6, 5])).winner, null);
});

test("zvanja decide who is ahead, and a tie made by them raises the target", () => {
  // 36 : 39, then 6 : 5 with napola for team 1 and četiri asa for team 2: 45 : 48, team 2 wins
  const ahead = matchState([...play([36, 39]), withZvanja([6, 5], [1, 0], [0, 1])]);
  assert.deepEqual([ahead.score1, ahead.score2, ahead.winner], [45, 48, 2]);
  // 34 : 41, then 6 : 5 with tri trice and napola (6) for team 1: 46 : 46, the target goes to 51
  const raised = matchState([...play([34, 41]), withZvanja([6, 5], [2, 0])]);
  assert.deepEqual([raised.score1, raised.score2, raised.target, raised.winner], [46, 46, 51, null]);
});

test("s ovim dosta: the zvanja of the hands before count towards the target", () => {
  // 33 : 20 after a hand of 29 : 20 with četiri trice for team 1, then a custom 8 : 0 with the call: 41 reached
  const hands = [withZvanja([29, 20], [0, 1]), play([8, 0, 1])[0]];
  const s = matchState(hands);
  assert.equal(s.callError, null);
  assert.equal(s.winner, 1);
  // without the zvanja the call would come at 37
  assert.match(matchState(play([29, 20], [8, 0, 1])).callError!, /doći do 41/);
});

test("zvanjaError: what the cards allow, a custom hand and a tournament bez zvanja", () => {
  assert.equal(zvanjaError(NO_ZVANJA, NO_ZVANJA), null);
  assert.equal(zvanjaError({3: 7, 4: 0}, NO_ZVANJA), null);
  assert.equal(zvanjaError({3: 2, 4: 2}, NO_ZVANJA), null);
  assert.equal(zvanjaError({3: 0, 4: 4}, NO_ZVANJA), "Ekipa ne može imati ta zvanja.");
  assert.equal(zvanjaError({3: 1, 4: 3}, NO_ZVANJA), "Ekipa ne može imati ta zvanja.");
  assert.equal(zvanjaError({3: 8, 4: 0}, NO_ZVANJA), "Ekipa ne može imati ta zvanja.");
  // each possible on its own, not at one deal: the 12 cards are shared
  assert.equal(zvanjaError({3: 0, 4: 1}, {3: 4, 4: 0}), "Obje ekipe ne mogu imati ta zvanja u istoj igri.");
  assert.equal(zvanjaError({3: 7, 4: 0}, {3: 1, 4: 0}), "Obje ekipe ne mogu imati ta zvanja u istoj igri.");
  // a zvanje left unannounced: below a possible deal is allowed
  assert.equal(zvanjaError({3: 1, 4: 0}, {3: 5, 4: 0}), null);
  assert.equal(zvanjaError({3: -1, 4: 0}, NO_ZVANJA), "Zvanja moraju biti cijeli brojevi od 0.");
  assert.equal(zvanjaError({3: 1.5, 4: 0}, NO_ZVANJA), "Zvanja moraju biti cijeli brojevi od 0.");
  assert.equal(zvanjaError({3: 1, 4: 0}, NO_ZVANJA, {custom: true}), "Ručni unos nema zvanja.");
  assert.equal(zvanjaError(NO_ZVANJA, NO_ZVANJA, {custom: true}), null);
  assert.equal(zvanjaError(NO_ZVANJA, {3: 0, 4: 1}, {declarations: false}), "Ovaj turnir se igra bez zvanja.");
  assert.equal(zvanjaError(NO_ZVANJA, NO_ZVANJA, {declarations: false}), null);
});

test("canAddZvanje: a click that would make an impossible hand is not offered", () => {
  assert.equal(canAddZvanje({3: 6, 4: 0}, NO_ZVANJA, 1, 3), true); // 7 × 3
  assert.equal(canAddZvanje({3: 7, 4: 0}, NO_ZVANJA, 1, 3), false); // 8 × 3
  assert.equal(canAddZvanje({3: 7, 4: 0}, NO_ZVANJA, 2, 3), false); // team 2 has nothing left
  assert.equal(canAddZvanje({3: 0, 4: 3}, NO_ZVANJA, 1, 3), false);
  assert.equal(canAddZvanje({3: 0, 4: 2}, NO_ZVANJA, 1, 4), true);
  assert.equal(canAddZvanje({3: 0, 4: 1}, {3: 3, 4: 0}, 2, 3), false); // 1 × 4 against 4 × 3
});
