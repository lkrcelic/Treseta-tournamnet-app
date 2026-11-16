// C3 · signing up for a tournament on the phone: Prijavi se and Odjavi se (tournaments.open), the waiting list and its
// order, a team leaving that lets the first waiting one in (tournaments.fullWaiting), sign-ups refused when closed or
// cancelled (tournaments.closed, tournaments.cancelled), and a tournament played "na prolaz" (tournaments.naProlaz).
// The tests that sign teams up or off put the tournament's entries back as they were (the `entries` fixture).
// Expected values (Bela's DECISIONS on Turniri, BELA_SYNC.md · Turniri): a full tournament takes new teams on the waiting
// list, in the order they signed up; a team that was in and signs off frees its place for the first team waiting, which
// comes in without a notice; closed or cancelled sign-ups are refused with the reason; the rules line of a "na prolaz"
// tournament reads "41 · zvanja · na prolaz".
import {expect, test} from "../../helpers/c3";
import {ONBOARDED} from "../../helpers/db";

test("Prijavi se signs the player's team up for an open tournament, and Odjavi se takes it off again", async ({as, db, world, entries, healthy}) => {
  const {id} = world.tournaments.open;
  const team = world.teams.player;
  await entries(id);
  const before = await db.tournamentTeam.count({where: {tournament_id: id}});
  expect(await db.tournamentTeam.count({where: {tournament_id: id, team_id: team.id}})).toBe(0);

  const page = await as("player");
  await page.goto(`/turniri/${id}`);
  const open = page.getByRole("region", {name: "Prijave otvorene"});
  await expect(open).toContainText(`${before} ekipa`);
  await open.getByRole("button", {name: "Prijavi se"}).click();
  const sheet = page.getByRole("dialog", {name: "Koju ekipu prijavljuješ?"});
  // the player's only team is picked already
  await expect(sheet.getByRole("radio").filter({hasText: team.name})).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", {name: `Prijavi ekipu ${team.name}`}).click();
  await expect(sheet).toBeHidden();
  // what the day asks of them: Tu smo between Okupljanje and the start
  const joined = page.getByRole("dialog", {name: `${team.name} su prijavljeni`});
  await expect(joined).toContainText("Od 17:30 potvrdi dolazak");
  await expect(joined).toContainText("Bez potvrde do 18:00 ne igrate 1. kolo");
  await joined.getByRole("button", {name: "Na stranicu turnira"}).click();
  await expect(joined).toBeHidden();

  const signedUp = page.getByRole("region", {name: "Prijavljeni ste"});
  await expect(signedUp).toContainText(team.name);
  await expect(page.getByRole("heading", {name: `Prijavljene ekipe · ${before + 1}`})).toBeVisible();
  const entry = await db.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: id, team_id: team.id}}});
  expect({status: entry.status, by: entry.registered_by}).toEqual({status: "REGISTERED", by: world.accounts.player.id});
  await healthy(page);

  await page.getByRole("button", {name: "Odjavi se s turnira"}).click();
  const leave = page.getByRole("dialog", {name: `Odjaviti ekipu ${team.name} s turnira?`});
  await leave.getByRole("button", {name: "Odjavi ekipu"}).click();
  await expect(leave).toBeHidden();
  await expect(open).toContainText(`${before} ekipa`);
  await expect(open.getByRole("button", {name: "Prijavi se"})).toBeVisible();
  expect(await db.tournamentTeam.count({where: {tournament_id: id, team_id: team.id}})).toBe(0);
});

