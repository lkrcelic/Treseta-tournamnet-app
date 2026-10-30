import {LeagueNightAdd, LeagueNightRow, LeagueNightUpdate, MAX_NIGHTS_ERROR, MOVE_TO_PAST_ERROR, NIGHT_TAKEN, PAST_NIGHT_ERROR} from "@/app/_interfaces/league";
import {leagueDateString} from "@/app/_lib/dates";
import {effectiveLocation, effectiveTime, locationOf, MAX_NIGHTS} from "@/app/_lib/nights";
import {prisma} from "@/app/_lib/prisma";
import {deleteNightTables, lockLeague, NotFoundError} from "@/app/_lib/service/admin/tables";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Prisma} from "@prisma/client";

// League nights (Upravljanje ligom · Datumi): the nights a league plays. Raspored shows them to the players, and
// Burza igrača offers only these nights to a team that needs a substitute.

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const nightValue = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// The nights that have published rounds in the given leagues, as "leagueId|YYYY-MM-DD" (a night with only a draft
// isn't played yet)
export async function playedNightKeys(leagueIds: number[]): Promise<Set<string>> {
  if (!leagueIds.length) return new Set();
  const rows = await prisma.$queryRaw<{league_id: number; night: Date}[]>`
      SELECT DISTINCT lr.league_id, r.round_date AS night
      FROM "LeagueRound" lr
               JOIN "Round" r ON r.id = lr.round_id
      WHERE lr.league_id IN (${Prisma.join(leagueIds)})
        AND r.round_date IS NOT NULL
        AND r.status = 'PUBLISHED'`;
  return new Set(rows.map((r) => `${r.league_id}|${isoDate(r.night)}`));
}

const LOCATION = {location_name: true, location_address: true, location_url: true} as const;

// How many rounds each night of a league has published, by "YYYY-MM-DD" (a night with only a draft isn't played yet)
async function publishedRounds(leagueId: number): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{night: Date; rounds: number}[]>`
      SELECT r.round_date AS night, COUNT(DISTINCT r.round_number)::int AS rounds
      FROM "LeagueRound" lr
               JOIN "Round" r ON r.id = lr.round_id
      WHERE lr.league_id = ${leagueId}
        AND r.round_date IS NOT NULL
        AND r.status = 'PUBLISHED'
      GROUP BY r.round_date`;
  return new Map(rows.map((r) => [isoDate(r.night), r.rounds]));
}

// A league's nights in date order, each with its published rounds, when it starts and where it is played; null when
// the league doesn't exist
export async function listLeagueNights(leagueId: number): Promise<LeagueNightRow[] | null> {
  const league = await prisma.league.findUnique({
    where: {league_id: leagueId},
    select: {start_time: true, ...LOCATION, nights: {select: {night: true, start_time: true, ...LOCATION}, orderBy: {night: "asc"}}},
  });
  if (!league) return null;
  const published = await publishedRounds(leagueId);
  return league.nights.map((n) => {
    const date = isoDate(n.night);
    const rounds = published.get(date) ?? 0;
    return {
      date,
      played: rounds > 0,
      rounds,
      start_time: n.start_time,
      time: effectiveTime(n.start_time, league.start_time),
      location: locationOf(n),
      place: effectiveLocation(n, league),
    };
  });
}

// A night's own place as its three columns (null: the league's, all three cleared)
const locationData = (location: NonNullable<LeagueNightUpdate["location"]> | null) => ({
  location_name: location?.name.trim() || null,
  location_address: (location && location.address?.trim()) || null,
  location_url: (location && location.url?.trim()) || null,
});

