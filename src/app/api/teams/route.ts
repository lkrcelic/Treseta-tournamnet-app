// src/app/api/teams/route.ts

import {prisma} from "@/app/_lib/prisma";
import {TEAM_NAME_TAKEN, TeamRequestValidation, TeamsResponseValidation} from "@/app/_interfaces/team";
import {Prisma} from "@prisma/client";
import {errorResponse} from "@/app/_lib/apiErrors";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {createTeam} from "@/app/_lib/service/team/create";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {escapeLike} from "@/app/_lib/helpers/query/anyCase";
import {rosterView} from "@/app/_lib/players/privacy";
import {PLAYER_PHOTO, photoContext} from "@/app/_lib/service/players/photos";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const {searchParams} = new URL(request.url);
    const search = searchParams.get("search");
    const dbTeams = await prisma.team.findMany({
      // the bye placeholder is not a real team
      where: {
        team_id: {not: BYE_TEAM_ID},
        // escaped: "_" and "%" in the name are plain characters, not wildcards
        ...(search ? {team_name: {contains: escapeLike(search), mode: "insensitive"}} : {}),
      },
      include: {
        // only the fields the response shows (not emails or password hashes); rosterView below drops the usernames
        // others may not see and puts the players in Croatian name order
        teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, username: true, ...PLAYER_PHOTO}}}},
        leagueTeams: {
          select: {active: true, league: {select: {league_id: true, league_name: true}}},
          orderBy: {league_id: "desc"},
        },
      },
      orderBy: {team_name: "asc"},
    });
    // the avatars: only the photos this viewer may see (photos.ts)
    const photos = await photoContext(auth.user);
    const teams = TeamsResponseValidation.parse(
      dbTeams.map((t) => ({
        ...t,
        photo_url: photos.team(t),
        teamPlayers: rosterView(
          auth.user,
          t.teamPlayers.map(({player: {photo_updated_at, photo_visibility, ...p}}) => ({...p, photo_url: photos.player({id: p.id, photo_updated_at, photo_visibility})}))
        ).map((player) => ({player})),
      }))
    );

    return NextResponse.json(teams, {status: STATUS.OK});
  } catch (error) {
    return NextResponse.json({error: "Ekipe se nisu učitale."}, {status: STATUS.ServerError});
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const req_data = await request.json();

    const teamVal = TeamRequestValidation.parse(req_data);

    const createdTeam = await createTeam(teamVal, auth.user.id);

    return NextResponse.json(createdTeam, {status: STATUS.OK});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({error: TEAM_NAME_TAKEN}, {status: STATUS.BadRequest});
    }
    return errorResponse(error, "Ekipa nije napravljena.");
  }
}
