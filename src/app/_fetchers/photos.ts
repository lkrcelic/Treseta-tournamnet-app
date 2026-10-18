import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import type {PhotoSaved, PhotoVisibility} from "@/app/_interfaces/photo";

// Profile photos of players and teams: a player's own (Moj profil), a team's (any of its players, on the Team page),
// and the admin's removing and blocking them

export type PhotoTarget = {kind: "player" | "team"; id: number};

const base = (t: PhotoTarget) => `/api/${t.kind === "player" ? "players" : "teams"}/${t.id}`;

async function patch(t: PhotoTarget, body: object, fallback: string): Promise<void> {
  const response = await apiFetch(base(t), {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
  if (!response.ok) throw new Error(await responseErrorMessage(response, fallback));
}

// The crop (a data: URL); answers the photo's new address
export async function savePhotoAPI(t: PhotoTarget, data: string): Promise<string> {
  const response = await apiFetch(`${base(t)}/photo`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({data})});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Slika nije spremljena."));
  return ((await response.json()) as PhotoSaved).photo_url;
}

export async function removePhotoAPI(t: PhotoTarget): Promise<void> {
  const response = await apiFetch(`${base(t)}/photo`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Slika nije maknuta."));
}

// Tko vidi sliku: saved as soon as it is picked
export function savePhotoVisibilityAPI(t: PhotoTarget, photo_visibility: PhotoVisibility): Promise<void> {
  return patch(t, {photo_visibility}, "Vidljivost nije spremljena.");
}

// The admin's "Zabrani novu sliku"
export function savePhotoBlockedAPI(t: PhotoTarget, photo_blocked: boolean): Promise<void> {
  return patch(t, {photo_blocked}, "Promjena nije spremljena.");
}

// The player's Google picture through this app, so the cropper's canvas may draw it
export const GOOGLE_PHOTO_PATH = "/api/players/me/google-photo";
