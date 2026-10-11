import {z} from "zod";
import {PlayerPartialResponseValidation} from "@/app/_interfaces/player";

const TeamName = z.string().trim().min(1, "Team name is required.").max(100, "Team name is too long.");

// A new team: its name and any number of players (the first two are its founders).
// founder_id1 / founder_id2 are the older form of the same request and still accepted.
export const TeamRequestValidation = z
  .object({
    team_name: TeamName,
    players: z.array(z.number().int()).optional(),
    founder_id1: z.number().int().optional(),
    founder_id2: z.number().int().optional(),
    // the league the team joins; defaults to the current league
    league_id: z.number().int().optional(),
  })
  .transform(({team_name, players, founder_id1, founder_id2, league_id}) => ({
    team_name,
    players: Array.from(new Set(players ?? [founder_id1, founder_id2].filter((id): id is number => id != null))),
    league_id,
  }));
export type TeamCreateRequest = z.infer<typeof TeamRequestValidation>;

export const TeamUpdateValidation = z.object({
  team_name: TeamName,
});

export const TeamPlayerAddValidation = z.object({
  player_id: z.number().int(),
});

export const AddTeammateRequestValidation = z.object({
  team_id: z.number().int(),
  player_id: z.number().int(),
});

export const TeamExtendedResponseValidation = z.object({
  team_id: z.number().int(),
  team_name: z.string(),
  // Manage Teams marks the founders and lists the team's leagues
  founder_id1: z.number().int().nullable().optional(),
  founder_id2: z.number().int().nullable().optional(),
  teamPlayers: z.array(
    z.object({
      player: PlayerPartialResponseValidation,
    })
  ),
  leagueTeams: z
    .array(
      z.object({
        active: z.boolean(),
        league: z.object({league_id: z.number().int(), league_name: z.string()}),
      })
    )
    .optional(),
});

export const TeamsResponseValidation = z.array(TeamExtendedResponseValidation);
export type TeamExtendedResponse = z.infer<typeof TeamExtendedResponseValidation>;
