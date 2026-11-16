// C8 · editing, closing and publishing again the player's own Burza ad. The app has no edit screen on /burza/<id>: an
// ad is changed by publishing the same ad again, which updates the open one (Bela's DECISIONS #29; "the same" is twinFields in
// _lib/burzaStatus.ts: an availability ad, a partner ad for the same league, a substitute ad for the same team, night
// and player). Zatvori oglas on the ad's page closes it; Moji oglasi' Objavi ponovno puts it back up in place, or,
// when the same ad is already open, shows that one with "Već imaš ovakav oglas"; a substitute ad whose night has passed
// opens Trebam zamjenu filled in from it, for a new night (Bela's DECISIONS #39). The DECISIONS named are Bela's: Treseta's
// Burza is Bela's code (BELA_SYNC.md lists no difference in it).
// Bela's spec: e2e/tests/burza/c8-uredi.spec.ts (ba24386).
import {expect, test} from "../../helpers/c8";
import {addDays, closeAd, dayMonth, escape, insertAd, myAds, nightLabel, phoneField, publishAd, publishButton, zagrebDay} from "../../helpers/c8";

test("editing Dostupan sam: the form opens filled in from the open ad, and publishing it changes that ad instead of adding one", async ({
  as,
  db,
  me,
  healthy,
}) => {
  const id = await publishAd(me.api, {kind: "AVAILABLE", as_substitute: true, as_partner: false, phone: "091 234 5678", note: "Mogu utorkom.", save_phone: true});
  const page = await as("player");

  await page.goto(`/burza/${id}`);
  const ad = page.getByRole("region", {name: "Oglas"});
  await expect(ad.getByRole("heading", {name: me.name})).toBeVisible();
  await expect(page.getByRole("definition").filter({hasText: /^zamjenu$/})).toBeVisible();
  await expect(page.getByText("“Mogu utorkom.”", {exact: true})).toBeVisible();
  await expect(page.getByText("Tvoj oglas", {exact: true})).toBeVisible();
  await expect(page.getByText("+385 91 234 5678", {exact: true})).toBeVisible();

  // Dostupan sam again: the open ad's choices, note and the profile's number are filled in
  await page.goto("/burza/novi/dostupan");
  await expect(page.getByRole("button", {name: "Zamjena", exact: true})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", {name: "Novi partner", exact: true})).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Napomena · neobavezno")).toHaveValue("Mogu utorkom.");
  await expect(phoneField(page)).toHaveValue("+385 91 234 5678");
  await expect(page.getByText("S profila", {exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Novi partner", exact: true}).click();
  await page.getByLabel("Napomena · neobavezno").fill("Mogu utorkom i četvrtkom.");
  await publishButton(page).click();
  await expect(page.getByRole("heading", {name: "Oglas je objavljen"})).toBeVisible();

  const ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.id, a.kind, a.as_substitute, a.as_partner, a.note, a.closed_at])).toEqual([[id, "AVAILABLE", true, true, "Mogu utorkom i četvrtkom.", null]]);

  await page.goto(`/burza/${id}`);
  await expect(page.getByRole("definition").filter({hasText: /^zamjenu i novog partnera$/})).toBeVisible();
  await expect(page.getByText("“Mogu utorkom i četvrtkom.”", {exact: true})).toBeVisible();
  await healthy(page);
});

