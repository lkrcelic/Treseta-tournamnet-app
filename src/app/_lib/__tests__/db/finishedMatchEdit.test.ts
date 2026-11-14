import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {finishOngoingMatch} from "@/app/_lib/service/match/finishOngoingMatch";
import {deleteHand, updateHand} from "@/app/_lib/service/admin/hands";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {leagueNight} from "@/app/_lib/dates";

// The admin scorepad changing a finished league round against a real Postgres: a change that would leave a match
// without a winner is held back (NoWinnerWarning) and the round, its matches and the standings stay as they were until
// the admin confirms it; a change that keeps the winner recounts the match. Run with `npm run test:db` on a throwaway database (never production).

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

test("deleting the hand that took a 2:0 winner over 41 asks first, and saves once confirmed", async () => {
  const round = await prisma.round.create({
    data: {team1_id: teams[0], team2_id: teams[1], status: "PUBLISHED", published_at: new Date(), leagueRounds: {create: {league_id: leagueId}}},
  });
  await playMatch(round.id, [[30, 20], [11, 0]]);
  await playMatch(round.id, [[41, 30]]);
  const before = await state(round.id);
  assert.deepEqual([before.round.team1_wins, before.round.team2_wins, before.round.open], [2, 0, false]);
  assert.deepEqual(before.score, {wins: 1, draws: 0, score: 2});

  const lastHand = before.round.matches[0].results[1];
  await assert.rejects(deleteHand("finished", lastHand.result_id), (e: Error) => e.name === "NoWinnerWarning" && /meč je 30:20 i nitko nema 41/.test(e.message));
  await assert.rejects(updateHand("finished", lastHand.result_id, {custom: true, points1: 0, points2: 10}), {name: "NoWinnerWarning"});

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

  // confirmed (Obriši svejedno): the match is left at 30:20 without a winner, the round reads 1:0 and is still a win
  await deleteHand("finished", lastHand.result_id, {allowNoWinner: true});
  const confirmed = await state(round.id);
  assert.deepEqual([confirmed.round.matches[0].player_pair1_score, confirmed.round.matches[0].player_pair2_score], [30, 20]);
  assert.equal(confirmed.round.matches[0].results.length, 1);
  assert.deepEqual([confirmed.round.team1_wins, confirmed.round.team2_wins], [1, 0]);
  assert.deepEqual(confirmed.score, {wins: 1, draws: 0, score: 2});
});

// A league table of Kolo `number`, published, of tonight (or of another night)
const table = (number: number | null = null, night = leagueNight()) =>
  prisma.round.create({
    data: {round_number: number, round_date: night, team1_id: teams[0], team2_id: teams[1], status: "PUBLISHED", published_at: new Date(), leagueRounds: {create: {league_id: leagueId}}},
  });

test("a match closed with time left that no team has won any more goes back in play, with the time it had left", async () => {
  const round = await table(901);
  await playMatch(round.id, [[30, 20], [11, 0]]);
  const [match] = await prisma.match.findMany({where: {round_id: round.id}, include: {results: {orderBy: {result_id: "asc"}}}});
  // it was closed 10 minutes after it started
  await prisma.match.update({where: {id: match.id}, data: {start_time: new Date(Date.now() - 10 * 60_000), end_time: new Date()}});

  const outcome = await deleteHand("finished", match.results[1].result_id);
  assert.deepEqual(outcome, {reopened: true});
  const after = await prisma.round.findUniqueOrThrow({where: {id: round.id}, include: {matches: true, ongoingMatches: {include: {results: true}}}});
  assert.equal(after.matches.length, 0);
  assert.deepEqual([after.team1_wins, after.team2_wins, after.open], [0, 0, true]);
  // the empty second match is gone: the first one is played again, with its hand
  assert.equal(after.ongoingMatches.length, 1);
  const ongoing = after.ongoingMatches[0];
  assert.deepEqual([ongoing.player_pair1_score, ongoing.player_pair2_score, ongoing.results.length], [30, 20, 1]);
  // 45 minutes, 10 of them played: about 35 left
  const left = (ongoing.ends_at!.getTime() - Date.now()) / 60_000;
  assert.ok(left > 34 && left <= 35.1, `${left} minutes left`);
});

test("a closed table goes back in play: the standings no longer count it", async () => {
  const round = await table(902);
  const scoreBefore = await prisma.teamScore.findUnique({where: {team_id_league_id: {team_id: teams[0], league_id: leagueId}}, select: {wins: true}});
  await playMatch(round.id, [[41, 30]]);
  await playMatch(round.id, [[30, 20], [11, 0]]);
  const closed = await prisma.round.findUniqueOrThrow({where: {id: round.id}, include: {matches: {orderBy: {id: "asc"}, include: {results: {orderBy: {result_id: "asc"}}}}}});
  assert.equal(closed.open, false);
  const scoreClosed = await prisma.teamScore.findUniqueOrThrow({where: {team_id_league_id: {team_id: teams[0], league_id: leagueId}}, select: {wins: true}});
  assert.equal(scoreClosed.wins, (scoreBefore?.wins ?? 0) + 1);

  const outcome = await updateHand("finished", closed.matches[1].results[1].result_id, {custom: true, points1: 5, points2: 0});
  assert.deepEqual(outcome, {reopened: true});
  const after = await prisma.round.findUniqueOrThrow({where: {id: round.id}, include: {matches: true, ongoingMatches: true}});
  assert.deepEqual([after.matches.length, after.ongoingMatches.length, after.team1_wins, after.team2_wins, after.open, after.active], [1, 1, 1, 0, true, true]);
  assert.deepEqual([after.ongoingMatches[0].player_pair1_score, after.ongoingMatches[0].player_pair2_score], [35, 20]);
  const scoreAfter = await prisma.teamScore.findUniqueOrThrow({where: {team_id_league_id: {team_id: teams[0], league_id: leagueId}}, select: {wins: true}});
  assert.equal(scoreAfter.wins, scoreBefore?.wins ?? 0);
});

