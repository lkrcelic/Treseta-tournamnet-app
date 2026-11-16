// C3's own setup: tournaments of the test's own, made as the admin makes them (Novi turnir, Dodaj ekipu, Prijave
// zatvorene, Složi Kolo 1, Objavi kolo) through the app's routes, with teams that have nothing else going on today, and
// removed again after the test with everything played at them (its played Kolos through Obriši kolo, so the ratings are
// counted again without them, the rest with Prisma: the app deletes a tournament only before it starts). The world's
// tournaments are only read, or put back as they were (`entries`).
import type {APIRequestContext, Page} from "@playwright/test";
import type {TournamentEntryStatus} from "@prisma/client";
import {MATCH_THRESHOLD, type MatchEnd} from "@/app/_lib/game/scoring";
import {GAME_MINUTES_DEFAULT} from "@/app/_lib/gameTime";
import {CRON_HEADERS, ONBOARDED, minutesAgo, type Db} from "./db";
import {expect, test as base} from "./fixtures";
import {addHands, escape, handRows, startMatch, type ApiHand} from "./scorepad";

// every tournament a C3 test makes is named so; one left behind by a test that crashed goes before the next test
export const OWN = "E2E C3 · ";

// ---------- time in Zagreb (the app's tournament clock) ----------

const zagrebParts = (d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"})
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );

// "2026-11-15": the Zagreb calendar day of a moment (a tournament's date)
export const zagrebDay = (d: Date = new Date()) => {
  const p = zagrebParts(d);
  return `${p.year}-${p.month}-${p.day}`;
};

// "19:52": the Zagreb wall clock of a moment, as a tournament's times are written and the app shows them
export const zagrebTime = (d: Date) => {
  const p = zagrebParts(d);
  return `${p.hour}:${p.minute}`;
};

// "0:05", "20:14": a moment as the tournament's texts say it (hour without a leading zero)
export const clock = (d: Date) => new Intl.DateTimeFormat("hr-HR", {timeZone: "Europe/Zagreb", hour: "numeric", minute: "2-digit", hourCycle: "h23"}).format(d);

export const plusMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);

// The same day a month later, as stored (UTC midnight), or that month's last day when it is shorter (31 January → 28
// February): how long a Kolo 1 no-show's sign-up ban lasts
export function monthAfter(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last)));
}

// "00:39" as the day's texts show a time ("0:39")
export const shownTime = (time: string) => time.replace(/^0(\d)/, "$1");

// A moment `minutes` from now as a time of today, kept inside today (a window can't run past midnight)
export function todayAt(minutes: number): string {
  const at = new Date(Date.now() + minutes * 60_000);
  if (zagrebDay(at) === zagrebDay()) return zagrebTime(at);
  return minutes < 0 ? "00:00" : "23:59";
}

// ---------- teams ----------

export type Player = {id: number; username: string; name: string};
// A team for a tournament of the test's own: its players (all active), and `phone`, the one who logs in (no onboarding
// sheet slides over their pages)
export type Team = {id: number; name: string; players: Player[]; phone: string};

// The days a league night or a tournament of now can be on: today, and until 06:00 the night before
function nowDays(): Date[] {
  const days = new Set([zagrebDay(), zagrebDay(new Date(Date.now() - 6 * 3_600_000))]);
  return Array.from(days).map((d) => new Date(`${d}T00:00:00.000Z`));
}

