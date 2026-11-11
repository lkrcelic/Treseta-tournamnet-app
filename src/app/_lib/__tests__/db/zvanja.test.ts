import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {addHand, deleteHand, getTablePad, updateHand} from "@/app/_lib/service/admin/hands";
import {createResult} from "@/app/_lib/service/ongoingResult/create";
import {updateOngoingResult} from "@/app/_lib/service/ongoingResult/update";
import {finishOngoingMatch} from "@/app/_lib/service/match/finishOngoingMatch";
import {MATCH_THRESHOLD, zvanjaColumns} from "@/app/_lib/game/scoring";

// Zvanja against a real Postgres: a hand's zvanja are stored with it and its total moves the match score, a correction
// without zvanja keeps them, a finished match keeps them, a table "bez zvanja" refuses them, and the database's CHECKs
// hold. Run with `npm run test:db` and DATABASE_URL on a throwaway database with the migrations applied (it adds its
// own league and teams and removes them afterwards). Never point it at production.

const tag = `zv${Date.now()}`;
let leagueId = 0;
const teams: number[] = [];

before(async () => {
  const league = await prisma.league.create({data: {league_name: `${tag} liga`}});
  leagueId = league.league_id;
  for (const name of ["A", "B"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    await prisma.leagueTeam.create({data: {league_id: leagueId, team_id: team.team_id}});
  }
});

after(async () => {
  // the finished matches too (their hands go with them): a deleted round would leave them without one
  await prisma.match.deleteMany({where: {round: {leagueRounds: {some: {league_id: leagueId}}}}});
  await prisma.ongoingMatch.deleteMany({where: {round: {leagueRounds: {some: {league_id: leagueId}}}}});
  await prisma.round.deleteMany({where: {leagueRounds: {some: {league_id: leagueId}}}});
  await prisma.league.delete({where: {league_id: leagueId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});

// A published table with its first match started and no hands yet; `declarations` false: a table "bez zvanja"
async function table(declarations = true) {
  const round = await prisma.round.create({
    data: {
      team1_id: teams[0],
      team2_id: teams[1],
      status: "PUBLISHED",
      published_at: new Date(),
      declarations,
      leagueRounds: {create: {league_id: leagueId}},
    },
  });
  const match = await prisma.ongoingMatch.create({data: {round_id: round.id, score_threshold: MATCH_THRESHOLD}});
  return {roundId: round.id, matchId: match.id};
}

// a normal hand of points1 : points2 with each team's [threes, fours]
const hand = (matchId: number, [points1, points2]: [number, number], [a3, a4]: [number, number] = [0, 0], [b3, b4]: [number, number] = [0, 0]) => ({
  match_id: matchId,
  team1_game_points: points1,
  team2_game_points: points2,
  ...zvanjaColumns({3: a3, 4: a4}, {3: b3, 4: b4}),
  custom: false,
});

const score = async (matchId: number) => {
  const m = await prisma.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  return [m.player_pair1_score, m.player_pair2_score];
};

// matched by name: the tests compile to an ES5 target, where instanceof doesn't work for Error subclasses
const refused = (message: RegExp) => ({name: "InvalidResultError", message});

test("a hand's zvanja are stored with it, and its total moves the match score", async () => {
  const {matchId} = await table();
  // 6 : 5 with napola and četiri asa for team 1 (7), tri dvice for team 2 (3)
  const id = await createResult(hand(matchId, [6, 5], [1, 1], [1, 0]));
  const stored = await prisma.ongoingResult.findUniqueOrThrow({where: {result_id: id}});
  assert.deepEqual([stored.team1_zvanja3, stored.team1_zvanja4, stored.team2_zvanja3, stored.team2_zvanja4], [1, 1, 1, 0]);
  assert.deepEqual(await score(matchId), [13, 8]);
});

test("a correction moves the score by the difference of the totals, and one without zvanja keeps them", async () => {
  const {matchId} = await table();
  const id = await createResult(hand(matchId, [6, 5], [2, 0]));
  assert.deepEqual(await score(matchId), [12, 5]);

  // a phone from before zvanja corrects the points only: the zvanja stay
  await updateOngoingResult({result_id: id, resultData: {match_id: matchId, team1_game_points: 4, team2_game_points: 7, custom: false}});
  const kept = await prisma.ongoingResult.findUniqueOrThrow({where: {result_id: id}});
  assert.equal(kept.team1_zvanja3, 2);
  assert.deepEqual(await score(matchId), [10, 7]);

  // new zvanja replace them
  await updateOngoingResult({result_id: id, resultData: hand(matchId, [4, 7], [0, 0], [0, 1])});
  assert.deepEqual(await score(matchId), [4, 11]);

  // made custom: no zvanja, the typed points are the total
  await updateOngoingResult({result_id: id, resultData: {match_id: matchId, team1_game_points: 9, team2_game_points: 2, custom: true}});
  const custom = await prisma.ongoingResult.findUniqueOrThrow({where: {result_id: id}});
  assert.equal(custom.team2_zvanja4, 0);
  assert.deepEqual(await score(matchId), [9, 2]);
});

test("zvanja the cards can't make are refused, and the score stays", async () => {
  const {matchId} = await table();
  // 1 × 4 against 4 × 3 can't happen at one deal
  await assert.rejects(createResult(hand(matchId, [6, 5], [0, 1], [4, 0])), refused(/Obje ekipe ne mogu/));
  await assert.rejects(createResult(hand(matchId, [6, 5], [8, 0])), refused(/Ekipa ne može/));
  await assert.rejects(
    createResult({match_id: matchId, team1_game_points: 9, team2_game_points: 2, team1_zvanja3: 1, custom: true}),
    refused(/Ručni unos nema zvanja/),
  );
  assert.deepEqual(await score(matchId), [0, 0]);
});

test("a table bez zvanja takes none, from the players or from the admin", async () => {
  const {roundId, matchId} = await table(false);
  await assert.rejects(createResult(hand(matchId, [6, 5], [1, 0])), refused(/bez zvanja/));
  await assert.rejects(addHand(roundId, {kind: "ongoing"}, {custom: false, points1: 6, points2: 5, zvanja1: {3: 1, 4: 0}}), refused(/bez zvanja/));
  // a hand without zvanja is fine
  await createResult(hand(matchId, [6, 5]));
  assert.deepEqual(await score(matchId), [6, 5]);
  assert.equal((await getTablePad(roundId)).declarations, false);
});

test("the admin's pad: totals with the zvanja, and what makes them up", async () => {
  const {roundId} = await table();
  await addHand(roundId, {kind: "ongoing"}, {custom: false, points1: 8, points2: 3, zvanja1: {3: 0, 4: 1}, zvanja2: {3: 2, 4: 0}});
  const pad = await getTablePad(roundId);
  const [h] = pad.matches[0].hands;
  assert.deepEqual([h.total1, h.total2, h.points1, h.points2], [12, 9, 8, 3]);
  assert.deepEqual([h.zvanja1, h.zvanja2], [{3: 0, 4: 1}, {3: 2, 4: 0}]);
  assert.equal(pad.declarations, true);
  assert.deepEqual([pad.matches[0].score1, pad.matches[0].score2], [12, 9]);

  // the admin corrects it, then deletes it: the score follows the totals
  await updateHand("ongoing", h.id, {custom: false, points1: 8, points2: 3, zvanja1: {3: 1, 4: 0}});
  assert.deepEqual(await score(pad.matches[0].id), [11, 3]);
  await deleteHand("ongoing", h.id);
  assert.deepEqual(await score(pad.matches[0].id), [0, 0]);
});

test("a finished match keeps its hands' zvanja, and the admin's corrections recount it", async () => {
  const {roundId, matchId} = await table();
  await createResult({match_id: matchId, team1_game_points: 30, team2_game_points: 20, custom: true});
  // 6 : 5 with tri trice for team 1: 39 : 25
  await createResult(hand(matchId, [6, 5], [1, 0]));
  // 5 : 6 with četiri trice for team 1: 48 : 31, team 1 wins
  await createResult(hand(matchId, [5, 6], [0, 1]));
  assert.deepEqual(await score(matchId), [48, 31]);
  await finishOngoingMatch(matchId);

  const finished = await prisma.match.findFirstOrThrow({where: {round_id: roundId}, include: {results: {orderBy: {result_id: "asc"}}}});
  assert.deepEqual([finished.player_pair1_score, finished.player_pair2_score, finished.winner_side], [48, 31, 1]);
  assert.deepEqual(finished.results.map((r) => [r.team1_zvanja3, r.team1_zvanja4]), [[0, 0], [1, 0], [0, 1]]);

  // the četiri trice were the other team's: 44 : 35, still team 1
  const last = finished.results[2];
  await updateHand("finished", last.result_id, {custom: false, points1: 5, points2: 6, zvanja2: {3: 0, 4: 1}});
  const recounted = await prisma.match.findUniqueOrThrow({where: {id: finished.id}});
  assert.deepEqual([recounted.player_pair1_score, recounted.player_pair2_score, recounted.winner_side], [44, 35, 1]);
});

test("the database refuses what the cards don't allow one team, and zvanja on a custom hand", async () => {
  const {matchId} = await table();
  await assert.rejects(prisma.ongoingResult.create({data: {match_id: matchId, team1_zvanja3: 8}}), /team1_zvanja_check/);
  await assert.rejects(prisma.ongoingResult.create({data: {match_id: matchId, team2_zvanja3: 1, team2_zvanja4: 3}}), /team2_zvanja_check/);
  await assert.rejects(prisma.ongoingResult.create({data: {match_id: matchId, custom: true, team1_zvanja4: 1}}), /custom_zvanja_check/);
});
