import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {getTablePad} from "@/app/_lib/service/admin/hands";
import {answerAttendance, skipDueTables} from "@/app/_lib/service/tournament/attendance";
import {gameMinutesOf} from "@/app/_lib/service/match/timeLimit";
import {NOT_LOCKED, unlockTable} from "@/app/_lib/service/admin/unlock";
import {NO_SHOW_SKIP_MS, NO_SHOW_UNLOCK_MS} from "@/app/_lib/tournamentDay";

// Otključaj partiju against a real Postgres (DECISIONS #89): a table locked by Nedolazak, by a skipped match and by
// Vrijeme partije is unlocked, and what the lock did is undone with it. Run with `npm run test:db` and DATABASE_URL on
// a throwaway database with the migrations applied (it adds its own tournament, teams and players and removes them
// afterwards). Never point it at production.

const tag = `ul${Date.now()}`;
let tournamentId = 0;
let adminId = 0;
const teams: number[] = [];
const players: number[] = [];
const rounds: number[] = [];

const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

before(async () => {
  const t = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: today(), rounds: 3, game_minutes: 35, started_at: new Date(), registrations_open: false},
  });
  tournamentId = t.tournament_id;
  for (const name of ["A", "B", "C", "D", "E", "F"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    const player = await prisma.player.create({
      data: {first_name: tag, last_name: name, username: `${tag}${name}`.toLowerCase().slice(0, 20), password_hash: "x", email: `${tag}${name}@test.local`.toLowerCase(), player_role: "PLAYER"},
    });
    players.push(player.id);
    await prisma.teamPlayer.create({data: {team_id: team.team_id, player_id: player.id}});
    await prisma.tournamentTeam.create({data: {tournament_id: tournamentId, team_id: team.team_id, status: "REGISTERED", active: true, arrived_at: new Date()}});
  }
  const admin = await prisma.player.create({data: {first_name: tag, last_name: "Admin", username: `${tag}admin`.toLowerCase().slice(0, 20), password_hash: "x", email: `${tag}admin@test.local`.toLowerCase(), player_role: "ADMIN"}});
  adminId = admin.id;
});

after(async () => {
  await prisma.signupBan.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.ongoingMatch.deleteMany({where: {round_id: {in: rounds}}});
  await prisma.match.deleteMany({where: {round_id: {in: rounds}}});
  await prisma.tournamentRound.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.round.deleteMany({where: {id: {in: rounds}}});
  await prisma.tournamentTeam.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.tournament.delete({where: {tournament_id: tournamentId}});
  await prisma.teamPlayer.deleteMany({where: {team_id: {in: teams}}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.player.deleteMany({where: {id: {in: [...players, adminId]}}});
  await prisma.$disconnect();
});

// a published table of the tournament whose Kolo went out this many milliseconds ago
async function table(kolo: number, team1: number, team2: number, outFor: number, matchesPerRound = 1) {
  const round = await prisma.round.create({
    data: {
      team1_id: team1,
      team2_id: team2,
      round_number: kolo,
      round_date: today(),
      status: "PUBLISHED",
      published_at: new Date(Date.now() - outFor),
      matches_per_round: matchesPerRound,
      tournamentRounds: {create: {tournament_id: tournamentId}},
    },
  });
  rounds.push(round.id);
  return round.id;
}

const entry = (teamId: number) => prisma.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}}});

test("Nedolazak unlocked: the 5 : 0 (NO_SHOW_SCORE) goes, the team is back in the tournament and its ban with it", async () => {
  const roundId = await table(1, teams[0], teams[1], NO_SHOW_UNLOCK_MS + 1000);
  const viewer = {id: players[0], player_role: "PLAYER"};
  assert.equal(await answerAttendance(roundId, viewer, "NO_SHOW"), "NO_SHOW");
  // what the answer did: the result, the exclusion and, in Kolo 1, the ban
  assert.equal(await prisma.match.count({where: {round_id: roundId}}), 1);
  assert.equal((await entry(teams[1])).excluded_reason, "NO_SHOW");
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, team_id: teams[1], lifted_at: null}}), 1);
  const locked = await getTablePad(roundId);
  assert.equal(locked.lock?.kind, "no_show");
  assert.ok(locked.lock?.absent?.includes("B"));

  const out = await unlockTable(roundId, 20, adminId);
  assert.deepEqual([out.kind, out.minutes, out.resumed, out.bans_lifted], ["no_show", 20, false, 1]);
  assert.equal(await prisma.match.count({where: {round_id: roundId}}), 0);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.open, round.attendance, round.team1_wins, round.team2_wins, round.game_minutes], [true, null, 0, 0, 20]);
  const back = await entry(teams[1]);
  assert.deepEqual([back.excluded_at, back.excluded_reason, back.active], [null, null, true]);
  // the ban and the player's ban under it are lifted
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, lifted_at: null}}), 0);
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, player_id: players[1], lifted_at: {not: null}}}), 1);
  // the table's own Vrijeme partije decides from now on, not the tournament's 35
  assert.equal(await gameMinutesOf(prisma, roundId), 20);
  const pad = await getTablePad(roundId);
  assert.equal(pad.lock, null);
  assert.equal(pad.gameMinutes, 20);
  // an open table can't be unlocked again
  await assert.rejects(unlockTable(roundId, 20, adminId), {message: NOT_LOCKED});
});

