// C7 · the organizer on the admin's tournaments (tournaments.open, upcoming; tournaments.live, being played): the screens
// show none of the organizer's actions, and every route behind those actions answers 403 "Ovo nije tvoj turnir." and
// changes nothing. DECISIONS #86: a capability says what someone may do, ownership (Tournament.created_by) on which
// tournament; an organizer may "not touch anyone else's tournament", and only an admin deletes one.
// Nothing here changes the world: the API tests compare the whole tournament before and after each refused request.
import {expect, freeTeams, removeOwnTournaments, test, tournamentRequest, tournamentState} from "../../helpers/c7";
import type {Db} from "../../helpers/db";
import {escape, handRows} from "../../helpers/scorepad";

const NOT_YOURS = "Ovo nije tvoj turnir.";
// requireAdmin's and requireCan's refusal (_lib/auth/forbidden.ts)
const FORBIDDEN = "Nemaš ovlasti za ovu radnju.";

for (const key of ["open", "live"] as const) {
  test(`the admin's tournament (${key}) is not in the organizer's Turniri, and its Upravljanje turnirom says it isn't theirs`, async ({as, db, world, healthy}) => {
    const {id, name} = world.tournaments[key];
    // a C7 tournament a killed run left behind would be in the lists too
    await removeOwnTournaments(db);
    const page = await as("organizer");
    await page.goto("/turniri/upravljanje");
    const tabs = page.getByRole("tablist", {name: "Turniri"});
    // a tournament's card reads "<name> <date or Kolos> · …"; each tab lists the organizer's own and nothing else
    const cards = page.getByRole("main").getByRole("link", {name: / · /});
    for (const [tab, own] of [
      ["Nadolazeći", [world.tournaments.organizer.name]],
      ["Aktivni", []],
      ["Završeni", [world.tournaments.finishedNoDeclarations.name]],
    ] as const) {
      const tabButton = tabs.getByRole("tab", {name: new RegExp(`^${tab} ${own.length}$`)});
      await tabButton.click();
      await expect(tabButton).toHaveAttribute("aria-selected", "true");
      await expect(cards).toHaveCount(own.length);
      for (const [i, mine] of own.entries()) await expect(cards.nth(i)).toHaveAccessibleName(new RegExp(`^${escape(mine)} `));
      await expect(page.getByRole("link", {name: new RegExp(`^${escape(name)} `)})).toHaveCount(0);
    }

    // opened by its address: the refusal, and not one of the management controls
    await page.goto(`/turniri/${id}/upravljanje`);
    await expect(page.getByRole("main").getByRole("alert").filter({hasText: NOT_YOURS})).toBeVisible();
    await expect(page.getByRole("heading", {name, level: 1})).toHaveCount(0);
    await expect(page.getByRole("tablist", {name: "Upravljanje turnirom"})).toHaveCount(0);
    await expect(page.getByRole("switch")).toHaveCount(0);
    for (const action of ["Dodaj ekipu · ime ekipe", "Otkaži turnir", "Obriši turnir", "Dodaj kolo", "Spremi promjene"]) {
      await expect(page.getByRole("button", {name: action})).toHaveCount(0);
    }
    if (key === "live") {
      // the Kolo with the no-show and the table the admin gave a team: no table's status, no Uredi ishod or Vrati stol
      await page.goto(`/turniri/${id}/upravljanje?view=kola&kolo=2`);
      await expect(page.getByRole("main").getByRole("alert").filter({hasText: NOT_YOURS})).toBeVisible();
      await expect(page.getByRole("region", {name: "Statusi stolova"})).toHaveCount(0);
      await expect(page.getByRole("button", {name: /^(Uredi ishod|Vrati) Stol/})).toHaveCount(0);
      await expect(page.getByRole("timer")).toHaveCount(0);
    }
    await healthy(page);
  });
}

// a table of the live tournament's Kolo being played, with its match open (the seed's "stolovi u igri")
async function liveTable(db: Db, tournamentId: number) {
  const round = await db.round.findFirstOrThrow({
    where: {tournamentRounds: {some: {tournament_id: tournamentId}}, status: "PUBLISHED", open: true, attendance: null, team1_id: {not: 0}, team2_id: {not: 0}, ongoingMatches: {some: {}}},
    orderBy: {id: "asc"},
    include: {ongoingMatches: {include: {results: {orderBy: {result_id: "asc"}}}}},
  });
  return round;
}

test("a table of the admin's live tournament shows the organizer no scorepad, and Tko igra refuses them", async ({as, db, world, healthy}) => {
  const {id} = world.tournaments.live;
  const table = await liveTable(db, id);
  const before = await tournamentState(db, id);
  const page = await as("organizer");

  await page.goto(`/turniri/${id}/stol/${table.id}`);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  for (const action of ["Upiši igru", "Završi meč", "Tko igra"]) await expect(page.getByRole("button", {name: action, exact: true})).toHaveCount(0);
  await expect(handRows(page)).toHaveCount(0);

  // Tko igra by its address: not a player of the table, not the tournament's organizer
  await page.goto(`/round/lineup/${table.id}?turnir=${id}`);
  await expect(page.getByRole("main").getByRole("alert").filter({hasText: "Ne igraš u ovoj rundi."})).toBeVisible();
  await expect(page.getByRole("button", {name: "Potvrdi i počni"})).toBeDisabled();
  expect(await tournamentState(db, id)).toEqual(before);
  await healthy(page);
});

