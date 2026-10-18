import {z} from "zod";

export const MAX_ROUNDS = 5;
export const MAX_WINDOW = 200;
const id = z.number().int().positive().max(2147483647);

// What an admin has set up on Novo kolo for a league tonight (saved for them on the server). sitting_out: the teams that
// don't play, taken when the admin first changes something.
export const CreateRoundDraftValidation = z.object({
  rounds: z.number().int().min(1).max(MAX_ROUNDS),
  // the pairing needs an even window
  window_size: z.number().int().min(2).max(MAX_WINDOW).refine((n) => n % 2 === 0, "Prozor mora biti paran broj."),
  smoking_on: z.boolean(),
  smoking_tables: z.array(z.number().int().positive().max(MAX_WINDOW)).max(MAX_WINDOW),
  sitting_out: z.array(id).max(5000),
});

// spelled out: without strictNullChecks z.infer makes every field optional
export type CreateRoundDraft = {rounds: number; window_size: number; smoking_on: boolean; smoking_tables: number[]; sitting_out: number[]};

type DraftTeam = {id: number; active: boolean};

// Until the admin changes something (no draft yet) the active teams play. After that the draft decides: a team made
// inactive later keeps playing, one made active stays out until it is switched on, and a team added to the league
// later plays.
export function isPlaying(team: DraftTeam, sittingOut: ReadonlySet<number> | null): boolean {
  return sittingOut ? !sittingOut.has(team.id) : team.active;
}

// The teams sitting out once the given teams are switched on or off; the first change takes who sits out now. Teams no
// longer in the league are dropped, so one added back later plays.
export function switchTeams(teams: readonly DraftTeam[], sittingOut: ReadonlySet<number> | null, ids: readonly number[], on: boolean): number[] {
  const out = new Set(teams.filter((t) => !isPlaying(t, sittingOut)).map((t) => t.id));
  ids.forEach((teamId) => (on ? out.delete(teamId) : out.add(teamId)));
  const inLeague = new Set(teams.map((t) => t.id));
  return Array.from(out).filter((teamId) => inLeague.has(teamId)).sort((a, b) => a - b);
}