test("Tražim partnera for the same league again changes the open ad's text and number instead of adding one", async ({as, db, me}) => {
  const id = await publishAd(me.api, {kind: "PARTNER", league_id: me.league.id, phone: "091 234 5678", note: "Tražim partnera za nedjelje."});
  const page = await as("player");
  await page.goto("/burza/novi/partner");
  await expect(page.getByRole("radio", {name: me.league.name, exact: true})).toBeChecked();
  await phoneField(page).fill("092 111 2233");
  await page.getByRole("textbox", {name: "Oglas"}).fill("Tražim partnera za nedjelje i srijede.");
  await publishButton(page).click();
  await expect(page.getByRole("heading", {name: "Oglas je objavljen"})).toBeVisible();
  await expect(page.getByText("Tražim partnera za nedjelje i srijede.", {exact: true})).toBeVisible();

  const ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.id, a.kind, a.league_id, a.phone, a.note, a.closed_at])).toEqual([
    [id, "PARTNER", me.league.id, "+385 92 111 2233", "Tražim partnera za nedjelje i srijede.", null],
  ]);
  await page.goto("/burza/moji");
  await expect(page.getByRole("tab", {name: "Aktivni · 1"})).toHaveAttribute("aria-selected", "true");
});

test("Trebam zamjenu for the same night and teammate again changes the open ad's number and note; another night is another ad", async ({as, db, me}) => {
  const night = me.league.nights[1];
  const id = await publishAd(me.api, {
    kind: "SUBSTITUTE",
    league_id: me.league.id,
    team_id: me.team.id,
    night,
    with_player_id: me.partner.id,
    phone: "091 234 5678",
    note: "Počinjemo u 20 h.",
  });
  const page = await as("player");
  await page.goto("/burza/novi/zamjena");
  await page.getByRole("radio", {name: nightLabel(night), exact: true}).click();
  await page.getByRole("radio", {name: new RegExp(escape(me.partner.name))}).click();
  await phoneField(page).fill("092 111 2233");
  await page.getByLabel("Napomena · neobavezno").fill("Počinjemo u 19:30.");
  await publishButton(page).click();
  await expect(page.getByRole("heading", {name: "Oglas je objavljen"})).toBeVisible();
  await expect(page.getByText("+385 92 111 2233", {exact: true})).toBeVisible();

  let ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.id, a.night?.toISOString().slice(0, 10), a.with_player_id, a.phone, a.note])).toEqual([
    [id, night, me.partner.id, "+385 92 111 2233", "Počinjemo u 19:30."],
  ]);

  // the next night is a new ad, next to the first
  const later = me.league.nights[2];
  await page.goto("/burza/novi/zamjena");
  await page.getByRole("radio", {name: nightLabel(later), exact: true}).click();
  await page.getByRole("radio", {name: new RegExp(escape(me.partner.name))}).click();
  await expect(phoneField(page)).toHaveValue("+385 92 111 2233");
  await publishButton(page).click();
  await expect(page.getByRole("heading", {name: "Oglas je objavljen"})).toBeVisible();
  ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.night?.toISOString().slice(0, 10), a.closed_at])).toEqual([
    [night, null],
    [later, null],
  ]);
  await page.goto("/burza/moji");
  await expect(page.getByRole("tab", {name: "Aktivni · 2"})).toHaveAttribute("aria-selected", "true");
});