// A new night with its own start time and place, or (left out or null) the league's
export async function addLeagueNight(leagueId: number, night: LeagueNightAdd): Promise<void> {
  if ((await prisma.leagueNight.count({where: {league_id: leagueId}})) >= MAX_NIGHTS) {
    throw new InvalidResultError(MAX_NIGHTS_ERROR);
  }
  try {
    await prisma.leagueNight.create({
      data: {league_id: leagueId, night: nightValue(night.date), start_time: night.start_time ?? null, ...locationData(night.location ?? null)},
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new InvalidResultError(NIGHT_TAKEN);
      if (error.code === "P2003") throw new NotFoundError("Liga ne postoji.");
    }
    throw error;
  }
}

// Removes a night that has no rounds (a draft counts too). withRounds (Obrisati odigranu večer?) removes a night that
// has some, with its rounds and what was played at them; standings and ratings are recalculated. Returns false when
// the league doesn't have that night.
export async function removeLeagueNight(leagueId: number, date: string, withRounds = false): Promise<boolean> {
  const night = nightValue(date);
  if (withRounds) {
    return prisma.$transaction(
      async (tx) => {
        if (!(await tx.leagueNight.count({where: {league_id: leagueId, night}}))) return false;
        await deleteNightTables(tx, leagueId, night);
        await tx.leagueNight.deleteMany({where: {league_id: leagueId, night}});
        return true;
      },
      {timeout: 60000}
    );
  }
  const rounds = await prisma.round.groupBy({by: ["status"], where: {round_date: night, leagueRounds: {some: {league_id: leagueId}}}});
  if (rounds.some((r) => r.status === "PUBLISHED")) {
    throw new InvalidResultError("Odigrane večeri ne mogu se ukloniti ovdje. Prvo obriši njihova kola na kartici Kola.");
  }
  if (rounds.length) throw new InvalidResultError("Ova večer ima skicu kola. Prvo je odbaci na kartici Skica.");
  const {count} = await prisma.leagueNight.deleteMany({where: {league_id: leagueId, night}});
  return count > 0;
}

// Moves a night to another date and sets its own start time and place (Uredi večer); any left out stays as it is, and
// null goes back to the league's (a null location clears all three location fields). Only a night still to be played:
// one that has passed or has rounds keeps its date, time and place. A moved night takes its Burza igrača ads along.
// Returns the night as Datumi shows it, or null when the league doesn't have that night.
export async function updateLeagueNight(leagueId: number, date: string, change: LeagueNightUpdate): Promise<LeagueNightRow | null> {
  const night = nightValue(date);
  const today = leagueDateString();
  const moveTo = change.date !== undefined && change.date !== date ? change.date : null;
  if (moveTo != null && moveTo < today) throw new InvalidResultError(MOVE_TO_PAST_ERROR);
  return prisma.$transaction(async (tx) => {
    // creating a round holds the same lock, so no round lands on the night while it moves
    await lockLeague(tx, leagueId);
    const exists = await tx.leagueNight.count({where: {league_id: leagueId, night}});
    if (!exists) return null;
    const rounds = await tx.round.count({where: {round_date: night, leagueRounds: {some: {league_id: leagueId}}}});
    if (rounds || date < today) throw new InvalidResultError(PAST_NIGHT_ERROR);
    if (moveTo != null && (await tx.leagueNight.count({where: {league_id: leagueId, night: nightValue(moveTo)}}))) {
      throw new InvalidResultError(NIGHT_TAKEN);
    }
    const {location} = change;
    const updated = await tx.leagueNight.update({
      where: {league_id_night: {league_id: leagueId, night}},
      data: {
        ...(moveTo == null ? {} : {night: nightValue(moveTo)}),
        start_time: change.start_time,
        ...(location === undefined ? {} : locationData(location)),
      },
      select: {start_time: true, ...LOCATION, league: {select: {start_time: true, ...LOCATION}}},
    });
    // a team looking for a substitute for that night looks for the new one
    if (moveTo != null) await tx.marketPost.updateMany({where: {league_id: leagueId, night}, data: {night: nightValue(moveTo)}});
    return {
      date: moveTo ?? date,
      played: false,
      rounds: 0,
      start_time: updated.start_time,
      time: effectiveTime(updated.start_time, updated.league.start_time),
      location: locationOf(updated),
      place: effectiveLocation(updated, updated.league),
    };
  });
}

// A round created on a date the league hadn't planned adds that night, so Raspored shows it as played
export async function ensureLeagueNight(tx: Prisma.TransactionClient, leagueId: number, night: Date): Promise<void> {
  await tx.leagueNight.createMany({data: [{league_id: leagueId, night}], skipDuplicates: true});
}
