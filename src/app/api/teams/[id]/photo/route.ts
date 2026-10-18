import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {isByeTeam} from "@/app/_lib/bye";
import {prisma} from "@/app/_lib/prisma";
import {teamPhotoChangeError, teamPhotoUrl, teamPhotoVisible} from "@/app/_lib/players/privacy";
import {getTeamPhoto, photoContext, removeTeamPhoto, setTeamPhoto} from "@/app/_lib/service/players/photos";
import {noPhoto, photoResponse} from "@/app/_lib/photoResponse";
import {PhotoSaved, PhotoUploadValidation} from "@/app/_interfaces/photo";

export const dynamic = "force-dynamic";

const teamNotFound = () => NextResponse.json({error: "Ekipa ne postoji."}, {status: STATUS.NotFound});

// A team's photo (any logged-in player who may see it: everyone, or only the team's players; admins always)
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return noPhoto();
  try {
    const found = await getTeamPhoto(id);
    if (!found) return noPhoto();
    const {teamIds} = await photoContext(auth.user);
    if (!teamPhotoVisible(auth.user, found.team, teamIds, id)) return noPhoto();
    return photoResponse(request, found.stored);
  } catch (error) {
    console.error(error);
    return new NextResponse(null, {status: STATUS.ServerError});
  }
}

// Any player of the team sets its photo, {data} (403 for anyone else, admins too, and while an admin has blocked it)
export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  try {
    const team = await photoTeam(id, auth.user.id);
    if (!team) return teamNotFound();
    const refused = teamPhotoChangeError(auth.user, team, team.member, "set");
    if (refused) return NextResponse.json({error: refused}, {status: STATUS.Forbidden});
    const {data} = PhotoUploadValidation.parse(await request.json());
    const updatedAt = await setTeamPhoto(id, data, auth.user.id);
    const saved: PhotoSaved = {photo_url: teamPhotoUrl({...team, photo_updated_at: updatedAt}, auth.user, new Set([id]))!};
    return NextResponse.json(saved, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Slika nije spremljena.");
  }
}

// A player of the team removes its photo, or an admin does (nobody is told); the team's letter comes back
export async function DELETE(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  try {
    const team = await photoTeam(id, auth.user.id);
    if (!team) return teamNotFound();
    const refused = teamPhotoChangeError(auth.user, team, team.member, "remove");
    if (refused) return NextResponse.json({error: refused}, {status: STATUS.Forbidden});
    await removeTeamPhoto(id, auth.user.id);
    return NextResponse.json({photo_url: null}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Slika nije maknuta.");
  }
}

async function photoTeam(id: number, viewerId: number) {
  if (!isDbId(id) || isByeTeam(id)) return null;
  const t = await prisma.team.findUnique({
    where: {team_id: id},
    select: {team_id: true, photo_blocked: true, photo_visibility: true, teamPlayers: {where: {player_id: viewerId}, select: {player_id: true}}},
  });
  return t && {team_id: t.team_id, photo_blocked: t.photo_blocked, photo_visibility: t.photo_visibility, member: t.teamPlayers.length > 0};
}
