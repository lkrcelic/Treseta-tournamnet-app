// Section L's own setup (Lokacije and the league night at two places). The generated world has two places
// (places.pitanik, used by the leagues and tournaments, and places.dubrava, unused) and no two-place night, so each test
// gets a league of its own, "E2E · Dvije lokacije": eight new teams of two new players (onboarded, password "sifra"),
// Caffe bar Pitanik as the league's place (Zadano lige), start 00:00 so Tu smo is open whenever the league night is
// (until 06:00), two Kola a night, and nights last week (Kolo 6 played, so tonight's first Kolo is 7), next week and the
// week after. Tonight isn't a night of it until a test adds it (night()): Datumi counts days by the calendar and Novo
// kolo, Podjela and Tu smo by the league night (06:00), so a test that doesn't need tonight works on next week's night
// and runs the same after midnight. tonight is read once per test: a test running across 06:00 isn't supported. Everything is removed before and after each test, with
// the places a test added ("L · …").
import type {APIRequestContext} from "@playwright/test";
import {leagueNightString} from "@/app/_lib/dates";
import type {Db} from "./db";
import {expect, test as base} from "./fixtures";

export const LEAGUE_NAME = "E2E · Dvije lokacije";
// the teams' names, and the places a test adds in Lokacije
export const PREFIX = "L · ";
const USERNAME = "e2e.l.";

export const KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type Key = (typeof KEYS)[number];
// alphabetical as the app sorts in Croatian (Č after C)
const NAMES: Record<Key, string> = {A: "Akužavci", B: "Bura i Jugo", C: "Čarobnjaci", D: "Dva baje", E: "Evo nas", F: "Fjaka", G: "Gušti", H: "Hajduci"};
// The split the tests use: A–D at the night's first place, E–G at its second (three teams: a bye), H not placed
export const SPLIT: Partial<Record<Key, 1 | 2>> = {A: 1, B: 1, C: 1, D: 1, E: 2, F: 2, G: 2};
export const AT_FIRST: Key[] = ["A", "B", "C", "D"];
export const AT_SECOND: Key[] = ["E", "F", "G"];

export type Team = {key: Key; id: number; name: string; players: string[]};
export type Place = {id: number; name: string; address: string; url: string};

export type Liga = {
  id: number;
  name: string;
  // the league night (06:00 rule) and the nights around it, YYYY-MM-DD
  tonight: string;
  lastWeek: string;
  nextWeek: string;
  weekAfter: string;
  // the league's place (Zadano lige) and the second place of a two-place night
  pitanik: Place;
  dubrava: Place;
  teams: Record<Key, Team>;
  // the admin's request context, for setup through the app's routes
  admin: APIRequestContext;
  // Adds or changes one of the league's nights: second: Klub Dubrava as its second place; split: Podjela; arrived: the
  // teams that pressed Tu smo (tonight only)
  night: (date: string, o?: {second?: boolean; split?: Partial<Record<Key, 1 | 2>>; arrived?: Key[]}) => Promise<void>;
  // Novo kolo (the window wider than the number of Kola, as the form asks) → Odobri sva → Objavi through the admin's routes, at a place (null: a one-place night); returns the Kolo
  // numbers published
  publish: (slot: 1 | 2 | null, teams: Key[], kola: number) => Promise<number[]>;
  // tonight's tables of the league, oldest first
  tables: () => Promise<Table[]>;
};

export type Table = {id: number; round: number | null; table: number | null; slot: number | null; status: string; team1: string; team2: string; team1Id: number; team2Id: number};