test("Zatvori oglas on the ad's page: it says it is closed, leaves Burza and is in Moji oglasi' Prošli", async ({as, db, me, healthy}) => {
  const id = await publishAd(me.api, {kind: "PARTNER", league_id: me.league.id, phone: "091 234 5678", note: "Tražim partnera za nedjelje."});
  const page = await as("player");
  await page.goto("/burza?tab=partneri");
  const panel = page.getByRole("tabpanel", {name: "Partneri"});
  const card = panel.getByRole("link", {name: new RegExp(`^Traži partnera upravo ${escape(me.name)} `)});
  await expect(card).toHaveAttribute("href", `/burza/${id}`);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/burza/${id}$`));

  await page.getByRole("button", {name: "Zatvori oglas", exact: true}).click();
  await expect(page.getByText("Oglas je zatvoren. Više se ne vidi u Burzi.", {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Zatvori oglas", exact: true})).toBeHidden();
  await expect(page.getByRole("button", {name: "Podijeli"})).toBeHidden();
  const [ad] = await myAds(db, me.id);
  expect(ad.closed_at).not.toBeNull();
  await healthy(page);

  // back to Burza: the seeded partner ads are there, the closed one isn't
  await page.getByRole("button", {name: "Natrag"}).click();
  await expect(page).toHaveURL(/\/burza\?tab=partneri$/);
  await expect(panel.getByRole("link").first()).toBeVisible();
  await expect(panel.getByRole("link", {name: new RegExp(escape(me.name))})).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Moji oglasi", exact: true})).toBeVisible();

  await page.getByRole("link", {name: "Moji oglasi", exact: true}).click();
  await expect(page.getByRole("tab", {name: "Aktivni · 0"})).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", {name: "Nemaš aktivnih oglasa"})).toBeVisible();
  await page.getByRole("tab", {name: "Prošli · 1"}).click();
  const past = page.getByRole("article", {name: "Tražim partnera"});
  await expect(past.getByText("Zatvoren", {exact: true})).toBeVisible();
  await expect(past.getByText(`Zatvoren ${dayMonth(zagrebDay(ad.closed_at!))}`, {exact: true})).toBeVisible();
  await expect(past.getByRole("button", {name: "Objavi ponovno"})).toBeVisible();
  await healthy(page);
});

test("Objavi ponovno puts a closed ad back up in place: it moves to Aktivni as Objavljeno ponovno and Burza lists it as new", async ({
  as,
  db,
  me,
  healthy,
}) => {
  const id = await publishAd(me.api, {kind: "PARTNER", league_id: me.league.id, phone: "091 234 5678", note: "Tražim partnera za nedjelje."});
  await closeAd(me.api, id);
  // it went up three days ago
  const before = new Date(Date.now() - 3 * 86_400_000);
  await db.marketPost.update({where: {id}, data: {created_at: before}});

  const page = await as("player");
  await page.goto("/burza/moji?tab=prosli");
  await expect(page.getByRole("tab", {name: "Prošli · 1"})).toHaveAttribute("aria-selected", "true");
  await page.getByRole("article", {name: "Tražim partnera"}).getByRole("button", {name: "Objavi ponovno"}).click();

  await expect(page).toHaveURL(/\/burza\/moji$/);
  await expect(page.getByRole("tab", {name: "Aktivni · 1"})).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", {name: "Prošli · 0"})).toBeVisible();
  const card = page.getByRole("article", {name: "Tražim partnera"});
  await expect(card.getByText("Aktivan", {exact: true})).toBeVisible();
  await expect(card.getByText("Objavljeno ponovno", {exact: true})).toBeVisible();
  await expect(page.getByRole("status").filter({hasText: "Oglas je ponovno objavljen."})).toBeAttached();

  const ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.id, a.closed_at])).toEqual([[id, null]]);
  expect(ads[0].created_at.getTime()).toBeGreaterThan(before.getTime());
  await healthy(page);

  // Burza has it again, as just published
  await page.goto("/burza?tab=partneri");
  await expect(page.getByRole("tabpanel", {name: "Partneri"}).getByRole("link", {name: new RegExp(`^Traži partnera upravo ${escape(me.name)} `)})).toHaveAttribute(
    "href",
    `/burza/${id}`
  );
});

test("Objavi ponovno when the same ad is already up brings up the open one with Već imaš ovakav oglas, and makes no copy", async ({as, db, me}) => {
  const closed = await publishAd(me.api, {kind: "PARTNER", league_id: me.league.id, phone: "091 234 5678", note: "Prvi oglas."});
  await closeAd(me.api, closed);
  // with the first one closed, a partner ad for the same league is a new one
  const open = await publishAd(me.api, {kind: "PARTNER", league_id: me.league.id, phone: "091 234 5678", note: "Drugi oglas."});
  expect(open).not.toBe(closed);

  const page = await as("player");
  await page.goto("/burza/moji?tab=prosli");
  await page.getByRole("article", {name: "Tražim partnera"}).getByRole("button", {name: "Objavi ponovno"}).click();

  await expect(page.getByRole("tab", {name: "Aktivni · 1"})).toHaveAttribute("aria-selected", "true");
  const card = page.getByRole("article", {name: "Tražim partnera"});
  await expect(card.getByText("Već imaš ovakav oglas", {exact: true})).toBeVisible();
  await expect(card.getByRole("link", {name: "Pogledaj"})).toHaveAttribute("href", `/burza/${open}`);
  // the tapped ad stays where it was
  await expect(page.getByRole("tab", {name: "Prošli · 1"})).toBeVisible();

  const ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.id, a.note, a.closed_at === null])).toEqual([
    [closed, "Prvi oglas.", false],
    [open, "Drugi oglas.", true],
  ]);
});

test("Objavi ponovno on a substitute ad whose night has passed opens Trebam zamjenu filled in from it, and the new night's ad leaves the old one in Prošli", async ({
  as,
  db,
  me,
  healthy,
}) => {
  const lastWeek = addDays(me.league.nights[0], -7);
  const old = await insertAd(db, me.id, {
    kind: "SUBSTITUTE",
    league_id: me.league.id,
    team_id: me.team.id,
    night: new Date(`${lastWeek}T00:00:00Z`),
    with_player_id: me.partner.id,
    phone: "+385 91 234 5678",
    note: "Javi se do 18 h.",
    created_at: new Date(`${addDays(lastWeek, -2)}T12:00:00Z`),
  });

  const page = await as("player");
  await page.goto("/burza/moji?tab=prosli");
  const card = page.getByRole("article", {name: `Ekipa ${me.team.name} traži zamjenu`});
  await expect(card.getByText("Istekao", {exact: true})).toBeVisible();
  await expect(card.getByText(`Istekao nakon večeri ${dayMonth(lastWeek)}`, {exact: true})).toBeVisible();
  await card.getByRole("button", {name: "Objavi ponovno"}).click();

  // the form, filled in from the ad: its league, the teammate, the note and the number; the night is a new one
  await expect(page).toHaveURL(/\/burza\/novi\/zamjena\?/);
  expect(new URL(page.url()).searchParams.get("repost")).toBe(String(old));
  await expect(page.getByRole("heading", {name: "Trebam zamjenu", level: 1})).toBeVisible();
  await expect(page.getByRole("radio", {name: me.league.name, exact: true})).toBeChecked();
  await expect(page.getByRole("radio", {name: new RegExp(escape(me.partner.name))})).toBeChecked();
  await expect(page.getByLabel("Napomena · neobavezno")).toHaveValue("Javi se do 18 h.");
  await expect(phoneField(page)).toHaveValue("+385 91 234 5678");
  const night = me.league.nights[1];
  await page.getByRole("radio", {name: nightLabel(night), exact: true}).click();
  await publishButton(page).click();
  await expect(page.getByRole("heading", {name: "Oglas je objavljen"})).toBeVisible();

  const ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.id === old, a.night?.toISOString().slice(0, 10), a.with_player_id, a.phone, a.note, a.closed_at])).toEqual([
    [true, lastWeek, me.partner.id, "+385 91 234 5678", "Javi se do 18 h.", null],
    [false, night, me.partner.id, "+385 91 234 5678", "Javi se do 18 h.", null],
  ]);

  // the way back leads to Aktivni, where the new ad is; the old one is still in Prošli
  await page.getByRole("button", {name: "Natrag"}).click();
  await expect(page).toHaveURL(/\/burza\/moji$/);
  await expect(page.getByRole("tab", {name: "Aktivni · 1"})).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("article", {name: `Ekipa ${me.team.name} traži zamjenu`}).getByText(`Zatvara se sam nakon večeri, ${nightLabel(night)}`, {exact: true})).toBeVisible();
  await expect(page.getByRole("tab", {name: "Prošli · 1"})).toBeVisible();
  await healthy(page);
});