// n teams with no player in common and nothing else today: no player of theirs is in a team of today's other
// tournaments or of tonight's league tables (so no other table, question or Tu smo reaches their phones), none is
// banned, all of a team's players are active and one of them opens the app without an onboarding sheet. Always the same
// teams for the same world, in id order; `exclude` keeps teams (and their players) out, `size` takes only teams of that
// many players (Tko igra picks a team of two by itself).
export async function freeTeams(db: Db, n: number, {exclude = [], size}: {exclude?: number[]; size?: number} = {}): Promise<Team[]> {
  const days = nowDays();
  const busyTeams = new Set<number>(exclude);
  const entries = await db.tournamentTeam.findMany({
    where: {tournament: {date: {in: days}, cancelled_at: null, NOT: {tournament_name: {startsWith: OWN}}}},
    select: {team_id: true},
  });
  entries.forEach((e) => busyTeams.add(e.team_id));
  const tables = await db.round.findMany({where: {round_date: {in: days}, leagueRounds: {some: {}}}, select: {team1_id: true, team2_id: true}});
  tables.forEach((r) => [r.team1_id, r.team2_id].forEach((id) => busyTeams.add(id)));
  const busyPlayers = new Set(
    (await db.teamPlayer.findMany({where: {team_id: {in: Array.from(busyTeams)}}, select: {player_id: true}})).map((tp) => tp.player_id),
  );
  const today = new Date(`${zagrebDay()}T00:00:00.000Z`);
  const bans = await db.signupBan.findMany({where: {lifted_at: null, OR: [{until: null}, {until: {gt: today}}]}, select: {team_id: true, player_id: true}});
  const bannedTeams = new Set(bans.map((b) => b.team_id).filter((id): id is number => id != null));
  const bannedPlayers = new Set(bans.map((b) => b.player_id).filter((id): id is number => id != null));
  const onboarded = new Set((await db.player.findMany({where: ONBOARDED, select: {id: true}})).map((p) => p.id));

  const teams = await db.team.findMany({
    where: {team_id: {gt: 0}},
    orderBy: {team_id: "asc"},
    include: {teamPlayers: {include: {player: true}, orderBy: {player_id: "asc"}}},
  });
  const used = new Set<number>();
  const out: Team[] = [];
  for (const t of teams) {
    if (out.length === n) break;
    const players = t.teamPlayers.map((tp) => tp.player);
    const ids = players.map((p) => p.id);
    if (busyTeams.has(t.team_id) || bannedTeams.has(t.team_id)) continue;
    if (players.length < 2 || (size != null && players.length !== size) || players.some((p) => !p.active || p.deleted_at != null)) continue;
    if (ids.some((id) => busyPlayers.has(id) || bannedPlayers.has(id) || used.has(id))) continue;
    const phone = players.find((p) => onboarded.has(p.id));
    if (!phone) continue;
    ids.forEach((id) => used.add(id));
    out.push({
      id: t.team_id,
      name: t.team_name,
      players: players.map((p) => ({id: p.id, username: p.username, name: `${p.first_name} ${p.last_name}`})),
      phone: phone.username,
    });
  }
  if (out.length < n) throw new Error(`only ${out.length} of ${n} free teams today`);
  return out;
}

// ---------- tournaments through the admin's routes ----------

export type TournamentOptions = {
  name: string;
  date?: string;
  gathering_time?: string | null;
  start_time?: string | null;
  rounds?: number;
  matches_per_round?: 1 | 2;
  match_end?: MatchEnd;
  max_teams?: number | null;
  auto_publish?: boolean;
};

// Novi turnir as the admin's form sends it: today, no Okupljanje and no start time (so no Tu smo: every team signed up
// plays), with zvanja, to 41
export async function createTournament(admin: APIRequestContext, o: TournamentOptions): Promise<number> {
  const res = await admin.post("/api/admin/tournaments", {
    data: {
      name: `${OWN}${o.name}`,
      date: o.date ?? zagrebDay(),
      gathering_time: o.gathering_time ?? null,
      start_time: o.start_time ?? null,
      location_id: null,
      rounds: o.rounds ?? 3,
      matches_per_round: o.matches_per_round ?? 1,
      declarations: true,
      score_threshold: MATCH_THRESHOLD,
      match_end: o.match_end ?? "S_OVIM_DOSTA",
      max_teams: o.max_teams === undefined ? 16 : o.max_teams,
      entry_fee: 0,
      rules_url: null,
      prizes: [],
      game_minutes: GAME_MINUTES_DEFAULT,
      auto_publish: o.auto_publish ?? false,
      open_signups: false,
      organizer_phone: "+385 91 000 0001",
    },
  });
  expect(res.status(), `Novi turnir: ${await res.text()}`).toBe(201);
  return ((await res.json()) as {id: number}).id;
}

// Dodaj ekipu, one after another (in while there is room, then the waiting list, in this order)
export async function addTeams(admin: APIRequestContext, id: number, teams: Team[]) {
  for (const team of teams) {
    const res = await admin.post(`/api/admin/tournaments/${id}/teams`, {data: {team_id: team.id}});
    expect(res.status(), `Dodaj ekipu ${team.name}: ${await res.text()}`).toBe(201);
  }
}

// Prijave zatvorene
export async function closeSignUps(admin: APIRequestContext, id: number) {
  const res = await admin.patch(`/api/admin/tournaments/${id}/registrations`, {data: {open: false}});
  expect(res.ok(), `Prijave zatvorene: ${await res.text()}`).toBeTruthy();
}

