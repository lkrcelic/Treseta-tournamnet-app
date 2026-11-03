import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {finishOngoingMatch} from "@/app/_lib/service/match/finishOngoingMatch";
import {deleteHand, updateHand} from "@/app/_lib/service/admin/hands";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";

// The admin scorepad changing a finished league round against a real Postgres: a change that would leave a match
// without a winner is refused and the round, its matches and the standings stay as they were; a change that keeps the
// winner recounts the match. Run with `npm run test:db` on a throwaway database (never production).

const tag = `fm${Date.now()}`;
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
  await prisma.round.deleteMany({where: {leagueRounds: {some: {league_id: leagueId}}}});
  await prisma.league.delete({where: {league_id: leagueId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});

// plays the round's open match hand by hand (custom hands) and taps Završi meč
async function playMatch(roundId: number, hands: [number, number][]) {
  const match = await prisma.ongoingMatch.findFirst({where: {round_id: roundId}})
    ?? await prisma.ongoingMatch.create({data: {round_id: roundId, score_threshold: MATCH_THRESHOLD}});
  for (const [a, b] of hands) {
    await prisma.ongoingResult.create({data: {match_id: match.id, team1_game_points: a, team2_game_points: b, custom: true}});
  }
  const sum = (i: 0 | 1) => hands.reduce((s, h) => s + h[i], 0);
  await prisma.ongoingMatch.update({where: {id: match.id}, data: {player_pair1_score: sum(0), player_pair2_score: sum(1)}});
  return finishOngoingMatch(match.id);
}

const state = async (roundId: number) => {
  const round = await prisma.round.findUniqueOrThrow({
    where: {id: roundId},
    include: {matches: {orderBy: {id: "asc"}, include: {results: {orderBy: {result_id: "asc"}}}}},
  });
  const score = await prisma.teamScore.findUniqueOrThrow({where: {team_id_league_id: {team_id: teams[0], league_id: leagueId}}, select: {wins: true, draws: true, score: true}});
  return {round, score};
};

test("deleting the hand that took a 2:0 winner over 41 is refused and nothing changes", async () => {
  const round = await prisma.round.create({
    data: {team1_id: teams[0], team2_id: teams[1], status: "PUBLISHED", published_at: new Date(), leagueRounds: {create: {league_id: leagueId}}},
  });
  await playMatch(round.id, [[30, 20], [11, 0]]);
  await playMatch(round.id, [[41, 30]]);
  const before = await state(round.id);
  assert.deepEqual([before.round.team1_wins, before.round.team2_wins, before.round.open], [2, 0, false]);
  assert.deepEqual(before.score, {wins: 1, draws: 0, score: 2});

  const lastHand = before.round.matches[0].results[1];
  await assert.rejects(deleteHand("finished", lastHand.result_id), /Meč bi ostao bez pobjednika \(30:20, nitko nema 41\)/);
  await assert.rejects(updateHand("finished", lastHand.result_id, {custom: true, points1: 0, points2: 10}), /bez pobjednika/);

  const after = await state(round.id);
  assert.deepEqual([after.round.team1_wins, after.round.team2_wins], [2, 0]);
  assert.deepEqual([after.round.matches[0].player_pair1_score, after.round.matches[0].player_pair2_score], [41, 20]);
  assert.equal(after.round.matches[0].results.length, 2);
  assert.deepEqual(after.score, {wins: 1, draws: 0, score: 2});

  // a typo fixed that keeps the winner over 41 is recounted
  await updateHand("finished", lastHand.result_id, {custom: true, points1: 13, points2: 2});
  const fixed = await state(round.id);
  assert.deepEqual([fixed.round.matches[0].player_pair1_score, fixed.round.matches[0].player_pair2_score], [43, 22]);
  assert.deepEqual([fixed.round.team1_wins, fixed.round.team2_wins], [2, 0]);
  assert.deepEqual(fixed.score, {wins: 1, draws: 0, score: 2});
});
