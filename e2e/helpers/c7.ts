// C7's own setup: the organizer (accounts.organizer) on tournaments of their own. The seeded ones (tournaments.organizer,
// tournaments.finishedNoDeclarations) are put back by each test; a tournament of today, for the day's flows (arrival,
// Kolo 1, a skipped table), is made by the test itself through the organizer's own routes (Novi turnir, Dodaj ekipu,
// Prijave, Složi Kolo, Objavi) and removed afterwards, so --repeat-each always starts from the same point.
import {expect, type APIRequestContext} from "@playwright/test";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {GAME_MINUTES_DEFAULT} from "@/app/_lib/gameTime";
import type {Db} from "./db";
import {test as base} from "./fixtures";

// every tournament a C7 test makes is named so, and removed after the test (and before it, should a run have died)
export const OWN_PREFIX = "C7 · ";

export type Side = {id: number; name: string};

export type Own = {
  id: number;
  name: string;
  // the teams signed up, in the order they were added
  teams: Side[];
};

export type OwnOptions = {
  // Okupljanje 00:00 and Početak 23:59 on today's date: Potvrda dolaska is open all day (DECISIONS #86's "dolasci"); without
  // it the tournament has no start time, so no arrival window, and its sign-ups close with the switch
  arrival?: boolean;
  teams?: number;
  rounds?: number;
  // Prijave zatvorene, Složi Kolo 1 and Objavi kolo, as the organizer
  kolo1?: boolean;
};

type C7 = {
  // the organizer's and the admin's request contexts, for setup through the app's routes
  organizer: APIRequestContext;
  admin: APIRequestContext;
  // a tournament of today made by the organizer, removed after the test
  own: (options?: OwnOptions) => Promise<Own>;
};

export const test = base.extend<C7>({
  organizer: async ({api}, use) => {
    await use(await api("organizer"));
  },
  admin: async ({api}, use) => {
    await use(await api("admin"));
  },
  own: async ({organizer, db}, use) => {
    await removeOwnTournaments(db);
    await use((options) => makeOwnTournament(organizer, db, options));
    await removeOwnTournaments(db);
  },
});

export {expect} from "./fixtures";

// The tournament's day in Zagreb, as Tournament.date stores it ("2026-11-15")
export function todayInZagreb(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit"}).format(now);
}

// "0:05", "20:14": the Zagreb wall clock of a moment, as the tournament's screens write a time (hour without a leading zero)
export function zagrebClock(moment: Date): string {
  return new Intl.DateTimeFormat("hr-HR", {timeZone: "Europe/Zagreb", hour: "numeric", minute: "2-digit", hourCycle: "h23"}).format(moment);
}