// Složi Kolo n (the next one) and Objavi kolo
export async function publishNextKolo(admin: APIRequestContext, id: number): Promise<number> {
  const made = await admin.post(`/api/admin/tournaments/${id}/kola`, {data: {redo: false}});
  expect(made.ok(), `Složi kolo: ${await made.text()}`).toBeTruthy();
  const {made: kolo} = (await made.json()) as {made: {number: number}};
  const res = await admin.post(`/api/admin/tournaments/${id}/kola/${kolo.number}/publish`);
  expect(res.ok(), `Objavi Kolo ${kolo.number}: ${await res.text()}`).toBeTruthy();
  return kolo.number;
}

// The admin's read of Upravljanje turnirom, which runs what the tournament's clock owes now (forced: the start time's
// switch, the tables skipped at 10 minutes, the next Kolo's draft)
export async function syncClock(admin: APIRequestContext, id: number) {
  const res = await admin.get(`/api/admin/tournaments/${id}`);
  expect(res.ok(), `Upravljanje turnirom: ${await res.text()}`).toBeTruthy();
}

// /api/cron/tick: the clock's backup, as a scheduler calls it
export async function tick(api: APIRequestContext) {
  const res = await api.get("/api/cron/tick", {headers: CRON_HEADERS});
  expect(res.ok(), `tick: ${await res.text()}`).toBeTruthy();
}

export type KoloTable = {id: number; table: number; team1: Team; team2: Team | null};

// A Kolo's tables in table order, each team as the test knows it (team2 null for Slobodna runda)
export async function koloTables(db: Db, id: number, kolo: number, teams: Team[]): Promise<KoloTable[]> {
  const rounds = await db.round.findMany({where: {tournamentRounds: {some: {tournament_id: id}}, round_number: kolo}, orderBy: {table_number: "asc"}});
  const byId = (teamId: number) => teams.find((t) => t.id === teamId) ?? null;
  return rounds.map((r) => ({id: r.id, table: r.table_number!, team1: byId(r.team1_id)!, team2: byId(r.team2_id)}));
}

// The Kolo went out `minutes` ago: what Nedolazak za stol counts from (one table, or the whole Kolo)
export async function publishedAgo(db: Db, roundIds: number[], minutes: number) {
  await db.round.updateMany({where: {id: {in: roundIds}}, data: {published_at: minutesAgo(minutes)}});
}

// Plays a table's matches to the end through the app's routes, as its phones do: Tko igra, the hands, Završi meč.
// hands: per match, by the round's sides
export async function playTable(api: APIRequestContext, roundId: number, matches: ApiHand[][]) {
  for (const hands of matches) {
    const matchId = await startMatch(api, roundId);
    await addHands(api, matchId, hands);
    // the body is the match's id alone, as the phone sends it
    const res = await api.post("/api/matches", {data: JSON.stringify(matchId), headers: {"Content-Type": "application/json"}});
    expect(res.ok(), `Završi meč: ${await res.text()}`).toBeTruthy();
  }
}

// Hands of 11 without zvanja that bring a match to `a : b` by the round's sides, side 1's points spread evenly over
// them (a + b must be whole hands); the caller picks a score whose last hand is the one that decides the match
export function handsTo(a: number, b: number): ApiHand[] {
  const k = (a + b) / 11;
  if (!Number.isInteger(k) || k < 1) throw new Error(`${a} : ${b} is not a number of hands of 11`);
  const base = Math.floor(a / k);
  return Array.from({length: k}, (_, i) => {
    const p = base + (i < a % k ? 1 : 0);
    return {points: [p, 11 - p] as [number, number]};
  });
}

// Upiši igru without zvanja, Kaput for `team` (11 : 0) and Spremi: the players' Custom key at a table "na prolaz" (where
// Ručno isn't); resolves once the board lists the new hand
export async function enterKaput(page: Page, team: string) {
  const before = await handRows(page).count();
  await page.getByRole("button", {name: "Upiši igru", exact: true}).click();
  await page.getByRole("button", {name: /^(Dalje|Nema zvanja)$/}).click();
  const keypad = page.getByRole("group", {name: "Bodovi igre"});
  await expect(keypad.getByRole("button", {name: "Kaput: 11 : 0"})).toBeVisible();
  await expect(keypad.getByRole("button", {name: "Ručno"})).toHaveCount(0);
  const box = page.getByRole("radiogroup", {name: "Igra: upis za ekipu"}).getByRole("radio", {name: new RegExp(`^${escape(team)}: igra \\d+`)});
  await box.click();
  await expect(box).toBeChecked();
  await keypad.getByRole("button", {name: "Kaput: 11 : 0"}).click();
  await expect(box).toHaveAccessibleName(new RegExp(`^${escape(team)}: igra 11(,|$)`));
  await page.getByRole("button", {name: "Spremi", exact: true}).click();
  await expect(handRows(page)).toHaveCount(before + 1);
}

