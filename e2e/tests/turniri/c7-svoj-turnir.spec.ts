// C7 · the organizer (accounts.organizer) on the phone, on the tournaments they made: their Turniri under a bar of Turniri,
// Ekipe and Igrači, and Početna opening on it (Bela 52ef6b3); Novi turnir; on tournaments.organizer (upcoming) Podaci ·
// Spremi promjene (with Treseta's Lokacija, Igra se do and Kraj partije), Prijave otvorene / zatvorene, Dodaj ekipu,
// Makni, Otkaži and Vrati turnir, and no Obriši turnir (an admin's only, DECISIONS #86: the button is hidden and the route
// refuses it); on tournaments.finishedNoDeclarations (Treseta's "na prolaz" tournament) Dodaj kolo and Obriši kolo.
// What an organizer may do is DECISIONS #86 and CHANGELOG 07.11. ("Organizator: nova rola"), as Treseta has it: make a
// tournament, and edit, run and cancel the ones they made (kola, Skica, Objavi, stolovi, rezultati, prijave, dolasci,
// Isključi), but never delete one. (Bela's DECISIONS #99, 8db335f, takes Otkaži and Vrati turnir from the organizer;
// Treseta hasn't got it yet.) Every test puts back what it changed on the seeded tournaments.
import {expect, freeTeams, OWN_PREFIX, removeOwnTournaments, test, todayInZagreb, tournamentState} from "../../helpers/c7";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("the organizer's Turniri list only the tournaments they made, under a bar of Turniri, Ekipe and Igrači only", async ({as, db, world, healthy}) => {
  // a C7 tournament a killed run left behind would be in the list too
  await removeOwnTournaments(db);
  // the world: the organizer made exactly these two, every other tournament is the admin's
  const made = await db.tournament.findMany({where: {created_by: world.accounts.organizer.id}, orderBy: {tournament_id: "asc"}});
  expect(made.map((t) => t.tournament_id)).toEqual([world.tournaments.finishedNoDeclarations.id, world.tournaments.organizer.id].sort((a, b) => a - b));

  const page = await as("organizer");
  await page.goto("/turniri/upravljanje");
  await expect(page.getByRole("heading", {name: "Turniri", level: 1})).toBeVisible();
  // Večer, Rejting and Sponzori are the league's and the admin's
  await expect(page.getByRole("navigation", {name: "Admin"}).getByRole("link")).toHaveText(["Turniri", "Ekipe", "Igrači"]);

  // Nadolazeći: Organizatorov kup; Aktivni: none; Završeni: Kup bez zvanja. So none of the admin's anywhere.
  const tabs = page.getByRole("tablist", {name: "Turniri"});
  // a tournament's card reads "<name> <date or Kolos> · …"; the bar's links have no "·"
  const cards = page.getByRole("main").getByRole("link", {name: / · /});
  for (const [tab, names] of [
    ["Nadolazeći", [world.tournaments.organizer.name]],
    ["Aktivni", []],
    ["Završeni", [world.tournaments.finishedNoDeclarations.name]],
  ] as const) {
    const tabButton = tabs.getByRole("tab", {name: new RegExp(`^${tab} ${names.length}$`)});
    await tabButton.click();
    await expect(tabButton).toHaveAttribute("aria-selected", "true");
    await expect(cards).toHaveCount(names.length);
    for (const [i, name] of names.entries()) await expect(cards.nth(i)).toHaveAccessibleName(new RegExp(`^${escape(name)} `));
  }
  await healthy(page);
});

test("Početna opens the organizer's phone on their own Turniri, not on the players' Početna", async ({as}) => {
  // a phone that runs tournaments but not the league opens on its Turniri, the screen its bar starts from (Bela's 52ef6b3,
  // DECISIONS #86, on master since the sync of 17 Nov 2026)
  const page = await as("organizer");
  await page.goto("/");
  await expect(page.getByRole("heading", {name: "Turniri", level: 1})).toBeVisible();
  await expect(page.getByRole("navigation", {name: "Admin"}).getByRole("link")).toHaveText(["Turniri", "Ekipe", "Igrači"]);
  await expect(page.getByRole("tablist", {name: "Turniri"}).getByRole("tab", {name: /^Nadolazeći 1$/})).toBeVisible();
});

