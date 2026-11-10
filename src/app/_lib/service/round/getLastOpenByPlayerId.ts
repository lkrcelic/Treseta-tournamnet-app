import {RoundResponse, RoundResponseValidation} from "@/app/_interfaces/round";
import {prisma} from "@/app/_lib/prisma";
import {Prisma} from "@prisma/client";
import {PUBLISHED_ROUND} from "@/app/_lib/roundStatus";

// The round the player plays next (Početna's table and opponent, Započni igru): an open, published one
// Which tables count: a league's (Početna · Liga), a tournament's (Početna · Turniri), or any (the menu's Započni igru)
export type OpenRoundScope = "league" | "tournament" | "any";

const SCOPE_WHERE: Record<OpenRoundScope, Prisma.RoundWhereInput> = {
  league: {leagueRounds: {some: {}}},
  tournament: {tournamentRounds: {some: {}}},
  any: {},
};

export async function getLastOpenRoundByPlayerId(playerId: number, scope: OpenRoundScope = "any"): Promise<RoundResponse | null> {
  const dbRound = await prisma.round.findFirst({
    where: {
      open: true,
      ...PUBLISHED_ROUND,
      ...SCOPE_WHERE[scope],
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
    include: {tournamentRounds: {select: {tournament_id: true}}},
  } as Prisma.RoundFindFirstArgs);

  if (!dbRound) return null;
  const tournamentId = (dbRound as unknown as {tournamentRounds: {tournament_id: number}[]}).tournamentRounds[0]?.tournament_id;
  return RoundResponseValidation.parse({...dbRound, tournament_id: tournamentId});
}
