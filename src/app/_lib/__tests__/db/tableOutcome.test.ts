import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {setTableOutcome, skipDueTables} from "@/app/_lib/service/tournament/attendance";
import {BYE_MATCH_POINTS} from "@/app/_lib/game/scoring";
import {leagueNight} from "@/app/_lib/dates";

// Uredi ishod against a real Postgres: a skipped Kolo 1 table gets a team's win (5:0 per match, the other team out and
// banned, the winner back in without its ban), the win moves to the other team, and back to skipped; the result it
// already has changes nothing, and a table that wasn't skipped or a no-show is refused. Run with `npm run test:db` and
// DATABASE_URL on a throwaway database with the migrations applied. Never point it at production.

const tag = `to${Date.now()}`;
let tournamentId = 0;
let roundId = 0;
const teams: number[] = [];
const players: number[] = [];

const entry = (teamId: number) => prisma.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}}});
const activeBan = (teamId: number) => prisma.signupBan.count({where: {tournament_id: tournamentId, team_id: teamId, lifted_at: null}});

before(async () => {
  const tournament = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: leagueNight(), start_time: "18:00", rounds: 3, matches_per_round: 2, started_at: new Date(), registrations_open: false, arrival_closed_at: new Date()},
  });
  tournamentId = tournament.tournament_id;
  for (const name of ["A", "B", "Admin"]) {
    const player = await prisma.player.create({data: {username: `${tag}${name}`.toLowerCase(), email: `${tag}${name}@example.com`, password_hash: "x", player_role: name === "Admin" ? "ADMIN" : "PLAYER", first_name: name, last_name: tag}});
    players.push(player.id);
    if (name === "Admin") continue;
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`, teamPlayers: {create: {player_id: player.id}}}});
    teams.push(team.team_id);
    await prisma.tournamentTeam.create({data: {tournament_id: tournamentId, team_id: team.team_id, arrived_at: new Date()}});
  }
  // Kolo 1 went out eleven minutes ago with no game: the clock skips it
  const round = await prisma.round.create({
    data: {
      team1_id: teams[0],
      team2_id: teams[1],
      round_number: 1,
      round_date: leagueNight(),
      status: "PUBLISHED",
      published_at: new Date(Date.now() - 11 * 60_000),
      matches_per_round: 2,
      tournamentRounds: {create: {tournament_id: tournamentId}},
    },
  });
  roundId = round.id;
});

after(async () => {
  await prisma.match.deleteMany({where: {round: {tournamentRounds: {some: {tournament_id: tournamentId}}}}});
  await prisma.round.deleteMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}});
  await prisma.signupBan.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.tournament.delete({where: {tournament_id: tournamentId}});
  await prisma.teamPlayer.deleteMany({where: {team_id: {in: teams}}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.player.deleteMany({where: {id: {in: players}}});
  await prisma.$disconnect();
});

test("a table that wasn't skipped or a no-show has no outcome to edit", async () => {
  await assert.rejects(setTableOutcome(tournamentId, roundId, "TEAM1", players[2]), /samo preskočenom stolu/);
});

test("a skipped table given to a team: 5:0 per match, the winner back in without a ban, the other out and banned", async () => {
  assert.deepEqual(await skipDueTables(tournamentId), [roundId]);
  assert.deepEqual([await activeBan(teams[0]), await activeBan(teams[1])], [1, 1]);

  await setTableOutcome(tournamentId, roundId, "TEAM1", players[2]);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.attendance, round.attendance_team_id, round.attendance_by, round.team1_wins, round.team2_wins, round.open], ["NO_SHOW", teams[0], players[2], 2, 0, false]);
  const matches = await prisma.match.findMany({where: {round_id: roundId}});
  assert.deepEqual(matches.map((m) => [m.player_pair1_score, m.player_pair2_score, m.winner_side]), [[BYE_MATCH_POINTS, 0, 1], [BYE_MATCH_POINTS, 0, 1]]);

  const [winner, loser] = [await entry(teams[0]), await entry(teams[1])];
  assert.deepEqual([winner.excluded_at, winner.active], [null, true]);
  assert.deepEqual([loser.excluded_reason, loser.excluded_kolo], ["NO_SHOW", 1]);
  assert.deepEqual([await activeBan(teams[0]), await activeBan(teams[1])], [0, 1]);
});

test("the win moved to the other team: the matches, the exclusion and the bans follow", async () => {
  await setTableOutcome(tournamentId, roundId, "TEAM2", players[2]);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.attendance_team_id, round.team1_wins, round.team2_wins], [teams[1], 0, 2]);
  assert.equal(await prisma.match.count({where: {round_id: roundId, winner_side: 2}}), 2);
  assert.equal(await prisma.match.count({where: {round_id: roundId}}), 2);
  assert.equal((await entry(teams[1])).excluded_at, null);
  assert.equal((await entry(teams[0])).excluded_reason, "NO_SHOW");
  // team A's earlier ban is in force again, not a second one
  assert.deepEqual([await activeBan(teams[0]), await activeBan(teams[1])], [1, 0]);
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, team_id: teams[0]}}), 1);
});

test("back to skipped: no matches, both teams out and banned; the same outcome again changes nothing", async () => {
  await setTableOutcome(tournamentId, roundId, "SKIPPED", players[2]);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.attendance, round.attendance_team_id, round.team1_wins, round.team2_wins, round.open], ["SKIPPED", null, 0, 0, false]);
  assert.equal(await prisma.match.count({where: {round_id: roundId}}), 0);
  assert.deepEqual([(await entry(teams[0])).excluded_reason, (await entry(teams[1])).excluded_reason], ["SKIPPED", "SKIPPED"]);
  assert.deepEqual([await activeBan(teams[0]), await activeBan(teams[1])], [1, 1]);

  const before = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  await setTableOutcome(tournamentId, roundId, "SKIPPED", players[2]);
  assert.deepEqual(await prisma.round.findUniqueOrThrow({where: {id: roundId}}), before);
});