// The league night (before 06:00 still the evening before), as a league round's round_date
function tonightInZagreb(now = new Date()): string {
  return todayInZagreb(new Date(now.getTime() - 6 * 60 * 60_000));
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Teams that may enter a tournament of today: two active players or more, no sign-up ban on the team or a player, and
// no player who plays today elsewhere (a tournament of today, a league table tonight) or is already in `tournamentId`.
// No two of them share a player. Alphabetical, so every run picks the same.
export async function freeTeams(db: Db, n: number, {tournamentId, skip = []}: {tournamentId?: number; skip?: number[]} = {}): Promise<Side[]> {
  const days = Array.from(new Set([todayInZagreb(), tonightInZagreb()])).map(day);
  const busyTeams = new Set<number>(skip);
  for (const e of await db.tournamentTeam.findMany({where: {OR: [{tournament: {date: {in: days}}}, ...(tournamentId ? [{tournament_id: tournamentId}] : [])]}, select: {team_id: true}})) {
    busyTeams.add(e.team_id);
  }
  for (const r of await db.round.findMany({where: {round_date: {in: days}}, select: {team1_id: true, team2_id: true}})) {
    busyTeams.add(r.team1_id);
    busyTeams.add(r.team2_id);
  }
  const busyPlayers = new Set((await db.teamPlayer.findMany({where: {team_id: {in: Array.from(busyTeams)}}, select: {player_id: true}})).map((tp) => tp.player_id));
  const now = new Date();
  const bans = await db.signupBan.findMany({where: {lifted_at: null, OR: [{until: null}, {until: {gt: now}}]}, select: {team_id: true, player_id: true}});
  const bannedTeams = new Set(bans.map((b) => b.team_id).filter((id): id is number => id != null));
  const bannedPlayers = new Set(bans.map((b) => b.player_id).filter((id): id is number => id != null));

  const teams = await db.team.findMany({
    where: {team_id: {not: 0}},
    orderBy: {team_name: "asc"},
    select: {team_id: true, team_name: true, teamPlayers: {select: {player: {select: {id: true, active: true, deleted_at: true}}}}},
  });
  const used = new Set<number>();
  const out: Side[] = [];
  for (const t of teams) {
    if (out.length === n) break;
    const players = t.teamPlayers.map((tp) => tp.player).filter((p) => p.deleted_at == null);
    const ids = players.map((p) => p.id);
    if (players.filter((p) => p.active).length < 2) continue;
    if (busyTeams.has(t.team_id) || bannedTeams.has(t.team_id)) continue;
    if (ids.some((id) => busyPlayers.has(id) || bannedPlayers.has(id) || used.has(id))) continue;
    ids.forEach((id) => used.add(id));
    out.push({id: t.team_id, name: t.team_name});
  }
  if (out.length < n) throw new Error(`only ${out.length} of ${n} teams are free to enter a tournament today`);
  return out;
}

// Novi turnir as the organizer sends it (Treseta's form: a place from Lokacije, with zvanja, to 41, "s ovim dosta"),
// then Dodaj ekipu for each team, then (kolo1) Prijave zatvorene, Složi Kolo 1 and Objavi kolo
export async function makeOwnTournament(organizer: APIRequestContext, db: Db, {arrival = false, teams = 4, rounds = 2, kolo1 = false}: OwnOptions = {}): Promise<Own> {
  const name = `${OWN_PREFIX}Organizatorov dan`;
  const created = await organizer.post("/api/admin/tournaments", {
    data: {
      name,
      date: todayInZagreb(),
      gathering_time: arrival ? "00:00" : null,
      start_time: arrival ? "23:59" : null,
      location_id: null,
      rounds,
      matches_per_round: 1,
      declarations: true,
      score_threshold: MATCH_THRESHOLD,
      match_end: "S_OVIM_DOSTA",
      max_teams: teams,
      entry_fee: 0,
      rules_url: null,
      prizes: [],
      game_minutes: GAME_MINUTES_DEFAULT,
      auto_publish: false,
      open_signups: false,
      organizer_phone: "+385 91 000 0003",
    },
  });
  expect(created.status(), `Novi turnir: ${await created.text()}`).toBe(201);
  const {id} = (await created.json()) as {id: number};
  const sides = await freeTeams(db, teams);
  for (const team of sides) {
    const added = await organizer.post(`/api/admin/tournaments/${id}/teams`, {data: {team_id: team.id}});
    expect(added.status(), `Dodaj ekipu ${team.name}: ${await added.text()}`).toBe(201);
  }
  if (kolo1) await publishKolo1(organizer, id);
  return {id, name, teams: sides};
}

// Prijave zatvorene, Složi Kolo 1, Objavi kolo: the organizer's three taps that start their tournament
export async function publishKolo1(organizer: APIRequestContext, id: number) {
  const closed = await organizer.patch(`/api/admin/tournaments/${id}/registrations`, {data: {open: false}});
  expect(closed.ok(), `Prijave zatvorene: ${await closed.text()}`).toBeTruthy();
  const made = await organizer.post(`/api/admin/tournaments/${id}/kola`, {data: {}});
  expect(made.status(), `Složi Kolo 1: ${await made.text()}`).toBe(201);
  const published = await organizer.post(`/api/admin/tournaments/${id}/kola/1/publish`);
  expect(published.ok(), `Objavi kolo: ${await published.text()}`).toBeTruthy();
}

// Kolo n's tables (the bye's left out), by table number, with their teams' names
export async function koloTables(db: Db, tournamentId: number, n: number) {
  const rounds = await db.round.findMany({
    where: {tournamentRounds: {some: {tournament_id: tournamentId}}, round_number: n, team1_id: {not: 0}, team2_id: {not: 0}},
    orderBy: {table_number: "asc"},
    include: {team1: true, team2: true},
  });
  return rounds.map((r) => ({id: r.id, table: r.table_number!, team1: {id: r.team1_id, name: r.team1.team_name}, team2: {id: r.team2_id, name: r.team2.team_name}}));
}

// Nedolazak za stol: the tables' Kolo went out `minutes` ago (only these tables' clocks move), then the organizer's read
// of Upravljanje turnirom runs what the day owes for this tournament alone (syncTournament; Treseta: 10 minutes without a
// game or an answer skips a table). /api/cron/tick would run every tournament's clock, the world's too. Returns the
// moment the tables went out.
export async function tableOutFor(db: Db, organizer: APIRequestContext, tournamentId: number, roundIds: number | number[], minutes: number): Promise<Date> {
  const out = new Date(Date.now() - minutes * 60_000);
  await db.round.updateMany({where: {id: {in: ([] as number[]).concat(roundIds)}}, data: {published_at: out}});
  const read = await organizer.get(`/api/admin/tournaments/${tournamentId}`);
  expect(read.ok(), `Upravljanje turnirom: ${await read.text()}`).toBeTruthy();
  return out;
}

// The tournament as Podaci sends it back (the whole form), from its row: a valid body for Spremi promjene
export async function tournamentRequest(db: Db, id: number) {
  const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}, include: {prizes: {orderBy: {place: "asc"}}}});
  return {
    name: t.tournament_name,
    date: t.date.toISOString().slice(0, 10),
    gathering_time: t.gathering_time,
    start_time: t.start_time,
    location_id: t.location_id,
    rounds: t.rounds,
    matches_per_round: t.matches_per_round,
    declarations: t.declarations,
    score_threshold: t.score_threshold,
    match_end: t.match_end,
    max_teams: t.max_teams,
    entry_fee: t.entry_fee,
    rules_url: t.rules_url,
    prizes: t.prizes.map((p) => ({prize: p.prize, description: p.description})),
    game_minutes: t.game_minutes,
    auto_publish: t.auto_publish,
    open_signups: t.open_signups,
    organizer_phone: t.organizer_phone,
  };
}