// Removes the tournament and everything played at it (tables, matches, hands, the bans its no-shows gave). A table
// played to the end counted in the players' ratings: its Kolos go first through the admin's Obriši kolo with the results
// (Kolo 1 takes every Kolo after it), which counts the ratings again without them; then the rest goes with Prisma.
export async function removeTournament(db: Db, admin: APIRequestContext, id: number) {
  const played = await db.result.count({where: {match: {round: {tournamentRounds: {some: {tournament_id: id}}}}}});
  if (played > 0) {
    const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
    // Obriši kolo keeps at least one Kolo
    if (t.rounds < 2) await db.tournament.update({where: {tournament_id: id}, data: {rounds: 2}});
    const res = await admin.delete(`/api/admin/tournaments/${id}/kola/1?rezultati=1`);
    expect(res.ok(), `Obriši kolo 1 s rezultatima: ${await res.text()}`).toBeTruthy();
  }
  const ids = (await db.round.findMany({where: {tournamentRounds: {some: {tournament_id: id}}}, select: {id: true}})).map((r) => r.id);
  await db.ongoingMatch.deleteMany({where: {round_id: {in: ids}}});
  await db.match.deleteMany({where: {round_id: {in: ids}}});
  await db.round.deleteMany({where: {id: {in: ids}}});
  await db.signupBan.deleteMany({where: {tournament_id: id}});
  await db.tournament.deleteMany({where: {tournament_id: id}});
}

// ---------- the world's tournaments, put back ----------

// A tournament's entries as they are, to put back after a test signs teams up, off or lets them in
export type EntriesSnapshot = {
  id: number;
  maxTeams: number | null;
  registrationsOpen: boolean;
  rows: {team_id: number; status: TournamentEntryStatus; registered_at: Date; registered_by: number | null; arrived_at: Date | null; arrived_by: number | null; arrived_by_admin: boolean; active: boolean}[];
};

export async function snapshotEntries(db: Db, id: number): Promise<EntriesSnapshot> {
  const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
  const rows = await db.tournamentTeam.findMany({
    where: {tournament_id: id},
    select: {team_id: true, status: true, registered_at: true, registered_by: true, arrived_at: true, arrived_by: true, arrived_by_admin: true, active: true},
  });
  return {id, maxTeams: t.max_teams, registrationsOpen: t.registrations_open, rows};
}

export async function restoreEntries(db: Db, s: EntriesSnapshot) {
  await db.$transaction([
    db.tournamentTeam.deleteMany({where: {tournament_id: s.id}}),
    db.tournamentTeam.createMany({data: s.rows.map((r) => ({...r, tournament_id: s.id}))}),
    db.tournament.update({where: {tournament_id: s.id}, data: {max_teams: s.maxTeams, registrations_open: s.registrationsOpen}}),
  ]);
}

// ---------- fixtures ----------

export type Own = {
  admin: APIRequestContext;
  // Novi turnir with these teams added in order (the ones past max_teams wait), the tournament's id
  make: (o: TournamentOptions, teams: Team[]) => Promise<number>;
};

export const test = base.extend<{own: Own; entries: (id: number) => Promise<void>}>({
  // tournaments of the test's own, removed after it (and any a crashed test left behind, before it)
  own: async ({api, db}, use) => {
    const admin = await api("admin");
    const sweep = async () => {
      for (const t of await db.tournament.findMany({where: {tournament_name: {startsWith: OWN}}, select: {tournament_id: true}})) {
        await removeTournament(db, admin, t.tournament_id);
      }
    };
    await sweep();
    await use({
      admin,
      make: async (o, teams) => {
        const id = await createTournament(admin, o);
        await addTeams(admin, id, teams);
        return id;
      },
    });
    await sweep();
  },
  // a world tournament's entries put back after the test, as they were before it
  entries: async ({db}, use) => {
    const shots: EntriesSnapshot[] = [];
    await use(async (id) => {
      shots.push(await snapshotEntries(db, id));
    });
    for (const s of shots.reverse()) await restoreEntries(db, s);
  },
});

export {expect};
