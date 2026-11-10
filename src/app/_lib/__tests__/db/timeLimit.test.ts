import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {getTablePad} from "@/app/_lib/service/admin/hands";
import {expireDueMatches, gameMinutesOf} from "@/app/_lib/service/match/timeLimit";
import {createResult, TIME_UP} from "@/app/_lib/service/ongoingResult/create";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {leagueNight} from "@/app/_lib/dates";

// Vrijeme partije against a real Postgres: a match whose time is up closes at once (no wait after the deadline) with
// the team ahead winning, a player's hand after the time is refused, a level score plays one more hand, and a raised
// target gives the match five more minutes. Run with `npm run test:db` and DATABASE_URL on a throwaway database with
// the migrations applied (it adds its own league and teams and removes them afterwards). Never point it at
// production.

const tag = `tl${Date.now()}`;
const MINUTES = 45;
// the tournament's own Vrijeme partije, different from the league's and from the default
const TOURNAMENT_MINUTES = 30;
let leagueId = 0;
let tournamentId = 0;
const teams: number[] = [];

before(async () => {
  const league = await prisma.league.create({data: {league_name: `${tag} liga`, game_minutes: MINUTES}});
  leagueId = league.league_id;
  for (const name of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    await prisma.leagueTeam.create({data: {league_id: leagueId, team_id: team.team_id}});
  }
});

after(async () => {
  await prisma.ongoingMatch.deleteMany({where: {round: {leagueRounds: {some: {league_id: leagueId}}}}});
  await prisma.round.deleteMany({where: {leagueRounds: {some: {league_id: leagueId}}}});
  await prisma.round.deleteMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}});
  await prisma.tournament.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.league.delete({where: {league_id: leagueId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});

// A published league table whose first match stands at score1:score2 — one hand carries the score, as a real match's
// hands do — with its time up this many seconds ago (negative: still running).
async function tableOutOfTime(team1: number, team2: number, score1: number, score2: number, secondsAgo: number) {
  const round = await prisma.round.create({
    data: {team1_id: team1, team2_id: team2, status: "PUBLISHED", published_at: new Date(), leagueRounds: {create: {league_id: leagueId}}},
  });
  const ends = new Date(Date.now() - secondsAgo * 1000);
  const started = new Date(ends.getTime() - MINUTES * 60_000);
  const match = await prisma.ongoingMatch.create({
    data: {
      round_id: round.id,
      score_threshold: MATCH_THRESHOLD,
      player_pair1_score: score1,
      player_pair2_score: score2,
      started_at: started,
      ends_at: ends,
      results: {create: {team1_game_points: score1, team2_game_points: score2, custom: true}},
    },
  });
  return {roundId: round.id, matchId: match.id, started, ends};
}

// a hand typed by hand (Ručni unos), so the test can put the score where it wants it
const hand = (matchId: number, points1: number, points2: number) => ({
  match_id: matchId,
  team1_game_points: points1,
  team2_game_points: points2,
  custom: true,
});

test("a second after the deadline the match is closed: the team ahead wins, the second match opens", async () => {
  const {roundId, matchId} = await tableOutOfTime(teams[0], teams[1], 29, 24, 1);
  assert.deepEqual(await expireDueMatches({roundIds: [roundId]}), [roundId]);

  assert.equal(await prisma.ongoingMatch.count({where: {id: matchId}}), 0);
  const finished = await prisma.match.findFirstOrThrow({where: {round_id: roundId}});
  assert.deepEqual([finished.player_pair1_score, finished.player_pair2_score, finished.time_expired], [29, 24, true]);
  assert.equal(finished.winner_side, 1);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.team1_wins, round.team2_wins, round.open], [1, 0, true]);
  // the second match's time counts from when it opened
  const next = await prisma.ongoingMatch.findFirstOrThrow({where: {round_id: roundId}});
  assert.ok(next.ends_at && Math.abs(next.ends_at.getTime() - (Date.now() + MINUTES * 60_000)) < 60_000);
  // the admin's scorepad shows its winner too, though nobody reached 41
  assert.deepEqual((await getTablePad(roundId)).matches.map((m) => [m.kind, m.winner]), [["finished", 1], ["ongoing", null]]);
});

test("a match whose time isn't up stays open", async () => {
  const {roundId, matchId} = await tableOutOfTime(teams[2], teams[3], 29, 24, -60);
  assert.deepEqual(await expireDueMatches({roundIds: [roundId]}), []);
  assert.equal(await prisma.ongoingMatch.count({where: {id: matchId}}), 1);
});

test("a player's hand after the deadline is refused and doesn't change the score", async () => {
  const {matchId} = await tableOutOfTime(teams[4], teams[5], 30, 20, 1);
  await assert.rejects(createResult(hand(matchId, 5, 6)), {message: TIME_UP});
  const match = await prisma.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  assert.deepEqual([match.player_pair1_score, match.player_pair2_score], [30, 20]);
});

