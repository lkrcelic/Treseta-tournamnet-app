// C9's own setup: the `player` account's profile as the seed made it (its photo, "Ja i suigrači", no block, no Mobitel, a
// birth date, not a smoker), put back after every test, so each test starts from the seeded profile and
// --repeat-each never meets what the last one changed. Plus what the photo tests look at: the photo's <img> (its address
// carries the version, /api/players/<id>/photo?v=<ms>) and what a viewer's browser gets for that address.
import {join} from "node:path";
import type {Locator, Page} from "@playwright/test";
import type {PhotoVisibility} from "@prisma/client";
import {ONBOARDED, type Db} from "./db";
import {test as base} from "./fixtures";

// the file a player picks in the gallery (512×512, the app's own icon: Treseta's flower, blue and yellow petals in a
// black ring, on a transparent background)
export const PICKED_PHOTO = join(__dirname, "..", "..", "public", "icons", "icon-512.png");

export type Me = {
  id: number;
  username: string;
  // "Petar Igračić", as the Player page and the Team page name him
  name: string;
  firstName: string;
  lastName: string;
  team: {id: number; name: string};
  // the photo's current address (its version is when it last changed; the seed's moment for the seeded one), null when
  // there is none
  photoUrl: () => Promise<string | null>;
  // change the profile in the database (the test's own starting point)
  set: (data: {photo_visibility?: PhotoVisibility; photo_blocked?: boolean; smoker_answered?: boolean}) => Promise<void>;
  removePhoto: () => Promise<void>;
};

const PROFILE = {
  phone: true,
  birth_date: true,
  smoker: true,
  smoker_answered: true,
  photo_visibility: true,
  photo_blocked: true,
  photo_updated_at: true,
} as const;

export const test = base.extend<{me: Me}>({
  me: async ({db, world}, use) => {
    const {id, username} = world.accounts.player;
    const {first_name, last_name, ...seeded} = await db.player.findUniqueOrThrow({where: {id}, select: {...PROFILE, first_name: true, last_name: true}});
    const photo = await db.playerPhoto.findUnique({where: {player_id: id}});
    const team = world.teams.player;
    const photoUrl = async () => {
      const p = await db.player.findUniqueOrThrow({where: {id}, select: {photo_updated_at: true}});
      return p.photo_updated_at ? `/api/players/${id}/photo?v=${p.photo_updated_at.getTime()}` : null;
    };
    await use({
      id,
      username,
      name: `${first_name} ${last_name}`,
      firstName: first_name,
      lastName: last_name,
      team,
      photoUrl,
      set: async (data) => {
        await db.player.update({where: {id}, data});
      },
      removePhoto: async () => {
        await db.$transaction([db.playerPhoto.deleteMany({where: {player_id: id}}), db.player.update({where: {id}, data: {photo_updated_at: null}})]);
      },
    });
    // the seeded profile back: the same photo under the same version, so its address is the seed's again
    await db.$transaction([
      db.playerPhoto.deleteMany({where: {player_id: id}}),
      ...(photo ? [db.playerPhoto.create({data: {player_id: id, photo: photo.photo, type: photo.type}})] : []),
      db.player.update({where: {id}, data: seeded}),
    ]);
  },
});

export {expect} from "./fixtures";

// A plain player who plays in a team, but in none of `me`'s (so has teammates, just not him) and opens pages without
// an onboarding sheet; the first by id, so every run picks the same
export async function playerFromAnotherTeam(db: Db, me: Me): Promise<string> {
  const p = await db.player.findFirstOrThrow({
    where: {
      ...ONBOARDED,
      player_role: "PLAYER",
      deleted_at: null,
      teamPlayers: {some: {}, none: {team: {teamPlayers: {some: {player_id: me.id}}}}},
    },
    orderBy: {id: "asc"},
    select: {username: true},
  });
  return p.username;
}

// The <img> of a player's photo inside `scope` (an avatar is aria-hidden with alt="", so it has no role to find it by)
export function photoOf(scope: Page | Locator, playerId: number): Locator {
  return scope.locator(`img[src^="/api/players/${playerId}/photo?v="]`);
}

// How a player's chip in a Moje ekipe card ends: "@username", which is public (Bela's 5defdb6, DECISIONS #88, on master
// since the sync of 17 Nov 2026)
export function chipLabel(p: {username: string}): RegExp {
  return new RegExp(`@${p.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

// The player's chip in the Moje ekipe card of their team
export function myChip(page: Page, me: Me): Locator {
  const label = chipLabel({username: me.username});
  return page.getByRole("article", {name: me.team.name}).getByRole("list", {name: "Igrači"}).getByRole("listitem").filter({hasText: label});
}

// The player's row on the team's page: "<name> @<username>" for everyone, a teammate too (Bela's 5defdb6, DECISIONS #88,
// on master since the sync of 17 Nov 2026), as Bela's C9 finds it
export function myRow(page: Page, me: Me): Locator {
  return page.getByRole("region", {name: "Igrači"}).getByRole("link", {name: new RegExp(`^${me.name} @${me.username.replace(/\./g, "\\.")}`)});
}

// The size the browser decoded an <img> to (0 when it didn't load)
export function loadedWidth(img: Locator): Promise<number> {
  return img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0));
}

// What the viewer's own browser gets for an address (through the page, so with its login and its address)
export function statusFor(page: Page, url: string): Promise<number> {
  return page.evaluate((u) => fetch(u, {cache: "no-store"}).then((r) => r.status), url);
}

// The mean brightness (0–255) of a square of a photo, drawn by the viewer's browser: the corner of a crop zoomed 3× into
// the flower is a blue petal (about 120), the icon's own corner is transparent (0)
export function brightness(page: Page, url: string, square: {x: number; y: number; size: number}): Promise<number> {
  return page.evaluate(
    async ({u, s}) => {
      const img = new Image();
      img.src = u;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const {data} = ctx.getImageData(s.x, s.y, s.size, s.size);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      return sum / (data.length / 4);
    },
    {u: url, s: square}
  );
}
