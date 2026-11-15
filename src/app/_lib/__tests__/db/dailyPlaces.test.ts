import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {leagueNight} from "@/app/_lib/dates";
import {getLeagueStandingsByDate} from "@/app/_lib/service/league/getStandingsByDate";

// Dnevni poredak of a two-place night against a real Postgres (get_league_standings_by_date with a place): Sve counts
// every table of the night, a place only its own tables and the teams that came to it, ranked from 1. Run with
// `npm run test:db` and DATABASE_URL on a throwaway database with the migrations applied.

const tag = `dp${Date.now()}`;
const tonight = leagueNight();
const iso = tonight.toISOString().slice(0, 10);
let leagueId = 0;
const places: number[] = [];
// A, B at Kartaš (1); C, D at Lanterna (2); E came to Lanterna and hasn't played yet
const teams: Record<"A" | "B" | "C" | "D" | "E", number> = {A: 0, B: 0, C: 0, D: 0, E: 0};

before(async () => {
  for (const name of ["Kartaš", "Lanterna"]) places.push((await prisma.location.create({data: {name: `${tag} ${name}`}})).location_id);
  leagueId = (await prisma.league.create({data: {league_name: `${tag} liga`, location_id: places[0]}})).league_id;
  await prisma.leagueNight.create({data: {league_id: leagueId, night: tonight, second_location_id: places[1]}});
  for (const name of ["A", "B", "C", "D", "E"] as const) {
    teams[name] = (await prisma.team.create({data: {team_name: `${tag} ${name}`}})).team_id;
    await prisma.leagueTeam.create({data: {league_id: leagueId, team_id: teams[name]}});
    await prisma.leagueNightTeam.create({data: {league_id: leagueId, night: tonight, team_id: teams[name], slot: name === "A" || name === "B" ? 1 : 2}});
  }
  // Kolo 7 at both places: A beat B at Kartaš, D beat C at Lanterna (both Stol 1)
  for (const [w, l, slot] of [["A", "B", 1], ["D", "C", 2]] as const) {
    await prisma.round.create({
      data: {
        team1_id: teams[w],
        team2_id: teams[l],
        team1_wins: 2,
        team2_wins: 0,
        open: false,
        round_number: 7,
        table_number: 1,
        round_date: tonight,
        status: "PUBLISHED",
        published_at: new Date(),
        location_slot: slot,
        leagueRounds: {create: {league_id: leagueId}},
      },
    });
  }
  await prisma.leagueArrival.create({data: {league_id: leagueId, night: tonight, team_id: teams.E, arrived_at: new Date(), by_admin: true}});
});

after(async () => {
  await prisma.round.deleteMany({where: {leagueRounds: {some: {league_id: leagueId}}}});
  await prisma.leagueArrival.deleteMany({where: {league_id: leagueId}});
  await prisma.league.delete({where: {league_id: leagueId}});
  await prisma.team.deleteMany({where: {team_id: {in: Object.values(teams)}}});
  await prisma.location.deleteMany({where: {location_id: {in: places}}});
  await prisma.$disconnect();
});

const names = (rows: {team: {team_name: string}}[]) => rows.map((r) => r.team.team_name.slice(tag.length + 1));

test("Sve ranks every team of the night together", async () => {
  // the two winners first, then E (came, 0 rounds) and the two losers by name
  assert.deepEqual(names(await getLeagueStandingsByDate(leagueId, iso)), ["A", "D", "B", "C", "E"]);
});

test("a place ranks its own teams from 1, with the teams that came to it", async () => {
  assert.deepEqual(names(await getLeagueStandingsByDate(leagueId, iso, 1)), ["A", "B"]);
  assert.deepEqual(names(await getLeagueStandingsByDate(leagueId, iso, 2)), ["D", "C", "E"]);
});
