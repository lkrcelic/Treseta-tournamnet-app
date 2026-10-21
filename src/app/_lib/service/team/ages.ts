import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {isByeTeam} from "@/app/_lib/bye";
import {leagueNight} from "@/app/_lib/dates";
import {averageAge} from "@/app/_lib/matching/teamAges";

// Each team's average age tonight, from the players on its roster now (one without a birth date counts as
// DEFAULT_AGE); teams without players are left out. As for smokers, a deactivated player can't play, so they don't
// count; a deleted one has left every team.
export async function teamAverageAges(
  teamIds: number[],
  db: Prisma.TransactionClient | typeof prisma = prisma,
  today: Date = leagueNight()
): Promise<Map<number, number>> {
  const ids = Array.from(new Set(teamIds.filter((id) => !isByeTeam(id))));
  const ages = new Map<number, number>();
  if (!ids.length) return ages;
  const rows = await db.teamPlayer.findMany({
    where: {team_id: {in: ids}, player: {active: true}},
    select: {team_id: true, player: {select: {birth_date: true}}},
  });
  const byTeam = new Map<number, (Date | null)[]>();
  rows.forEach((r) => byTeam.set(r.team_id, [...(byTeam.get(r.team_id) ?? []), r.player.birth_date]));
  byTeam.forEach((dates, id) => {
    const age = averageAge(dates, today);
    if (age != null) ages.set(id, age);
  });
  return ages;
}
