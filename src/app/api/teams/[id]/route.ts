// src/app/api/teams/[id]/route.ts
import {NextRequest, NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {requireAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {prisma} from "@/app/_lib/prisma";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse, lookupErrorResponse} from "@/app/_lib/apiErrors";
import {
  TEAM_NAME_TAKEN,
  TEAM_NOT_FOUND,
  TEAM_PHOTO_VISIBILITY_MEMBERS_ONLY,
  TEAM_RENAME_ADMIN_ONLY,
  TeamExtendedResponseValidation,
  TeamUpdateValidation,
} from "@/app/_interfaces/team";
import {PHOTO_BLOCK_ADMIN_ONLY} from "@/app/_interfaces/player";
import {isAdminRole} from "@/app/_lib/players/admin";
import {isByeTeam} from "@/app/_lib/bye";
import {renameTeam} from "@/app/_lib/service/team/update";
import {deleteTeam} from "@/app/_lib/service/team/delete";
import {rosterView} from "@/app/_lib/players/privacy";
import {PLAYER_PHOTO, photoContext} from "@/app/_lib/service/players/photos";
import {isDbId} from "@/app/_lib/helpers/query/dbId";

// A new response each time: a response body can only be sent once
const teamNotFound = () => NextResponse.json({error: TEAM_NOT_FOUND}, {status: STATUS.NotFound});

// Handle GET request to fetch a single team by ID
export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
    const teamId = Number(params.id);
    // an id the database can't hold (also a malformed one) doesn't exist either
    if (!isDbId(teamId)) return teamNotFound();

    try {
        const dbTeam = await prisma.team.findUnique({
            where: {
                team_id: teamId,
            },
            // the response includes the players, so load them (without this every request failed validation);
            // rosterView below drops the usernames others may not see and puts the players in Croatian name order
            include: {
                teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, username: true, ...PLAYER_PHOTO}}}},
                leagueTeams: {select: {active: true, league: {select: {league_id: true, league_name: true}}}},
            },
        });

        if (!dbTeam) {
            return teamNotFound();
        }
        const photos = await photoContext(auth.user);
        const team = TeamExtendedResponseValidation.parse({
            ...dbTeam,
            photo_url: photos.team(dbTeam),
            teamPlayers: rosterView(
                auth.user,
                dbTeam.teamPlayers.map(({player: {photo_updated_at, photo_visibility, ...p}}) => ({...p, photo_url: photos.player({id: p.id, photo_updated_at, photo_visibility})}))
            ).map((player) => ({player})),
        });

        return NextResponse.json(team, {status: STATUS.OK});
    } catch (error) {
        // a database fault or a response that fails validation is the server's: a logged 500, not a 400
        return lookupErrorResponse(error, "Ekipa se nije učitala.");
    }
}

// Rename a team (admin), choose who sees its photo (any of its players: ALL or TEAMMATES) and/or switch "Zabrani novu
// sliku" (admin)
export async function PATCH(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const {team_name, photo_visibility, photo_blocked} = TeamUpdateValidation.parse(await request.json());
    const teamId = Number(params.id);
    if (!isDbId(teamId) || isByeTeam(teamId)) return teamNotFound();
    const admin = isAdminRole(auth.user);
    if (team_name !== undefined && !admin) return NextResponse.json({error: TEAM_RENAME_ADMIN_ONLY}, {status: STATUS.Forbidden});
    if (photo_blocked !== undefined && !admin) return NextResponse.json({error: PHOTO_BLOCK_ADMIN_ONLY}, {status: STATUS.Forbidden});
    if (photo_visibility !== undefined) {
      const member = await prisma.teamPlayer.findUnique({where: {team_id_player_id: {team_id: teamId, player_id: auth.user.id}}, select: {team_id: true}});
      if (!member) return NextResponse.json({error: TEAM_PHOTO_VISIBILITY_MEMBERS_ONLY}, {status: STATUS.Forbidden});
    }
    if (photo_visibility !== undefined || photo_blocked !== undefined) {
      const {count} = await prisma.team.updateMany({
        where: {team_id: teamId},
        data: {...(photo_visibility !== undefined && {photo_visibility}), ...(photo_blocked !== undefined && {photo_blocked})},
      });
      if (!count) return teamNotFound();
    }
    if (team_name === undefined) {
      return NextResponse.json({team_id: teamId, photo_visibility, photo_blocked}, {status: STATUS.OK});
    }
    const team = await renameTeam(teamId, team_name);
    if (!team) {
      return teamNotFound();
    }
    return NextResponse.json({team_id: team.team_id, team_name: team.team_name, photo_visibility, photo_blocked}, {status: STATUS.OK});
  } catch (error) {
    // two renames to the same name at once: the unique index catches the second
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({error: TEAM_NAME_TAKEN}, {status: STATUS.BadRequest});
    }
    return errorResponse(error, "Ime ekipe nije spremljeno.");
  }
}

// "Obriši ekipu" (admin): deletes a team that has never played and isn't in a tournament (deleteTeam). 204; a team that
// has played or is in a tournament is a 400 with the reason; a missing team (or the bye) a 404.
export async function DELETE(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const teamId = Number(params.id);
  if (!isDbId(teamId)) return teamNotFound();

  try {
    await deleteTeam(teamId);
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Ekipa nije obrisana.");
  }
}