test("a table of the admin's live tournament tells the organizer it isn't theirs, not to check their connection", async ({as, db, world}) => {
  // BUG (Bela #86, not fixed in Bela yet; shared code): the phone scorepad (TablePhone) drops the server's 403 "Ovo nije
  // tvoj turnir." and shows "Stol se nije učitao · Provjeri vezu i pokušaj ponovno.", as if the connection had failed;
  // Upravljanje turnirom says "Ovo nije tvoj turnir."
  test.fail();
  const {id} = world.tournaments.live;
  const table = await liveTable(db, id);
  const page = await as("organizer");
  await page.goto(`/turniri/${id}/stol/${table.id}`);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(NOT_YOURS);
  await expect(page.getByText("Provjeri vezu i pokušaj ponovno.")).toHaveCount(0);
});

// ---------- the routes ----------

type Ctx = {
  id: number;
  // a team in the tournament, one that isn't (and may enter), and the tournament's Broj kola
  entry: number;
  free: number;
  rounds: number;
  body: Awaited<ReturnType<typeof tournamentRequest>>;
  // live only: a table being played, one skipped or closed by a no-show, a hand of the open match, a played match's hand
  table?: {id: number; team1: number; team2: number};
  skipped?: number;
  hand?: number;
  playedHand?: number;
};

type Action = {
  name: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  path: (c: Ctx) => string;
  data?: (c: Ctx) => unknown;
  // a table or a hand is needed (the live tournament only)
  tables?: boolean;
  error?: string;
};

const T = (c: Ctx) => `/api/admin/tournaments/${c.id}`;
// a Treseta hand as the admin's scorepad sends it: 11 points between the teams
const HAND = {custom: false, points1: 7, points2: 4};

// every organizer action on a tournament, by the route it sends (src/app/api/admin/tournaments, admin/tables, admin/hands).
// Otključaj partiju is Bela's (it came with the sync of 17 Nov 2026), with Treseta's 45 minutes; Uredi ishod and Vrati
// stol are Treseta's own (the admin or the tournament's organizer).
const ACTIONS: Action[] = [
  {name: "Upravljanje turnirom (read)", method: "get", path: T},
  {name: "Podaci · Spremi promjene", method: "patch", path: T, data: (c) => ({...c.body, name: `${c.body.name} (organizator)`, entry_fee: c.body.entry_fee + 1})},
  {name: "Obriši turnir", method: "delete", path: T, error: FORBIDDEN},
  {name: "Otkaži turnir", method: "post", path: (c) => `${T(c)}/cancel`},
  {name: "Vrati turnir", method: "delete", path: (c) => `${T(c)}/cancel`},
  {name: "Prijave otvorene / zatvorene", method: "patch", path: (c) => `${T(c)}/registrations`, data: () => ({open: false})},
  {name: "Dodaj ekipu · search", method: "get", path: (c) => `${T(c)}/candidates?q=Br`},
  {name: "Dodaj ekipu", method: "post", path: (c) => `${T(c)}/teams`, data: (c) => ({team_id: c.free})},
  {name: "Makni ekipu", method: "delete", path: (c) => `${T(c)}/teams/${c.entry}`},
  {name: "Označi dolazak", method: "patch", path: (c) => `${T(c)}/teams/${c.entry}`, data: () => ({arrived: true})},
  {name: "Aktivna", method: "patch", path: (c) => `${T(c)}/teams/${c.entry}`, data: () => ({active: false})},
  {name: "Isključi ekipu", method: "patch", path: (c) => `${T(c)}/teams/${c.entry}`, data: () => ({excluded: true})},
  {name: "Ubaci u turnir", method: "post", path: (c) => `${T(c)}/teams/${c.entry}/admit`},
  {name: "Složi kolo", method: "post", path: (c) => `${T(c)}/kola`, data: () => ({redo: true})},
  {name: "Dodaj kolo", method: "put", path: (c) => `${T(c)}/kola/${c.rounds + 1}`},
  {name: "Obriši kolo", method: "delete", path: (c) => `${T(c)}/kola/1?rezultati=1`},
  {name: "Objavi kolo", method: "post", path: (c) => `${T(c)}/kola/1/publish`},
  {name: "Novi stol", method: "post", path: (c) => `${T(c)}/kola/1/tables`, data: (c) => ({team1_id: c.entry, team2_id: c.free})},
  {name: "Uredi ishod", method: "post", path: (c) => `${T(c)}/tables/${c.skipped}/outcome`, data: () => ({outcome: "TEAM2"}), tables: true},
  {name: "Vrati stol", method: "post", path: (c) => `${T(c)}/tables/${c.skipped}/restore`, tables: true},
  {name: "the table's scorepad (read)", method: "get", path: (c) => `/api/admin/tables/${c.table!.id}`, tables: true},
  {name: "Uredi par", method: "patch", path: (c) => `/api/admin/tables/${c.table!.id}`, data: (c) => ({team1_id: c.table!.team2, team2_id: c.table!.team1}), tables: true},
  {name: "Ukloni stol", method: "delete", path: (c) => `/api/admin/tables/${c.table!.id}`, tables: true},
  {name: "Upiši igru", method: "post", path: (c) => `/api/admin/tables/${c.table!.id}/hands`, data: () => ({target: {kind: "ongoing"}, hand: HAND}), tables: true},
  {name: "Završi meč", method: "post", path: (c) => `/api/admin/tables/${c.table!.id}/finish`, tables: true},
  {name: "Otključaj partiju", method: "patch", path: (c) => `/api/admin/tables/${c.table!.id}/unlock`, data: () => ({minutes: 45}), tables: true},
  {name: "Ispravi igru (match being played)", method: "put", path: (c) => `/api/admin/hands/ongoing/${c.hand}`, data: () => HAND, tables: true},
  {name: "Obriši igru (match being played)", method: "delete", path: (c) => `/api/admin/hands/ongoing/${c.hand}`, tables: true},
  {name: "Ispravi igru (played match)", method: "put", path: (c) => `/api/admin/hands/finished/${c.playedHand}?allow_no_winner=1`, data: () => HAND, tables: true},
  {name: "Obriši igru (played match)", method: "delete", path: (c) => `/api/admin/hands/finished/${c.playedHand}?allow_no_winner=1`, tables: true},
];

