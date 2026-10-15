import {LeagueNightRow, LeagueNightUpdate, MAX_NIGHTS_ERROR, NIGHT_TAKEN, PAST_NIGHT_ERROR} from "@/app/_interfaces/league";
import {leagueDateString} from "@/app/_lib/dates";
import {effectiveLocation, effectiveTime, locationOf, MAX_NIGHTS} from "@/app/_lib/nights";
import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
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

// A league's nights in date order, each with whether it has rounds, when it starts and where it is played; null when
// the league doesn't exist
export async function listLeagueNights(leagueId: number): Promise<LeagueNightRow[] | null> {
  const league = await prisma.league.findUnique({
    where: {league_id: leagueId},
    select: {start_time: true, ...LOCATION, nights: {select: {night: true, start_time: true, ...LOCATION}, orderBy: {night: "asc"}}},
  });
  if (!league) return null;
  const played = await playedNightKeys([leagueId]);
  return league.nights.map((n) => {
    const date = isoDate(n.night);
    return {
      date,
      played: played.has(`${leagueId}|${date}`),
      start_time: n.start_time,
      time: effectiveTime(n.start_time, league.start_time),
      location: locationOf(n),
      place: effectiveLocation(n, league),
    };
  });
}

// startTime: the night's own start time (null: the league's)
export async function addLeagueNight(leagueId: number, date: string, startTime: string | null = null): Promise<void> {
  if ((await prisma.leagueNight.count({where: {league_id: leagueId}})) >= MAX_NIGHTS) {
    throw new InvalidResultError(MAX_NIGHTS_ERROR);
  }
  try {
    await prisma.leagueNight.create({data: {league_id: leagueId, night: nightValue(date), start_time: startTime}});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new InvalidResultError(NIGHT_TAKEN);
      if (error.code === "P2003") throw new NotFoundError("Liga ne postoji.");
    }
    throw error;
  }
}

// Removes a night that has no rounds (a draft counts too). Returns false when the league doesn't have that night.
export async function removeLeagueNight(leagueId: number, date: string): Promise<boolean> {
  const night = nightValue(date);
  const rounds = await prisma.round.groupBy({by: ["status"], where: {round_date: night, leagueRounds: {some: {league_id: leagueId}}}});
  if (rounds.some((r) => r.status === "PUBLISHED")) {
    throw new InvalidResultError("Odigrane večeri ne mogu se ukloniti ovdje. Prvo obriši njihova kola na kartici Kola.");
  }
  if (rounds.length) throw new InvalidResultError("Ova večer ima skicu kola. Prvo je odbaci na kartici Skica.");
  const {count} = await prisma.leagueNight.deleteMany({where: {league_id: leagueId, night}});
  return count > 0;
}

// Sets a night's own start time and place (Okupljanje večeri); either left out stays as it is, and null goes back to
// the league's (a null location clears all three location fields). Only a night still to be played: one that has
// passed or has rounds keeps its time and place. Returns the night as Datumi shows it, or null when the league doesn't
// have that night.
export async function updateLeagueNight(leagueId: number, date: string, change: LeagueNightUpdate): Promise<LeagueNightRow | null> {
  const night = nightValue(date);
  const exists = await prisma.leagueNight.count({where: {league_id: leagueId, night}});
  if (!exists) return null;
  const rounds = await prisma.round.count({where: {round_date: night, leagueRounds: {some: {league_id: leagueId}}}});
  if (rounds || date < leagueDateString()) throw new InvalidResultError(PAST_NIGHT_ERROR);
  const {location} = change;
  const updated = await prisma.leagueNight.update({
    where: {league_id_night: {league_id: leagueId, night}},
    data: {
      start_time: change.start_time,
      ...(location === undefined
        ? {}
        : {
            location_name: location?.name.trim() || null,
            location_address: (location && location.address?.trim()) || null,
            location_url: (location && location.url?.trim()) || null,
          }),
    },
    select: {start_time: true, ...LOCATION, league: {select: {start_time: true, ...LOCATION}}},
  });
  return {
    date,
    played: false,
    start_time: updated.start_time,
    time: effectiveTime(updated.start_time, updated.league.start_time),
    location: locationOf(updated),
    place: effectiveLocation(updated, updated.league),
  };
}

// A round created on a date the league hadn't planned adds that night, so Raspored shows it as played
export async function ensureLeagueNight(tx: Prisma.TransactionClient, leagueId: number, night: Date): Promise<void> {
  await tx.leagueNight.createMany({data: [{league_id: leagueId, night}], skipDuplicates: true});
}