test("the organizer makes a tournament with Novi turnir, and it is theirs", async ({as, db, world, healthy}) => {
  await removeOwnTournaments(db);
  try {
    const name = `${OWN_PREFIX}Novi turnir organizatora`;
    const date = todayInZagreb(new Date(Date.now() + 30 * 24 * 60 * 60_000));
    const page = await as("organizer");
    await page.goto("/turniri/upravljanje");
    await page.getByRole("button", {name: "Novi turnir"}).click();
    await expect(page.getByRole("heading", {name: "Novi turnir", level: 1})).toBeVisible();
    await page.getByRole("textbox", {name: "Naziv turnira"}).fill(name);
    await page.getByRole("textbox", {name: "Datum"}).fill(date);
    await page.getByRole("textbox", {name: "Telefon organizatora *"}).fill("+385 91 000 0003");
    await page.getByRole("button", {name: "Makni nagradu za 1. mjesto"}).click();
    await page.getByRole("button", {name: "Kreiraj turnir"}).click();

    // published at once, sign-ups open, on its own Upravljanje
    await expect(page).toHaveURL(/\/turniri\/\d+\/upravljanje\?view=prijave$/);
    await expect(page.getByRole("heading", {name, level: 1})).toBeVisible();
    await expect(page.getByRole("switch", {name: /^Prijave otvorene /})).toBeChecked();
    const id = Number(new URL(page.url()).pathname.split("/")[2]);
    const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
    expect([t.tournament_name, t.date.toISOString().slice(0, 10), t.created_by, t.registrations_open]).toEqual([name, date, world.accounts.organizer.id, true]);

    // and it is in their Turniri
    await page.goto("/turniri/upravljanje");
    await expect(page.getByRole("link", {name: new RegExp(`^${escape(name)} `)})).toBeVisible();
    await healthy(page);
  } finally {
    await removeOwnTournaments(db);
  }
});

test("the organizer changes their tournament in Podaci (Lokacija, Kotizacija, Igra se do, Kraj partije), and Spremi promjene saves it", async ({as, db, world, healthy}) => {
  const id = world.tournaments.organizer.id;
  const before = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
  // the other of the world's two places (Lokacije); Igra se do and Kraj partije are Treseta's own (BELA_SYNC.md · Turniri)
  const place = Object.values(world.places).find((p) => p.id !== before.location_id)!;
  try {
    const page = await as("organizer");
    await page.goto(`/turniri/${id}/upravljanje?view=podaci`);
    const picker = page.getByRole("button", {name: "Lokacija", exact: true});
    await expect(picker).toContainText(Object.values(world.places).find((p) => p.id === before.location_id)!.name);
    await picker.click();
    await page.getByRole("listbox", {name: "Lokacije"}).getByRole("option").filter({hasText: place.name}).click();
    await expect(picker).toContainText(place.name);
    await page.getByRole("spinbutton", {name: "Kotizacija po igraču · €"}).fill(String(before.entry_fee + 5));
    await page.getByRole("radiogroup", {name: "Igra se do"}).getByRole("radio", {name: "51"}).click();
    await page.getByRole("radiogroup", {name: "Kraj partije"}).getByRole("radio", {name: "Na prolaz"}).click();
    await page.getByRole("button", {name: "Spremi promjene"}).click();
    await expect(page.getByRole("button", {name: "Spremljeno"})).toBeVisible();

    const after = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
    expect([after.location_id, after.entry_fee, after.score_threshold, after.match_end]).toEqual([place.id, before.entry_fee + 5, 51, "NA_PROLAZ"]);
    await page.reload();
    await expect(page.getByRole("button", {name: "Lokacija", exact: true})).toContainText(place.name);
    await expect(page.getByRole("radiogroup", {name: "Igra se do"}).getByRole("radio", {name: "51"})).toBeChecked();
    await expect(page.getByRole("radiogroup", {name: "Kraj partije"}).getByRole("radio", {name: "Na prolaz"})).toBeChecked();
    await healthy(page);
  } finally {
    await db.tournament.update({
      where: {tournament_id: id},
      data: {location_id: before.location_id, entry_fee: before.entry_fee, score_threshold: before.score_threshold, match_end: before.match_end},
    });
  }
});

