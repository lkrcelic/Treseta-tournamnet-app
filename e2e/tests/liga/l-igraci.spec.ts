// L · The players of a two-place night (league "E2E · Dvije lokacije", helpers/l.ts: A–D at Caffe bar Pitanik, E–G at
// Klub Dubrava, H not placed). Početna and Raspored show the team's own place, or both and "Još niste raspoređeni";
// Tu smo is the placed team's, counts at its own place, and a team without a place is sent to the admin (Javi se
// adminu) while the server refuses it; the player's table says which of its place's Kola it is ("Kolo 1/2"), and a bye
// at a place of three teams is Pauza there. The tests of Početna's tonight card are marked to fail between 00:00 and
// 06:00, when master's Početna drops tonight for next week (a shared bug, AFTER_MIDNIGHT_BUG); the rest use next week's
// night or the routes and run the same at any hour.
import {afterMidnight, AFTER_MIDNIGHT_BUG, AT_FIRST, AT_SECOND, expect, KEYS, SPLIT, test} from "../../helpers/l";
import {escape} from "../../helpers/scorepad";

test("Početna and Raspored show the team's own place on a two-place night, and both places before Podjela", async ({as, liga, healthy}) => {
  const {pitanik, dubrava, nextWeek} = liga;
  await liga.night(nextWeek, {second: true, split: SPLIT});

  // E at Klub Dubrava: "Vaša lokacija" with its address and map
  const e = await as(liga.teams.E.players[0]);
  await e.goto("/");
  let card = e.getByRole("region", {name: "Sljedeća večer"});
  await expect(card).toContainText("Vaša lokacija");
  await expect(card).toContainText(`00:00 · ${dubrava.name}`);
  await expect(card).toContainText(dubrava.address);
  await expect(card.getByRole("link", {name: `Karta: ${dubrava.name}`})).toHaveAttribute("href", dubrava.url);
  await expect(card).not.toContainText(pitanik.name);

  // Raspored: both places, "Vi" on the team's own
  await e.goto(`/raspored?league=${liga.id}`);
  card = e.getByRole("region", {name: "Sljedeća večer"});
  await expect(card.getByRole("link", {name: `00:00 · ${pitanik.name}, otvori kartu`})).toBeVisible();
  await expect(card.getByRole("link", {name: `${dubrava.name}, vaša lokacija, otvori kartu`})).toHaveAttribute("href", dubrava.url);
  await expect(card).not.toContainText("Još niste raspoređeni.");
  const row = e.getByRole("listitem").filter({hasText: `00:00 · ${pitanik.name} · ${dubrava.name}`});
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`${dubrava.name} (vi)`);
  await healthy(e);

  // A at Caffe bar Pitanik
  const a = await as(liga.teams.A.players[0]);
  await a.goto("/");
  card = a.getByRole("region", {name: "Sljedeća večer"});
  await expect(card).toContainText("Vaša lokacija");
  await expect(card).toContainText(`00:00 · ${pitanik.name}`);
  await expect(card.getByRole("link", {name: `Karta: ${pitanik.name}`})).toHaveAttribute("href", pitanik.url);
  await expect(card).not.toContainText(dubrava.name);

  // H, not placed yet: both places and "Još niste raspoređeni.", no map
  const h = await as(liga.teams.H.players[0]);
  await h.goto("/");
  card = h.getByRole("region", {name: "Sljedeća večer"});
  await expect(card).toContainText(`00:00 · ${pitanik.name} ili ${dubrava.name}`);
  await expect(card).toContainText("Još niste raspoređeni.");
  await expect(card).not.toContainText("Vaša lokacija");
  await expect(card.getByRole("link", {name: /^Karta: /})).toHaveCount(0);
  await h.goto(`/raspored?league=${liga.id}`);
  card = h.getByRole("region", {name: "Sljedeća večer"});
  await expect(card).toContainText("Još niste raspoređeni.");
  await expect(card.getByRole("link", {name: /vaša lokacija/})).toHaveCount(0);
  const hRow = h.getByRole("listitem").filter({hasText: `00:00 · ${pitanik.name} · ${dubrava.name}`});
  await expect(hRow).toHaveCount(1);
  await expect(hRow).not.toContainText("(vi)");
  await healthy(h);
});

