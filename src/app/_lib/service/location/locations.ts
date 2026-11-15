import {LOCATION_IN_USE, LOCATION_NAME_TAKEN, LOCATION_NOT_FOUND, LocationCreate, LocationUpdate, LocationUse, LocationView} from "@/app/_interfaces/location";
import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Prisma} from "@prisma/client";

// Lokacije (LOCATIONS_PLAN.md): one list of places for every league night and tournament. A change shows wherever the
// place is used, past nights included; a place in use can't be deleted (the foreign keys RESTRICT it too).

const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const spaced = (name: string) => name.trim().replace(/\s+/g, " ");

const USES = {
  _count: {select: {leagues: true, nights: true, secondNights: true, tournaments: true}},
} as const;

type Row = {
  location_id: number;
  name: string;
  address: string | null;
  url: string | null;
  _count: {leagues: number; nights: number; secondNights: number; tournaments: number};
};

const usesOf = (r: Row): LocationUse => ({leagues: r._count.leagues, nights: r._count.nights + r._count.secondNights, tournaments: r._count.tournaments});
const viewOf = (r: Row): LocationView => ({location_id: r.location_id, name: r.name, address: r.address, url: r.url, uses: usesOf(r)});

// Every place, by name (Croatian order), with what uses it
export async function listLocations(): Promise<LocationView[]> {
  const rows = await prisma.location.findMany({select: {location_id: true, name: true, address: true, url: true, ...USES}});
  return rows.map(viewOf).sort((a, b) => a.name.localeCompare(b.name, "hr"));
}

// Two places can't share a name (any case, spaces aside): pickers find a place by it
async function checkNameFree(name: string, exceptId?: number): Promise<void> {
  const key = spaced(name).toLowerCase();
  const all = await prisma.location.findMany({select: {location_id: true, name: true}});
  if (all.some((l) => l.location_id !== exceptId && spaced(l.name).toLowerCase() === key)) throw new InvalidResultError(LOCATION_NAME_TAKEN);
}

// Dodaj lokaciju (Lokacije), and Nova lokacija in a place picker
export async function createLocation(input: LocationCreate): Promise<LocationView> {
  await checkNameFree(input.name);
  const row = await prisma.location.create({
    data: {name: spaced(input.name), address: blankToNull(input.address), url: blankToNull(input.url)},
    select: {location_id: true, name: true, address: true, url: true, ...USES},
  });
  return viewOf(row);
}

// Uredi lokaciju: fields left out stay as they are; an empty address or link is cleared
export async function updateLocation(id: number, input: LocationUpdate): Promise<LocationView> {
  if (input.name !== undefined) await checkNameFree(input.name, id);
  try {
    const row = await prisma.location.update({
      where: {location_id: id},
      data: {
        name: input.name === undefined ? undefined : spaced(input.name),
        address: input.address === undefined ? undefined : blankToNull(input.address),
        url: input.url === undefined ? undefined : blankToNull(input.url),
      },
      select: {location_id: true, name: true, address: true, url: true, ...USES},
    });
    return viewOf(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new NotFoundError(LOCATION_NOT_FOUND);
    throw error;
  }
}

// Obriši lokaciju: only one nothing uses (no league, night or tournament)
export async function deleteLocation(id: number): Promise<void> {
  const row = await prisma.location.findUnique({where: {location_id: id}, select: {location_id: true, name: true, address: true, url: true, ...USES}});
  if (!row) throw new NotFoundError(LOCATION_NOT_FOUND);
  const u = usesOf(row);
  if (u.leagues + u.nights + u.tournaments > 0) throw new InvalidResultError(LOCATION_IN_USE);
  try {
    await prisma.location.delete({where: {location_id: id}});
  } catch (error) {
    // something started using it in between: the foreign keys refuse
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw new InvalidResultError(LOCATION_IN_USE);
    throw error;
  }
}

// A place a league, night or tournament is set to must exist; a missing one is a readable 400, not a 500
export function locationRefused(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003" && String(error.meta?.field_name ?? "").includes("location")) {
    throw new InvalidResultError(LOCATION_NOT_FOUND);
  }
  throw error;
}