test("the organizer adds a new place with Nova lokacija in Podaci, and their tournament is played there", async ({as, db, world, healthy}) => {
  // location.create is the organizer's (permissions.ts: the tournament form picks a place from Lokacije and can add one;
  // changing and deleting a place stay the admin's, c7-admin-stranice). Treseta's own: Lokacije (BELA_SYNC.md · Lokacije)
  const id = world.tournaments.organizer.id;
  const before = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
  const name = `${OWN_PREFIX}Klub organizatora`;
  const address = "Ilica 3, Zagreb";
  const removePlace = () => db.location.deleteMany({where: {name: {startsWith: OWN_PREFIX}, tournaments: {none: {}}}});
  await removePlace();
  try {
    const page = await as("organizer");
    await page.goto(`/turniri/${id}/upravljanje?view=podaci`);
    const picker = page.getByRole("button", {name: "Lokacija", exact: true});
    await picker.click();
    // the search finds no such place, so Nova lokacija takes the name typed
    await page.getByLabel("Traži lokaciju po imenu ili adresi").fill(name);
    await expect(page.getByText("Nema lokacije s tim imenom.")).toBeVisible();
    await page.getByRole("button", {name: `Nova lokacija „${name}”`}).click();
    await expect(page.getByLabel("Ime mjesta")).toHaveValue(name);
    await page.getByLabel("Adresa").fill(address);
    await page.getByRole("button", {name: "Dodaj lokaciju"}).click();
    await expect(picker).toContainText(name);
    await expect(picker).toContainText(address);
    await page.getByRole("button", {name: "Spremi promjene"}).click();
    await expect(page.getByRole("button", {name: "Spremljeno"})).toBeVisible();

    // one new place in Lokacije, and the tournament points at it
    const made = await db.location.findMany({where: {name}});
    expect(made.map((l) => [l.name, l.address])).toEqual([[name, address]]);
    expect((await db.tournament.findUniqueOrThrow({where: {tournament_id: id}})).location_id).toBe(made[0].location_id);
    await page.reload();
    await expect(page.getByRole("button", {name: "Lokacija", exact: true})).toContainText(name);
    await healthy(page);
  } finally {
    await db.tournament.update({where: {tournament_id: id}, data: {location_id: before.location_id}});
    await removePlace();
  }
});

test("the organizer closes and reopens their sign-ups and adds a team with Dodaj ekipu", async ({as, admin, db, world, healthy}) => {
  const id = world.tournaments.organizer.id;
  const [team] = await freeTeams(db, 1, {tournamentId: id});
  const registered = await db.tournamentTeam.count({where: {tournament_id: id, status: "REGISTERED"}});
  const max = (await db.tournament.findUniqueOrThrow({where: {tournament_id: id}})).max_teams!;
  try {
    const page = await as("organizer");
    await page.goto(`/turniri/${id}/upravljanje?view=prijave`);

    // Prijave otvorene is the navy card's switch
    const open = page.getByRole("switch", {name: new RegExp(`^Prijave otvorene ${registered} od ${max} `)});
    await expect(open).toBeChecked();
    await open.click();
    const closed = page.getByRole("switch", {name: new RegExp(`^Prijave zatvorene ${registered} od ${max} `)});
    await expect(closed).not.toBeChecked();
    expect((await db.tournament.findUniqueOrThrow({where: {tournament_id: id}})).registrations_open).toBe(false);
    await closed.click();
    await expect(open).toBeChecked();
    expect((await db.tournament.findUniqueOrThrow({where: {tournament_id: id}})).registrations_open).toBe(true);

    // Dodaj ekipu: the search finds the team by its name, Dodaj signs it up
    await page.getByRole("button", {name: "Dodaj ekipu · ime ekipe"}).click();
    const sheet = page.getByRole("dialog", {name: "Dodaj ekipu"});
    await sheet.getByRole("searchbox", {name: "Traži ekipu ili igrača"}).fill(team.name);
    await sheet.getByRole("button", {name: `Dodaj ${team.name} na turnir`, exact: true}).click();
    await expect(sheet.getByRole("button", {name: `Dodaj ${team.name} na turnir`, exact: true})).toHaveCount(0);
    await sheet.getByRole("button", {name: "Zatvori"}).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("list", {name: "Prijavljene ekipe"}).getByRole("listitem").filter({hasText: team.name})).toHaveCount(1);
    await expect(page.getByRole("switch", {name: new RegExp(`^Prijave otvorene ${registered + 1} od ${max} `)})).toBeChecked();
    const entry = await db.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: id, team_id: team.id}}});
    expect(entry.status).toBe("REGISTERED");
    await healthy(page);
  } finally {
    await db.tournament.update({where: {tournament_id: id}, data: {registrations_open: true}});
    if (await db.tournamentTeam.count({where: {tournament_id: id, team_id: team.id}})) {
      const removed = await admin.delete(`/api/admin/tournaments/${id}/teams/${team.id}`);
      expect(removed.ok(), `put back: Makni ${team.name}: ${await removed.text()}`).toBeTruthy();
    }
  }
});

