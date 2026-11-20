// C8 · Burza igrača for a guest (nobody logged in). The list and each ad are public (Bela's DECISIONS #29), the numbers
// aren't (Bela #11, Bela's DECISIONS #90, 3eb80df): GET /api/burza and an ad's page give a guest no phone number, and the
// ad's page offers "Prijavi se da vidiš broj", which goes to Prijava (Treseta has no "Sjedni za stol." sheet: Gost i
// poziv isn't copied, BELA_SYNC.md). Publishing needs a login: a form opened by a guest goes to Prijava and back
// (?next=, which Treseta keeps for Burza).
// Bela's spec: e2e/tests/burza/c8-gost.spec.ts (ba24386).
import {expect, test} from "../../helpers/fixtures";
import {PASSWORD} from "../../helpers/fixtures";

type Post = {id: number; phone: string | null; phone_hidden: boolean};

test("a guest reads every open ad of the public Burza, has no Moji oglasi, and is sent to Prijava to publish", async ({as, world, healthy}) => {
  const open = Object.values(world.ads)
    .filter((a) => a.open)
    .map((a) => `/burza/${a.id}`)
    .sort();
  const page = await as("guest");
  await page.goto("/burza");
  const list = page.getByRole("tabpanel", {name: "Sve"}).getByRole("link");
  await expect(list).toHaveCount(open.length);
  expect((await list.evaluateAll((links) => links.map((l) => l.getAttribute("href")))).sort()).toEqual(open);
  await expect(page.getByRole("link", {name: /^Moji oglasi/})).toHaveCount(0);
  await healthy(page);

  await page.getByRole("button", {name: "Objavi", exact: true}).click();
  await page.getByRole("dialog", {name: "Što objavljuješ?"}).getByRole("button", {name: /^Dostupan sam/}).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fburza%2Fnovi%2Fdostupan$/);
  await expect(page.getByRole("heading", {name: "Prijava"})).toBeVisible();
});

test("a guest sent to Prijava from Objavi comes back to the form once logged in", async ({as, world}) => {
  // BUG (Bela #79): logging in within 30 s of the redirect leaves the player on Prijava with Prijavi se spinning: Next's client
  // router cache still holds the middleware's redirect for /burza/novi/dostupan, so login/page.tsx's
  // router.replace(next) lands on Prijava again (shared code; after 30 s it works)
  test.fail();
  const page = await as("guest");
  await page.goto("/burza");
  await page.getByRole("button", {name: "Objavi", exact: true}).click();
  await page.getByRole("dialog", {name: "Što objavljuješ?"}).getByRole("button", {name: /^Dostupan sam/}).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fburza%2Fnovi%2Fdostupan$/);

  await page.getByLabel("Korisničko ime ili Email").fill(world.accounts.player.username);
  await page.getByLabel("Lozinka", {exact: true}).fill(PASSWORD);
  await page.getByRole("button", {name: "Prijavi se", exact: true}).click();
  await expect(page).toHaveURL(/\/burza\/novi\/dostupan$/);
  await expect(page.getByRole("heading", {name: "Dostupan sam", level: 1})).toBeVisible();
});

test("a guest gets no phone number, and Prijavi se da vidiš broj leads to Prijava, after which the ad shows its number (Bela #11)", async ({
  as,
  api,
  db,
  world,
  healthy,
}) => {
  // the seeded availability ad with a number of its own
  const ad = world.ads.availablePartner;
  const row = await db.marketPost.findUniqueOrThrow({where: {id: ad.id}, include: {player: true}});
  const number = row.phone!;
  expect(number).toMatch(/^\+385 /);

  // the API: every open ad, none with its number, each saying a login shows it
  const guest = await api("guest");
  const res = await guest.get("/api/burza");
  expect(res.status()).toBe(200);
  const {posts} = (await res.json()) as {posts: Post[]};
  expect(posts.map((p) => p.id).sort((a, b) => a - b)).toEqual(
    Object.values(world.ads)
      .filter((a) => a.open)
      .map((a) => a.id)
      .sort((a, b) => a - b)
  );
  expect(posts.filter((p) => p.phone != null)).toEqual([]);
  expect(posts.every((p) => p.phone_hidden)).toBe(true);
  const one = (await (await guest.get(`/api/burza/${ad.id}`)).json()) as Post;
  expect([one.phone, one.phone_hidden]).toEqual([null, true]);

  // the ad's page: everything but the number
  const page = await as("guest");
  await page.goto(`/burza/${ad.id}`);
  await expect(page.getByRole("region", {name: "Oglas"}).getByRole("heading", {name: `${row.player.first_name} ${row.player.last_name}`})).toBeVisible();
  await expect(page.getByText("Broj vide igrači s računom.", {exact: true})).toBeVisible();
  await expect(page.getByText(number)).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Nazovi"})).toHaveCount(0);
  await healthy(page);

  // Prijava (Bela opens "Sjedni za stol." here); once logged in, the ad shows its number
  await page.getByRole("link", {name: "Prijavi se da vidiš broj"}).click();
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.getByRole("heading", {name: "Prijava"})).toBeVisible();
  await page.getByLabel("Korisničko ime ili Email").fill(world.accounts.player.username);
  await page.getByLabel("Lozinka", {exact: true}).fill(PASSWORD);
  await page.getByRole("button", {name: "Prijavi se", exact: true}).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto(`/burza/${ad.id}`);
  await expect(page.getByText(number, {exact: true})).toBeVisible();
  await expect(page.getByRole("link", {name: "Nazovi"})).toHaveAttribute("href", `tel:+${number.replace(/\D/g, "")}`);
  await expect(page.getByText("Broj vide igrači s računom.", {exact: true})).toHaveCount(0);
  await healthy(page);
});
