import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {answerAttendance, restoreTable, skipDueTables} from "@/app/_lib/service/tournament/attendance";
import {NO_SHOW_SCORE} from "@/app/_lib/tournamentDay";
import {BYE_MATCH_POINTS, MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {leagueNight} from "@/app/_lib/dates";

// Nedolazak za stol against a real Postgres: "Ne, nisu došli" scores every match of the table as a Slobodna runda is
// scored (5:0 at threshold 41, with the winner stored), closes the table and puts the absent team out of the rest of
// the tournament. Run with `npm run test:db` and DATABASE_URL on a throwaway database with the migrations applied.

const tag = `at${Date.now()}`;
let tournamentId = 0;
let roundId = 0;
const teams: number[] = [];
const players: number[] = [];

before(async () => {
  const tournament = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: leagueNight(), start_time: "18:00", rounds: 3, matches_per_round: 2, started_at: new Date(), registrations_open: false, arrival_closed_at: new Date()},
  });
  tournamentId = tournament.tournament_id;
  for (const name of ["A", "B"]) {
    const player = await prisma.player.create({data: {username: `${tag}${name}`.toLowerCase(), email: `${tag}${name}@example.com`, password_hash: "x", player_role: "PLAYER", first_name: name, last_name: tag}});
    players.push(player.id);
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`, teamPlayers: {create: {player_id: player.id}}}});
    teams.push(team.team_id);
    await prisma.tournamentTeam.create({data: {tournament_id: tournamentId, team_id: team.team_id, arrived_at: new Date()}});
  }
  // the Kolo went out six minutes ago, so the answer is open (3 minutes to ask, answerable from 5, skipped at 8)
  const round = await prisma.round.create({
    data: {
      team1_id: teams[0],
      team2_id: teams[1],
      round_number: 1,
      round_date: leagueNight(),
      status: "PUBLISHED",
      published_at: new Date(Date.now() - 6 * 60_000),
      matches_per_round: 2,
      tournamentRounds: {create: {tournament_id: tournamentId}},
    },
  });
  roundId = round.id;
});

after(async () => {
  await prisma.match.deleteMany({where: {round: {tournamentRounds: {some: {tournament_id: tournamentId}}}}});
  await prisma.round.deleteMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}});
  await prisma.tournament.delete({where: {tournament_id: tournamentId}});
  await prisma.teamPlayer.deleteMany({where: {team_id: {in: teams}}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.player.deleteMany({where: {id: {in: players}}});
  await prisma.$disconnect();
});

test("the question is only for the players of that table", async () => {
  const stranger = await prisma.player.create({data: {username: `${tag}x`, email: `${tag}x@example.com`, password_hash: "x", player_role: "PLAYER", first_name: "X", last_name: tag}});
  players.push(stranger.id);
  await assert.rejects(answerAttendance(roundId, {id: stranger.id, player_role: "PLAYER"}, "NO_SHOW"), {
    message: "Ovo pitanje je za igrače tog stola.",
  });
});

test("Ne, nisu došli: every match goes to the answering team as a bye does, and the other team is out", async () => {
  const answer = await answerAttendance(roundId, {id: players[0], player_role: "PLAYER"}, "NO_SHOW");
  assert.equal(answer, "NO_SHOW");
  assert.deepEqual(NO_SHOW_SCORE, [BYE_MATCH_POINTS, 0]);

  const matches = await prisma.match.findMany({where: {round_id: roundId}, orderBy: {id: "asc"}});
  assert.equal(matches.length, 2);
  for (const m of matches) {
    assert.deepEqual([m.player_pair1_score, m.player_pair2_score], [BYE_MATCH_POINTS, 0]);
    assert.equal(m.score_threshold, MATCH_THRESHOLD);
    // the stored winner is what the round's wins and the standings read
    assert.equal(m.winner_side, 1);
  }

  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.team1_wins, round.team2_wins, round.open, round.attendance], [2, 0, false, "NO_SHOW"]);
  assert.equal(round.attendance_team_id, teams[0]);

  const absent = await prisma.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teams[1]}}});
  assert.deepEqual([absent.excluded_kolo, absent.excluded_reason], [1, "NO_SHOW"]);
  // the team that came stays in
  const present = await prisma.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teams[0]}}});
  assert.equal(present.excluded_at, null);
});

test("a table that is already answered keeps its answer", async () => {
  assert.equal(await answerAttendance(roundId, {id: players[0], player_role: "PLAYER"}, "PRESENT"), "NO_SHOW");
});

test("Vrati stol after a no-show: the table plays again, the absent team is back and its Kolo 1 ban is lifted", async () => {
  const bans = await prisma.signupBan.findMany({where: {tournament_id: tournamentId, lifted_at: null}});
  assert.ok(bans.some((b) => b.team_id === teams[1]));

  await restoreTable(tournamentId, roundId, players[0]);
  assert.equal(await prisma.match.count({where: {round_id: roundId}}), 0);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.team1_wins, round.team2_wins, round.open, round.active, round.attendance], [0, 0, true, true, "PRESENT"]);
  const back = await prisma.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teams[1]}}});
  assert.deepEqual([back.excluded_at, back.excluded_reason, back.active, back.status], [null, null, true, "REGISTERED"]);
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, lifted_at: null}}), 0);

  // no question and no skip any more: the clock leaves it open
  assert.deepEqual(await skipDueTables(tournamentId), []);
  assert.equal((await prisma.round.findUniqueOrThrow({where: {id: roundId}})).open, true);
  // a second tap changes nothing
  await restoreTable(tournamentId, roundId, players[0]);
});

test("Vrati stol after a skip: both teams are back and the table is live again", async () => {
  await prisma.round.update({where: {id: roundId}, data: {open: false, active: false}});
  const skipped = await prisma.round.create({
    data: {
      team1_id: teams[0],
      team2_id: teams[1],
      round_number: 2,
      round_date: leagueNight(),
      status: "PUBLISHED",
      published_at: new Date(Date.now() - 9 * 60_000),
      matches_per_round: 2,
      tournamentRounds: {create: {tournament_id: tournamentId}},
    },
  });
  assert.deepEqual(await skipDueTables(tournamentId), [skipped.id]);
  const out = await prisma.tournamentTeam.findMany({where: {tournament_id: tournamentId, excluded_reason: "SKIPPED"}});
  assert.equal(out.length, 2);

  await restoreTable(tournamentId, skipped.id, players[0]);
  const round = await prisma.round.findUniqueOrThrow({where: {id: skipped.id}});
  assert.deepEqual([round.open, round.attendance], [true, "PRESENT"]);
  assert.equal(await prisma.tournamentTeam.count({where: {tournament_id: tournamentId, excluded_at: {not: null}}}), 0);
  assert.deepEqual(await skipDueTables(tournamentId), []);
});
