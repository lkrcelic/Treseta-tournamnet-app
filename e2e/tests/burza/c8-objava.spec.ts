// C8 · publishing each kind of Burza ad as the player, from /burza/novi/zamjena | partner | dostupan, with the form's
// refusals first (Bela's DECISIONS #29, #39): Objavi oglas waits for a whole phone number (at least 9 digits, stored as
// "+385 91 234 5678"), Dostupan sam for at least one of Zamjena and Novi partner, and the server's refusal reaches the
// form. A new number goes on the player's profile when the profile has none, and one that would replace the profile's
// asks first, with "Zamijeni i broj na profilu" (b355d23); an availability ad without a number of its own shows the
// profile's (DECISIONS #29), also after the profile's number changes. The DECISIONS and commits named are Bela's: Treseta's
// Burza is Bela's code (BELA_SYNC.md lists no difference in it).
// Bela's spec: e2e/tests/burza/c8-objava.spec.ts (ba24386).
import {expect, test as base} from "../../helpers/c8";
import {day, escape, myAds, nightLabel, PHONE_ERROR, PHONE_HINT, phoneField, pickKind, publishButton} from "../../helpers/c8";

const test = base.extend<{dropNight: (night: string) => Promise<void>}>({
  // takes one of the current league's nights off its schedule, as an admin would in Datumi, and puts it back after
  // (with its places, and Podjela's rows, which go with the night on Treseta)
  dropNight: async ({db, me}, use) => {
    const rows: Awaited<ReturnType<typeof db.leagueNight.findMany>> = [];
    const split: Awaited<ReturnType<typeof db.leagueNightTeam.findMany>> = [];
    await use(async (night) => {
      const key = {league_id: me.league.id, night: day(night)};
      rows.push(await db.leagueNight.findUniqueOrThrow({where: {league_id_night: key}}));
      split.push(...(await db.leagueNightTeam.findMany({where: key})));
      await db.leagueNight.delete({where: {league_id_night: key}});
    });
    for (const row of rows) await db.leagueNight.upsert({where: {league_id_night: {league_id: row.league_id, night: row.night}}, create: row, update: {}});
    if (split.length) await db.leagueNightTeam.createMany({data: split, skipDuplicates: true});
  },
});

test("Trebam zamjenu: Objavi oglas waits for a whole number, then the ad goes up for the picked night and teammate and the number goes on the profile", async ({
  as,
  db,
  me,
  healthy,
}) => {
  const page = await as("player");
  await page.goto("/burza");
  await pickKind(page, "Objavi", "Trebam zamjenu");
  await expect(page).toHaveURL(/\/burza\/novi\/zamjena$/);

  // the player's team plays one league: it is picked, with the next six of its nights, tonight first
  await expect(page.getByRole("radiogroup", {name: "Liga"}).getByRole("radio")).toHaveCount(1);
  await expect(page.getByRole("radio", {name: me.league.name})).toBeChecked();
  const nights = page.getByRole("radiogroup", {name: "Večer"}).getByRole("radio");
  await expect(nights).toHaveCount(Math.min(6, me.league.nights.length));
  await expect(nights.first()).toHaveAccessibleName(`Večeras · ${nightLabel(me.league.nights[0])}`);
  await expect(nights.first()).toBeChecked();
  const roster = page.getByRole("radiogroup", {name: "Tko traži zamjenu?"}).getByRole("radio");
  await expect(roster).toHaveCount(2);
  await expect(roster.first()).toHaveAccessibleName(new RegExp(`Ja · ${escape(me.name)}`));
  await expect(roster.first()).toBeChecked();

  const night = me.league.nights[1];
  await page.getByRole("radio", {name: nightLabel(night), exact: true}).click();
  await page.getByRole("radio", {name: new RegExp(escape(me.partner.name))}).click();
  await expect(page.getByRole("radio", {name: new RegExp(escape(me.partner.name))})).toBeChecked();

  // the player has no number on the profile: the field is empty and Objavi oglas waits for one
  await expect(phoneField(page)).toHaveValue("");
  await expect(page.getByText(PHONE_HINT)).toBeVisible();
  await expect(publishButton(page)).toBeDisabled();
  await phoneField(page).fill("091 23");
  await expect(phoneField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(PHONE_ERROR)).toBeVisible();
  await expect(publishButton(page)).toBeDisabled();

  await phoneField(page).fill("091 234 5678");
  await expect(phoneField(page)).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Sprema se i na tvoj profil, pa ga idući put ne upisuješ.")).toBeVisible();
  await page.getByLabel("Napomena · neobavezno").fill("Počinjemo u 20 h.");
  await publishButton(page).click();

  await expect(page.getByRole("heading", {name: "Oglas je objavljen"})).toBeVisible();
  await expect(page.getByText("Ovako ga vide drugi. Zatvori ga kad nađeš igrača, a sam se zatvara kad prođe ta večer.")).toBeVisible();
  await expect(page.getByText("Treba zamjena", {exact: true})).toBeVisible();
  await expect(page.getByText(me.team.name, {exact: true})).toBeVisible();
  await expect(page.getByText(nightLabel(night), {exact: true})).toBeVisible();
  await expect(page.getByText(new RegExp(`^Suigrač: ${escape(me.partner.name)}`))).toBeVisible();
  await expect(page.getByText("+385 91 234 5678", {exact: true})).toBeVisible();
  await expect(page.getByText("Broj je spremljen na profil. Idući put je već upisan.")).toBeVisible();

  const ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.kind, a.league_id, a.team_id, a.night?.toISOString().slice(0, 10), a.with_player_id, a.phone, a.note, a.closed_at])).toEqual([
    ["SUBSTITUTE", me.league.id, me.team.id, night, me.partner.id, "+385 91 234 5678", "Počinjemo u 20 h.", null],
  ]);
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).phone).toBe("+385 91 234 5678");
  await healthy(page);

  // Gotovo: Burza on Zamjene, with the new ad among the open ones and in the header's count (the other teams' cards
  // name the player's team too, in "Taj dan igraš za ekipu …")
  await page.getByRole("button", {name: "Gotovo"}).click();
  await expect(page).toHaveURL(/\/burza\?tab=zamjene$/);
  await expect(page.getByRole("tabpanel", {name: "Zamjene"}).getByRole("link", {name: new RegExp(`^Treba zamjena upravo ${escape(me.team.name)} `)})).toHaveAttribute(
    "href",
    `/burza/${ads[0].id}`
  );
  await expect(page.getByRole("link", {name: "Moji oglasi · 1 aktivan"})).toBeVisible();
  await healthy(page);
});

