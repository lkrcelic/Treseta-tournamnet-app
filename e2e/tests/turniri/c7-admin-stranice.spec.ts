// C7 · the organizer and the admin's own pages, on the phone: the league's management (Upravljanje ligom, Nova liga,
// Sponzori) and the players (a player's page, editing a player, a role, a ban). DECISIONS #86 / CHANGELOG 07.11.: an
// organizer may open the Igrači list with names, teams and phone numbers, and may not touch the league (Novo kolo,
// Upravljanje ligom, večeri, Datumi), edit or delete a player, give a role, see emails or birth dates, or open
// Sponzori. The screens hide it, and every route behind it answers 403 and changes nothing. Treseta's own league routes
// are among them (BELA_SYNC.md · Conferences, Lokacije): Konferencije, Podjela, Uredi večer, and changing or deleting a
// place (location.manage; the organizer has only location.create, to pick and add a place on the tournament form).
import {expect, test} from "../../helpers/c7";
import type {Db} from "../../helpers/db";

// requireAdmin's and requireCan's refusal (_lib/auth/forbidden.ts)
const FORBIDDEN = "Nemaš ovlasti za ovu radnju.";

test("on the phone the league's management and Nova liga stay the admin's, and Sponzori sends the organizer to Početna", async ({as, world, healthy}) => {
  const page = await as("organizer");
  for (const path of [`/league/${world.leagues.current.id}/manage`, "/league/new"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", {name: "Ovo se uređuje na računalu."})).toBeVisible();
    await expect(page.getByRole("tablist")).toHaveCount(0);
    for (const action of ["Novo kolo", "Kreiraj ligu", "Dodaj večer", "Spremi promjene"]) await expect(page.getByRole("button", {name: action})).toHaveCount(0);
  }
  // Početna, without a sponsor's controls (that Početna is the organizer's Turniri is c7-svoj-turnir's, Bela 52ef6b3)
  await page.goto("/sponzori");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("main").getByRole("heading", {level: 1})).toBeVisible();
  for (const action of ["Novi sponzor", "Dodaj sponzora"]) await expect(page.getByRole("button", {name: action})).toHaveCount(0);
  await healthy(page);
});

// a player with every private field filled in: a phone, an email (always there), a birth date, Pušač
const fullPlayer = (db: Db) =>
  db.player.findFirstOrThrow({where: {player_role: "PLAYER", active: true, phone: {not: null}, birth_date: {not: null}, smoker_answered: true}, orderBy: {id: "asc"}});

test("a player's page shows the organizer none of the admin's controls and none of the player's private data", async ({as, db, healthy}) => {
  const player = await fullPlayer(db);
  const page = await as("organizer");
  await page.goto(`/players/${player.id}`);
  await expect(page.getByRole("heading", {name: `${player.first_name} ${player.last_name}`, level: 1})).toBeVisible();
  const data = page.getByRole("region", {name: "Osobni podaci"});
  await expect(data.getByRole("term").first()).toHaveText("Ime");
  for (const term of ["Email", "Datum rođenja", "Pušač"]) await expect(data.getByRole("term").filter({hasText: term})).toHaveCount(0);
  await expect(data).not.toContainText(player.email);

  for (const action of ["Uredi podatke", "Deaktiviraj račun", "Obriši igrača", "Zabrani prijave igraču", "Makni sliku"]) {
    await expect(page.getByRole("button", {name: action})).toHaveCount(0);
  }
  await expect(page.getByRole("radiogroup", {name: "Rola"})).toHaveCount(0);
  await expect(page.getByRole("switch", {name: /^Zabrani novu sliku/})).toHaveCount(0);
  await healthy(page);
});

