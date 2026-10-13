// src/app/api/teams/[id]/route.ts
import {NextRequest, NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {requireAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {prisma} from "@/app/_lib/prisma";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {TEAM_NAME_TAKEN, TeamExtendedResponseValidation, TeamUpdateValidation} from "@/app/_interfaces/team";
import {renameTeam} from "@/app/_lib/service/team/update";
import {rosterView} from "@/app/_lib/players/privacy";

// Handle GET request to fetch a single team by ID
export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
    const {id} = params;

    try {
        const dbTeam = await prisma.team.findUnique({
            where: {
                team_id: Number(id),
            },
            // the response includes the players, so load them (without this every request failed validation);
            // rosterView below drops the usernames others may not see and puts the players in Croatian name order
            include: {
                teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, username: true}}}},
                leagueTeams: {select: {active: true, league: {select: {league_id: true, league_name: true}}}},
            },
        });

        if (!dbTeam) {
            return NextResponse.json({error: "Ekipa ne postoji."}, {status: STATUS.NotFound});
        }
        const team = TeamExtendedResponseValidation.parse({
            ...dbTeam,
            teamPlayers: rosterView(auth.user, dbTeam.teamPlayers.map((tp) => tp.player)).map((player) => ({player})),
        });

        return NextResponse.json(team, {status: STATUS.OK});
    } catch (error) {
        return NextResponse.json({error: "Ekipa se nije učitala."}, {status: STATUS.BadRequest});
    }
}

// Rename a team (admin)
export async function PATCH(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const {team_name} = TeamUpdateValidation.parse(await request.json());
    const team = await renameTeam(Number(params.id), team_name);
    if (!team) {
      return NextResponse.json({error: "Ekipa ne postoji."}, {status: STATUS.NotFound});
    }
    return NextResponse.json({team_id: team.team_id, team_name: team.team_name}, {status: STATUS.OK});
  } catch (error) {
    // two renames to the same name at once: the unique index catches the second
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({error: TEAM_NAME_TAKEN}, {status: STATUS.BadRequest});
    }
    return errorResponse(error, "Ime ekipe nije spremljeno.");
  }
}
