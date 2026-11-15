// The three leagues of production's shape (14.11.2026): two finished seasons and the current one, 58–76 teams each,
// 6–7 nights, 3–4 rounds a night. The current one plays on tonight's weekday, so every run has a live night.
import type {League, Team} from "@prisma/client";
import {GAME_MINUTES_DEFAULT} from "@/app/_lib/gameTime";
import {addDays, type Ctx} from "../context";
import type {People} from "./people";
import {placeId, type PlaceKey} from "./places";

export type LeagueSpec = {
  key: string;
  name: string;
  season: string | null;
  teams: number;
  nights: Date[]; // every night of the league, oldest first
  datedLeague: boolean; // start/end/play_day filled in (the oldest production league has none)
  roundsPerNight: number;
  startTime: string | null;
  gatheringTime: string | null;
  // the league's place (Lokacije, scenarios/places.ts)
  location: PlaceKey | null;
};

export type BuiltLeague = {spec: LeagueSpec; league: League; teams: Team[]};

export function leagueSpecs(ctx: Ctx): LeagueSpec[] {
  const weekly = (first: Date, count: number) => Array.from({length: count}, (_, i) => addDays(first, i * 7));
  // the current league: five nights played, tonight, five to come
  const current = weekly(addDays(ctx.tonight, -35), 11);
  return [
    {
      key: "past1",
      name: "Trešeta liga Jesen 25/26",
      season: null,
      teams: 63,
      nights: weekly(addDays(ctx.tonight, -7 * 52), 7),
      datedLeague: false,
      roundsPerNight: 3,
      startTime: null,
      gatheringTime: null,
      location: null,
    },
    {
      key: "past2",
      name: "Trešeta liga Proljeće 26",
      season: "2026",
      teams: 76,
      nights: weekly(addDays(ctx.tonight, -7 * 30), 6),
      datedLeague: true,
      roundsPerNight: 3,
      startTime: "19:30",
      gatheringTime: null,
      location: "pitanik",
    },
    {
      key: "current",
      name: "Trešeta liga Jesen 2026",
      season: "2026/27",
      teams: 58,
      nights: current,
      datedLeague: true,
      roundsPerNight: 4,
      startTime: "19:30",
      gatheringTime: "19:00",
      location: "pitanik",
    },
  ];
}

// play_day is 0 = Monday … 6 = Sunday
function playDay(night: Date): number {
  return (night.getUTCDay() + 6) % 7;
}

export async function createLeague(ctx: Ctx, spec: LeagueSpec, teams: Team[]): Promise<BuiltLeague> {
  const {prisma} = ctx;
  const first = spec.nights[0];
  const last = spec.nights[spec.nights.length - 1];
  const league = await prisma.league.create({
    data: {
      league_name: spec.name,
      season: spec.season,
      start_date: spec.datedLeague ? first : null,
      end_date: spec.datedLeague ? last : null,
      play_day: spec.datedLeague ? playDay(first) : null,
      start_time: spec.startTime,
      gathering_time: spec.gatheringTime,
      location_id: spec.location ? placeId(spec.location) : null,
      rounds_per_night: spec.roundsPerNight,
      game_minutes: GAME_MINUTES_DEFAULT,
      created_at: addDays(first, -10),
    },
  });
  await prisma.leagueNight.createMany({
    data: spec.nights.map((night) => ({league_id: league.league_id, night})),
  });
  await prisma.leagueTeam.createMany({
    data: teams.map((team) => ({league_id: league.league_id, team_id: team.team_id})),
  });
  ctx.catalog.leagues[spec.key] = {id: league.league_id, name: league.league_name};
  return {spec, league, teams};
}

// Which teams play in which league: the player's team is always in the current one, the organizer's and the second
// admin's teams stay out of it (their own scenarios use them), and the rest are drawn so most teams play in more than
// one season, as in production.
export function pickLeagueTeams(ctx: Ctx, people: People, spec: LeagueSpec): Team[] {
  const rng = ctx.rng.fork(`league-teams-${spec.key}`);
  const reserved = new Set(people.teams.slice(-2).map((t) => t.team_id));
  const candidates = people.teams.filter((t) => !reserved.has(t.team_id) && t.team_id !== people.playerTeam.team_id);
  // within one league a player plays for one team only (two two-player teams sharing a player can't both field two)
  const out: Team[] = spec.key === "current" ? [people.playerTeam] : [];
  const used = new Set(out.flatMap((t) => people.rosters.get(t.team_id) ?? []));
  for (const team of rng.shuffle(candidates)) {
    if (out.length === spec.teams) break;
    const ids = people.rosters.get(team.team_id) ?? [];
    if (ids.some((id) => used.has(id))) continue;
    ids.forEach((id) => used.add(id));
    out.push(team);
  }
  if (out.length < spec.teams) throw new Error(`only ${out.length} of ${spec.teams} teams without a shared player for ${spec.key}`);
  return out;
}
