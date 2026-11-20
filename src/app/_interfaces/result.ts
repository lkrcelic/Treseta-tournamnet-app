import {z} from "zod";
import {TeamSideValidation} from "@/app/_interfaces/side";

// One hand: each team's points. Normally they add up to 11; a custom hand (one cut short by "s ovim dosta", or a
// correction) is typed freely. `dosta_side` is the team that called "s ovim dosta" on it (a custom hand only);
// saving a hand without it clears the call. The zvanja are each team's count of zvanja worth 3 and worth 4 (none on a
// custom hand). Left out, a new hand has none and a corrected hand keeps the ones it has (a phone still on the page
// from before zvanja doesn't wipe them).
export const ResultCreateRequestValidation = z.object({
  match_id: z.number().int(),
  team1_game_points: z.number().int(),
  team2_game_points: z.number().int(),
  team1_zvanja3: z.number().int().min(0).optional(),
  team1_zvanja4: z.number().int().min(0).optional(),
  team2_zvanja3: z.number().int().min(0).optional(),
  team2_zvanja4: z.number().int().min(0).optional(),
  custom: z.boolean().optional().default(false),
  dosta_side: TeamSideValidation.nullable().optional(),
  // How many hands the match held when this entry was opened. Several phones follow the same match, so a hand saved
  // on another one in the meantime means this one may be the same hand twice: the save is held back (409) and the
  // phone asks. Left out (an admin's hand, or a re-send the player confirmed) means "save it whatever happened".
  expected_hands: z.number().int().nonnegative().optional().nullable(),
});

export const ResultResponseValidation = ResultCreateRequestValidation.omit({expected_hands: true}).extend({
  result_id: z.number().int().nullable(),
});

// A hand as the scoreboard lists it, with each team's zvanja by value (0 when the server leaves them out)
export const PartialResultResponseValidation = z.object({
  result_id: z.number().int().nullable(),
  team1_game_points: z.number(),
  team2_game_points: z.number(),
  team1_zvanja3: z.number().int().default(0),
  team1_zvanja4: z.number().int().default(0),
  team2_zvanja3: z.number().int().default(0),
  team2_zvanja4: z.number().int().default(0),
  custom: z.boolean().optional(),
  dosta_side: TeamSideValidation.nullable().optional(),
});

export type ResultCreateRequest = z.infer<typeof ResultCreateRequestValidation>;
export type ResultResponse = z.infer<typeof ResultResponseValidation>;