test("Makni takes a team off the organizer's own tournament", async ({as, organizer, admin, db, world, healthy}) => {
  // BUG (Bela #84, not fixed in Bela yet; shared code): signOff lets only an admin remove a team they don't play in, so
  // the organizer's Makni ekipu is refused with "Možeš odjaviti samo ekipu u kojoj igraš." (entries.ts uses isAdminRole,
  // not the tournament's owner)
  test.fail();
  const id = world.tournaments.organizer.id;
  const [team] = await freeTeams(db, 1, {tournamentId: id});
  const added = await organizer.post(`/api/admin/tournaments/${id}/teams`, {data: {team_id: team.id}});
  expect(added.status(), `Dodaj ekipu: ${await added.text()}`).toBe(201);
  try {
    const page = await as("organizer");
    await page.goto(`/turniri/${id}/upravljanje?view=prijave`);
    const row = page.getByRole("list", {name: "Prijavljene ekipe"}).getByRole("listitem").filter({hasText: team.name});
    await expect(row).toHaveCount(1);
    await page.getByRole("button", {name: `Makni ${team.name} s turnira`, exact: true}).click();
    const sheet = page.getByRole("dialog", {name: `Maknuti ${team.name} s turnira?`});
    await sheet.getByRole("button", {name: "Makni ekipu"}).click();
    await expect(sheet).toBeHidden();
    await expect(row).toHaveCount(0);
    expect(await db.tournamentTeam.count({where: {tournament_id: id, team_id: team.id}})).toBe(0);
    await healthy(page);
  } finally {
    if (await db.tournamentTeam.count({where: {tournament_id: id, team_id: team.id}})) {
      const removed = await admin.delete(`/api/admin/tournaments/${id}/teams/${team.id}`);
      expect(removed.ok(), `put back: Makni ${team.name}: ${await removed.text()}`).toBeTruthy();
    }
  }
});

test("the organizer cancels their tournament with Otkaži turnir and brings it back with Vrati turnir", async ({as, organizer, db, world, healthy}) => {
  // Treseta's rule today (DECISIONS #86: the organizer cancels their own tournament). Bela's 8db335f (DECISIONS #99)
  // makes Otkaži and Vrati turnir the admin's alone: when the sync brings it, this test becomes Bela's (the organizer
  // can't cancel, the admin cancels and brings back).
  const id = world.tournaments.organizer.id;
  const {name} = world.tournaments.organizer;
  const entries = () => db.tournamentTeam.findMany({where: {tournament_id: id}, orderBy: {team_id: "asc"}});
  const teams = await entries();
  try {
    const page = await as("organizer");
    await page.goto(`/turniri/${id}/upravljanje?view=podaci`);
    await page.getByRole("button", {name: "Otkaži turnir"}).click();
    const sheet = page.getByRole("dialog", {name: `Otkazati ${name}?`});
    await sheet.getByRole("button", {name: "Otkaži turnir"}).click();
    await expect(sheet).toBeHidden();

    // Otkazan: who cancelled it, sign-ups closed, only Prijave and Podaci left
    await expect(page.getByText("Turnir je otkazan")).toBeVisible();
    await expect(page.getByText(/^Otkazao Oliver Organizator, .* · prijave zatvorene$/)).toBeVisible();
    await expect(page.getByRole("tablist", {name: "Upravljanje turnirom"}).getByRole("tab")).toHaveText(["Prijave", "Podaci"]);
    let t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
    expect([t.cancelled_at != null, t.cancelled_by, t.registrations_open]).toEqual([true, world.accounts.organizer.id, false]);

    // Vrati turnir: back with its sign-ups open and its teams as they were
    await page.getByRole("button", {name: "Vrati turnir"}).click();
    await expect(page.getByRole("switch", {name: /^Prijave otvorene /})).toBeChecked();
    t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
    expect([t.cancelled_at, t.cancelled_by, t.registrations_open]).toEqual([null, null, true]);
    expect(await entries()).toEqual(teams);
    await healthy(page);
  } finally {
    if ((await db.tournament.findUniqueOrThrow({where: {tournament_id: id}})).cancelled_at) {
      const back = await organizer.delete(`/api/admin/tournaments/${id}/cancel`);
      expect(back.ok(), `put back: Vrati turnir: ${await back.text()}`).toBeTruthy();
    }
  }
});

