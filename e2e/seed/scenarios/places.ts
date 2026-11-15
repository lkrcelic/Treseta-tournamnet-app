// The places of the leagues and tournaments (Admin · Lokacije). Treseta's own: a league night and a tournament point
// at a Location row (Bela keeps the place's name and address on the league and the tournament). Made first, so every
// league and tournament can use them.
import type {Ctx} from "../context";

const PLACES = {
  pitanik: {name: "Caffe bar Pitanik", address: "Ilica 1, Zagreb", url: "https://maps.app.goo.gl/e2eTestPitanik"},
  dubrava: {name: "Klub Dubrava", address: "Avenija Dubrava 1, Zagreb", url: "https://maps.app.goo.gl/e2eTestDubrava"},
} as const;

export type PlaceKey = keyof typeof PLACES;

const ids = new Map<PlaceKey, number>();

export async function seedPlaces(ctx: Ctx) {
  ids.clear();
  for (const [key, place] of Object.entries(PLACES) as [PlaceKey, (typeof PLACES)[PlaceKey]][]) {
    const row = await ctx.prisma.location.create({data: place});
    ids.set(key, row.location_id);
    ctx.catalog.places[key] = {id: row.location_id, name: row.name};
  }
}

// a place's id, once seedPlaces has run
export function placeId(key: PlaceKey): number {
  const id = ids.get(key);
  if (id === undefined) throw new Error(`place ${key} isn't seeded yet: seedPlaces runs first`);
  return id;
}