// Everything a tournament is made of, to compare before and after a request that must change nothing
export async function tournamentState(db: Db, id: number) {
  const roundIds = (await db.tournamentRound.findMany({where: {tournament_id: id}, select: {round_id: true}})).map((r) => r.round_id);
  return {
    tournament: await db.tournament.findUnique({where: {tournament_id: id}, include: {prizes: true}}),
    entries: await db.tournamentTeam.findMany({where: {tournament_id: id}, orderBy: {team_id: "asc"}}),
    tables: await db.round.findMany({where: {id: {in: roundIds}}, orderBy: {id: "asc"}}),
    matches: await db.match.findMany({where: {round_id: {in: roundIds}}, orderBy: {id: "asc"}, include: {results: {orderBy: {result_id: "asc"}}}}),
    ongoing: await db.ongoingMatch.findMany({where: {round_id: {in: roundIds}}, orderBy: {id: "asc"}, include: {results: {orderBy: {result_id: "asc"}}}}),
    lineups: await db.roundPlayer.findMany({where: {round_id: {in: roundIds}}, orderBy: [{round_id: "asc"}, {player_id: "asc"}]}),
    bans: await db.signupBan.findMany({where: {tournament_id: id}, orderBy: {id: "asc"}}),
  };
}

// Removes every tournament a C7 test made, with all that hangs on it, as the admin's Obriši would (and what it can't:
// a started one, its tables and the sign-up bans its Kolo 1 gave). Nothing of it was rated (no table played to the end).
export async function removeOwnTournaments(db: Db) {
  const mine = await db.tournament.findMany({where: {tournament_name: {startsWith: OWN_PREFIX}}, select: {tournament_id: true}});
  for (const {tournament_id: id} of mine) {
    const ids = (await db.tournamentRound.findMany({where: {tournament_id: id}, select: {round_id: true}})).map((r) => r.round_id);
    await db.$transaction([
      db.ongoingMatch.deleteMany({where: {round_id: {in: ids}}}),
      db.match.deleteMany({where: {round_id: {in: ids}}}),
      db.round.deleteMany({where: {id: {in: ids}}}),
      db.signupBan.deleteMany({where: {tournament_id: id, via_ban_id: {not: null}}}),
      db.signupBan.deleteMany({where: {tournament_id: id}}),
      db.tournament.delete({where: {tournament_id: id}}),
    ]);
  }
}