test("the server refuses the organizer's Obriši turnir on their own tournament: only an admin deletes one", async ({organizer, db, world}) => {
  const id = world.tournaments.organizer.id;
  const before = await tournamentState(db, id);
  const refused = await organizer.delete(`/api/admin/tournaments/${id}`);
  expect(refused.status()).toBe(403);
  expect(await refused.json()).toEqual({error: "Nemaš ovlasti za ovu radnju."});
  expect(await tournamentState(db, id)).toEqual(before);
});

test("Podaci doesn't give the organizer Obriši turnir, which only an admin may do", async ({as, world}) => {
  // BUG (Bela 8db335f, DECISIONS #99): Podaci shows Obriši turnir to the organizer (phone and computer) though the route
  // is the admin's only (requireAdmin): tapping it and confirming answers "Nemaš ovlasti za ovu radnju." Bela's 8db335f
  // hides it from the organizer (and Otkaži turnir with it, see the cancel test above); it comes with the sync.
  test.fail();
  const page = await as("organizer");
  await page.goto(`/turniri/${world.tournaments.organizer.id}/upravljanje?view=podaci`);
  await expect(page.getByRole("button", {name: "Spremi promjene"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Obriši turnir"})).toHaveCount(0);
});

test("on their finished tournament the organizer adds a Kolo with Dodaj kolo and deletes it again", async ({as, organizer, db, world, healthy}) => {
  const id = world.tournaments.finishedNoDeclarations.id;
  const before = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
  const tables = () => db.round.count({where: {tournamentRounds: {some: {tournament_id: id}}, round_number: before.rounds + 1}});
  const next = before.rounds + 1;
  const playing = await db.tournamentTeam.count({where: {tournament_id: id, status: "REGISTERED", active: true, excluded_at: null}});
  try {
    const page = await as("organizer");
    await page.goto(`/turniri/${id}/upravljanje?view=kola`);
    const kola = page.getByRole("list", {name: "Kola turnira"}).getByRole("listitem");
    await expect(kola).toHaveCount(before.rounds);

    // Dodaj kolo: the tournament goes on with one more Kolo, made from the standings
    await page.getByRole("button", {name: "Dodaj kolo"}).click();
    await expect(kola).toHaveCount(next);
    await expect(page.getByRole("button", {name: new RegExp(`^Kolo ${next}, `)})).toBeVisible();
    expect((await db.tournament.findUniqueOrThrow({where: {tournament_id: id}})).rounds).toBe(next);
    // every team still in gets a table, an odd one the bye's
    expect(await tables()).toBe(Math.ceil(playing / 2));

    // Obriši Kolo n: asked first; nobody played at it, so no results go
    await page.getByRole("button", {name: `Obriši Kolo ${next}`}).click();
    const sheet = page.getByRole("dialog", {name: `Obrisati Kolo ${next}?`});
    await expect(sheet).toContainText(`Turnir će imati ${before.rounds} kola.`);
    await sheet.getByRole("button", {name: "Obriši kolo"}).click();
    await expect(sheet).toBeHidden();
    await expect(kola).toHaveCount(before.rounds);
    expect((await db.tournament.findUniqueOrThrow({where: {tournament_id: id}})).rounds).toBe(before.rounds);
    expect(await tables()).toBe(0);
    await healthy(page);
  } finally {
    if ((await db.tournament.findUniqueOrThrow({where: {tournament_id: id}})).rounds !== before.rounds) {
      const back = await organizer.delete(`/api/admin/tournaments/${id}/kola/${next}`);
      expect(back.ok(), `put back: Obriši Kolo ${next}: ${await back.text()}`).toBeTruthy();
    }
  }
});
