import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {makeKoloDraft, publishKolo} from "@/app/_lib/service/tournament/kola";
import {createOngoingMatch} from "@/app/_lib/service/ongoingMatch/create";
import {createResult} from "@/app/_lib/service/ongoingResult/create";
import {updateOngoingResult} from "@/app/_lib/service/ongoingResult/update";
import {finishOngoingMatch} from "@/app/_lib/service/match/finishOngoingMatch";
import {MATCH_THRESHOLD, NO_HAND_ZVANJA} from "@/app/_lib/game/scoring";
import {leagueNight} from "@/app/_lib/dates";

// A tournament "na prolaz" against a real Postgres: its Kolo's tables take it, a player's custom hand is refused there
// while an admin's correction is taken, nobody calls "s ovim dosta", a level score at the target gives one more hand
// and five more minutes, and the next hand decides. Run with `npm run test:db` and DATABASE_URL on a throwaway database
// with the migrations applied (it adds its own tournament and teams and removes them afterwards). Never point it at
// production.

const tag = `tp${Date.now()}`;
let tournamentId = 0;
const teams: number[] = [];

before(async () => {
  const tournament = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: leagueNight(), rounds: 3, matches_per_round: 2, match_end: "NA_PROLAZ", registrations_open: false},
  });
  tournamentId = tournament.tournament_id;
  for (const name of ["A", "B"]) {
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

const asAdmin = {admin: true};
const hand = (match_id: number, a: number, b: number, extra: object = {}) => ({match_id, team1_game_points: a, team2_game_points: b, ...NO_HAND_ZVANJA, custom: false, ...extra});

test("na prolaz: the table takes it, custom only from an admin, no s ovim dosta, a level score plays one more hand", async () => {
  await makeKoloDraft(tournamentId);
  await publishKolo(tournamentId, 1);
  const [table] = await prisma.round.findMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}}, select: {id: true, match_end: true}});
  assert.equal(table.match_end, "NA_PROLAZ");

  const match = await createOngoingMatch({round_id: table.id, score_threshold: MATCH_THRESHOLD});
  const deadline = async () => (await prisma.ongoingMatch.findUniqueOrThrow({where: {id: match.id}})).ends_at!.getTime();
  const start = await deadline();

  // a player's custom hand is refused; an admin's correction is taken
  await assert.rejects(createResult(hand(match.id, 35, 35, {custom: true})), /Na prolaz nema ručnog unosa/);
  const custom = await createResult(hand(match.id, 35, 35, {custom: true}), (r) => r, asAdmin);
  // nor a player's edit of it to a custom hand, and nobody calls "s ovim dosta"
  await assert.rejects(updateOngoingResult({result_id: custom, resultData: hand(match.id, 35, 36, {custom: true})}), /Na prolaz nema ručnog unosa/);
  await assert.rejects(updateOngoingResult({result_id: custom, resultData: hand(match.id, 35, 35, {custom: true, dosta_side: 1}), normalize: (r) => r, admin: true}), /Na prolaz se ne zove/);

  // 4 : 7 with a 3 for team 1: 42 : 42, level at the target: no winner, the target stays, five more minutes
  await createResult(hand(match.id, 4, 7, {team1_zvanja3: 1}));
  assert.equal((await deadline()) - start, 5 * 60_000);
  await assert.rejects(finishOngoingMatch(match.id), /41/);

  // the next hand decides: 48 : 47
  await createResult(hand(match.id, 6, 5));
  assert.equal((await deadline()) - start, 5 * 60_000);
  await finishOngoingMatch(match.id);
  const [finished] = await prisma.match.findMany({where: {round_id: table.id}, select: {winner_side: true, player_pair1_score: true, player_pair2_score: true}});
  assert.deepEqual(finished, {winner_side: 1, player_pair1_score: 48, player_pair2_score: 47});
});
