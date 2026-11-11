import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {makeKoloDraft, publishKolo} from "@/app/_lib/service/tournament/kola";
import {createOngoingMatch} from "@/app/_lib/service/ongoingMatch/create";
import {createResult} from "@/app/_lib/service/ongoingResult/create";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {leagueNight} from "@/app/_lib/dates";

// A tournament played to 51 against a real Postgres: its Kolo's tables take 51, a match started at one is played to 51
// whatever the phone sends, and a bye's matches are written at 51 too. Run with `npm run test:db` and DATABASE_URL on a
// throwaway database with the migrations applied (it adds its own tournament and teams and removes them afterwards).
// Never point it at production.

const tag = `tt${Date.now()}`;
let tournamentId = 0;
const teams: number[] = [];

before(async () => {
  const tournament = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: leagueNight(), rounds: 3, matches_per_round: 2, score_threshold: 51, registrations_open: false},
  });
  tournamentId = tournament.tournament_id;
  // three teams: one of them gets the bye
  for (const name of ["A", "B", "C"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    await prisma.tournamentTeam.create({data: {tournament_id: tournamentId, team_id: team.team_id, arrived_at: new Date()}});
  }
});

after(async () => {
  const rounds = {round: {tournamentRounds: {some: {tournament_id: tournamentId}}}};
  await prisma.match.deleteMany({where: rounds});
  await prisma.ongoingMatch.deleteMany({where: rounds});
  await prisma.round.deleteMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}});
  await prisma.tournament.delete({where: {tournament_id: tournamentId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});

test("a tournament to 51: its tables, a match started at one (whatever the phone sends) and a bye are all to 51", async () => {
  await makeKoloDraft(tournamentId);
  await publishKolo(tournamentId, 1);
  const tables = await prisma.round.findMany({
    where: {tournamentRounds: {some: {tournament_id: tournamentId}}},
    select: {id: true, team1_id: true, team2_id: true, score_threshold: true, matches: {select: {score_threshold: true}}},
  });
  assert.ok(tables.every((r) => r.score_threshold === 51));

  const bye = tables.find((r) => r.team1_id === BYE_TEAM_ID || r.team2_id === BYE_TEAM_ID)!;
  assert.ok(bye.matches.length > 0);
  assert.ok(bye.matches.every((m) => m.score_threshold === 51));

  const played = tables.find((r) => r !== bye)!;
  // the phone still sends 41
  const match = await createOngoingMatch({round_id: played.id, score_threshold: MATCH_THRESHOLD});
  assert.equal(match.score_threshold, 51);
  // 45 : 0 is not the end of a match to 51
  await createResult({match_id: match.id, team1_game_points: 45, team2_game_points: 0, custom: true});
  const after45 = await prisma.ongoingMatch.findUniqueOrThrow({where: {id: match.id}});
  assert.equal(after45.player_pair1_score, 45);
  await createResult({match_id: match.id, team1_game_points: 6, team2_game_points: 5, custom: false});
  await assert.rejects(createResult({match_id: match.id, team1_game_points: 6, team2_game_points: 5, custom: false}), /Meč je gotov/);
});
