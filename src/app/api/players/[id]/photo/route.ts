import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {prisma} from "@/app/_lib/prisma";
import {playerPhotoChangeError, playerPhotoUrl, playerPhotoVisible} from "@/app/_lib/players/privacy";
import {getPlayerPhoto, photoContext, removePlayerPhoto, setPlayerPhoto} from "@/app/_lib/service/players/photos";
import {noPhoto, photoResponse} from "@/app/_lib/photoResponse";
import {PhotoSaved, PhotoUploadValidation} from "@/app/_interfaces/photo";
import {PLAYER_NOT_FOUND} from "@/app/_interfaces/player";

export const dynamic = "force-dynamic";

// A player's profile photo (any logged-in player who may see it: the player, an admin, or as the player chose; 404
// otherwise, as for no photo at all)
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return noPhoto();
  try {
    const found = await getPlayerPhoto(id);
    if (!found) return noPhoto();
    const {mates} = await photoContext(auth.user);
    if (!playerPhotoVisible(auth.user, found.owner, mates)) return noPhoto();
    return photoResponse(request, found.stored);
  } catch (error) {
    console.error(error);
    return new NextResponse(null, {status: STATUS.ServerError});
  }
}

// The player sets their own photo, {data}: the crop as base64 or a data: URL (403 for anyone else, and while an admin
// has blocked new photos)
export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  try {
    const owner = await photoOwner(id);
    if (!owner) return NextResponse.json({error: PLAYER_NOT_FOUND}, {status: STATUS.NotFound});
    const refused = playerPhotoChangeError(auth.user, owner, "set");
    if (refused) return NextResponse.json({error: refused}, {status: STATUS.Forbidden});
    const {data} = PhotoUploadValidation.parse(await request.json());
    const updatedAt = await setPlayerPhoto(id, data);
    const saved: PhotoSaved = {photo_url: playerPhotoUrl({...owner, photo_updated_at: updatedAt}, auth.user, new Set())!};
    return NextResponse.json(saved, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Slika nije spremljena.");
  }
}

// The player removes their photo, or an admin does (the player isn't told); the initials come back
export async function DELETE(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  try {
    const owner = await photoOwner(id);
    if (!owner) return NextResponse.json({error: PLAYER_NOT_FOUND}, {status: STATUS.NotFound});
    const refused = playerPhotoChangeError(auth.user, owner, "remove");
    if (refused) return NextResponse.json({error: refused}, {status: STATUS.Forbidden});
    await removePlayerPhoto(id);
    return NextResponse.json({photo_url: null}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Slika nije maknuta.");
  }
}

async function photoOwner(id: number) {
  if (!isDbId(id)) return null;
  return prisma.player.findFirst({where: {id, deleted_at: null}, select: {id: true, photo_blocked: true, photo_visibility: true}});
}
