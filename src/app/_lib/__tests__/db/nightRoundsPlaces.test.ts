import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {leagueNight} from "@/app/_lib/dates";
import {myTonight, teamArrivalAction} from "@/app/_lib/service/league/arrival";

// Broj kola and the end of a league night for Potvrda dolaska (BELA_SYNC.md, Lokacije), against a real Postgres: the
// night's own number, not the league's, is what each place plays; a place's last Kolo is counted at that place; a Kolo
// counts as played only when every one of its tables is closed; and a night at two places is over only when both have
// played that many Kola, a one-place night when it has. Run with `npm run test:db` and DATABASE_URL on a throwaway
// database with the migrations applied.

const tag = `nr${Date.now()}`;
const tonight = leagueNight();
const LAST_ROUND = "Zadnje kolo večeri je već počelo: više se ne može uskočiti.";
const OVER = "Večer je završila.";
// two leagues: "two" plays tonight at Kartaš and Lanterna, "one" at one place
const leagues = {two: 0, one: 0};
const places: number[] = [];
// two: A and D at Kartaš (1), B and E at Lanterna (2); one: F and G
type Name = "A" | "B" | "D" | "E" | "F" | "G";
const teams: Record<Name, number> = {A: 0, B: 0, D: 0, E: 0, F: 0, G: 0};
const players: Record<string, number> = {};
const leagueOf = (name: Name) => (name === "F" || name === "G" ? leagues.one : leagues.two);
const viewer = (name: Name) => ({id: players[name], player_role: "PLAYER"});
const card = async (name: Name) => (await myTonight([{league_id: leagueOf(name), team_id: teams[name], start: "00:00"}])).get(`${leagueOf(name)}|${teams[name]}`);
const action = (name: Name, what: "confirm" | "leave") => teamArrivalAction(leagueOf(name), teams[name], viewer(name), what);

// A published table of Kolo n at a place (slot null: the one-place league), open until its match is played
const table = (n: number, slot: 1 | 2 | null, open: boolean, tableNumber = 1) => {
  const [one, two] = slot === 1 ? [teams.A, teams.D] : slot === 2 ? [teams.B, teams.E] : [teams.F, teams.G];
  return prisma.round.create({
    data: {
      team1_id: one,
      team2_id: two,
      round_number: n,
      table_number: tableNumber,
      round_date: tonight,
      status: "PUBLISHED",
      published_at: new Date(),
      open,
      location_slot: slot,
      leagueRounds: {create: {league_id: slot == null ? leagues.one : leagues.two}},
    },
  });
};
const closeAll = (leagueId: number) => prisma.round.updateMany({where: {leagueRounds: {some: {league_id: leagueId}}}, data: {open: false}});

before(async () => {
  for (const name of ["Kartaš", "Lanterna"]) places.push((await prisma.location.create({data: {name: `${tag} ${name}`}})).location_id);
  // "00:00" on tonight's night: the night has started and Tu smo works until 06:00, whenever the test runs. Both
  // leagues play 2 Kola a night; tonight the two-place one plays 3 (Datumi).
  for (const kind of ["two", "one"] as const) {
    const league = await prisma.league.create({data: {league_name: `${tag} ${kind}`, location_id: places[0], start_time: "00:00", rounds_per_night: 2}});
    leagues[kind] = league.league_id;
  }
  await prisma.leagueNight.create({data: {league_id: leagues.two, night: tonight, second_location_id: places[1], rounds_per_night: 3}});
  await prisma.leagueNight.create({data: {league_id: leagues.one, night: tonight}});
  for (const name of Object.keys(teams) as Name[]) {
    const player = await prisma.player.create({data: {username: `${tag}${name}`.toLowerCase(), email: `${tag}${name}@example.com`, password_hash: "x", player_role: "PLAYER", first_name: name, last_name: tag}});
    players[name] = player.id;
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`, teamPlayers: {create: {player_id: player.id}}}});
    teams[name] = team.team_id;
    await prisma.leagueTeam.create({data: {league_id: leagueOf(name), team_id: team.team_id}});
    if (leagueOf(name) === leagues.two) {
      await prisma.leagueNightTeam.create({data: {league_id: leagues.two, night: tonight, team_id: team.team_id, slot: name === "A" || name === "D" ? 1 : 2}});
    }
  }
});

after(async () => {
  const ids = Object.values(leagues);
  await prisma.round.deleteMany({where: {leagueRounds: {some: {league_id: {in: ids}}}}});
  await prisma.leagueArrival.deleteMany({where: {league_id: {in: ids}}});
  await prisma.league.deleteMany({where: {league_id: {in: ids}}});
  await prisma.teamPlayer.deleteMany({where: {team_id: {in: Object.values(teams)}}});
  await prisma.team.deleteMany({where: {team_id: {in: Object.values(teams)}}});
  await prisma.player.deleteMany({where: {id: {in: Object.values(players)}}});
  await prisma.location.deleteMany({where: {location_id: {in: places}}});
  await prisma.$disconnect();
});

test("a place's last Kolo is the night's own Broj kola, counted at that place", async () => {
  // Lanterna's teams come in while nothing is published there
  assert.equal((await action("B", "confirm")).arrival?.here, true);
  assert.equal((await action("E", "confirm")).arrival?.here, true);
  // Kartaš has published 2 Kola: the league's number, not tonight's 3, so D can still jump in
  await table(1, 1, true);
  await table(2, 1, true);
  assert.equal((await card("D"))?.last_round, false);
  assert.equal((await action("D", "confirm")).arrival?.here, true);
  // Kartaš's 3rd Kolo is its last; Lanterna, with none published, isn't affected
  await table(3, 1, true);
  assert.equal((await card("A"))?.last_round, true);
  assert.equal((await card("B"))?.last_round, false);
  await assert.rejects(action("A", "confirm"), {message: LAST_ROUND});
});

test("a night at two places is over only when both have played its Broj kola, every table closed", async () => {
  // Kartaš has played all 3 of its Kola, Lanterna 2 of 3: the night goes on at both places
  await closeAll(leagues.two);
  await table(1, 2, false);
  await table(2, 2, false);
  assert.ok(await card("A"), "Kartaš's teams still see the night");
  assert.ok(await card("B"), "Lanterna's teams still see the night");
  // Lanterna's 3rd Kolo is out, one of its two tables still playing: published isn't played, the night goes on
  await table(3, 2, false, 1);
  const playing = await table(3, 2, true, 2);
  assert.ok(await card("B"), "a table still playing keeps the night on");
  assert.equal((await action("E", "leave")).arrival?.here, false);

  // its last table closes: the night is over for everyone, as at 06:00
  await prisma.round.update({where: {id: playing.id}, data: {open: false}});
  assert.equal(await card("A"), undefined);
  assert.equal(await card("B"), undefined);
  await assert.rejects(action("B", "leave"), {message: OVER});
  await assert.rejects(action("E", "confirm"), {message: OVER});
});

test("a one-place night is over when its Broj kola are played, every table closed", async () => {
  // the league's 2 Kola a night (no Broj kola of its own tonight)
  assert.equal((await action("F", "confirm")).arrival?.here, true);
  await table(1, null, false);
  await table(2, null, false, 1);
  const playing = await table(2, null, true, 2);
  assert.ok(await card("F"), "a table still playing keeps the night on");
  assert.equal((await action("F", "leave")).arrival?.here, false);

  await prisma.round.update({where: {id: playing.id}, data: {open: false}});
  assert.equal(await card("F"), undefined);
  await assert.rejects(action("G", "confirm"), {message: OVER});
});