test("Preskočen unlocked: both teams come back and the table is new again", async () => {
  const roundId = await table(1, teams[2], teams[3], NO_SHOW_SKIP_MS + 1000);
  assert.deepEqual(await skipDueTables(tournamentId), [roundId]);
  assert.equal((await getTablePad(roundId)).lock?.kind, "skipped");
  for (const t of [teams[2], teams[3]]) assert.equal((await entry(t)).excluded_reason, "SKIPPED");

  const out = await unlockTable(roundId, 45, adminId);
  assert.deepEqual([out.kind, out.resumed, out.restored.length], ["skipped", false, 2]);
  for (const t of [teams[2], teams[3]]) assert.equal((await entry(t)).excluded_at, null);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.open, round.attendance, round.active, round.game_minutes], [true, null, false, 45]);
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, lifted_at: null}}), 0);
});

test("Vrijeme isteklo unlocked: the match carries on with its hands, a new deadline and the win off the score", async () => {
  const roundId = await table(2, teams[4], teams[5], 60_000);
  const match = await prisma.match.create({
    data: {
      round_id: roundId,
      player_pair1_score: 30,
      player_pair2_score: 18,
      score_threshold: 41,
      // closed by the clock: the team with more points won it
      winner_side: 1,
      time_expired: true,
      start_time: new Date(Date.now() - 35 * 60_000),
      end_time: new Date(),
      match_date: today(),
      results: {
        create: [
          {team1_game_points: 8, team2_game_points: 3, team1_zvanja3: 1},
          {team1_game_points: 4, team2_game_points: 7},
          {team1_game_points: 15, team2_game_points: 8, custom: true},
        ],
      },
    },
  });
  await prisma.round.update({where: {id: roundId}, data: {open: false, active: false, team1_wins: 1}});
  assert.equal((await getTablePad(roundId)).lock?.kind, "time_expired");

  const out = await unlockTable(roundId, 15, adminId);
  assert.deepEqual([out.kind, out.resumed, out.minutes], ["time_expired", true, 15]);
  // the finished match is gone and is the match being played again, with both hands and the zvanje on the first and the custom hand
  assert.equal(await prisma.match.count({where: {id: match.id}}), 0);
  const ongoing = await prisma.ongoingMatch.findFirstOrThrow({where: {round_id: roundId}, include: {results: {orderBy: {result_id: "asc"}}}});
  assert.deepEqual([ongoing.player_pair1_score, ongoing.player_pair2_score, ongoing.score_threshold], [30, 18, 41]);
  assert.equal(ongoing.results.length, 3);
  assert.equal(ongoing.results[0].team1_zvanja3, 1);
  assert.equal(ongoing.results[2].custom, true);
  assert.ok(ongoing.ends_at && Math.abs(ongoing.ends_at.getTime() - (Date.now() + 15 * 60_000)) < 60_000);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.open, round.active, round.team1_wins, round.team2_wins], [true, true, 0, 0]);
  // the pad opens on the match being played, with the table's own time
  const pad = await getTablePad(roundId);
  assert.deepEqual([pad.lock, pad.gameMinutes, pad.matches.map((m) => m.kind)], [null, 15, ["ongoing"]]);
});

test("the minutes are checked, and a league table isn't unlocked", async () => {
  const roundId = await table(3, teams[0], teams[2], 60_000);
  await prisma.round.update({where: {id: roundId}, data: {open: false}});
  await assert.rejects(unlockTable(roundId, 4, adminId), /od 5 do 180/);
  await assert.rejects(unlockTable(roundId, 181, adminId), /od 5 do 180/);
  // a table played to the end with no match at all: unlocked, nothing to carry on
  const out = await unlockTable(roundId, 35, adminId);
  assert.deepEqual([out.kind, out.resumed], ["done", false]);
});