export const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const addDays = (iso: string, days: number) => new Date(day(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);

// "čet 19. 11.": a night as the app writes it (Datumi, Novo kolo's eyebrow)
const WEEKDAYS = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];
export function nightLabel(iso: string): string {
  const d = day(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`;
}


// Croatian counts as the app writes them: 1 liga, 2 lige, 5 liga
export function count(n: number, [one, few, many]: [string, string, string]): string {
  const ten = n % 10;
  const hundred = n % 100;
  const form = ten === 1 && hundred !== 11 ? one : ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14) ? few : many;
  return `${n} ${form}`;
}

export async function clean(db: Db) {
  const leagues = (await db.league.findMany({where: {league_name: LEAGUE_NAME}, select: {league_id: true}})).map((l) => l.league_id);
  if (leagues.length) {
    const rounds = (await db.round.findMany({where: {leagueRounds: {some: {league_id: {in: leagues}}}}, select: {id: true}})).map((r) => r.id);
    // a bye's two 5 : 0 matches (and anything played) would stay behind without their round
    await db.match.deleteMany({where: {round_id: {in: rounds}}});
    await db.ongoingMatch.deleteMany({where: {round_id: {in: rounds}}});
    await db.round.deleteMany({where: {id: {in: rounds}}});
    await db.league.deleteMany({where: {league_id: {in: leagues}}});
  }
  await db.team.deleteMany({where: {team_name: {startsWith: PREFIX}}});
  await db.player.deleteMany({where: {username: {startsWith: USERNAME}}});
  await db.location.deleteMany({where: {name: {startsWith: PREFIX}}});
}

async function placeOf(db: Db, id: number): Promise<Place> {
  const row = await db.location.findUniqueOrThrow({where: {location_id: id}});
  return {id, name: row.name, address: row.address ?? "", url: row.url ?? ""};
}

export const test = base.extend<{liga: Liga; places: void}>({
  // Lokacije's tests add places of their own ("L · …"): none before and none after
  places: async ({db}, use) => {
    await db.location.deleteMany({where: {name: {startsWith: PREFIX}}});
    await use();
    await db.location.deleteMany({where: {name: {startsWith: PREFIX}}});
  },
  liga: async ({db, api, world}, use) => {
    await clean(db);
    const admin = await api("admin");
    const pitanik = await placeOf(db, world.places.pitanik.id);
    const dubrava = await placeOf(db, world.places.dubrava.id);
    const hash = (await db.player.findUniqueOrThrow({where: {username: world.accounts.admin.username}})).password_hash;
    const tonight = leagueNightString();
    const lastWeek = addDays(tonight, -7);
    const nextWeek = addDays(tonight, 7);
    const weekAfter = addDays(tonight, 14);

    const teams = {} as Record<Key, Team>;
    for (const key of KEYS) {
      const players: {id: number; username: string}[] = [];
      for (const n of [1, 2]) {
        const username = `${USERNAME}${key.toLowerCase()}${n}`;
        players.push(
          await db.player.create({
            data: {
              username,
              email: `${username}@e2e.test`,
              password_hash: hash,
              player_role: "PLAYER",
              first_name: n === 1 ? "Ante" : "Mate",
              last_name: NAMES[key].split(" ")[0],
              birth_date: new Date("1990-05-01T00:00:00.000Z"),
              smoker_answered: true,
            },
          }),
        );
      }
      const team = await db.team.create({data: {team_name: `${PREFIX}${NAMES[key]}`, teamPlayers: {create: players.map((p) => ({player_id: p.id}))}}});
      teams[key] = {key, id: team.team_id, name: team.team_name, players: players.map((p) => p.username)};
    }

    const league = await db.league.create({
      data: {league_name: LEAGUE_NAME, season: "E2E", start_time: "00:00", location_id: pitanik.id, rounds_per_night: 2},
    });
    const leagueId = league.league_id;
    await db.leagueTeam.createMany({data: KEYS.map((k) => ({league_id: leagueId, team_id: teams[k].id}))});
    await db.leagueNight.createMany({data: [lastWeek, nextWeek, weekAfter].map((d) => ({league_id: leagueId, night: day(d)}))});
    // last week's Kolo 6, played: tonight's first published Kolo is 7, at both places
    await db.round.create({
      data: {
        team1_id: teams.A.id,
        team2_id: teams.B.id,
        team1_wins: 2,
        team2_wins: 0,
        open: false,
        round_number: 6,
        table_number: 1,
        round_date: day(lastWeek),
        status: "PUBLISHED",
        published_at: day(lastWeek),
        leagueRounds: {create: {league_id: leagueId}},
      },
    });

    const night: Liga["night"] = async (date, o = {}) => {
      const key = {league_id_night: {league_id: leagueId, night: day(date)}};
      const second_location_id = o.second ? dubrava.id : null;
      await db.leagueNight.upsert({where: key, create: {league_id: leagueId, night: day(date), second_location_id}, update: {second_location_id}});
      if (o.split) {
        await db.leagueNightTeam.createMany({
          data: Object.entries(o.split).map(([k, slot]) => ({league_id: leagueId, night: day(date), team_id: teams[k as Key].id, slot: slot!})),
        });
      }
      if (o.arrived?.length) {
        await db.leagueArrival.createMany({data: o.arrived.map((k) => ({league_id: leagueId, night: day(date), team_id: teams[k].id, by_admin: true}))});
      }
    };

    const publish: Liga["publish"] = async (slot, keys, kola) => {
      const created = await admin.post("/api/rounds/generate-multiple", {
        data: {league_id: leagueId, present_teams: keys.map((k) => teams[k].id), numberOfRounds: kola, windowSize: 2 * kola, allowRepeats: true, location_slot: slot},
      });
      expect(created.status(), `Novo kolo: ${await created.text()}`).toBe(201);
      const q = slot ? `?slot=${slot}` : "";
      for (const step of ["approve", "publish"]) {
        const res = await admin.post(`/api/leagues/${leagueId}/nights/${tonight}/${step}${q}`);
        expect(res.ok(), `${step}: ${await res.text()}`).toBeTruthy();
        if (step === "publish") return ((await res.json()) as {rounds: number[]}).rounds;
      }
      return [];
    };

    const tables: Liga["tables"] = async () => {
      const rows = await db.round.findMany({
        where: {leagueRounds: {some: {league_id: leagueId}}, round_date: day(tonight)},
        orderBy: [{location_slot: "asc"}, {draft_order: "asc"}, {round_number: "asc"}, {table_number: "asc"}],
        include: {team1: true, team2: true},
      });
      return rows.map((r) => ({
        id: r.id,
        round: r.round_number,
        table: r.table_number,
        slot: r.location_slot,
        status: r.status,
        team1: r.team1.team_name,
        team2: r.team2.team_name,
        team1Id: r.team1_id,
        team2Id: r.team2_id,
      }));
    };

    await use({id: leagueId, name: LEAGUE_NAME, tonight, lastWeek, nextWeek, weekAfter, pitanik, dubrava, teams, admin, night, publish, tables});
    await clean(db);
  },
});

export {expect};