test("a match stays closed without a winner once the next Kolo is made, or the next match has a hand", async () => {
  // the next match already has a hand
  const busy = await table(903);
  await playMatch(busy.id, [[30, 20], [11, 0]]);
  const next = await prisma.ongoingMatch.findFirstOrThrow({where: {round_id: busy.id}});
  await prisma.ongoingResult.create({data: {match_id: next.id, team1_game_points: 6, team2_game_points: 5}});
  const [m1] = await prisma.match.findMany({where: {round_id: busy.id}, include: {results: {orderBy: {result_id: "asc"}}}});
  await assert.rejects(deleteHand("finished", m1.results[1].result_id), (e: Error) => e.name === "NoWinnerWarning" && /Za stolom se već igra sljedeći meč/.test(e.message));
  assert.deepEqual(await deleteHand("finished", m1.results[1].result_id, {allowNoWinner: true}), {reopened: false});
  const kept = await prisma.match.findUniqueOrThrow({where: {id: m1.id}});
  assert.deepEqual([kept.player_pair1_score, kept.winner_side], [30, null]);

  // a later Kolo of the league exists (a draft counts)
  const early = await table(904);
  await playMatch(early.id, [[30, 20], [11, 0]]);
  await prisma.round.create({data: {round_number: 905, team1_id: teams[0], team2_id: teams[1], status: "DRAFT", draft_order: 1, leagueRounds: {create: {league_id: leagueId}}}});
  const [m2] = await prisma.match.findMany({where: {round_id: early.id}, include: {results: {orderBy: {result_id: "asc"}}}});
  await assert.rejects(deleteHand("finished", m2.results[1].result_id), (e: Error) => e.name === "NoWinnerWarning" && /Sljedeće kolo je već složeno/.test(e.message));
});

test("a match of an earlier night, or one with no time left, stays closed for the admin to add its hands", async () => {
  // a table of last week, the league's last Kolo so far
  const old = await table(906, new Date(leagueNight().getTime() - 7 * 86_400_000));
  await playMatch(old.id, [[30, 20], [11, 0]]);
  const [m1] = await prisma.match.findMany({where: {round_id: old.id}, include: {results: {orderBy: {result_id: "asc"}}}});
  await assert.rejects(deleteHand("finished", m1.results[1].result_id), (e: Error) => e.name === "NoWinnerWarning" && /Stol nije od večeras/.test(e.message));

  // tonight's, but its 45 minutes were used up when it was closed
  const late = await table(907);
  await playMatch(late.id, [[30, 20], [11, 0]]);
  const [m2] = await prisma.match.findMany({where: {round_id: late.id}, include: {results: {orderBy: {result_id: "asc"}}}});
  await prisma.match.update({where: {id: m2.id}, data: {start_time: new Date(Date.now() - 50 * 60_000), end_time: new Date()}});
  await assert.rejects(deleteHand("finished", m2.results[1].result_id), (e: Error) => e.name === "NoWinnerWarning" && /Meču je vrijeme već isteklo/.test(e.message));
  assert.equal(await prisma.ongoingResult.count({where: {match: {round_id: late.id}}}), 0);
});

test("a match closed by Vrijeme partije goes to the team with more points, and a level score asks first", async () => {
  const round = await table(null);
  const match = await prisma.match.create({
    data: {
      round_id: round.id,
      player_pair1_score: 25,
      player_pair2_score: 20,
      score_threshold: MATCH_THRESHOLD,
      winner_side: 1,
      time_expired: true,
      results: {create: [{team1_game_points: 20, team2_game_points: 15, custom: true}, {team1_game_points: 5, team2_game_points: 5, custom: true}]},
    },
    include: {results: {orderBy: {result_id: "asc"}}},
  });
  await prisma.round.update({where: {id: round.id}, data: {team1_wins: 1}});

  // the other team now has more points: the win moves, no question and no reopening
  assert.deepEqual(await updateHand("finished", match.results[1].result_id, {custom: true, points1: 0, points2: 10}), {reopened: false});
  let after = await prisma.match.findUniqueOrThrow({where: {id: match.id}, include: {round: true}});
  assert.deepEqual([after.player_pair1_score, after.player_pair2_score, after.winner_side, after.round!.team1_wins, after.round!.team2_wins], [20, 25, 2, 0, 1]);

  // level: asked first, then left without a winner
  await assert.rejects(updateHand("finished", match.results[1].result_id, {custom: true, points1: 5, points2: 10}), {name: "NoWinnerWarning"});
  await updateHand("finished", match.results[1].result_id, {custom: true, points1: 5, points2: 10}, {allowNoWinner: true});
  after = await prisma.match.findUniqueOrThrow({where: {id: match.id}, include: {round: true}});
  assert.deepEqual([after.player_pair1_score, after.player_pair2_score, after.winner_side, after.round!.team1_wins, after.round!.team2_wins], [25, 25, null, 0, 0]);
  assert.equal(await prisma.ongoingMatch.count({where: {round_id: round.id}}), 0);
});