async function contextOf(db: Db, id: number, live: boolean): Promise<Ctx> {
  const entry = await db.tournamentTeam.findFirstOrThrow({where: {tournament_id: id, status: "REGISTERED", active: true, excluded_at: null}, orderBy: {team_id: "asc"}});
  const [free] = await freeTeams(db, 1, {tournamentId: id});
  const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
  const c: Ctx = {id, entry: entry.team_id, free: free.id, rounds: t.rounds, body: await tournamentRequest(db, id)};
  if (!live) return c;
  const table = await liveTable(db, id);
  const skipped = await db.round.findFirstOrThrow({where: {tournamentRounds: {some: {tournament_id: id}}, attendance: {in: ["SKIPPED", "NO_SHOW"]}}, orderBy: {id: "asc"}});
  const played = await db.result.findFirstOrThrow({where: {match: {round: {tournamentRounds: {some: {tournament_id: id}}}}}, orderBy: {result_id: "asc"}});
  return {
    ...c,
    table: {id: table.id, team1: table.team1_id, team2: table.team2_id},
    skipped: skipped.id,
    hand: table.ongoingMatches[0].results[0].result_id,
    playedHand: played.result_id,
  };
}

for (const key of ["open", "live"] as const) {
  for (const action of ACTIONS.filter((a) => key === "live" || !a.tables)) {
    test(`on the admin's tournament (${key}) the organizer's ${action.name} is refused with 403 and changes nothing`, async ({organizer, db, world}) => {
      const id = world.tournaments[key].id;
      const c = await contextOf(db, id, key === "live");
      const before = await tournamentState(db, id);
      const res = await organizer[action.method](action.path(c), action.data ? {data: action.data(c)} : undefined);
      expect(res.status(), `${action.method.toUpperCase()} ${action.path(c)}: ${await res.text()}`).toBe(403);
      expect(await res.json()).toEqual({error: action.error ?? NOT_YOURS});
      expect(await tournamentState(db, id)).toEqual(before);
    });
  }
}

// the same routes are the organizer's own on their tournament: the refusal above is about whose it is, not the role
test("the organizer's own tournaments answer the same reads: Upravljanje, Dodaj ekipu's search and a table's scorepad", async ({organizer, db, world}) => {
  // a C7 tournament a killed run left behind would be in the list too
  await removeOwnTournaments(db);
  const upcoming = world.tournaments.organizer.id;
  const finished = world.tournaments.finishedNoDeclarations.id;
  const table = await db.round.findFirstOrThrow({where: {tournamentRounds: {some: {tournament_id: finished}}, team1_id: {not: 0}, team2_id: {not: 0}}, orderBy: {id: "asc"}});
  for (const path of [`/api/admin/tournaments/${upcoming}`, `/api/admin/tournaments/${upcoming}/candidates?q=Br`, `/api/admin/tournaments/${finished}`, `/api/admin/tables/${table.id}`]) {
    const res = await organizer.get(path);
    expect(res.status(), `GET ${path}: ${await res.text()}`).toBe(200);
  }
  const list = await organizer.get("/api/admin/tournaments");
  expect(list.ok()).toBeTruthy();
  const ids = ((await list.json()) as {id: number}[]).map((t) => t.id).sort((a, b) => a - b);
  expect(ids).toEqual([upcoming, finished].sort((a, b) => a - b));
});
