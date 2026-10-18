import {prisma} from "@/app/_lib/prisma";
import {isAdminRole} from "@/app/_lib/players/admin";
import {playerPhotoUrl, teamPhotoUrl, Viewer} from "@/app/_lib/players/privacy";
import {decodeImage, ImageError} from "@/app/_lib/images";
import {GOOGLE_PHOTO_MAX_BYTES, OwnPhoto, PHOTO_FORMAT_ERROR, PHOTO_MAX_BYTES, PHOTO_SIZE_ERROR} from "@/app/_interfaces/photo";

// Profile photos of players and teams (the rules are in _lib/players/privacy.ts). A list that shows avatars selects
// PLAYER_PHOTO / TEAM_PHOTO with its rows and turns them into addresses with the viewer's PhotoContext: the bytes are
// only ever read by the photo routes.

export const PLAYER_PHOTO = {photo_updated_at: true, photo_visibility: true} as const;
export const TEAM_PHOTO = {photo_updated_at: true, photo_visibility: true} as const;

type PlayerPhotoRow = {id: number; photo_updated_at: Date | null; photo_visibility: Parameters<typeof playerPhotoUrl>[0]["photo_visibility"]};
type TeamPhotoRow = {team_id: number; photo_updated_at: Date | null; photo_visibility: Parameters<typeof teamPhotoUrl>[0]["photo_visibility"]};

// Who the viewer shares a team with, and their teams: what TEAMMATES needs
export type PhotoContext = {
  viewer: Viewer;
  mates: ReadonlySet<number>;
  teamIds: ReadonlySet<number>;
  player: (p: PlayerPhotoRow) => string | null;
  team: (t: TeamPhotoRow) => string | null;
};

// one lookup per request: the viewer object is the request's own (requireUser)
const contexts = new WeakMap<Viewer, Promise<PhotoContext>>();

export function photoContext(viewer: Viewer): Promise<PhotoContext> {
  let found = contexts.get(viewer);
  if (!found) {
    found = loadContext(viewer);
    contexts.set(viewer, found);
  }
  return found;
}

async function loadContext(viewer: Viewer): Promise<PhotoContext> {
  // an admin sees every photo: nothing to look up
  const rows = isAdminRole(viewer)
    ? []
    : await prisma.teamPlayer.findMany({
        where: {team: {teamPlayers: {some: {player_id: viewer.id}}}},
        select: {team_id: true, player_id: true},
      });
  const mates = new Set(rows.map((r) => r.player_id));
  const teamIds = new Set(rows.map((r) => r.team_id));
  return {
    viewer,
    mates,
    teamIds,
    player: (p) => playerPhotoUrl(p, viewer, mates),
    team: (t) => teamPhotoUrl(t, viewer, teamIds),
  };
}

export async function viewerTeammates(viewer: Viewer): Promise<ReadonlySet<number>> {
  return (await photoContext(viewer)).mates;
}

export async function viewerTeamIds(viewer: Viewer): Promise<ReadonlySet<number>> {
  return (await photoContext(viewer)).teamIds;
}

// ---------- the bytes ----------

const MESSAGES = {format: PHOTO_FORMAT_ERROR, size: PHOTO_SIZE_ERROR};

export type StoredPhoto = {photo: Buffer; type: string; updatedAt: Date};

// A player's photo with what decides who may see it; null when they have none (or were deleted)
export async function getPlayerPhoto(id: number) {
  const p = await prisma.player.findFirst({
    where: {id, deleted_at: null, photo_updated_at: {not: null}},
    select: {id: true, ...PLAYER_PHOTO, photo: {select: {photo: true, type: true}}},
  });
  if (!p?.photo || !p.photo_updated_at) return null;
  return {owner: {id: p.id, photo_visibility: p.photo_visibility}, stored: {photo: Buffer.from(p.photo.photo), type: p.photo.type, updatedAt: p.photo_updated_at}};
}