test("a full tournament takes new teams on the waiting list in sign-up order, and a team that signs off lets the first waiting team in", async ({
  as,
  db,
  world,
  entries,
  healthy,
}) => {
  test.setTimeout(90_000);
  const {id} = world.tournaments.fullWaiting;
  await entries(id);
  const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
  const rows = await db.tournamentTeam.findMany({where: {tournament_id: id}, orderBy: [{registered_at: "asc"}, {team_id: "asc"}], include: {team: true}});
  const inside = rows.filter((r) => r.status === "REGISTERED");
  const waiting = rows.filter((r) => r.status === "WAITING");
  expect([t.max_teams, inside.length, waiting.length]).toEqual([8, 8, 3]);

  // the admin's Čekanje: the waiting teams in the order they signed up
  const admin = await as("admin");
  await admin.goto(`/turniri/${id}/upravljanje`);
  await admin.getByRole("tab", {name: "Čekanje"}).click();
  const list = admin.getByRole("list", {name: "Lista čekanja"}).getByRole("listitem");
  await expect(list).toHaveCount(3);
  for (const [i, w] of waiting.entries()) await expect(list.nth(i)).toContainText(w.team.team_name);

  // the player's team goes on the list, fourth
  const team = world.teams.player;
  const page = await as("player");
  await page.goto(`/turniri/${id}`);
  const full = page.getByRole("region", {name: "Prijave otvorene"});
  await expect(full).toContainText("Turnir je pun: nova prijava ide na listu čekanja.");
  await full.getByRole("button", {name: "Prijavi se na listu čekanja"}).click();
  await page.getByRole("dialog", {name: "Koju ekipu prijavljuješ?"}).getByRole("button", {name: `Prijavi ekipu ${team.name}`}).click();
  await page.getByRole("dialog", {name: `${team.name} su prijavljeni`}).getByRole("button", {name: "Na stranicu turnira"}).click();
  const onList = page.getByRole("region", {name: "Na listi čekanja"});
  await expect(onList.getByRole("heading", {name: "Na listi čekanja · 4."})).toBeVisible();
  expect((await db.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: id, team_id: team.id}}})).status).toBe("WAITING");
  await healthy(page);

  // a team that is in signs off: the first waiting team takes its place, and the player's team moves up to third
  // (the first team in whose player opens the app without an onboarding sheet)
  const ready = await db.player.findMany({where: {...ONBOARDED, teamPlayers: {some: {team_id: {in: inside.map((r) => r.team_id)}}}}, include: {teamPlayers: true}});
  const leaving = inside.find((r) => ready.some((p) => p.teamPlayers.some((tp) => tp.team_id === r.team_id)))!;
  const leaver = ready.find((p) => p.teamPlayers.some((tp) => tp.team_id === leaving.team_id))!;
  const other = await as(leaver.username);
  await other.goto(`/turniri/${id}`);
  await other.getByRole("button", {name: "Odjavi se s turnira"}).click();
  await other.getByRole("dialog", {name: `Odjaviti ekipu ${leaving.team.team_name} s turnira?`}).getByRole("button", {name: "Odjavi ekipu"}).click();
  await expect(other.getByRole("region", {name: "Prijave otvorene"})).toContainText("8 ekipa");

  const after = await db.tournamentTeam.findMany({where: {tournament_id: id}});
  const status = (teamId: number) => after.find((r) => r.team_id === teamId)?.status;
  expect(status(leaving.team_id)).toBeUndefined();
  expect(status(waiting[0].team_id)).toBe("REGISTERED");
  expect([status(waiting[1].team_id), status(waiting[2].team_id), status(team.id)]).toEqual(["WAITING", "WAITING", "WAITING"]);
  expect(after.filter((r) => r.status === "REGISTERED")).toHaveLength(8);
  await page.reload();
  await expect(onList.getByRole("heading", {name: "Na listi čekanja · 3."})).toBeVisible();

  // and leaves the list again
  await page.getByRole("button", {name: "Makni se s liste čekanja"}).click();
  await page.getByRole("dialog", {name: `Maknuti ekipu ${team.name} s liste čekanja?`}).getByRole("button", {name: "Odjavi ekipu"}).click();
  await expect(full.getByRole("button", {name: "Prijavi se na listu čekanja"})).toBeVisible();
  expect(await db.tournamentTeam.count({where: {tournament_id: id, team_id: team.id}})).toBe(0);
});

test("closed and cancelled tournaments offer no sign-up, and the server refuses one with the reason", async ({as, api, world, healthy}) => {
  const team = world.teams.player;
  const page = await as("player");
  const phone = await api("player");

  const closed = world.tournaments.closed;
  await page.goto(`/turniri/${closed.id}`);
  const card = page.getByRole("region", {name: "Prijave zatvorene"});
  await expect(card).toContainText("Prijave su zatvorene. Turnir možeš pratiti ovdje: poredak i rezultati bit će vidljivi od prvog kola.");
  await expect(page.getByRole("button", {name: /^Prijavi se/})).toHaveCount(0);
  await healthy(page);
  const refused = await phone.post(`/api/tournaments/${closed.id}/registrations`, {data: {team_id: team.id}});
  expect(refused.status()).toBe(400);
  expect(await refused.json()).toEqual({error: "Prijave su zatvorene."});

  const cancelled = world.tournaments.cancelled;
  await page.goto(`/turniri/${cancelled.id}`);
  await expect(page.getByRole("heading", {name: cancelled.name, level: 1})).toBeVisible();
  await expect(page.getByText("Turnir je otkazan. Prijave su zatvorene i turnir se neće igrati.")).toBeVisible();
  await expect(page.getByRole("button", {name: /^Prijavi se/})).toHaveCount(0);
  await healthy(page);
  const gone = await phone.post(`/api/tournaments/${cancelled.id}/registrations`, {data: {team_id: team.id}});
  expect(gone.status()).toBe(400);
  expect(await gone.json()).toEqual({error: "Turnir je otkazan."});
});

test("a tournament played \"na prolaz\" says so in its rules, with the player's team signed up", async ({as, world, healthy}) => {
  const {id, name} = world.tournaments.naProlaz;
  const team = world.teams.player;
  const page = await as("player");
  await page.goto(`/turniri/${id}`);
  await expect(page.getByRole("heading", {name, level: 1})).toBeVisible();
  await expect(page.getByRole("region", {name: "Prijavljeni ste"})).toContainText(team.name);
  await expect(page.getByRole("region", {name: "O turniru"})).toContainText(/Pravila igre\s*41 · zvanja · na prolaz/);
  await expect(page.getByRole("region", {name: "Prijavljene ekipe"}).getByRole("listitem").filter({hasText: team.name})).toContainText("Petar Igračić (ti)");
  await healthy(page);
});