test("Trebam zamjenu: a night the league stopped playing while the form was open is refused with the server's words, and nothing goes up", async ({
  as,
  db,
  me,
  dropNight,
}) => {
  const page = await as("player");
  await page.goto("/burza/novi/zamjena");
  const night = me.league.nights[Math.min(5, me.league.nights.length - 1)];
  await page.getByRole("radio", {name: nightLabel(night), exact: true}).click();
  await phoneField(page).fill("091 234 5678");
  await expect(publishButton(page)).toBeEnabled();

  // an admin takes the night off the league's schedule meanwhile
  await dropNight(night);
  await publishButton(page).click();
  await expect(page.getByText("Liga te večeri ne igra.", {exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Trebam zamjenu", level: 1})).toBeVisible();
  expect(await myAds(db, me.id)).toEqual([]);
  // the number goes on the profile only with an ad that went up
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).phone).toBeNull();
});

test("Tražim partnera: the profile's number is filled in, a new one asks before replacing it, and the ad goes up for the league", async ({
  as,
  db,
  me,
  healthy,
}) => {
  await db.player.update({where: {id: me.id}, data: {phone: "+385 98 765 4321"}});
  const page = await as("player");
  // from Moji oglasi this time: Novi oglas opens the same "Što objavljuješ?"
  await page.goto("/burza/moji");
  await pickKind(page, "Novi oglas", "Tražim partnera");
  await expect(page).toHaveURL(/\/burza\/novi\/partner$/);

  await expect(page.getByRole("radio", {name: me.league.name, exact: true})).toBeChecked();
  await expect(phoneField(page)).toHaveValue("+385 98 765 4321");
  await expect(page.getByText("S profila", {exact: true})).toBeVisible();
  await expect(publishButton(page)).toBeEnabled();

  // an emptied field waits for a number, a short one is an error
  await phoneField(page).fill("");
  await expect(page.getByText(PHONE_HINT)).toBeVisible();
  await expect(publishButton(page)).toBeDisabled();
  await phoneField(page).fill("12345");
  await expect(page.getByText(PHONE_ERROR)).toBeVisible();
  await expect(publishButton(page)).toBeDisabled();

  // another whole number: it would replace the profile's, so that is a choice (DECISIONS doesn't say which way it
  // starts, so the test only turns it off)
  await phoneField(page).fill("092 111 2233");
  await expect(page.getByText("S profila", {exact: true})).toBeHidden();
  const replace = page.getByRole("checkbox", {name: "Zamijeni i broj na profilu"});
  await expect(replace).toHaveAccessibleDescription("Na profilu je +385 98 765 4321.");
  await replace.setChecked(false);
  await expect(replace).not.toBeChecked();

  await page.getByRole("textbox", {name: "Oglas"}).fill("Tražim partnera za cijelu sezonu, igram nedjeljom.");
  await publishButton(page).click();

  await expect(page.getByRole("heading", {name: "Oglas je objavljen"})).toBeVisible();
  await expect(page.getByText("Ovako ga vide drugi. Zatvori ga kad nađeš partnera.", {exact: true})).toBeVisible();
  await expect(page.getByText("Traži partnera", {exact: true})).toBeVisible();
  await expect(page.getByText(me.name, {exact: true})).toBeVisible();
  await expect(page.getByText(new RegExp(`^${escape(me.league.name)}`))).toBeVisible();
  await expect(page.getByText("Tražim partnera za cijelu sezonu, igram nedjeljom.", {exact: true})).toBeVisible();
  await expect(page.getByText("+385 92 111 2233", {exact: true})).toBeVisible();
  await expect(page.getByText("Broj je spremljen na profil. Idući put je već upisan.")).toBeHidden();

  const ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.kind, a.league_id, a.team_id, a.night, a.phone, a.note, a.closed_at])).toEqual([
    ["PARTNER", me.league.id, null, null, "+385 92 111 2233", "Tražim partnera za cijelu sezonu, igram nedjeljom.", null],
  ]);
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).phone).toBe("+385 98 765 4321");
  await healthy(page);
});

