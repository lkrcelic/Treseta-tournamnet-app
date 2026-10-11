import {LeagueNightRow} from "@/app/_interfaces/league";
import {MAX_NIGHTS} from "@/app/_lib/nights";
import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Prisma} from "@prisma/client";

// League nights (Manage League · Dates): the nights a league plays. Raspored shows them to the players, and
// Burza igrača offers only these nights to a team that needs a substitute.

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const nightValue = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// The nights that have rounds in the given leagues, as "leagueId|YYYY-MM-DD"
export async function playedNightKeys(leagueIds: number[]): Promise<Set<string>> {
  if (!leagueIds.length) return new Set();
  const rows = await prisma.$queryRaw<{league_id: number; night: Date}[]>`
      SELECT DISTINCT lr.league_id, r.round_date AS night
      FROM "LeagueRound" lr
               JOIN "Round" r ON r.id = lr.round_id
      WHERE lr.league_id IN (${Prisma.join(leagueIds)})
        AND r.round_date IS NOT NULL`;
  return new Set(rows.map((r) => `${r.league_id}|${isoDate(r.night)}`));
}

// A league's nights in date order, each with whether it has rounds; null when the league doesn't exist
export async function listLeagueNights(leagueId: number): Promise<LeagueNightRow[] | null> {
  const league = await prisma.league.findUnique({
    where: {league_id: leagueId},
    select: {nights: {select: {night: true}, orderBy: {night: "asc"}}},
  });
  if (!league) return null;
  const played = await playedNightKeys([leagueId]);
  return league.nights.map((n) => {
    const date = isoDate(n.night);
    return {date, played: played.has(`${leagueId}|${date}`)};
  });
}

export async function addLeagueNight(leagueId: number, date: string): Promise<void> {
  if ((await prisma.leagueNight.count({where: {league_id: leagueId}})) >= MAX_NIGHTS) {
    throw new InvalidResultError(`A league can have at most ${MAX_NIGHTS} nights.`);
  }
  try {
    await prisma.leagueNight.create({data: {league_id: leagueId, night: nightValue(date)}});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new InvalidResultError("This night is already on the list.");
      if (error.code === "P2003") throw new NotFoundError("League not found.");
    }
    throw error;
  }
}

// Removes a night that has no rounds. Returns false when the league doesn't have that night.
export async function removeLeagueNight(leagueId: number, date: string): Promise<boolean> {
  const night = nightValue(date);
  const rounds = await prisma.round.count({where: {round_date: night, leagueRounds: {some: {league_id: leagueId}}}});
  if (rounds) throw new InvalidResultError("Played nights can't be removed here. Delete their rounds in the Rounds tab first.");
  const {count} = await prisma.leagueNight.deleteMany({where: {league_id: leagueId, night}});
  return count > 0;
}

// A round created on a date the league hadn't planned adds that night, so Raspored shows it as played
export async function ensureLeagueNight(tx: Prisma.TransactionClient, leagueId: number, night: Date): Promise<void> {
  await tx.leagueNight.createMany({data: [{league_id: leagueId, night}], skipDuplicates: true});
}
