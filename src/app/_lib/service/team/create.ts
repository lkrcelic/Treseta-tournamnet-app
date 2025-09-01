import {prisma} from "@/app/_lib/prisma";
import {Team} from "@prisma/client";

export async function createTeam(createRequest: unknown, creatorId: number): Promise<Team> {
  return prisma.team.create({
    data: {
      team_name: createRequest.team_name,
      founder_id1: createRequest.founder_id1,
      founder_id2: createRequest.founder_id2,
      creator_id: creatorId,
      teamPlayers: {
        create: [
          {player_id: createRequest.founder_id1},
          {player_id: createRequest.founder_id2},
        ],
      },
    },
  });
}