test("Dostupan sam: Objavi oglas needs at least one of Zamjena and Novi partner, and the ad shows the profile's number, also once it changes", async ({
  as,
  db,
  me,
  healthy,
}) => {
  const page = await as("player");
  await page.goto("/burza/novi/dostupan");
  await expect(page.getByRole("heading", {name: "Dostupan sam", level: 1})).toBeVisible();

  const asSubstitute = page.getByRole("button", {name: "Zamjena", exact: true});
  const asPartner = page.getByRole("button", {name: "Novi partner", exact: true});
  await expect(asSubstitute).toHaveAttribute("aria-pressed", "true");
  await expect(asPartner).toHaveAttribute("aria-pressed", "false");
  await expect(publishButton(page)).toBeDisabled();
  await phoneField(page).fill("091 234 56");
  await expect(page.getByText(PHONE_ERROR)).toBeVisible();
  await phoneField(page).fill("091 234 5678");
  await expect(publishButton(page)).toBeEnabled();

  // neither: an error and no Objavi oglas
  await asSubstitute.click();
  await expect(asSubstitute).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("alert").filter({hasText: "Odaberi barem jedno."})).toBeVisible();
  await expect(publishButton(page)).toBeDisabled();
  await asPartner.click();
  await expect(page.getByRole("alert").filter({hasText: "Odaberi barem jedno."})).toBeHidden();
  await expect(publishButton(page)).toBeEnabled();

  await page.getByLabel("Napomena · neobavezno").fill("Slobodan sam nedjeljom.");
  await publishButton(page).click();

  await expect(page.getByRole("heading", {name: "Oglas je objavljen"})).toBeVisible();
  await expect(page.getByText("Ovako ga vide drugi. Zatvori ga kad više nisi dostupan.", {exact: true})).toBeVisible();
  await expect(page.getByText("Dostupan", {exact: true})).toBeVisible();
  await expect(page.getByText("Za novog partnera", {exact: true})).toBeVisible();
  await expect(page.getByText(/^Slobodan sam nedjeljom\./)).toBeVisible();
  await expect(page.getByText("+385 91 234 5678", {exact: true})).toBeVisible();
  await expect(page.getByText("Broj je spremljen na profil. Idući put je već upisan.")).toBeVisible();

  // the number went on the profile
  const ads = await myAds(db, me.id);
  expect(ads.map((a) => [a.kind, a.as_substitute, a.as_partner, a.note, a.closed_at])).toEqual([["AVAILABLE", false, true, "Slobodan sam nedjeljom.", null]]);
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).phone).toBe("+385 91 234 5678");
  await healthy(page);

  await page.getByRole("button", {name: "Gotovo"}).click();
  await expect(page).toHaveURL(/\/burza\?tab=dostupni$/);
  await expect(page.getByRole("tabpanel", {name: "Dostupni"}).getByRole("link", {name: new RegExp(`^Dostupan upravo ${escape(me.name)} Za novog partnera `)})).toHaveAttribute(
    "href",
    `/burza/${ads[0].id}`
  );

  // a new number on the profile (Moj profil · Mobitel) is the ad's number too
  await db.player.update({where: {id: me.id}, data: {phone: "+385 95 555 0101"}});
  await page.goto(`/burza/${ads[0].id}`);
  await expect(page.getByText("+385 95 555 0101", {exact: true})).toBeVisible();
  await expect(page.getByText("+385 91 234 5678", {exact: true})).toHaveCount(0);
});
