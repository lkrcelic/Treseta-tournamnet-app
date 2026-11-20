// C8's own setup: Burza igrača as the `player` account (Petar Igračić of "Igračići", who plays the current league with
// `partner`). The seed gives the player no ads and no phone number, and every test starts and ends that way, so a test
// builds the ads it needs (through the app's /api/burza, or Prisma for a state the app can't make: a night that has
// passed, a league that has ended) and --repeat-each never meets the last run's ads. The seeded ads of other players
// (ads.*) are only read.
import {expect, type APIRequestContext, type Page} from "@playwright/test";
import type {Prisma} from "@prisma/client";
import type {Db} from "./db";
import {test as base} from "./fixtures";


type Person = {id: number; name: string};

export type Me = {
  id: number;
  username: string;
  name: string;
  team: {id: number; name: string};
  partner: Person;
  // the league the player's team plays now, and its nights from tonight on (YYYY-MM-DD)
  league: {id: number; name: string; nights: string[]};
  // the player's request context, for setup through the app's routes
  api: APIRequestContext;
};

export const test = base.extend<{me: Me}>({
  me: async ({api, db, world}, use) => {
    const {id, username} = world.accounts.player;
    const clear = async () => {
      await db.marketPost.deleteMany({where: {player_id: id}});
      await db.player.update({where: {id}, data: {phone: null}});
    };
    await clear();
    const name = async (playerId: number) => {
      const p = await db.player.findUniqueOrThrow({where: {id: playerId}});
      return `${p.first_name} ${p.last_name}`;
    };
    const league = world.leagues.current;
    const nights = await db.leagueNight.findMany({
      where: {league_id: league.id, night: {gte: new Date(`${world.leagues.current.tonight}T00:00:00Z`)}},
      orderBy: {night: "asc"},
    });
    await use({
      id,
      username,
      name: await name(id),
      team: world.teams.player,
      partner: {id: world.accounts.partner.id, name: await name(world.accounts.partner.id)},
      league: {id: league.id, name: league.name, nights: nights.map((n) => isoDay(n.night))},
      api: await api("player"),
    });
    await clear();
  },
});

export {expect} from "./fixtures";

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const addDays = (iso: string, days: number) => isoDay(new Date(day(iso).getTime() + days * 86_400_000));

// How the app writes dates (Bela's DECISIONS #39): a night "ned 22. 11.", a day "22. 11."
const WEEKDAYS = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];
export const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}.`;
export const nightLabel = (iso: string) => `${WEEKDAYS[day(iso).getUTCDay()]} ${dayMonth(iso)}`;
// the calendar day in Zagreb, as Moji oglasi dates a closed ad
export const zagrebDay = (d: Date) => new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Zagreb"}).format(d);

export const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// what POST /api/burza takes (src/app/_interfaces/burza.ts)
export type NewAd =
  | {kind: "SUBSTITUTE"; league_id: number; team_id: number; night: string; with_player_id: number; phone: string; note?: string; save_phone?: boolean}
  | {kind: "PARTNER"; league_id: number; phone: string; note?: string; save_phone?: boolean}
  | {kind: "AVAILABLE"; as_substitute: boolean; as_partner: boolean; phone: string; note?: string; save_phone?: boolean};

// Publishes an ad as the player would (Objavi oglas), and returns its id
export async function publishAd(api: APIRequestContext, ad: NewAd): Promise<number> {
  const res = await api.post("/api/burza", {data: ad});
  expect(res.status(), `POST /api/burza: ${await res.text()}`).toBe(201);
  return ((await res.json()) as {id: number}).id;
}

// Zatvori oglas, as its author
export async function closeAd(api: APIRequestContext, id: number) {
  const res = await api.patch(`/api/burza/${id}`, {data: {closed: true}});
  expect(res.status(), `PATCH /api/burza/${id}: ${await res.text()}`).toBe(200);
}

// An ad of the player's straight in the database, for what the app won't publish (a night already past, a league that
// has ended, a night the league doesn't play)
export async function insertAd(db: Db, playerId: number, data: Omit<Prisma.MarketPostUncheckedCreateInput, "player_id">): Promise<number> {
  return (await db.marketPost.create({data: {...data, player_id: playerId}})).id;
}

export const myAds = (db: Db, playerId: number) => db.marketPost.findMany({where: {player_id: playerId}, orderBy: {id: "asc"}});

// Burza's "Objavi" (or Moji oglasi' "Novi oglas") → "Što objavljuješ?" → one of the three kinds
export async function pickKind(page: Page, opener: "Objavi" | "Novi oglas", kind: "Trebam zamjenu" | "Tražim partnera" | "Dostupan sam") {
  await page.getByRole("button", {name: opener, exact: true}).click();
  const sheet = page.getByRole("dialog", {name: "Što objavljuješ?"});
  await sheet.getByRole("button", {name: new RegExp(`^${kind}`)}).click();
  await expect(page.getByRole("heading", {name: kind, level: 1})).toBeVisible();
}

// the phone field of a Burza form, and the line under it (the hint, or the error once the number can't be whole)
export const phoneField = (page: Page) => page.getByRole("textbox", {name: "Broj mobitela *"});
export const publishButton = (page: Page) => page.getByRole("button", {name: "Objavi oglas"});
export const PHONE_ERROR = /^Upiši cijeli broj, npr\. 091\s234\s5678\.$/;
export const PHONE_HINT = "Obavezno. Broj piše na oglasu da te mogu nazvati.";
