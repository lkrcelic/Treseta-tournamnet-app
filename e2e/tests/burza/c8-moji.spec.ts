// C8 · Moji oglasi and Burza's tabs. Moji oglasi sorts the player's ads into Aktivni (newest first) and Prošli (by when
// they ended, the latest first), each with Aktivan / Istekao / Zatvoren and when it closes or did (Bela's DECISIONS #39): a
// substitute ad expires after its night or when its night is taken off the schedule, a partner ad when its league has
// ended (and can't go up again), an availability ad stays until it is closed. Burza's tabs (?tab=zamjene|partneri|
// dostupni) list the open ads of their kind, never an expired or closed one (ads.substituteExpired, ads.partnerExpired,
// ads.*Closed); Zamjene steps through the nights with substitute ads, counting the teams that ask (DECISIONS #29). The DECISIONS
// named are Bela's: Treseta's Burza is Bela's code (BELA_SYNC.md lists no difference in it).
// Bela's spec: e2e/tests/burza/c8-moji.spec.ts (ba24386).
import type {Page} from "@playwright/test";
import {expect, test} from "../../helpers/c8";
import {addDays, dayMonth, escape, insertAd, isoDay, nightLabel, zagrebDay} from "../../helpers/c8";

const hours = (n: number) => new Date(Date.now() - n * 3_600_000);
// the ads a tab panel lists, by their links
const listed = (page: Page, tab: string) => page.getByRole("tabpanel", {name: tab}).getByRole("link");
const hrefs = (ids: number[]) => ids.map((id) => `/burza/${id}`).sort();

test("Moji oglasi shows each of the player's ads under Aktivni or Prošli with its status, when it closes and what can be done with it", async ({
  as,
  db,
  me,
  world,
  healthy,
}) => {
  const league = await db.league.findUniqueOrThrow({where: {league_id: me.league.id}});
  const ended = await db.league.findUniqueOrThrow({where: {league_id: world.leagues.past2.id}});
  const leagueEnd = isoDay(league.end_date!);
  const endedOn = isoDay(ended.end_date!);
  const [tonight, nextNight] = me.league.nights;
  const lastWeek = addDays(tonight, -7);
  // a night ahead that the league doesn't play (it was taken off the schedule)
  const removedNight = addDays(nextNight, 1);
  const closedAt = hours(48);
  const substitute = {kind: "SUBSTITUTE" as const, league_id: me.league.id, team_id: me.team.id, with_player_id: me.partner.id, phone: "+385 91 234 5678"};

  // Aktivni, newest first
  const nextWeek = await insertAd(db, me.id, {...substitute, night: new Date(`${nextNight}T00:00:00Z`), created_at: hours(1)});
  const partner = await insertAd(db, me.id, {kind: "PARTNER", league_id: me.league.id, phone: "+385 91 234 5678", note: "Tražim partnera.", created_at: hours(2)});
  const available = await insertAd(db, me.id, {kind: "AVAILABLE", as_substitute: true, phone: "+385 91 234 5678", created_at: hours(3)});
  // Prošli
  await insertAd(db, me.id, {...substitute, night: new Date(`${lastWeek}T00:00:00Z`), created_at: hours(24 * 9)});
  await insertAd(db, me.id, {...substitute, night: new Date(`${removedNight}T00:00:00Z`), created_at: hours(4)});
  await insertAd(db, me.id, {kind: "PARTNER", league_id: ended.league_id, phone: "+385 91 234 5678", created_at: new Date(`${addDays(endedOn, -30)}T12:00:00Z`)});
  await insertAd(db, me.id, {kind: "PARTNER", league_id: me.league.id, phone: "+385 91 234 5678", created_at: hours(24 * 5), closed_at: closedAt});

  const page = await as("player");
  await page.goto("/burza");
  // the header counts the ads that are up in Burza
  await page.getByRole("link", {name: "Moji oglasi · 3 aktivna"}).click();
  await expect(page).toHaveURL(/\/burza\/moji$/);
  await expect(page.getByRole("tab", {name: "Aktivni · 3"})).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", {name: "Prošli · 4"})).toBeVisible();

  const cards = page.getByRole("tabpanel", {name: "Aktivni · 3"}).getByRole("article");
  const active = [
    {id: nextWeek, title: `Ekipa ${me.team.name} traži zamjenu`, sub: `${me.league.name} · ${nightLabel(nextNight)} · suigrač: ${me.partner.name}`, line: `Zatvara se sam nakon večeri, ${nightLabel(nextNight)}`},
    {id: partner, title: "Tražim partnera", sub: me.league.name, line: `Zatvara se sam kad liga završi, ${dayMonth(leagueEnd)}`},
    {id: available, title: "Dostupan sam", sub: "Za zamjenu", line: "Aktivan dok ga ne zatvoriš"},
  ];
  await expect(cards).toHaveCount(active.length);
  for (const [i, ad] of active.entries()) {
    const card = cards.nth(i);
    await expect(card).toHaveAccessibleName(ad.title);
    await expect(card.getByText("Aktivan", {exact: true})).toBeVisible();
    await expect(card.getByText(ad.sub, {exact: true})).toBeVisible();
    await expect(card.getByText(ad.line, {exact: true})).toBeVisible();
    await expect(card.getByRole("link", {name: "Pogledaj"})).toHaveAttribute("href", `/burza/${ad.id}`);
    await expect(card.getByRole("button", {name: "Zatvori oglas"})).toBeEnabled();
  }
  await healthy(page);

  await page.getByRole("tab", {name: "Prošli · 4"}).click();
  await expect(page).toHaveURL(/\/burza\/moji\?tab=prosli$/);
  const pastCards = page.getByRole("tabpanel", {name: "Prošli · 4"}).getByRole("article");
  // the latest end first: the removed night is still ahead, the closed ad ended two days ago, last week's night, the
  // league that ended in spring
  const past = [
    {title: `Ekipa ${me.team.name} traži zamjenu`, pill: "Istekao", line: "Istekao: večer je uklonjena iz rasporeda", repost: true},
    {title: "Tražim partnera", pill: "Zatvoren", line: `Zatvoren ${dayMonth(zagrebDay(closedAt))}`, repost: true},
    {title: `Ekipa ${me.team.name} traži zamjenu`, pill: "Istekao", line: `Istekao nakon večeri ${dayMonth(lastWeek)}`, repost: true},
    {title: "Tražim partnera", pill: "Istekao", line: `Istekao kad je liga završila ${dayMonth(endedOn)}`, repost: false},
  ];
  await expect(pastCards).toHaveCount(past.length);
  for (const [i, ad] of past.entries()) {
    const card = pastCards.nth(i);
    await expect(card).toHaveAccessibleName(ad.title);
    await expect(card.getByText(ad.pill, {exact: true})).toBeVisible();
    await expect(card.getByText(ad.line, {exact: true})).toBeVisible();
    await expect(card.getByRole("button", {name: "Zatvori oglas"})).toHaveCount(0);
    await expect(card.getByRole("button", {name: "Objavi ponovno"})).toHaveCount(ad.repost ? 1 : 0);
    // a partner ad of a league that has ended says so where Objavi ponovno would be
    await expect(card.getByText("Liga je završila", {exact: true})).toHaveCount(ad.repost ? 0 : 1);
  }
  await healthy(page);
});

