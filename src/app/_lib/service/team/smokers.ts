import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {isByeTeam} from "@/app/_lib/bye";

// Smokers on each team's roster now (the profile's Smoker switch); teams without smokers are left out
export async function teamSmokers(teamIds: number[], db: Prisma.TransactionClient | typeof prisma = prisma): Promise<Map<number, number>> {
  const ids = Array.from(new Set(teamIds.filter((id) => !isByeTeam(id))));
  const counts = new Map<number, number>();
  if (!ids.length) return counts;
  const rows = await db.teamPlayer.findMany({where: {team_id: {in: ids}, player: {smoker: true}}, select: {team_id: true}});
  rows.forEach((r) => counts.set(r.team_id, (counts.get(r.team_id) ?? 0) + 1));
  return counts;
}