export async function getTeamPhoto(teamId: number) {
  const t = await prisma.team.findUnique({
    where: {team_id: teamId},
    select: {team_id: true, ...TEAM_PHOTO, photo: {select: {photo: true, type: true}}},
  });
  if (!t?.photo || !t.photo_updated_at) return null;
  return {team: {team_id: t.team_id, photo_visibility: t.photo_visibility}, stored: {photo: Buffer.from(t.photo.photo), type: t.photo.type, updatedAt: t.photo_updated_at}};
}

// Saves the photo (base64 or a data: URL, checked here: PNG, JPEG or WebP up to 512 KB) and gives its new version
export async function setPlayerPhoto(id: number, data: string): Promise<Date> {
  const {bytes, type} = decodeImage(data, PHOTO_MAX_BYTES, MESSAGES);
  const now = new Date();
  await prisma.$transaction([
    prisma.playerPhoto.upsert({where: {player_id: id}, create: {player_id: id, photo: bytes, type}, update: {photo: bytes, type}}),
    prisma.player.update({where: {id}, data: {photo_updated_at: now}, select: {id: true}}),
  ]);
  return now;
}

export async function removePlayerPhoto(id: number): Promise<void> {
  await prisma.$transaction([prisma.playerPhoto.deleteMany({where: {player_id: id}}), prisma.player.updateMany({where: {id}, data: {photo_updated_at: null}})]);
}

export async function setTeamPhoto(teamId: number, data: string, by: number): Promise<Date> {
  const {bytes, type} = decodeImage(data, PHOTO_MAX_BYTES, MESSAGES);
  const now = new Date();
  await prisma.$transaction([
    prisma.teamPhoto.upsert({where: {team_id: teamId}, create: {team_id: teamId, photo: bytes, type}, update: {photo: bytes, type}}),
    prisma.team.update({where: {team_id: teamId}, data: {photo_updated_at: now, photo_updated_by: by}, select: {team_id: true}}),
  ]);
  return now;
}

export async function removeTeamPhoto(teamId: number, by: number): Promise<void> {
  await prisma.$transaction([
    prisma.teamPhoto.deleteMany({where: {team_id: teamId}}),
    prisma.team.updateMany({where: {team_id: teamId}, data: {photo_updated_at: null, photo_updated_by: by}}),
  ]);
}

// ---------- the Google picture ----------

// Only Google's own picture host, over https (the address comes from the sign-in, but is checked anyway)
export function isGooglePhotoUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "googleusercontent.com" || u.hostname.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

// The picture of the player's Google account, fetched for the cropper (a canvas can't draw another site's image
// without CORS). null when there is none or it can't be had; at most 2 MB, 5 s.
export async function fetchGooglePhoto(url: string): Promise<{bytes: Buffer; type: string} | null> {
  if (!isGooglePhotoUrl(url)) return null;
  try {
    // a bigger size than the 96 px Google gives by default (its "=s96-c" suffix)
    const res = await fetch(url.replace(/=s\d+(-c)?$/, "=s512-c"), {signal: AbortSignal.timeout(5000), redirect: "error"});
    if (!res.ok) return null;
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > GOOGLE_PHOTO_MAX_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const {type} = decodeImage(bytes.toString("base64"), GOOGLE_PHOTO_MAX_BYTES, MESSAGES);
    return {bytes, type};
  } catch (error) {
    if (!(error instanceof ImageError)) console.error("google photo", error);
    return null;
  }
}

// ---------- the photo's settings ----------

// What a player gets about their own photo (Moj profil), and an admin about anyone's (the photo block on the Player
// page): the address, who sees it, whether new photos are blocked and, only for the player, whether their Google account
// has a picture to offer
export async function ownPhoto(id: number, viewer: Viewer): Promise<OwnPhoto | null> {
  const p = await prisma.player.findFirst({where: {id, deleted_at: null}, select: {id: true, ...PLAYER_PHOTO, photo_blocked: true, image: true}});
  if (!p) return null;
  return {
    photo_url: playerPhotoUrl(p, viewer, new Set()),
    photo_visibility: p.photo_visibility,
    photo_blocked: p.photo_blocked,
    ...(viewer.id === id && {has_google_photo: isGooglePhotoUrl(p.image)}),
  };
}