test("Zatvori oglas on Moji oglasi closes without asking: the card moves to Prošli as Zatvoren upravo", async ({as, db, me}) => {
  const first = await insertAd(db, me.id, {kind: "PARTNER", league_id: me.league.id, phone: "+385 91 234 5678", created_at: hours(1)});
  const second = await insertAd(db, me.id, {kind: "AVAILABLE", as_partner: true, phone: "+385 91 234 5678", created_at: hours(2)});
  const page = await as("player");
  await page.goto("/burza/moji");
  await expect(page.getByRole("tab", {name: "Aktivni · 2"})).toHaveAttribute("aria-selected", "true");

  await page.getByRole("article", {name: "Tražim partnera"}).getByRole("button", {name: "Zatvori oglas"}).click();
  await expect(page.getByRole("status").filter({hasText: "Oglas je zatvoren."})).toBeAttached();
  await expect(page.getByRole("tab", {name: "Aktivni · 1"})).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("article", {name: "Dostupan sam"})).toBeVisible();
  await expect(page.getByRole("article", {name: "Tražim partnera"})).toHaveCount(0);

  await page.getByRole("tab", {name: "Prošli · 1"}).click();
  const closed = page.getByRole("article", {name: "Tražim partnera"});
  await expect(closed.getByText("Zatvoren", {exact: true})).toBeVisible();
  await expect(closed.getByText("Zatvoren upravo", {exact: true})).toBeVisible();
  await expect(closed.getByRole("button", {name: "Objavi ponovno"})).toBeVisible();

  const ads = await db.marketPost.findMany({where: {id: {in: [first, second]}}, orderBy: {id: "asc"}});
  expect(ads.map((a) => a.closed_at !== null)).toEqual([true, false]);
});

