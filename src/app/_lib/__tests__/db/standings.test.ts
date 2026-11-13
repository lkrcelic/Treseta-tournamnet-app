import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {finishOngoingMatch} from "@/app/_lib/service/match/finishOngoingMatch";
import {closeRound} from "@/app/_lib/service/round/finish";
import {createByeMatches} from "@/app/_lib/service/round/insertPairRounds";
import {getLeagueStandings, standingsUntil} from "@/app/_lib/service/league/getStandings";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";

// Ukupni poredak against a real Postgres: the numbers of the table come from TeamScore (update_team_score, the latest
// one of the migrations) and the +/− from standingsUntil's own SQL. Both write "win 2, draw 1" (LEAGUE_WIN_POINTS in
// leagueOrder.ts); this checks they agree on two nights of wins, draws, a loss and a bye, and that getLeagueStandings
// orders them by points, then difference, with a team that hasn't played listed last with zeros. Run with
// `npm run test:db` and DATABASE_URL on a throwaway database with the migrations applied. Never point it at production.

const tag = `st${Date.now()}`;
let leagueId = 0;
const teams: number[] = [];
const [night1, night2] = ["2025-01-07", "2025-01-14"];

before(async () => {
  const league = await prisma.league.create({data: {league_name: `${tag} liga`}});
  leagueId = league.league_id;
  for (const name of ["A", "B", "C", "D", "E", "F"]) {
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

const publishedRound = (team1: number, team2: number, night: string, extra: object = {}) =>
  prisma.round.create({
    data: {team1_id: team1, team2_id: team2, round_date: new Date(`${night}T00:00:00Z`), status: "PUBLISHED", published_at: new Date(), leagueRounds: {create: {league_id: leagueId}}, ...extra},
  });

// plays the round's two matches to these scores, each as one custom hand; the second closes the round
async function play(team1: number, team2: number, night: string, matches: [number, number][]) {
  const round = await publishedRound(team1, team2, night);
  for (const [s1, s2] of matches) {
    const match = await prisma.ongoingMatch.findFirst({where: {round_id: round.id}})
      ?? await prisma.ongoingMatch.create({data: {round_id: round.id, score_threshold: MATCH_THRESHOLD}});
    await prisma.ongoingResult.create({data: {match_id: match.id, team1_game_points: s1, team2_game_points: s2, custom: true}});
    await prisma.ongoingMatch.update({where: {id: match.id}, data: {player_pair1_score: s1, player_pair2_score: s2}});
    await finishOngoingMatch(match.id);
  }
}

async function bye(team: number, night: string) {
  const round = await publishedRound(team, BYE_TEAM_ID, night, {team1_wins: 2, team2_wins: 0});
  await prisma.$transaction(async (tx) => {
    await createByeMatches(tx, round.id, team, new Date());
    await closeRound(tx, round.id);
  }, {timeout: 20000});
}

// what TeamScore holds, in standingsUntil's shape (without the bye's own row, which the standings leave out)
async function stored(): Promise<Map<number, {rounds_played: number; score: number; point_difference: number}>> {
  const rows = await prisma.teamScore.findMany({where: {league_id: leagueId, team_id: {not: BYE_TEAM_ID}}, select: {team_id: true, rounds_played: true, score: true, point_difference: true}});
  return new Map(rows.map(({team_id, ...totals}) => [team_id, totals]));
}

test("standingsUntil counts the points as TeamScore does, night by night", async () => {
  const [A, B, C, D, E] = teams;
  // night 1: A beats B 2:0, C and D draw 1:1, E has the bye
  await play(A, B, night1, [[41, 20], [41, 30]]);
  await play(C, D, night1, [[41, 35], [30, 41]]);
  await bye(E, night1);

  assert.deepEqual(await standingsUntil(leagueId, night1), await stored());
  assert.deepEqual(Object.fromEntries(await standingsUntil(leagueId, night1)), {
    [A]: {rounds_played: 1, score: 2, point_difference: 32},
    [B]: {rounds_played: 1, score: 0, point_difference: -32},
    [C]: {rounds_played: 1, score: 1, point_difference: -5},
    [D]: {rounds_played: 1, score: 1, point_difference: 5},
    [E]: {rounds_played: 1, score: 2, point_difference: 10},
  });

  // night 2: B beats C 2:0, A and E draw 1:1, D has the bye
  await play(B, C, night2, [[41, 0], [41, 0]]);
  await play(A, E, night2, [[41, 39], [39, 41]]);
  await bye(D, night2);

  assert.deepEqual(await standingsUntil(leagueId, night2), await stored());
  // the night before still reads as it was
  assert.equal((await standingsUntil(leagueId, night1)).get(B)?.score, 0);
});

test("getLeagueStandings: points, then the difference, and a team that hasn't played last with zeros", async () => {
  const [A, B, C, D, E, F] = teams;
  const rows = await getLeagueStandings(leagueId);
  // A, D and E have 3 points each, so the difference orders them: 32, 15 (draw + bye), 10 (bye + draw)
  assert.deepEqual(rows.map((r) => [r.team_id, r.score, r.point_difference]), [
    [A, 3, 32],
    [D, 3, 15],
    [E, 3, 10],
    [B, 2, 50],
    [C, 1, -87],
    [F, 0, 0],
  ]);
});
