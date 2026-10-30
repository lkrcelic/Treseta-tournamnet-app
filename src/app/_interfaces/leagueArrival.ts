import {z} from "zod";

// Potvrda dolaska in the league (DECISIONS #73), as the screens get it

// A team's arrival tonight
export type LeagueArrivalView = {
  // it came and hasn't left: Novo kolo pairs it
  here: boolean;
  // when it came (Tu smo, or the admin's switch), ISO
  arrived_at: string;
  // the player who pressed Tu smo; null when the admin switched it on
  by: string | null;
  by_admin: boolean;
  // Odlazimo, or the admin's switch off; ISO
  left_at: string | null;
  left_by_admin: boolean;
};

// Tonight's window (ISO): Tu smo from opens, the night's start, and the night's end at 06:00
export type LeagueArrivalTimes = {opens: string; start: string; closes: string};

// The player's team on Početna · Večeras: the window and its arrival (null: it hasn't come)
export type MyLeagueArrival = LeagueArrivalTimes & {
  night: string;
  arrival: LeagueArrivalView | null;
};

// The admin's Novo kolo: tonight's night, its window (null: no Potvrda dolaska tonight, so Novo kolo pairs the active
// teams as before) and the arrival of every team that came
export type LeagueArrivals = {
  night: string;
  window: LeagueArrivalTimes | null;
  teams: Record<number, LeagueArrivalView>;
};

// A player's Tu smo, or Ipak otkazujemo / Odlazimo (leave), for one of their teams
export const LeagueArrivalRequestValidation = z.object({
  team_id: z.number().int().positive(),
  action: z.enum(["confirm", "leave"]),
});

// The admin's switches in Novo kolo: these teams are here or not
export const LeagueArrivalsRequestValidation = z.object({
  team_ids: z.array(z.number().int().positive()).min(1).max(500),
  here: z.boolean(),
});