test("Burza's tabs list the open ads of their kind, never an expired or closed one, and Zamjene steps through the nights", async ({
  as,
  db,
  me,
  world,
  healthy,
}) => {
  const seeded = Object.values(world.ads);
  expect([world.ads.substituteExpired.open, world.ads.partnerExpired.open]).toEqual([false, false]);
  const rows = await db.marketPost.findMany({where: {id: {in: seeded.map((a) => a.id)}}, include: {team: true, player: true}});
  const open = (kind?: string) => rows.filter((r) => (!kind || r.kind === kind) && seeded.find((a) => a.id === r.id)!.open);
  const TAG = {SUBSTITUTE: "Treba zamjena", PARTNER: "Traži partnera", AVAILABLE: "Dostupan"} as const;
  // the card's headline: the team on a substitute ad, the author on the others
  const headline = (r: (typeof rows)[number]) => (r.kind === "SUBSTITUTE" ? r.team!.team_name : `${r.player.first_name} ${r.player.last_name}`);

  const page = await as("player");
  // every open ad of the kind and nothing else, each card with its tag and headline ("Treba zamjena prije 3 dana Kibiceri …")
  const expectTab = async (tab: string, ads: typeof rows) => {
    await expect(listed(page, tab)).toHaveCount(ads.length);
    const shown = await listed(page, tab).evaluateAll((links) => links.map((l) => l.getAttribute("href")));
    expect(shown.sort()).toEqual(hrefs(ads.map((a) => a.id)));
    for (const ad of ads) {
      await expect(listed(page, tab).filter({hasText: new RegExp(`^${TAG[ad.kind]}.+?${escape(headline(ad))}`)})).toHaveAttribute("href", `/burza/${ad.id}`);
    }
  };

  await page.goto("/burza?tab=zamjene");
  await expect(page.getByRole("tab", {name: "Zamjene"})).toHaveAttribute("aria-selected", "true");
  const substitutes = open("SUBSTITUTE");
  await expectTab("Zamjene", substitutes);
  // on a night the player's own team plays, the card says so
  for (const ad of substitutes) {
    const busy = me.league.nights.includes(isoDay(ad.night!));
    const card = listed(page, "Zamjene").filter({hasText: new RegExp(`^${TAG.SUBSTITUTE}.+?${escape(headline(ad))}`)});
    await expect(card.getByText(`Taj dan igraš za ekipu ${me.team.name}`, {exact: true})).toHaveCount(busy ? 1 : 0);
  }

  // the nights with substitute ads, each with the number of teams asking for it
  const nights = [...new Set(substitutes.map((a) => isoDay(a.night!)))].sort();
  const on = (night?: string) => substitutes.filter((a) => !night || isoDay(a.night!) === night);
  const looking = (ads: typeof rows) => {
    const n = new Set(ads.map((a) => a.team_id)).size;
    return n % 10 === 1 && n % 100 !== 11 ? `${n} ekipa traži igrača` : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? `${n} ekipe traže igrača` : `${n} ekipa traži igrača`;
  };
  await expect(page.getByText("Svi datumi", {exact: true})).toBeVisible();
  await expect(page.getByText(looking(on()), {exact: true})).toBeVisible();
  for (const night of nights) {
    await page.getByRole("button", {name: "Sljedeći datum"}).click();
    await expect(page).toHaveURL(new RegExp(`\\?tab=zamjene&date=${night}$`));
    // the night between the arrows, and on each of its cards
    await expect(page.getByText(nightLabel(night), {exact: true})).toHaveCount(on(night).length + 1);
    await expect(page.getByText(looking(on(night)), {exact: true})).toBeVisible();
    await expectTab("Zamjene", on(night));
  }
  await expect(page.getByRole("button", {name: "Sljedeći datum"})).toBeDisabled();
  await healthy(page);

  await page.getByRole("tab", {name: "Partneri"}).click();
  await expect(page).toHaveURL(/\/burza\?tab=partneri$/);
  await expectTab("Partneri", open("PARTNER"));

  await page.getByRole("tab", {name: "Dostupni"}).click();
  await expect(page).toHaveURL(/\/burza\?tab=dostupni$/);
  await expectTab("Dostupni", open("AVAILABLE"));

  await page.getByRole("tab", {name: "Sve"}).click();
  await expect(page).toHaveURL(/\/burza$/);
  await expectTab("Sve", open());
  await healthy(page);

  // an expired ad's own page says it is over, without a number to call
  for (const ad of [world.ads.substituteExpired, world.ads.partnerExpired]) {
    await page.goto(`/burza/${ad.id}`);
    await expect(page.getByText("Ovaj oglas je zatvoren.", {exact: true})).toBeVisible();
    await expect(page.getByText("Kontakt", {exact: true})).toHaveCount(0);
    await expect(page.getByRole("link", {name: "Nazovi"})).toHaveCount(0);
    await expect(page.getByRole("button", {name: /^Zatvori oglas/})).toHaveCount(0);
  }
});