test("the server takes Tu smo only from a placed team and counts it at its own place", async ({api, as, db, liga}) => {
  const {pitanik, dubrava, tonight, teams} = liga;
  await liga.night(tonight, {second: true, split: SPLIT});

  // H has no place: refused, and nothing is written
  const h = await api(teams.H.players[0]);
  const refused = await h.post(`/api/leagues/${liga.id}/arrival`, {data: {team_id: teams.H.id, action: "confirm"}});
  expect(refused.status()).toBe(400);
  expect(((await refused.json()) as {error: string}).error).toBe("Večeras se igra na dvije lokacije, a vaša ekipa još nije raspoređena. Javi se adminu.");
  expect(await db.leagueArrival.count({where: {league_id: liga.id, team_id: teams.H.id}})).toBe(0);

  // E at Klub Dubrava comes in
  const e = await api(teams.E.players[0]);
  const came = await e.post(`/api/leagues/${liga.id}/arrival`, {data: {team_id: teams.E.id, action: "confirm"}});
  expect(came.ok(), await came.text()).toBeTruthy();
  const cardOf = (await came.json()) as {two_places: boolean; slot: number | null; arrival: {here: boolean} | null};
  expect([cardOf.two_places, cardOf.slot, cardOf.arrival?.here]).toEqual([true, 2, true]);

  // the admin's arrivals of each place: E at Klub Dubrava only
  const admin = liga.admin;
  const here = async (slot: 1 | 2) => {
    const res = await admin.get(`/api/leagues/${liga.id}/arrivals?slot=${slot}`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const {teams: rows} = (await res.json()) as {teams: Record<string, {here: boolean}>};
    return Object.entries(rows).filter(([, a]) => a.here).map(([id]) => Number(id));
  };
  expect(await here(2)).toEqual([teams.E.id]);
  expect(await here(1)).toEqual([]);

  // Novo kolo of each place: E is on at Klub Dubrava; Caffe bar Pitanik has nobody here yet
  const page = await as("admin");
  await page.goto(`/league/${liga.id}/manage?view=create&slot=2`);
  const who = page.getByRole("region", {name: "Tko igra večeras"});
  await expect(who.getByRole("status")).toHaveText(new RegExp(`^1 / 3\\s*ekipa igra večeras · ${escape(dubrava.name)}$`));
  await expect(who.getByRole("list", {name: "Ekipe koje ne igraju"}).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("tablist", {name: "Lokacija"}).getByRole("tab", {name: new RegExp(`^${escape(pitanik.name)}`)}).click();
  await expect(who.getByRole("status")).toHaveText(new RegExp(`^0 / 4\\s*ekipa igra večeras · ${escape(pitanik.name)}$`));
});

test("Tu smo on Početna: a placed team comes in at its place, one without a place sees Javi se adminu", async ({as, db, liga, healthy}) => {
  // BUG: between 00:00 and 06:00 Početna drops tonight's card (schedule.ts today = leagueDateString; Bela 1f7d51e)
  test.fail(afterMidnight(), AFTER_MIDNIGHT_BUG);
  const {pitanik, dubrava, tonight, teams} = liga;
  await liga.night(tonight, {second: true, split: SPLIT});

  // E: tonight's card at Klub Dubrava, then Tu smo
  const e = await as(teams.E.players[0]);
  await e.goto("/");
  const card = e.getByRole("region", {name: "Večeras"});
  await expect(card).toContainText("Vaša lokacija");
  await expect(card).toContainText(`00:00 · ${dubrava.name}`);
  const arrival = card.getByRole("region", {name: "Potvrda dolaska"});
  await expect(arrival).toContainText("Niste potvrdili dolazak");
  await arrival.getByRole("button", {name: "Tu smo · Želimo uskočiti"}).click();
  await expect(arrival).toContainText("Tu ste");
  await expect(arrival).toContainText("Dolazak je potvrđen. Igrate u idućem kolu.");
  const row = await db.leagueArrival.findUniqueOrThrow({where: {league_id_night_team_id: {league_id: liga.id, night: new Date(tonight), team_id: teams.E.id}}});
  expect([row.by_admin, row.left_at]).toEqual([false, null]);
  await healthy(e);

  // H: no place on the card, Javi se adminu, Tu smo locked
  const h = await as(teams.H.players[0]);
  await h.goto("/");
  const hCard = h.getByRole("region", {name: "Večeras"});
  const ask = hCard.getByRole("region", {name: "Potvrda dolaska"});
  await expect(ask).toContainText("Javi se adminu");
  await expect(ask).toContainText("Večeras se igra na dvije lokacije, a vaša ekipa još nije raspoređena.");
  await expect(ask.getByRole("button", {name: "Tu smo"})).toBeDisabled();
  await expect(hCard).not.toContainText("Vaša lokacija");
  await expect(hCard).not.toContainText(dubrava.name);
  await healthy(h);

  // the admin's Večer lige: one of Klub Dubrava's three is here, none of Caffe bar Pitanik's four
  const admin = await as("admin");
  await admin.goto("/");
  await admin.getByRole("button", {name: /^Liga: .*\. Promijeni ligu$/}).click();
  await admin.getByRole("dialog", {name: "Odaberi ligu"}).getByRole("option", {name: new RegExp(`^${escape(liga.name)} `)}).click();
  const evening = admin.getByRole("region", {name: "Večeras"});
  await expect(evening.getByRole("region", {name: dubrava.name})).toContainText("3 ekipe · 1 tu");
  await expect(evening.getByRole("region", {name: pitanik.name})).toContainText("4 ekipe · 0 tu");
});

test("the player's table says which of its place's Kola it is", async ({as, db, liga, healthy}) => {
  const {tonight, teams} = liga;
  await liga.night(tonight, {second: true, split: SPLIT, arrived: [...AT_FIRST, ...AT_SECOND]});
  // Caffe bar Pitanik publishes two Kola, Klub Dubrava one: both start at Kolo 7
  expect(await liga.publish(1, AT_FIRST, 2)).toEqual([7, 8]);
  expect(await liga.publish(2, AT_SECOND, 1)).toEqual([7]);
  const tables = await liga.tables();
  const mine = new Set(KEYS.map((k) => teams[k].id));
  const tableOf = (id: number) => tables.find((t) => t.round === 7 && (t.team1Id === id || t.team2Id === id) && mine.has(t.team1Id) && mine.has(t.team2Id));

  // A's first table of Caffe bar Pitanik's two Kola tonight
  const a = await as(teams.A.players[0]);
  await a.goto("/");
  const start = a.getByRole("button", {name: /Započni igru/});
  await expect(start).toContainText(`STOL ${tableOf(teams.A.id)!.table}`);
  await expect(start).toContainText("Kolo 1/2");
  await healthy(a);

  // a Klub Dubrava team at the table: its place has made one Kolo
  const atTable = AT_SECOND.find((k) => tableOf(teams[k].id))!;
  const p = await as(teams[atTable].players[0]);
  await p.goto("/");
  const pStart = p.getByRole("button", {name: /Započni igru/});
  await expect(pStart).toContainText(`STOL ${tableOf(teams[atTable].id)!.table}`);
  await expect(pStart).toContainText("Kolo 1/1");
  expect(await db.round.count({where: {leagueRounds: {some: {league_id: liga.id}}, round_date: new Date(tonight), location_slot: 2}})).toBe(2);
});

test("a team that sits its place's Kolo out sees Pauza at that place", async ({as, liga, healthy}) => {
  // BUG: between 00:00 and 06:00 Početna drops tonight's card (schedule.ts today = leagueDateString; Bela 1f7d51e)
  test.fail(afterMidnight(), AFTER_MIDNIGHT_BUG);
  const {dubrava, tonight, teams} = liga;
  await liga.night(tonight, {second: true, split: SPLIT, arrived: [...AT_FIRST, ...AT_SECOND]});
  // two Kola a night: Klub Dubrava's first one isn't its last
  await liga.publish(2, AT_SECOND, 1);
  const tables = await liga.tables();
  const mine = new Set(KEYS.map((k) => teams[k].id));
  const bye = tables.find((t) => !mine.has(t.team1Id) || !mine.has(t.team2Id))!;
  const sitter = AT_SECOND.find((k) => teams[k].id === bye.team1Id || teams[k].id === bye.team2Id)!;

  const page = await as(teams[sitter].players[0]);
  await page.goto("/");
  const pause = page.getByRole("region", {name: "Pauza"});
  await expect(pause).toContainText("KOLO 1/1");
  await expect(pause).toContainText("Ovo kolo pauzirate");
  await expect(pause).toContainText(`Neparan broj ekipa na lokaciji ${dubrava.name}.`);
  await healthy(page);
});
