import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {leagueNight} from "@/app/_lib/dates";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {mySchedule} from "@/app/_lib/service/league/schedule";
import {homeCard} from "@/app/_lib/homeCard";

// Početna's evening on a two-place night, against a real Postgres (MyLeague.tonight): the team's last table, which of
// its own place's Kola it was ("Kolo 1/1" while the other place is further), and Kraj večeri after a bye in the place's
// last Kolo. Run with `npm run test:db` and DATABASE_URL on a throwaway database with the migrations applied.

const tag = `ht${Date.now()}`;
const tonight = leagueNight();
let leagueId = 0;
let playerId = 0;
const places: number[] = [];
// A, B at Kartaš (1); C, D at Lanterna (2)
const teams: Record<"A" | "B" | "C" | "D", number> = {A: 0, B: 0, C: 0, D: 0};

const table = (a: number, b: number, n: number, slot: number, wins: [number, number]) =>
  prisma.round.create({
    data: {
      team1_id: a,
      team2_id: b,
      team1_wins: wins[0],
      team2_wins: wins[1],
      open: false,
      round_number: n,
      table_number: 1,
      round_date: tonight,
      status: "PUBLISHED",
      published_at: new Date(),
      location_slot: slot,
      leagueRounds: {create: {league_id: leagueId}},
    },
  });

before(async () => {
  for (const name of ["Kartaš", "Lanterna"]) places.push((await prisma.location.create({data: {name: `${tag} ${name}`}})).location_id);
  leagueId = (await prisma.league.create({data: {league_name: `${tag} liga`, location_id: places[0], rounds_per_night: 2}})).league_id;
  await prisma.leagueNight.create({data: {league_id: leagueId, night: tonight, second_location_id: places[1]}});
  playerId = (await prisma.player.create({data: {username: `${tag}a`, email: `${tag}a@example.com`, password_hash: "x", player_role: "PLAYER", first_name: "A", last_name: tag}})).id;
  for (const name of ["A", "B", "C", "D"] as const) {
    teams[name] = (await prisma.team.create({data: {team_name: `${tag} ${name}`, ...(name === "A" && {teamPlayers: {create: {player_id: playerId}}})}})).team_id;
    await prisma.leagueTeam.create({data: {league_id: leagueId, team_id: teams[name]}});
    await prisma.leagueNightTeam.create({data: {league_id: leagueId, night: tonight, team_id: teams[name], slot: name === "A" || name === "B" ? 1 : 2}});
  }
  await prisma.team.upsert({where: {team_id: BYE_TEAM_ID}, update: {}, create: {team_id: BYE_TEAM_ID, team_name: `${tag} Bye`}});
  // Kolo 7: A beat B at Kartaš; Lanterna has played Kolo 7 and 8 already
  await table(teams.A, teams.B, 7, 1, [2, 0]);
  await table(teams.C, teams.D, 7, 2, [1, 1]);
  await table(teams.C, teams.D, 8, 2, [2, 0]);
});

after(async () => {
  await prisma.round.deleteMany({where: {leagueRounds: {some: {league_id: leagueId}}}});
  await prisma.league.delete({where: {league_id: leagueId}});
  await prisma.teamPlayer.deleteMany({where: {team_id: {in: Object.values(teams)}}});
  await prisma.team.deleteMany({where: {team_id: {in: Object.values(teams)}}});
  await prisma.player.delete({where: {id: playerId}});
  await prisma.location.deleteMany({where: {location_id: {in: places}}});
  await prisma.$disconnect();
});

const evening = async () => (await mySchedule({id: playerId, player_role: "PLAYER"})).leagues.find((l) => l.league_id === leagueId)?.tonight;

test("after its first table the team waits for Kartaš's next Kolo: Kolo 1/1, Lanterna's Kola don't count", async () => {
  const e = await evening();
  assert.deepEqual(e?.lastTable, {table: 1, kolo: [1, 1], opponent: `${tag} B`, opponentId: teams.B, score: [2, 0], bye: false});
  assert.equal(e?.kola, 1);
  assert.equal(e?.lastKoloOut, false);
  assert.equal(homeCard({openTable: false, tonight: {started: true, here: true, lastTable: {kolo: e!.lastTable!.kolo, bye: false}, lastKoloOut: e!.lastKoloOut}, nextNight: true}), "next");
});

test("a bye in Kartaš's last Kolo of the night ends the evening", async () => {
  await table(teams.A, BYE_TEAM_ID, 8, 1, [2, 0]);
  const e = await evening();
  assert.deepEqual(e?.lastTable, {table: 1, kolo: [2, 2], opponent: null, opponentId: BYE_TEAM_ID, score: [2, 0], bye: true});
  assert.equal(e?.lastKoloOut, true);
  assert.equal(homeCard({openTable: false, tonight: {started: true, here: true, lastTable: {kolo: e!.lastTable!.kolo, bye: true}, lastKoloOut: true}, nextNight: true}), "end");
});
