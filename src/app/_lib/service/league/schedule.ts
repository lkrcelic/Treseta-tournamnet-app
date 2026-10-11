import {MyLeague, MySchedule} from "@/app/_interfaces/burza";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {nextNightIndex} from "@/app/_lib/nights";
import {prisma} from "@/app/_lib/prisma";
import {playedNightKeys} from "@/app/_lib/service/league/nights";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function playerName(p: {first_name: string; last_name: string; username: string}): string {
  return `${p.first_name} ${p.last_name}`.trim() || p.username;
}

// The leagues the player plays in through their teams, each with the team, its players and the league's nights
// (Početna · Sljedeća večer, Raspored, Burza · Trebam zamjenu). The league with the soonest night comes first;
// leagues whose season is over come last.
export async function mySchedule(playerId: number): Promise<MySchedule> {
  const today = leagueDateString();
  const teams = await prisma.team.findMany({
    where: {team_id: {not: BYE_TEAM_ID}, teamPlayers: {some: {player_id: playerId}}},
    select: {
      team_id: true,
      team_name: true,
      teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, username: true, rating: true}}}},
      leagueTeams: {
        select: {
          active: true,
          league: {select: {league_id: true, league_name: true, nights: {select: {night: true}, orderBy: {night: "asc"}}}},
        },
      },
    },
  });

  const leagueIds = Array.from(new Set(teams.flatMap((t) => t.leagueTeams.map((lt) => lt.league.league_id))));
  const played = await playedNightKeys(leagueIds);

  const leagues: MyLeague[] = teams.flatMap((t) =>
    t.leagueTeams.map(({active, league}) => {
      const nights = league.nights.map((n) => isoDate(n.night));
      return {
        league_id: league.league_id,
        league_name: league.league_name,
        team_id: t.team_id,
        team_name: t.team_name,
        active,
        players: t.teamPlayers
          .map(({player}) => ({id: player.id, name: playerName(player), rating: player.rating, me: player.id === playerId}))
          // the player first, as "(ti)" on Početna
          .sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name, "hr")),
        nights,
        played: nights.filter((n) => played.has(`${league.league_id}|${n}`)),
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
