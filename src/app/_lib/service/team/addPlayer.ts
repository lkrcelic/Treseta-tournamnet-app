import { prisma } from "@/app/_lib/prisma";

export async function addPlayerToTeam(team_id: number, player_id: number) {
  // Ensure the relation doesn't already exist
  const existing = await prisma.teamPlayer.findFirst({
    where: {
      team_id,
      player_id,
    },
  });
  if (existing) {
    return existing; // idempotent
  }

  // Create the team player relation
  return prisma.teamPlayer.create({
    data: {
      team_id,
      player_id,
    },
  });
}