import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {restoreTable, setTableOutcome, skipDueTables} from "@/app/_lib/service/tournament/attendance";
import {leagueNight} from "@/app/_lib/dates";

// A full tournament (two places) whose only table is skipped lets the confirmed waiting team in. Brought back by Vrati
// stol, that team goes back to waiting while no published table has it; once it has one it stays. A skipped table given
// to one team leaves a place for it. Run with `npm run test:db` and DATABASE_URL on a throwaway database with the
// migrations applied. Never point it at production.

const tag = `ro${Date.now()}`;
let tournamentId = 0;
const teams: number[] = [];
let admin = 0;

const status = async (teamId: number) =>
  (await prisma.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}}})).status;

async function skippedTable(kolo: number) {
  const round = await prisma.round.create({
    data: {
      team1_id: teams[0],
      team2_id: teams[1],
      round_number: kolo,
      round_date: leagueNight(),
      status: "PUBLISHED",
      published_at: new Date(Date.now() - 11 * 60_000),
      matches_per_round: 2,
      tournamentRounds: {create: {tournament_id: tournamentId}},
    },
  });
  assert.deepEqual(await skipDueTables(tournamentId), [round.id]);
  return round.id;
}

before(async () => {
  const tournament = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: leagueNight(), start_time: "18:00", rounds: 5, matches_per_round: 2, max_teams: 2, started_at: new Date(), registrations_open: false, arrival_closed_at: new Date()},
  });
  tournamentId = tournament.tournament_id;
  admin = (await prisma.player.create({data: {username: `${tag}admin`, email: `${tag}admin@example.com`, password_hash: "x", player_role: "ADMIN", first_name: "A", last_name: tag}})).id;
  const names = ["A", "B", "C"];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    await prisma.tournamentTeam.create({
      data: {tournament_id: tournamentId, team_id: team.team_id, arrived_at: new Date(), status: i < 2 ? "REGISTERED" : "WAITING", registered_at: new Date(Date.now() - (10 - i) * 60_000)},
    });
  }
});

after(async () => {
  await prisma.match.deleteMany({where: {round: {tournamentRounds: {some: {tournament_id: tournamentId}}}}});
  await prisma.round.deleteMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}});
  await prisma.signupBan.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.tournament.delete({where: {tournament_id: tournamentId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.player.delete({where: {id: admin}});
  await prisma.$disconnect();
});

test("Vrati stol: the waiting team that came in and has no table yet goes back to waiting", async () => {
  const table = await skippedTable(2);
  assert.equal(await status(teams[2]), "REGISTERED");
  await restoreTable(tournamentId, table, admin);
  assert.deepEqual([await status(teams[0]), await status(teams[1]), await status(teams[2])], ["REGISTERED", "REGISTERED", "WAITING"]);
  await prisma.round.update({where: {id: table}, data: {open: false, active: false}});
});

test("a skipped table given to one team: one place is free, the waiting team keeps it", async () => {
  const table = await skippedTable(3);
  assert.equal(await status(teams[2]), "REGISTERED");
  await setTableOutcome(tournamentId, table, "TEAM1", admin);
  assert.deepEqual([await status(teams[0]), await status(teams[2])], ["REGISTERED", "REGISTERED"]);
  // the win moved to the other team: still one place, still C's
  await setTableOutcome(tournamentId, table, "TEAM2", admin);
  assert.equal(await status(teams[2]), "REGISTERED");
});

test("a team that came in and already has a table stays; the admin decides", async () => {
  const table = (await prisma.round.findFirstOrThrow({where: {tournamentRounds: {some: {tournament_id: tournamentId}}, round_number: 3}})).id;
  await prisma.round.create({
    data: {
      team1_id: teams[2],
      team2_id: teams[1],
      round_number: 4,
      round_date: leagueNight(),
      status: "PUBLISHED",
      published_at: new Date(),
      matches_per_round: 2,
      tournamentRounds: {create: {tournament_id: tournamentId}},
    },
  });
  await restoreTable(tournamentId, table, admin);
  assert.deepEqual([await status(teams[0]), await status(teams[1]), await status(teams[2])], ["REGISTERED", "REGISTERED", "REGISTERED"]);
});
