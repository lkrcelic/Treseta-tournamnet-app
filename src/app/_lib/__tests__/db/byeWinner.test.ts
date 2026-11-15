import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {leagueNight} from "@/app/_lib/dates";
import {BYE_TEAM_ID, isByeTeam} from "@/app/_lib/bye";
import {BYE_MATCH_POINTS} from "@/app/_lib/game/scoring";
import {SeatedPair} from "@/app/_lib/matching/smokingTables";
import {insertRoundBatch} from "@/app/_lib/service/round/insertPairRounds";
import {approveNight, publishNight} from "@/app/_lib/service/round/publication";
import {makeKoloDraft, publishKolo} from "@/app/_lib/service/tournament/kola";
import {getTablePad} from "@/app/_lib/service/admin/hands";

// A Slobodna runda's matches have a winner: the real team wins each one 5 : 0 and is its winner_side, on a league
// night (the bye on either side of the table) and in a tournament's Kolo, as a no-show's matches are. Treseta reads a
// null winner_side as a match nobody won (the scorepad, the ratings). Run with `npm run test:db` and DATABASE_URL on a
// throwaway database with the migrations applied. Never point it at production.

const tag = `bw${Date.now()}`;
const tonight = leagueNight();
const iso = tonight.toISOString().slice(0, 10);
let leagueId = 0;
let tournamentId = 0;
const teams: number[] = [];

before(async () => {
  const league = await prisma.league.create({data: {league_name: `${tag} liga`}});
  leagueId = league.league_id;
  for (const name of ["A", "B", "C"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    await prisma.leagueTeam.create({data: {league_id: leagueId, team_id: team.team_id}});
  }
  await prisma.team.upsert({where: {team_id: BYE_TEAM_ID}, update: {}, create: {team_id: BYE_TEAM_ID, team_name: `${tag} Bye`}});
});

after(async () => {
  const rounds = {OR: [{leagueRounds: {some: {league_id: leagueId}}}, {tournamentRounds: {some: {tournament_id: tournamentId}}}]};
  const ids = (await prisma.round.findMany({where: rounds, select: {id: true}})).map((r) => r.id);
  await prisma.match.deleteMany({where: {round_id: {in: ids}}});
  await prisma.round.deleteMany({where: {id: {in: ids}}});
  await prisma.tournament.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.league.delete({where: {league_id: leagueId}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.$disconnect();
});

// the bye tables among these rounds, each with its matches and the side its real team sits on
async function byeTables(where: object) {
  const rounds = await prisma.round.findMany({
    where: {...where, OR: [{team1_id: BYE_TEAM_ID}, {team2_id: BYE_TEAM_ID}]},
    select: {id: true, team1_id: true, status: true, matches: {select: {player_pair1_score: true, player_pair2_score: true, winner_side: true}, orderBy: {id: "asc"}}},
    orderBy: {id: "asc"},
  });
  return rounds.map((r) => ({...r, realSide: isByeTeam(r.team1_id) ? 2 : 1}));
}

const byeScore = (realSide: number) => (realSide === 1 ? [BYE_MATCH_POINTS, 0] : [0, BYE_MATCH_POINTS]);

test("a league night's bye: the real team wins both matches 5 : 0 and is their winner, on either side of the table", async () => {
  const team = (i: number) => (i < 0 ? {id: BYE_TEAM_ID, name: "Bye"} : {id: teams[i], name: `${tag} ${i}`});
  const pair = (a: number, b: number, table: number) => ({teamOne: team(a), teamTwo: team(b), table, smoking: false}) as unknown as SeatedPair;
  // Novo kolo of two rounds for three teams: C sits out the first (the bye as team 2), B the second (the bye as team 1)
  await insertRoundBatch(
    [
      [pair(0, 1, 1), pair(2, -1, 2)],
      [pair(0, 2, 1), pair(-1, 1, 2)],
    ],
    leagueId
  );
  await approveNight(leagueId, iso);
  await publishNight(leagueId, iso);

  const byes = await byeTables({leagueRounds: {some: {league_id: leagueId}}});
  assert.deepEqual(
    byes.map((t) => [t.status, t.realSide]),
    [
      ["PUBLISHED", 1],
      ["PUBLISHED", 2],
    ]
  );
  for (const t of byes) {
    assert.deepEqual(
      t.matches.map((m) => [m.player_pair1_score, m.player_pair2_score, m.winner_side]),
      [
        [...byeScore(t.realSide), t.realSide],
        [...byeScore(t.realSide), t.realSide],
      ]
    );
    // the admin's scorepad names the real team as each match's winner
    assert.deepEqual((await getTablePad(t.id)).matches.map((m) => m.winner), [t.realSide, t.realSide]);
  }
});

test("a tournament Kolo's bye: the real team wins its matches 5 : 0 and is their winner", async () => {
  const tournament = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: tonight, rounds: 3, matches_per_round: 2, registrations_open: false},
  });
  tournamentId = tournament.tournament_id;
  // three teams in Kolo 1: one of them draws the Slobodna runda
  for (const id of teams) await prisma.tournamentTeam.create({data: {tournament_id: tournamentId, team_id: id, arrived_at: new Date()}});
  await makeKoloDraft(tournamentId);
  await publishKolo(tournamentId, 1);

  const byes = await byeTables({tournamentRounds: {some: {tournament_id: tournamentId}}});
  assert.equal(byes.length, 1);
  const [t] = byes;
  assert.equal(t.status, "PUBLISHED");
  assert.deepEqual(
    t.matches.map((m) => [m.player_pair1_score, m.player_pair2_score, m.winner_side]),
    [
      [...byeScore(t.realSide), t.realSide],
      [...byeScore(t.realSide), t.realSide],
    ]
  );
});
