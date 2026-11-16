// C3 · Potvrda dolaska on the tournament's day: Tu smo on a player's phone, the admin's arrival screen (Označi dolazak,
// U <start>: what the start time will do) and the start time's switch. On a tournament of the test's own (four places,
// six teams: two wait; removed afterwards) whose window is open now; the start time is then moved into the past.
// Expected values (src/app/_lib/tournamentDay.ts, Bela's DECISIONS on Potvrda dolaska): Tu smo works from Okupljanje
// until Početak; at the start the teams in that didn't confirm become inactive (still signed up), and the confirmed
// teams of the waiting list come in, in waiting-list order, while there is room; an unconfirmed waiting team stays out.
import {clock, expect, freeTeams, shownTime, syncClock, test, todayAt} from "../../helpers/c3";

test("Tu smo confirms a team, the admin marks the others, and at the start time the unconfirmed team goes inactive while a confirmed waiting team comes in", async ({
  as,
  db,
  own,
  healthy,
}) => {
  test.setTimeout(120_000);
  const teams = await freeTeams(db, 6);
  const [here, marked1, marked2, late, waitingHere, waitingAway] = teams;
  const startAt = todayAt(30);
  // the texts write the time without a leading zero
  const start = shownTime(startAt);
  const id = await own.make({name: "Dolazak", gathering_time: todayAt(-15), start_time: startAt, max_teams: 4}, teams);
  const entry = (teamId: number) => db.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: id, team_id: teamId}}});
  expect((await entry(waitingHere.id)).status).toBe("WAITING");

  // a player's Tu smo
  const page = await as(here.phone);
  await page.goto(`/turniri/${id}`);
  const ask = page.getByRole("region", {name: "Dolazak nije potvrđen"});
  await expect(ask).toContainText(`Jeste li stigli? Potvrdite do ${start}, inače ekipa ne igra prvo kolo.`);
  await ask.getByRole("button", {name: "Tu smo"}).click();
  const confirmed = page.getByRole("region", {name: "Tu ste"});
  await expect(confirmed.getByRole("button", {name: "Ipak otkazujemo"})).toBeVisible();
  const arrival = await entry(here.id);
  expect(arrival.arrived_at).not.toBeNull();
  const by = here.players.find((p) => p.username === here.phone)!;
  expect({by: arrival.arrived_by, admin: arrival.arrived_by_admin}).toEqual({by: by.id, admin: false});
  await expect(confirmed).toContainText(`Potvrdio ${by.name.split(" ")[0]} u ${clock(arrival.arrived_at!)}. Prvo kolo počinje u ${start}.`);
  await healthy(page);

  // the admin's day: one here, three not; Označi dolazak for two teams in and the first waiting team
  const admin = await as("admin");
  await admin.goto(`/turniri/${id}/upravljanje`);
  await expect(admin.getByRole("button", {name: new RegExp(`^Potvrda dolaska do ${start} 1 tu · 3 nije potvrdilo`)})).toBeVisible();
  const inList = admin.getByRole("tabpanel", {name: "Prijave"}).getByRole("list", {name: "Prijavljene ekipe"}).getByRole("listitem");
  const rowOf = (name: string) => inList.filter({hasText: name});
  await expect(rowOf(here.name)).toContainText("Tu");
  for (const team of [marked1, marked2]) {
    await expect(rowOf(team.name)).toContainText("Nije potvrdila");
    await rowOf(team.name).getByRole("button", {name: "Označi dolazak"}).click();
    await expect(rowOf(team.name)).not.toContainText("Nije potvrdila");
    await expect(rowOf(team.name).getByRole("button", {name: "Označi dolazak"})).toHaveCount(0);
  }
  await expect(rowOf(late.name)).toContainText("Nije potvrdila");
  await admin.getByRole("tab", {name: "Čekanje"}).click();
  const waitList = admin.getByRole("list", {name: "Lista čekanja"}).getByRole("listitem");
  await expect(waitList).toHaveCount(2);
  await expect(waitList.nth(0)).toContainText(waitingHere.name);
  await waitList.nth(0).getByRole("button", {name: "Označi dolazak"}).click();
  await expect(waitList.nth(0)).not.toContainText("Nije potvrdila");
  await expect(waitList.nth(0).getByRole("button", {name: "Označi dolazak"})).toHaveCount(0);
  await expect(waitList.nth(1)).toContainText(waitingAway.name);
  const marks = [];
  for (const team of [marked1, marked2, waitingHere]) {
    const e = await entry(team.id);
    marks.push({team: team.name, here: e.arrived_at != null, admin: e.arrived_by_admin, by: e.arrived_by});
  }
  expect(marks).toEqual([marked1, marked2, waitingHere].map((t) => ({team: t.name, here: true, admin: true, by: null})));
  await admin.getByRole("tab", {name: "Prijave"}).click();
  await expect(admin.getByRole("button", {name: new RegExp(`^Potvrda dolaska do ${start} 3 tu · 1 nije potvrdilo`)})).toBeVisible();
  const atStart = admin.getByRole("region", {name: `U ${start}`});
  await expect(atStart).toContainText("1 nepotvrđena ekipa postaje Neaktivna (ostaju prijavljene).");
  await expect(atStart).toContainText(`${waitingHere.name} (lista čekanja, tu) postaje Aktivna umjesto neaktivnih.`);
  await healthy(admin);

  // the start time comes (moved into the past): the switch runs on the next read
  const startedAt = todayAt(-1);
  const started = shownTime(startedAt);
  await db.tournament.update({where: {tournament_id: id}, data: {gathering_time: todayAt(-30), start_time: startedAt}});
  await syncClock(own.admin, id);
  const out = await entry(late.id);
  expect({status: out.status, active: out.active}).toEqual({status: "REGISTERED", active: false});
  const comesIn = await entry(waitingHere.id);
  expect({status: comesIn.status, active: comesIn.active}).toEqual({status: "REGISTERED", active: true});
  expect((await entry(waitingAway.id)).status).toBe("WAITING");
  for (const team of [here, marked1, marked2]) expect((await entry(team.id)).active).toBe(true);
  const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
  expect({closed: t.arrival_closed_at != null, signUps: t.registrations_open}).toEqual({closed: true, signUps: false});

  await admin.reload();
  await expect(admin.getByRole("button", {name: new RegExp(`^Potvrda dolaska zatvorena u ${started} `)})).toBeVisible();
  await expect(admin.getByRole("switch", {name: `${late.name} igra sljedeće kolo`})).not.toBeChecked();
  await expect(admin.getByRole("switch", {name: `${waitingHere.name} igra sljedeće kolo`})).toBeChecked();

  // the late team's phone: the tournament starts without them, Tu smo · Želimo uskočiti still lets them in later
  const lateTeam = await as(late.phone);
  await lateTeam.goto(`/turniri/${id}`);
  const missed = lateTeam.getByRole("region", {name: "Niste potvrdili dolazak"});
  await expect(missed).toContainText("Turnir počinje bez vas.");
  await expect(missed.getByRole("button", {name: "Tu smo · Želimo uskočiti"})).toBeVisible();
  await healthy(lateTeam);
});