test("a player's overview sends the organizer the phone number and nothing else private", async ({organizer, db}) => {
  // DECISIONS #86/#88: the phone for the player, admins and an organizer; email, birth date and Pušač for the first two
  const player = await fullPlayer(db);
  const overview = await organizer.get(`/api/players/${player.id}/overview`);
  expect(overview.ok(), await overview.text()).toBeTruthy();
  const {player: seen, full} = (await overview.json()) as {player: Record<string, unknown>; full: boolean};
  expect([seen.phone, full]).toEqual([player.phone, false]);
  for (const key of ["email", "birth_date", "smoker"]) expect(seen[key] ?? null, key).toBeNull();
});

test("a player's page shows the organizer the player's phone number", async ({as, db}) => {
  // BUG (Bela 8db335f, DECISIONS #99): the server sends the organizer the phone (privacy.ts, player.contact: "they call
  // the teams of their tournament"), but Osobni podaci (personalRows in _lib/ui/profiles.ts) shows Mobitel only with full
  // access, so the organizer sees Ime, Prezime and Korisničko ime and the note that the phone is for the player and
  // admins alone. Bela's personalRows adds the row when the server sent the phone; it comes with the sync.
  test.fail();
  const player = await fullPlayer(db);
  const page = await as("organizer");
  await page.goto(`/players/${player.id}`);
  const data = page.getByRole("region", {name: "Osobni podaci"});
  await expect(data.getByRole("term").first()).toHaveText("Ime");
  await expect(data.getByRole("term")).toHaveText(["Ime", "Prezime", "Korisničko ime", "Mobitel"]);
  await expect(data.getByRole("definition").last()).toHaveText(player.phone!);
});

// ---------- the routes ----------

type Ctx = {organizer: number; player: number; team: number; league: number; tonight: string; leagueTable: number; place: number};

type Action = {name: string; method: "get" | "post" | "put" | "patch" | "delete"; path: (c: Ctx) => string; data?: (c: Ctx) => unknown};

// what the admin does to the league and to players, by the route it sends
const ACTIONS: Action[] = [
  {name: "Rola · the organizer makes themselves an admin", method: "patch", path: (c) => `/api/admin/players/${c.organizer}`, data: () => ({role: "ADMIN"})},
  {name: "Uredi podatke of a player", method: "patch", path: (c) => `/api/admin/players/${c.player}`, data: () => ({first_name: "Preimenovan"})},
  {name: "Deaktiviraj račun", method: "patch", path: (c) => `/api/admin/players/${c.player}/active`, data: () => ({active: false})},
  {name: "Obriši igrača", method: "delete", path: (c) => `/api/admin/players/${c.player}`},
  {name: "Zabrana prijava (list)", method: "get", path: () => "/api/admin/bans"},
  {name: "Zabrani prijave ekipi", method: "post", path: () => "/api/admin/bans", data: (c) => ({team_id: c.team, until: null, reason: "organizator"})},
  {name: "Nova liga", method: "post", path: () => "/api/leagues", data: () => ({league_name: "Organizatorova liga", season: "2026"})},
  {name: "Podaci lige · Spremi promjene", method: "patch", path: (c) => `/api/leagues/${c.league}`, data: () => ({league_name: "Preimenovana liga"})},
  {name: "Ekipe lige (list)", method: "get", path: (c) => `/api/leagues/${c.league}/teams`},
  {name: "Dodaj ekipu u ligu", method: "post", path: (c) => `/api/leagues/${c.league}/teams`, data: (c) => ({team_id: c.team})},
  {name: "Dodaj večer", method: "post", path: (c) => `/api/leagues/${c.league}/nights`, data: () => ({date: "2026-12-31"})},
  {name: "Novo kolo", method: "post", path: () => "/api/rounds/generate-multiple", data: (c) => ({league_id: c.league, present_teams: [], numberOfRounds: 1, windowSize: 2, allowRepeats: true})},
  {name: "Objavi kola večeri", method: "post", path: (c) => `/api/leagues/${c.league}/nights/${c.tonight}/publish`},
  {name: "Kola lige (list)", method: "get", path: (c) => `/api/admin/leagues/${c.league}/rounds`},
  {name: "Obriši kolo lige", method: "delete", path: (c) => `/api/admin/leagues/${c.league}/rounds?date=${c.tonight}&round_number=1`},
  {name: "a league table's scorepad (read)", method: "get", path: (c) => `/api/admin/tables/${c.leagueTable}`},
  {name: "Upiši igru on a league table", method: "post", path: (c) => `/api/admin/tables/${c.leagueTable}/hands`, data: () => ({target: {kind: "ongoing"}, hand: {custom: false, points1: 7, points2: 4}})},
  // Treseta's own: conferences, a night at two places, Lokacije
  {name: "Konferencije · Spremi (an empty list turns them off)", method: "put", path: (c) => `/api/leagues/${c.league}/conferences`, data: () => ({conferences: []})},
  {name: "Podijeli po konferencijama", method: "put", path: (c) => `/api/leagues/${c.league}/conferences/teams`, data: (c) => ({teams: [{team_id: c.team, conference_id: null}]})},
  {name: "Podjela (read)", method: "get", path: (c) => `/api/leagues/${c.league}/nights/${c.tonight}/split`},
  {name: "Podjela · a team to a place", method: "put", path: (c) => `/api/leagues/${c.league}/nights/${c.tonight}/split`, data: (c) => ({teams: [{team_id: c.team, slot: 2}]})},
  {name: "Uredi večer · Druga lokacija", method: "patch", path: (c) => `/api/leagues/${c.league}/nights/${c.tonight}`, data: (c) => ({second_location_id: c.place})},
  {name: "Obriši večer", method: "delete", path: (c) => `/api/leagues/${c.league}/nights/${c.tonight}`},
  {name: "Lokacije · Uredi lokaciju", method: "patch", path: (c) => `/api/locations/${c.place}`, data: () => ({name: "Organizatorova lokacija"})},
  {name: "Lokacije · Obriši lokaciju", method: "delete", path: (c) => `/api/locations/${c.place}`},
];

