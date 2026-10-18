import {MyLeague, MySchedule} from "@/app/_interfaces/burza";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {effectiveLocation, effectiveTime, nextNightIndex, NightLocation} from "@/app/_lib/nights";
import {prisma} from "@/app/_lib/prisma";
import {playedNightKeys} from "@/app/_lib/service/league/nights";
import {displayName} from "@/app/_lib/players/names";
import {Viewer} from "@/app/_lib/players/privacy";
import {PLAYER_PHOTO, photoContext} from "@/app/_lib/service/players/photos";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const LOCATION = {location_name: true, location_address: true, location_url: true} as const;

// The leagues the player plays in through their teams, each with the team, its players and the league's nights (with
// their start times and places)
// (Početna · Sljedeća večer, Raspored, Burza · Trebam zamjenu). The league with the soonest night comes first;
// leagues whose season is over come last.
export async function mySchedule(viewer: Viewer): Promise<MySchedule> {
  const playerId = viewer.id;
  const today = leagueDateString();
  const teams = await prisma.team.findMany({
    where: {team_id: {not: BYE_TEAM_ID}, teamPlayers: {some: {player_id: playerId}}},
    select: {
      team_id: true,
      team_name: true,
      teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, rating: true, active: true, ...PLAYER_PHOTO}}}},
      leagueTeams: {
        select: {
          active: true,
          league: {
            select: {
              league_id: true,
              league_name: true,
              start_time: true,
              ...LOCATION,
              nights: {select: {night: true, start_time: true, ...LOCATION}, orderBy: {night: "asc"}},
            },
          },
        },
      },
    },
  });

  const leagueIds = Array.from(new Set(teams.flatMap((t) => t.leagueTeams.map((lt) => lt.league.league_id))));
  const [played, photos] = await Promise.all([playedNightKeys(leagueIds), photoContext(viewer)]);

  const leagues: MyLeague[] = teams.flatMap((t) =>
    t.leagueTeams.map(({active, league}) => {
      const nights = league.nights.map((n) => isoDate(n.night));
      const times: Record<string, string> = {};
      const places: Record<string, NightLocation> = {};
      const ownPlace: string[] = [];
      league.nights.forEach((n, i) => {
        const time = effectiveTime(n.start_time, league.start_time);
        if (time) times[nights[i]] = time;
        const place = effectiveLocation(n, league);
        if (place) places[nights[i]] = place;
        if (n.start_time || n.location_name) ownPlace.push(nights[i]);
      });
      return {
        league_id: league.league_id,
        league_name: league.league_name,
        team_id: t.team_id,
        team_name: t.team_name,
        active,
        players: t.teamPlayers
          .map(({player}) => ({
            id: player.id,
            name: displayName(player),
            rating: player.rating,
            me: player.id === playerId,
            active: player.active,
            photo_url: photos.player(player),
          }))
          // the player first, as "(ti)" on Početna
          .sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name, "hr")),
        nights,
        played: nights.filter((n) => played.has(`${league.league_id}|${n}`)),
        times,
        places,
        ownPlace,
      };
    })
  );

  const next = (l: MyLeague) => {
    const i = nextNightIndex(l.nights, today);
    return i < 0 ? "9999" : l.nights[i];
  };
  leagues.sort((a, b) => next(a).localeCompare(next(b)) || a.league_name.localeCompare(b.league_name, "hr"));
  return {today, leagues};
}
