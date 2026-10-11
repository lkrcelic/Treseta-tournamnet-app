import {RoundResponse, RoundResponseValidation} from "@/app/_interfaces/round";
import {prisma} from "@/app/_lib/prisma";
import {Prisma} from "@prisma/client";

export async function getLastOpenRoundByPlayerId(playerId: number): Promise<RoundResponse | null> {
  const dbRound = await prisma.round.findFirst({
    where: {
      open: true,
      OR: [
        {
          team1: {
            teamPlayers: {
              some: {
                player_id: playerId,
              },
            },
          },
        },
        {
          team2: {
            teamPlayers: {
              some: {
                player_id: playerId,
              },
            },
          },
        },
      ],
    },
    // The latest night first, so a round left unplayed on an earlier night doesn't block tonight's;
    // within the night the earliest open round is next (several are created at once)
    orderBy: [{round_date: {sort: "desc", nulls: "last"}}, {round_number: "asc"}, {id: "asc"}],
  } as Prisma.RoundFindFirstArgs);

  if (!dbRound) return null;
  return RoundResponseValidation.parse(dbRound);
}
