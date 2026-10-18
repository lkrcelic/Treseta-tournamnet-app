import {prisma} from "@/app/_lib/prisma";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {isAdminRole} from "@/app/_lib/players/admin";
import {fullAccess, playerView, Viewer} from "@/app/_lib/players/privacy";
import {allRatings, lastNights} from "@/app/_lib/service/ratings/ratings";
import {ratingSummary} from "@/app/_lib/ui/ratings";
import {inRatingOrder} from "@/app/_lib/ui/profiles";
import {PlayerOverview, PlayerOverviewTeam} from "@/app/_interfaces/profiles";
import {ownPhoto, PLAYER_PHOTO, photoContext, TEAM_PHOTO} from "@/app/_lib/service/players/photos";

// Zadnje večeri shows this many nights (as Rejting's detail)
const NIGHTS = 5;

// The Player page (GET /api/players/[id]/overview, any logged-in player): the player, privacy-filtered (personal data
// only for the player themself and admins), their rating and place as on Rejting, their teams with the teams' leagues
// and players, and their last nights. A player who isn't on Rejting still has a page (no place). Null for a player who
// doesn't exist or was deleted (404).
export async function getPlayerOverview(playerId: number, viewer: Viewer): Promise<PlayerOverview | null> {
  if (!isDbId(playerId)) return null;

  const player = await prisma.player.findFirst({
    where: {id: playerId, deleted_at: null},
    select: {
      id: true,
      first_name: true,
      last_name: true,
      active: true,
      username: true,
      email: true,
      phone: true,
      birth_date: true,
      smoker: true,
      player_role: true,
      rating: true,
      ...PLAYER_PHOTO,
    },
  });
  if (!player) return null;

  const full = fullAccess(viewer, playerId);
  const [list, teams, history, photos, own] = await Promise.all([
    allRatings(),
    prisma.team.findMany({
      where: {team_id: {not: BYE_TEAM_ID}, teamPlayers: {some: {player_id: playerId}}},
      select: {
        team_id: true,
        team_name: true,
        ...TEAM_PHOTO,
        leagueTeams: {select: {league: {select: {league_id: true, league_name: true}}}, orderBy: {league_id: "desc"}},
        teamPlayers: {
          where: {player: {deleted_at: null}},
          select: {player: {select: {id: true, first_name: true, last_name: true, ...PLAYER_PHOTO}}},
        },
      },
    }),
    prisma.playerRatingHistory.findMany({
      where: {player_id: playerId},
      orderBy: {night: "desc"},
      take: NIGHTS,
      select: {night: true, change: true},
    }),
    photoContext(viewer),
    full ? ownPhoto(playerId, viewer) : null,
  ]);

  const teamRows: PlayerOverviewTeam[] = teams
    .map((t) => ({
      team_id: t.team_id,
      team_name: t.team_name,
      leagues: t.leagueTeams.map((lt) => lt.league),
      players: inRatingOrder(
        t.teamPlayers.map(({player: p}) => ({id: p.id, first_name: p.first_name, last_name: p.last_name, photo_url: photos.player(p)})),
        list
      ),
      photo_url: photos.team(t),
    }))
    .sort((a, b) => a.team_name.localeCompare(b.team_name, "hr"));

  return {
    player: playerView(player, viewer),
    photo: own ?? {photo_url: photos.player(player)},
    full,
    rating: {...ratingSummary(list, player), total: list.length},
    teams: teamRows,
    nights: await lastNights(playerId, history),
    viewer: {admin: isAdminRole(viewer), self: viewer.id === playerId},
  };
}