test("an admin's hand is taken after the deadline: they enter what was played", async () => {
  const {matchId} = await tableOutOfTime(teams[6], teams[7], 30, 20, 1);
  await createResult(hand(matchId, 5, 6), (r) => r, {admin: true});
  const match = await prisma.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  assert.deepEqual([match.player_pair1_score, match.player_pair2_score], [35, 26]);
});

test("a level score after the deadline stays open for one more hand, and that hand ends the match", async () => {
  const {roundId, matchId} = await tableOutOfTime(teams[1], teams[2], 33, 33, 30);
  assert.deepEqual(await expireDueMatches({roundIds: [roundId]}), []);
  await createResult(hand(matchId, 4, 7));

  assert.equal(await prisma.ongoingMatch.count({where: {id: matchId}}), 0);
  const finished = await prisma.match.findFirstOrThrow({where: {round_id: roundId}});
  assert.deepEqual([finished.player_pair1_score, finished.player_pair2_score, finished.time_expired], [37, 40, true]);
  assert.equal(finished.winner_side, 2);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.team1_wins, round.team2_wins], [0, 1]);
});

test("the target raised to 51 gives the match five more minutes, and to 61 another five", async () => {
  // still running: its time is up in 20 minutes
  const {matchId, started} = await tableOutOfTime(teams[3], teams[4], 35, 35, -20 * 60);
  const deadline = (raises: number) => started.getTime() + (MINUTES + raises * 5) * 60_000;

  // 41:41 — level at the target, so it goes up to 51 and the clock gives five minutes
  await createResult(hand(matchId, 6, 6));
  const once = await prisma.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  assert.equal(once.ends_at?.getTime(), deadline(1));

  // 51:51 — to 61, five more
  await createResult(hand(matchId, 10, 10));
  const twice = await prisma.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  assert.equal(twice.ends_at?.getTime(), deadline(2));

  // a hand that breaks the tie leaves the target where it is, so the deadline stays
  await createResult(hand(matchId, 11, 0));
  const ahead = await prisma.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  assert.deepEqual([ahead.player_pair1_score, ahead.player_pair2_score], [62, 51]);
  assert.equal(ahead.ends_at?.getTime(), deadline(2));
});

test("a tournament's table takes its tournament's Vrijeme partije, not the default", async () => {
  const tournament = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: leagueNight(), game_minutes: TOURNAMENT_MINUTES, rounds: 3},
  });
  tournamentId = tournament.tournament_id;
  const koloTable = await prisma.round.create({
    data: {team1_id: teams[0], team2_id: teams[1], round_number: 1, round_date: leagueNight(), status: "PUBLISHED", published_at: new Date(), tournamentRounds: {create: {tournament_id: tournamentId}}},
  });
  assert.equal(await gameMinutesOf(prisma, koloTable.id), TOURNAMENT_MINUTES);

  // a table that was unlocked with its own minutes keeps those, over its tournament's
  await prisma.round.update({where: {id: koloTable.id}, data: {game_minutes: 12}});
  assert.equal(await gameMinutesOf(prisma, koloTable.id), 12);
});

test("the clock doesn't take a win from the team that called \"s ovim dosta\"", async () => {
  // 45 : 41, and team 2 called "s ovim dosta" on the hand that took it to 41: the rules give the match to team 2
  // although team 1 has more points
  const round = await prisma.round.create({
    data: {team1_id: teams[5], team2_id: teams[0], status: "PUBLISHED", published_at: new Date(), leagueRounds: {create: {league_id: leagueId}}},
  });
  const ends = new Date(Date.now() - 1000);
  const match = await prisma.ongoingMatch.create({
    data: {
      round_id: round.id,
      score_threshold: MATCH_THRESHOLD,
      player_pair1_score: 45,
      player_pair2_score: 41,
      started_at: new Date(ends.getTime() - MINUTES * 60_000),
      ends_at: ends,
      results: {
        create: [
          {team1_game_points: 45, team2_game_points: 30, custom: true},
          {team1_game_points: 0, team2_game_points: 11, custom: true, dosta_side: 2},
        ],
      },
    },
  });

  assert.deepEqual(await expireDueMatches({roundIds: [round.id]}), [round.id]);
  const finished = await prisma.match.findFirstOrThrow({where: {round_id: round.id}});
  assert.equal(await prisma.ongoingMatch.count({where: {id: match.id}}), 0);
  // the caller wins, and the clock didn't decide it
  assert.deepEqual([finished.winner_side, finished.time_expired], [2, false]);
  const closed = await prisma.round.findUniqueOrThrow({where: {id: round.id}});
  assert.deepEqual([closed.team1_wins, closed.team2_wins], [0, 1]);
});
