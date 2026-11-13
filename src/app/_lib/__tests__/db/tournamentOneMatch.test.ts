import assert from "node:assert/strict";
import {after, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {makeKoloDraft, publishKolo} from "@/app/_lib/service/tournament/kola";
import {dropDrafts} from "@/app/_lib/service/tournament/tournaments";
import {createOngoingMatch} from "@/app/_lib/service/ongoingMatch/create";
import {finishOngoingMatch} from "@/app/_lib/service/match/finishOngoingMatch";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {leagueNight} from "@/app/_lib/dates";

// A tournament of one match per Kolo against a real Postgres: its table closes after the first match (no second one
// opens), a table that opened a second match before the fix closes with the match it played, and a tournament switched
// from two matches to one while it is played gives its next Kolo tables of one match. Run with `npm run test:db` and
// DATABASE_URL on a throwaway database with the migrations applied. Never point it at production.

const tag = `om${Date.now()}`;
const tournaments: number[] = [];
const teams: number[] = [];

async function tournament(matches: number) {
  const t = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir ${matches}`, date: leagueNight(), rounds: 3, matches_per_round: matches, registrations_open: false},
  });
  tournaments.push(t.tournament_id);
  for (const name of ["A", "B"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${t.tournament_id} ${name}`}});
    teams.push(team.team_id);
    await prisma.tournamentTeam.create({data: {tournament_id: t.tournament_id, team_id: team.team_id, arrived_at: new Date()}});
  }
  return t.tournament_id;
}

async function tables(tournamentId: number, kolo: number) {
  return prisma.round.findMany({
    where: {tournamentRounds: {some: {tournament_id: tournamentId}}, round_number: kolo, status: "PUBLISHED"},
    select: {id: true, matches_per_round: true},
  });
}

// plays the table's open match to 41 : 20 (one custom hand) and taps Završi meč
async function play(matchId: number) {
  await prisma.ongoingResult.create({data: {match_id: matchId, team1_game_points: 41, team2_game_points: 20, custom: true}});
  await prisma.ongoingMatch.update({where: {id: matchId}, data: {player_pair1_score: 41, player_pair2_score: 20}});
  return finishOngoingMatch(matchId);
}

after(async () => {
  const rounds = {round: {tournamentRounds: {some: {tournament_id: {in: tournaments}}}}};
  await prisma.match.deleteMany({where: rounds});
  await prisma.ongoingMatch.deleteMany({where: rounds});
  await prisma.round.deleteMany({where: {tournamentRounds: {some: {tournament_id: {in: tournaments}}}}});
  await prisma.tournament.deleteMany({where: {tournament_id: {in: tournaments}}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});


test("one match per Kolo: 1 : 0 closes the table, no second match opens, nor can one be started", async () => {
  const id = await tournament(1);
  await makeKoloDraft(id);
  await publishKolo(id, 1);
  const [table] = await tables(id, 1);
  assert.equal(table.matches_per_round, 1);

  const match = await createOngoingMatch({round_id: table.id, score_threshold: MATCH_THRESHOLD});
  const outcome = await play(match.id);
  assert.deepEqual(outcome, {roundId: table.id, roundFinished: true, nextOngoingMatchId: null});

  const closed = await prisma.round.findUniqueOrThrow({where: {id: table.id}});
  assert.deepEqual([closed.team1_wins, closed.team2_wins, closed.open], [1, 0, false]);
  assert.equal(await prisma.ongoingMatch.count({where: {round_id: table.id}}), 0);
  assert.equal(await prisma.match.count({where: {round_id: table.id}}), 1);
  await assert.rejects(createOngoingMatch({round_id: table.id, score_threshold: MATCH_THRESHOLD}), /već/);
});

test("a table stuck on a second match (before the fix) closes with the match it played", async () => {
  const id = await tournament(1);
  await makeKoloDraft(id);
  await publishKolo(id, 1);
  const [table] = await tables(id, 1);

  // what production holds: 1 : 0 stored, the round still open, a second match opened
  const first = await createOngoingMatch({round_id: table.id, score_threshold: MATCH_THRESHOLD});
  await prisma.ongoingResult.create({data: {match_id: first.id, team1_game_points: 41, team2_game_points: 20, custom: true}});
  await prisma.ongoingMatch.update({where: {id: first.id}, data: {player_pair1_score: 41, player_pair2_score: 20}});
  await prisma.round.update({where: {id: table.id}, data: {matches_per_round: 2}});
  const opened = await finishOngoingMatch(first.id);
  assert.ok(opened.nextOngoingMatchId);
  await prisma.round.update({where: {id: table.id}, data: {matches_per_round: 1}});

  // the second match is played to the end: the table closes 1 : 0, the extra match is not stored
  const outcome = await play(opened.nextOngoingMatchId!);
  assert.deepEqual(outcome, {roundId: table.id, roundFinished: true, nextOngoingMatchId: null});
  const closed = await prisma.round.findUniqueOrThrow({where: {id: table.id}});
  assert.deepEqual([closed.team1_wins, closed.team2_wins, closed.open], [1, 0, false]);
  assert.equal(await prisma.match.count({where: {round_id: table.id}}), 1);
  assert.equal(await prisma.ongoingMatch.count({where: {round_id: table.id}}), 0);
});

test("switched from two matches to one while it is played: the next Kolo's tables play one match", async () => {
  const id = await tournament(2);
  await makeKoloDraft(id);
  await publishKolo(id, 1);
  const [kolo1] = await tables(id, 1);
  assert.equal(kolo1.matches_per_round, 2);

  // the admin's edit of a started tournament (updateTournament): the format is saved, the next Kolo's draft goes
  await prisma.$transaction(async (tx) => {
    await tx.tournament.update({where: {tournament_id: id}, data: {matches_per_round: 1}});
    await dropDrafts(tx, id);
  });

  // Kolo 1 keeps its two matches
  const m1 = await createOngoingMatch({round_id: kolo1.id, score_threshold: MATCH_THRESHOLD});
  const after1 = await play(m1.id);
  assert.equal(after1.roundFinished, false);
  assert.equal((await play(after1.nextOngoingMatchId!)).roundFinished, true);

  // Kolo 2 is made with one match and closes after it
  await makeKoloDraft(id);
  await publishKolo(id, 2);
  const [kolo2] = await tables(id, 2);
  assert.equal(kolo2.matches_per_round, 1);
  const m2 = await createOngoingMatch({round_id: kolo2.id, score_threshold: MATCH_THRESHOLD});
  assert.deepEqual(await play(m2.id), {roundId: kolo2.id, roundFinished: true, nextOngoingMatchId: null});
});
