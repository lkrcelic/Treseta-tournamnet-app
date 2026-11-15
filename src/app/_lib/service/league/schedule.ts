import {MyLeague, MySchedule} from "@/app/_interfaces/burza";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {isSlot, Slot} from "@/app/_lib/locations";
import {nightKolo} from "@/app/_lib/roundStatus";
import {MyLeagueTonight} from "@/app/_interfaces/burza";
import {leagueDateString, leagueNightString} from "@/app/_lib/dates";
import {myTonight} from "@/app/_lib/service/league/arrival";
import {effectiveLocation, effectiveTime, LOCATION_SELECT, nextNightIndex, NightLocation, secondLocationOf} from "@/app/_lib/nights";
import {prisma} from "@/app/_lib/prisma";
import {playedNightKeys} from "@/app/_lib/service/league/nights";
import {displayName} from "@/app/_lib/players/names";
import {Viewer} from "@/app/_lib/players/privacy";
import {PLAYER_PHOTO, photoContext} from "@/app/_lib/service/players/photos";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const LOCATION = {location: LOCATION_SELECT} as const;

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
      // Podjela: the team's place on the nights played at two places
      nightPlaces: {select: {league_id: true, night: true, slot: true}},
      leagueTeams: {
        select: {
          active: true,
          league: {
            select: {
              league_id: true,
              league_name: true,
              start_time: true,
              gathering_time: true,
              rounds_per_night: true,
              ...LOCATION,
              nights: {select: {night: true, start_time: true, gathering_time: true, ...LOCATION, secondLocation: LOCATION_SELECT}, orderBy: {night: "asc"}},
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
      const gatherings: Record<string, string> = {};
      const places: Record<string, NightLocation> = {};
      const secondPlaces: Record<string, NightLocation> = {};
      const slots: Record<string, Slot> = {};
      const placed = new Map(t.nightPlaces.filter((p) => p.league_id === league.league_id && isSlot(p.slot)).map((p) => [isoDate(p.night), p.slot as Slot]));
      const ownPlace: string[] = [];
      league.nights.forEach((n, i) => {
        const time = effectiveTime(n.start_time, league.start_time);
        if (time) times[nights[i]] = time;
        const gathering = effectiveTime(n.gathering_time, league.gathering_time);
        if (gathering) gatherings[nights[i]] = gathering;
        const place = effectiveLocation(n, league);
        if (place) places[nights[i]] = place;
        const second = secondLocationOf(n);
        if (second) secondPlaces[nights[i]] = second;
        const slot = second ? placed.get(nights[i]) : undefined;
        if (slot) slots[nights[i]] = slot;
        if (n.start_time || n.gathering_time || n.location || second) ownPlace.push(nights[i]);
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
        gatherings,
        places,
        secondPlaces,
        slots,
        ownPlace,
      };
    })
  );

  // Potvrda dolaska for the leagues that play tonight (until 06:00 still last evening's night)
  const tonight = leagueNightString();
  const arrivals = await myTonight(
    leagues
      .filter((l) => l.nights.includes(tonight))
      .map((l) => ({league_id: l.league_id, team_id: l.team_id, start: l.times[tonight] ?? null, gathering: l.gatherings[tonight] ?? null}))
  );
  for (const l of leagues) {
    const arrival = arrivals.get(`${l.league_id}|${l.team_id}`);
    if (arrival) l.arrival = arrival;
  }
  // the evening so far, for Početna's cards
  const perNight = new Map(teams.flatMap((t) => t.leagueTeams.map(({league}) => [league.league_id, league.rounds_per_night] as [number, number])));
  const evenings = await tonightOf(leagues.filter((l) => l.nights.includes(tonight)), tonight, perNight);
  for (const l of leagues) {
    const evening = evenings.get(`${l.league_id}|${l.team_id}`);
    if (evening) l.tonight = evening;
  }

  const next = (l: MyLeague) => {
    const i = nextNightIndex(l.nights, today);
    return i < 0 ? "9999" : l.nights[i];
  };
  leagues.sort((a, b) => next(a).localeCompare(next(b)) || a.league_name.localeCompare(b.league_name, "hr"));
  return {today, leagues};
}

// Each team's evening at its place (MyLeagueTonight), keyed "league_id|team_id", for the leagues that play tonight. The
// team's place is where its latest table was (a team moved during the night counts where it played), else where
// Podjela put it; a one-place night counts every table of the league.
async function tonightOf(leagues: MyLeague[], night: string, perNight: Map<number, number>): Promise<Map<string, MyLeagueTonight>> {
  if (leagues.length === 0) return new Map();
  const rounds = await prisma.round.findMany({
    where: {round_date: new Date(`${night}T00:00:00.000Z`), status: "PUBLISHED", leagueRounds: {some: {league_id: {in: leagues.map((l) => l.league_id)}}}},
    select: {
      round_number: true,
      location_slot: true,
      table_number: true,
      team1_id: true,
      team2_id: true,
      team1_wins: true,
      team2_wins: true,
      open: true,
      leagueRounds: {select: {league_id: true}},
      team1: {select: {team_name: true}},
      team2: {select: {team_name: true}},
    },
  });
  const out = new Map<string, MyLeagueTonight>();
  for (const l of leagues) {
    const ofLeague = rounds.filter((r) => r.leagueRounds.some((lr) => lr.league_id === l.league_id) && r.round_number != null);
    const mine = ofLeague
      .filter((r) => !r.open && (r.team1_id === l.team_id || r.team2_id === l.team_id))
      .sort((a, b) => b.round_number! - a.round_number!);
    const last = mine[0] ?? null;
    const twoPlaces = l.secondPlaces[night] != null;
    const slot = last ? last.location_slot : (l.slots[night] ?? null);
    const numbers = Array.from(new Set(ofLeague.filter((r) => !twoPlaces || r.location_slot === slot).map((r) => r.round_number!)));
    const kola = twoPlaces && slot == null ? 0 : numbers.length;
    let lastTable: MyLeagueTonight["lastTable"] = null;
    if (last) {
      const first = last.team1_id === l.team_id;
      const other = first ? last.team2_id : last.team1_id;
      lastTable = {
        table: last.table_number,
        kolo: nightKolo(last.round_number!, numbers) ?? [numbers.length, numbers.length],
        opponent: other === BYE_TEAM_ID ? null : (first ? last.team2 : last.team1).team_name,
        opponentId: other,
        score: first ? [last.team1_wins, last.team2_wins] : [last.team2_wins, last.team1_wins],
        bye: other === BYE_TEAM_ID,
      };
    }
    out.set(`${l.league_id}|${l.team_id}`, {night, lastTable, lastKoloOut: kola > 0 && kola >= (perNight.get(l.league_id) ?? Infinity), kola});
  }
  return out;
}
