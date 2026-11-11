import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {makeKoloDraft, publishKolo} from "@/app/_lib/service/tournament/kola";
import {updateTournament} from "@/app/_lib/service/tournament/tournaments";
import {TournamentRequest} from "@/app/_interfaces/tournament";
import {leagueNight} from "@/app/_lib/dates";

// A tournament with or without zvanja against a real Postgres: a Kolo's tables take the tournament's Zvanja when the
// Kolo is made, a change before the start moves into the drafts, and one after the start makes the next Kolo's draft
// again while the published Kolos keep theirs. Run with `npm run test:db` and DATABASE_URL on a throwaway database
// with the migrations applied (it adds its own tournament and teams and removes them afterwards). Never point it at
// production.

const tag = `tz${Date.now()}`;
let tournamentId = 0;
const teams: number[] = [];

// the tournament as its form sends it, with zvanja or without
const request = (declarations: boolean): TournamentRequest => ({
  name: `${tag} turnir`,
  date: leagueNight().toISOString().slice(0, 10),
  gathering_time: null,
  start_time: null,
  location_name: null,
  location_address: null,
  location_url: null,
  rounds: 3,
  matches_per_round: 2,
  declarations,
  max_teams: null,
  entry_fee: 0,
  rules_url: null,
  prizes: [],
  game_minutes: 45,
  auto_publish: false,
  open_signups: false,
  organizer_phone: "0931234567",
});

before(async () => {
  const tournament = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: leagueNight(), rounds: 3, matches_per_round: 2, declarations: false, registrations_open: false, organizer_phone: "0931234567"},
  });
  tournamentId = tournament.tournament_id;
  for (const name of ["A", "B", "C", "D"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    await prisma.tournamentTeam.create({data: {tournament_id: tournamentId, team_id: team.team_id, arrived_at: new Date()}});
  }
});

after(async () => {
  await prisma.round.deleteMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}});
  await prisma.tournament.delete({where: {tournament_id: tournamentId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});

const tables = (status?: "PUBLISHED") =>
  prisma.round.findMany({
    where: {tournamentRounds: {some: {tournament_id: tournamentId}}, ...(status ? {status} : {status: {not: "PUBLISHED" as const}})},
    select: {declarations: true},
  });

test("a Kolo's tables play as the tournament says when the Kolo is made, and a change before the start reaches them", async () => {
  await makeKoloDraft(tournamentId);
  const drafts = await tables();
  assert.equal(drafts.length, 2);
  assert.ok(drafts.every((r) => r.declarations === false));

  await updateTournament(tournamentId, request(true));
  assert.ok((await tables()).every((r) => r.declarations === true));
});

test("after the start a published Kolo keeps its Zvanja, and the next draft is made again with the new one", async () => {
  await publishKolo(tournamentId, 1);
  assert.equal(await prisma.tournament.count({where: {tournament_id: tournamentId, started_at: {not: null}}}), 1);
  // Kolo 1 played out, so Kolo 2's draft can be made: with zvanja, as the tournament still says
  await prisma.round.updateMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}, data: {open: false}});
  await makeKoloDraft(tournamentId);
  const before = await tables();
  assert.equal(before.length, 2);
  assert.ok(before.every((r) => r.declarations === true));

  await updateTournament(tournamentId, request(false));
  // the draft is gone, to be made again with the new Zvanja; Kolo 1 keeps its own
  assert.equal((await tables()).length, 0);
  const published = await tables("PUBLISHED");
  assert.equal(published.length, 2);
  assert.ok(published.every((r) => r.declarations === true));

  await makeKoloDraft(tournamentId);
  const remade = await tables();
  assert.equal(remade.length, 2);
  assert.ok(remade.every((r) => r.declarations === false));
});
