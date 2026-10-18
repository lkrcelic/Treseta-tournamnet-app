import {z} from "zod";
import {TEAM_PHOTO_VISIBILITIES} from "@/app/_interfaces/photo";

const TeamName = z.string().trim().min(1, "Ime ekipe je obavezno.").max(100, "Ime ekipe je predugo.");

// Another team has that name (ignoring case): the server's refusal, and the Team page's check before it sends a name
export const TEAM_NAME_TAKEN = "Ekipa s tim imenom već postoji.";
// the Team page's pencil and "Nova ekipa" with an empty name
export const TEAM_NAME_REQUIRED = "Upiši ime ekipe.";

// A new team: its name and any number of players (the first two are its founders).
// founder_id1 / founder_id2 are the older form of the same request and still accepted.
export const TeamRequestValidation = z
  .object({
    team_name: TeamName,
    players: z.array(z.number().int()).optional(),
    founder_id1: z.number().int().optional(),
    founder_id2: z.number().int().optional(),
    // the league the team joins: null = none yet (the admin's "Nova ekipa"); left out = the current league
    league_id: z.number().int().nullable().optional(),
  })
  .transform(({team_name, players, founder_id1, founder_id2, league_id}) => ({
    team_name,
    players: Array.from(new Set(players ?? [founder_id1, founder_id2].filter((id): id is number => id != null))),
    league_id,
  }));
export type TeamCreateRequest = z.infer<typeof TeamRequestValidation>;

// PATCH /api/teams/[id]: a new name (admin), who sees the team's photo (any of its players) and "Zabrani novu sliku"
// (admin); any of them, at least one
export const TeamUpdateValidation = z
  .object({
    team_name: TeamName.optional(),
    photo_visibility: z.enum(TEAM_PHOTO_VISIBILITIES).optional(),
    photo_blocked: z.boolean().optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), "Nema promjena za spremanje.");
export const TEAM_RENAME_ADMIN_ONLY = "Ime ekipe mijenja admin.";
export const TEAM_PHOTO_VISIBILITY_MEMBERS_ONLY = "Tko vidi sliku ekipe biraju njezini igrači.";

export const TeamPlayerAddValidation = z.object({
  player_id: z.number().int(),
});

// A player on a team's roster; the username is only sent to admins and the player themselves (handoff §6 "Privacy",
// _lib/players/privacy.ts rosterView)
const TeamMemberValidation = z.object({
  id: z.number().int(),
  first_name: z.string(),
  last_name: z.string(),
  username: z.string().optional(),
  // the avatar; null = the initials (no photo, or the viewer may not see it)
  photo_url: z.string().nullable().optional(),
});

export const TeamExtendedResponseValidation = z.object({
  team_id: z.number().int(),
  team_name: z.string(),
  // the team's photo for the avatar (null = its letter)
  photo_url: z.string().nullable().optional(),
  // the founders (the first two players), and the leagues the Ekipe directory counts
  founder_id1: z.number().int().nullable().optional(),
  founder_id2: z.number().int().nullable().optional(),
  teamPlayers: z.array(
    z.object({
      player: TeamMemberValidation,
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
