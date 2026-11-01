import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {finishOngoingMatch} from "@/app/_lib/service/match/finishOngoingMatch";
import {closeRound} from "@/app/_lib/service/round/finish";
import {createByeMatches} from "@/app/_lib/service/round/insertPairRounds";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {BYE_MATCH_POINTS, MATCH_THRESHOLD} from "@/app/_lib/game/scoring";

// Closing a round against a real Postgres: finishOngoingMatch stores the matches, closeRound runs update_team_score
// (the latest one of the migrations) and the TeamScore rows say 2 points for a 2:0 win, 1 each for a 1:1 draw and a
// bye counts as a win. Run with `npm run test:db` and DATABASE_URL on a throwaway database with the migrations applied
// (it adds its own league and teams and removes them afterwards). Never point it at production.

const tag = `rc${Date.now()}`;
let leagueId = 0;
const teams: number[] = [];

before(async () => {
  const league = await prisma.league.create({data: {league_name: `${tag} liga`}});
  leagueId = league.league_id;
  for (const name of ["A", "B", "C", "D", "E"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    await prisma.leagueTeam.create({data: {league_id: leagueId, team_id: team.team_id}});
  }
  await prisma.team.upsert({where: {team_id: BYE_TEAM_ID}, update: {}, create: {team_id: BYE_TEAM_ID, team_name: `${tag} Bye`}});
});

after(async () => {
  await prisma.round.deleteMany({where: {leagueRounds: {some: {league_id: leagueId}}}});
  await prisma.league.delete({where: {league_id: leagueId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});

async function publishedRound(team1: number, team2: number, extra: object = {}) {
  return prisma.round.create({
    data: {team1_id: team1, team2_id: team2, status: "PUBLISHED", published_at: new Date(), leagueRounds: {create: {league_id: leagueId}}, ...extra},
  });
}

// plays the round's open match to the given score (one custom hand) and taps Završi meč
async function playMatch(roundId: number, score1: number, score2: number) {
  const match = await prisma.ongoingMatch.findFirst({where: {round_id: roundId}})
    ?? await prisma.ongoingMatch.create({data: {round_id: roundId, score_threshold: MATCH_THRESHOLD}});
  await prisma.ongoingResult.create({data: {match_id: match.id, team1_game_points: score1, team2_game_points: score2, custom: true}});
  await prisma.ongoingMatch.update({where: {id: match.id}, data: {player_pair1_score: score1, player_pair2_score: score2}});
  return finishOngoingMatch(match.id);
}

async function score(teamId: number) {
  return prisma.teamScore.findUniqueOrThrow({
    where: {team_id_league_id: {team_id: teamId, league_id: leagueId}},
    select: {rounds_played: true, wins: true, draws: true, losses: true, point_difference: true, score: true},
  });
}

test("2:0: the first match opens the second, the second closes the round and the winner gets 2 points", async () => {
  const round = await publishedRound(teams[0], teams[1]);
  const first = await playMatch(round.id, 41, 20);
  assert.equal(first.roundFinished, false);
  assert.ok(first.nextOngoingMatchId);
  assert.equal(await prisma.teamScore.count({where: {team_id: teams[0], league_id: leagueId}}), 0);

  const second = await playMatch(round.id, 45, 30);
  assert.deepEqual(second, {roundId: round.id, roundFinished: true, nextOngoingMatchId: null});

  const closed = await prisma.round.findUniqueOrThrow({where: {id: round.id}});
  assert.deepEqual([closed.team1_wins, closed.team2_wins, closed.open, closed.active], [2, 0, false, false]);
  assert.deepEqual(await score(teams[0]), {rounds_played: 1, wins: 1, draws: 0, losses: 0, point_difference: 36, score: 2});
  assert.deepEqual(await score(teams[1]), {rounds_played: 1, wins: 0, draws: 0, losses: 1, point_difference: -36, score: 0});
});

test("1:1 is a draw: 1 point each", async () => {
  const round = await publishedRound(teams[2], teams[3]);
  await playMatch(round.id, 41, 35);
  const second = await playMatch(round.id, 30, 44);
  assert.equal(second.roundFinished, true);

  const closed = await prisma.round.findUniqueOrThrow({where: {id: round.id}});
  assert.deepEqual([closed.team1_wins, closed.team2_wins], [1, 1]);
  assert.deepEqual(await score(teams[2]), {rounds_played: 1, wins: 0, draws: 1, losses: 0, point_difference: -8, score: 1});
  assert.deepEqual(await score(teams[3]), {rounds_played: 1, wins: 0, draws: 1, losses: 0, point_difference: 8, score: 1});
});

test("a match below the threshold is refused and the round stays open", async () => {
  const round = await publishedRound(teams[0], teams[2]);
  await assert.rejects(playMatch(round.id, 30, 20), /Nijedna ekipa još nije došla do 41/);
  const open = await prisma.round.findUniqueOrThrow({where: {id: round.id}});
  assert.deepEqual([open.team1_wins, open.team2_wins, open.open], [0, 0, true]);
  await prisma.ongoingMatch.deleteMany({where: {round_id: round.id}});
  await prisma.round.delete({where: {id: round.id}});
});

test("a bye round counts as a 2:0 win for the real team", async () => {
  const round = await publishedRound(teams[4], BYE_TEAM_ID, {team1_wins: 2, team2_wins: 0});
  await prisma.$transaction(async (tx) => {
    await createByeMatches(tx, round.id, teams[4], new Date());
    await closeRound(tx, round.id);
  }, {timeout: 20000});
  assert.deepEqual(await score(teams[4]), {rounds_played: 1, wins: 1, draws: 0, losses: 0, point_difference: 2 * BYE_MATCH_POINTS, score: 2});
});

test("a draft round doesn't move the standings until it is published", async () => {
  const round = await publishedRound(teams[1], teams[3], {status: "DRAFT", published_at: null});
  await playMatch(round.id, 41, 0);
  await playMatch(round.id, 41, 0);
  assert.deepEqual(await score(teams[1]), {rounds_played: 1, wins: 0, draws: 0, losses: 1, point_difference: -36, score: 0});
});
