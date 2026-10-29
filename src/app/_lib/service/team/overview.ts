import {prisma} from "@/app/_lib/prisma";
import {isByeTeam} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {isAdminRole} from "@/app/_lib/players/admin";
import {displayName} from "@/app/_lib/players/names";
import {rosterUsername, Viewer} from "@/app/_lib/players/privacy";
import {getLeagueStandings} from "@/app/_lib/service/league/getStandings";
import {ratingSummaries} from "@/app/_lib/service/ratings/ratings";
import {aggregateTeamNights, bestRank, teamLeagueRows} from "@/app/_lib/ui/profiles";
import {PUBLISHED_ROUND} from "@/app/_lib/roundStatus";
import {TeamNight, TeamOverview, TeamOverviewPlayer} from "@/app/_interfaces/profiles";
import {PLAYER_PHOTO, photoContext, TEAM_PHOTO} from "@/app/_lib/service/players/photos";
import {teamDeleteBlocker} from "@/app/_lib/service/team/delete";

// Zadnje večeri shows this many nights
const NIGHTS = 4;

// The Team page (GET /api/teams/[id]/overview, any logged-in player): the team's players with their ratings, its
// leagues with its place and points (the same numbers as Ukupni poredak) and its last nights. Usernames only for an
// admin and the player themself; an admin also gets why the team can't be deleted. Null for a team that doesn't exist and for the bye team (404).
export async function getTeamOverview(teamId: number, viewer: Viewer): Promise<TeamOverview | null> {
  if (!isDbId(teamId) || isByeTeam(teamId)) return null;

  const team = await prisma.team.findUnique({
    where: {team_id: teamId},
    select: {
      team_id: true,
      team_name: true,
      ...TEAM_PHOTO,
      photo_blocked: true,
      // a deleted player is taken off every team; the filter only guards against an old row
      teamPlayers: {
        where: {player: {deleted_at: null}},
        select: {player: {select: {id: true, first_name: true, last_name: true, username: true, active: true, rating: true, ...PLAYER_PHOTO}}},
      },
      leagueTeams: {
        select: {
          league: {
            select: {
              league_id: true,
              league_name: true,
              season: true,
              end_date: true,
              nights: {select: {night: true}, orderBy: {night: "desc"}, take: 1},
            },
          },
        },
      },
    },
  });
  if (!team) return null;

  const roster = team.teamPlayers.map((tp) => tp.player);
  const leagues = team.leagueTeams.map((lt) => lt.league);
  const admin = isAdminRole(viewer);
  const [ratings, standings, nights, photos, deleteBlocked] = await Promise.all([
    ratingSummaries(roster),
    Promise.all(leagues.map((l) => getLeagueStandings(l.league_id))),
    lastTeamNights(teamId),
    photoContext(viewer),
    admin ? teamDeleteBlocker(teamId) : null,
  ]);

  const players: TeamOverviewPlayer[] = roster
    .map((p) => {
      const r = ratings.get(p.id)!;
      return {
        id: p.id,
        name: displayName(p),
        first_name: p.first_name,
        last_name: p.last_name,
        username: rosterUsername(viewer, p.id, p.username),
        rating: r.rating,
        rounds: r.rounds,
        provisional: r.provisional,
        active: p.active,
        me: p.id === viewer.id,
        photo_url: photos.player(p),
      };
    })
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, "hr"));

  const leagueRows = teamLeagueRows(
    leagues.map((l, i) => ({
      league_id: l.league_id,
      league_name: l.league_name,
      season: l.season,
      end_date: isoDate(l.end_date),
      last_night: isoDate(l.nights[0]?.night ?? null),
      standings: standings[i],
    })),
    teamId,
    leagueDateString()
  );

  const mine = players.some((p) => p.me);
  const photo_url = photos.team(team);
  return {
    team: {id: team.team_id, name: team.team_name, mine},
    // its players change the photo and who sees it; an admin removes it and blocks new ones
    photo:
      mine || admin
        ? {photo_url, photo_visibility: team.photo_visibility === "ME" ? "TEAMMATES" : team.photo_visibility, photo_blocked: team.photo_blocked, can_edit: mine}
        : {photo_url},
    stats: {
      best: bestRank(leagueRows),
      players: players.length,
      leagues: leagueRows.length,
      leagues_live: leagueRows.filter((l) => l.live).length,
    },
    players,
    leagues: leagueRows,
    nights,
    viewer: admin ? {admin, delete_blocked: deleteBlocked} : {admin},
  };
}

// The team's last nights: the finished rounds of its NIGHTS latest dates in a league, added up per night and league
async function lastTeamNights(teamId: number): Promise<TeamNight[]> {
  const dates = await prisma.$queryRaw<{round_date: Date}[]>`
      SELECT DISTINCT r.round_date
      FROM "Round" r
               JOIN "LeagueRound" lr ON lr.round_id = r.id
      WHERE r.open = false
        AND r.status = 'PUBLISHED'
        AND r.round_date IS NOT NULL
        AND (r.team1_id = ${teamId} OR r.team2_id = ${teamId})
      ORDER BY r.round_date DESC
      LIMIT ${NIGHTS}`;
  if (dates.length === 0) return [];

  const rounds = await prisma.round.findMany({
    where: {
      open: false,
      ...PUBLISHED_ROUND,
      round_date: {in: dates.map((d) => d.round_date)},
      OR: [{team1_id: teamId}, {team2_id: teamId}],
    },
    select: {
      round_date: true,
      team1_id: true,
      team2_id: true,
      team1_wins: true,
      team2_wins: true,
      leagueRounds: {select: {league: {select: {league_id: true, league_name: true}}}},
      matches: {select: {player_pair1_score: true, player_pair2_score: true}},
    },
  });

  return aggregateTeamNights(
    rounds.flatMap((r) =>
      r.leagueRounds.map(({league}) => ({
        date: isoDate(r.round_date)!,
        league_id: league.league_id,
        league_name: league.league_name,
        team1_id: r.team1_id,
        team2_id: r.team2_id,
        team1_wins: r.team1_wins,
        team2_wins: r.team2_wins,
        scores: r.matches.map((m): [number, number] => [m.player_pair1_score, m.player_pair2_score]),
      }))
    ),
    teamId,
    NIGHTS
  );
}

const isoDate = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