// what any of those requests could change
async function leagueState(db: Db, c: Ctx) {
  return {
    players: await db.player.findMany({where: {id: {in: [c.organizer, c.player]}}, orderBy: {id: "asc"}}),
    leagues: await db.league.findMany({orderBy: {league_id: "asc"}}),
    leagueTeams: await db.leagueTeam.findMany({where: {league_id: c.league}, orderBy: {team_id: "asc"}}),
    conferences: await db.conference.findMany({where: {league_id: c.league}, orderBy: {conference_id: "asc"}}),
    nights: await db.leagueNight.findMany({where: {league_id: c.league}, orderBy: {night: "asc"}}),
    nightTeams: await db.leagueNightTeam.findMany({where: {league_id: c.league}, orderBy: [{night: "asc"}, {team_id: "asc"}]}),
    places: await db.location.findMany({orderBy: {location_id: "asc"}}),
    rounds: await db.round.findMany({where: {leagueRounds: {some: {league_id: c.league}}}, orderBy: {id: "asc"}}),
    ongoing: await db.ongoingMatch.findMany({where: {round_id: c.leagueTable}, include: {results: true}}),
    bans: await db.signupBan.findMany({orderBy: {id: "asc"}}),
  };
}

for (const action of ACTIONS) {
  test(`the organizer's ${action.name} is refused with 403 and changes nothing`, async ({organizer, db, world}) => {
    const league = world.leagues.current;
    const table = world.tables.correction;
    const c: Ctx = {
      organizer: world.accounts.organizer.id,
      player: world.accounts.player.id,
      team: world.teams.player.id,
      league: league.id,
      tonight: league.tonight!,
      leagueTable: table.roundId,
      place: world.places.dubrava.id,
    };
    const before = await leagueState(db, c);
    const res = await organizer[action.method](action.path(c), action.data ? {data: action.data(c)} : undefined);
    expect(res.status(), `${action.method.toUpperCase()} ${action.path(c)}: ${await res.text()}`).toBe(403);
    expect(await res.json()).toEqual({error: FORBIDDEN});
    expect(await leagueState(db, c)).toEqual(before);
  });
}
