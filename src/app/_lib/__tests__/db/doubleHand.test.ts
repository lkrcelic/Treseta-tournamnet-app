import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {createResult} from "@/app/_lib/service/ongoingResult/create";
import {HANDS_CHANGED} from "@/app/_lib/validation/validateResult";

// The same hand from two phones at one table: the wizard sends the hands its board held (expected_hands), so a hand
// saved from the other phone meanwhile holds the save back (HandsChangedWarning) instead of counting the hand twice.
// Run with `npm run test:db` and DATABASE_URL on a throwaway database with the migrations applied (it adds its own
// league, teams and tables and removes them afterwards). Never point it at production.

const tag = `dh${Date.now()}`;
let leagueId = 0;
const teams: number[] = [];

before(async () => {
  const league = await prisma.league.create({data: {league_name: `${tag} liga`, game_minutes: 35}});
  leagueId = league.league_id;
  for (const name of ["A", "B", "C", "D"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    await prisma.leagueTeam.create({data: {league_id: leagueId, team_id: team.team_id}});
  }
});

after(async () => {
  await prisma.ongoingMatch.deleteMany({where: {round: {leagueRounds: {some: {league_id: leagueId}}}}});
  await prisma.round.deleteMany({where: {leagueRounds: {some: {league_id: leagueId}}}});
  await prisma.league.delete({where: {league_id: leagueId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});

// a published league table with its first match (to 41) being played, 35 minutes left
async function table(team1: number, team2: number) {
  const round = await prisma.round.create({
    data: {team1_id: team1, team2_id: team2, status: "PUBLISHED", published_at: new Date(), leagueRounds: {create: {league_id: leagueId}}},
  });
  const match = await prisma.ongoingMatch.create({
    data: {round_id: round.id, score_threshold: 41, player_pair1_score: 0, player_pair2_score: 0, started_at: new Date(), ends_at: new Date(Date.now() + 35 * 60_000)},
  });
  return match.id;
}

// the hand of the issue, on Treseta's hands: 8 for team 1, 3 for team 2
function hand(matchId: number, expectedHands?: number) {
  return {
    match_id: matchId,
    team1_game_points: 8,
    team2_game_points: 3,
    custom: false,
    ...(expectedHands === undefined ? {} : {expected_hands: expectedHands}),
  };
}

async function score(matchId: number) {
  const match = await prisma.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  return [match.player_pair1_score, match.player_pair2_score, await prisma.ongoingResult.count({where: {match_id: matchId}})];
}

test("the second phone's hand, entered from a board without the first hand, is held back", async () => {
  const matchId = await table(teams[0], teams[1]);
  // phone A: its board was empty and its hand is the first one
  assert.equal(typeof (await createResult(hand(matchId, 0))), "number");
  // phone B had the same empty board, so its save is the same hand again
  await assert.rejects(createResult(hand(matchId, 0)), {name: "HandsChangedWarning", message: HANDS_CHANGED});
  assert.deepEqual(await score(matchId), [8, 3, 1]);
});

test("the player's confirmation (no hand count) saves the hand, and so does a board that is up to date", async () => {
  const matchId = await table(teams[2], teams[3]);
  assert.equal(typeof (await createResult(hand(matchId, 0))), "number");
  // "Upiši i ovu": the same hand again, this time without expected_hands
  assert.equal(typeof (await createResult(hand(matchId))), "number");
  // a wizard opened on the board of two hands saves a third
  assert.equal(typeof (await createResult(hand(matchId, 2))), "number");
  assert.deepEqual(await score(matchId), [24, 9, 3]);
});

test("the hand of an admin's scorepad carries no hand count and is never held back", async () => {
  const matchId = await table(teams[0], teams[2]);
  assert.equal(typeof (await createResult(hand(matchId), (r) => r, {admin: true})), "number");
  assert.equal(typeof (await createResult(hand(matchId), (r) => r, {admin: true})), "number");
  assert.deepEqual(await score(matchId), [16, 6, 2]);
});
