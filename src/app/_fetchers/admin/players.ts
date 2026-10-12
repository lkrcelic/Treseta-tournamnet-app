import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import type {AdminPlayerField, AdminPlayerRow, AdminPlayerUpdateRequest, PlayerActiveResponse, PlayerView} from "@/app/_interfaces/player";

// Admin player management (see /api/admin/players): the Igrači directory and "Uredi osobne podatke"

// A refused Spremi can carry a message per field (a taken username or email, a field that isn't valid), shown under
// its input; the error's own message is the first of them
type PlayerUpdateError = Error & {fields: Partial<Record<AdminPlayerField, string>>};

const FIELDS: AdminPlayerField[] = ["first_name", "last_name", "username", "email", "phone", "birth_date"];

export function playerFieldErrors(error: unknown): Partial<Record<AdminPlayerField, string>> {
  return (error as Partial<PlayerUpdateError> | null)?.fields ?? {};
}

export async function getAdminPlayersAPI(): Promise<AdminPlayerRow[]> {
  const response = await apiFetch("/api/admin/players");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Igrači se nisu učitali."));
  return response.json();
}

// Spremi: only the fields that changed. Answers with the player as saved.
export async function updateAdminPlayerAPI(playerId: number, changes: AdminPlayerUpdateRequest): Promise<PlayerView> {
  const response = await apiFetch(`/api/admin/players/${playerId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(changes),
  });
  if (response.ok) return response.json();

  const fallback = "Promjena nije spremljena.";
  const body = await response.json().catch(() => null);
  const fields: PlayerUpdateError["fields"] = {};
  // a 409 names the taken fields; a 400 lists the problems (zod issues) with the field as the first path element
  for (const [field, message] of Object.entries(body?.errors ?? {})) {
    if (FIELDS.includes(field as AdminPlayerField) && typeof message === "string") fields[field as AdminPlayerField] = message;
  }
  for (const issue of Array.isArray(body?.issues) ? body.issues : []) {
    const field = issue?.path?.[0];
    if (FIELDS.includes(field) && typeof issue.message === "string") fields[field as AdminPlayerField] ??= issue.message;
  }
  const message = typeof body?.error === "string" ? body.error : fallback;
  throw Object.assign(new Error(message), {fields});
}

// Deaktiviraj račun / Aktiviraj račun: applies at once
export async function setPlayerActiveAPI(playerId: number, active: boolean): Promise<PlayerActiveResponse> {
  const response = await apiFetch(`/api/admin/players/${playerId}/active`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({active}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Promjena nije spremljena."));
  return response.json();
}

// Obriši igrača: anonymises the player; can't be undone
export async function deletePlayerAPI(playerId: number): Promise<void> {
  const response = await apiFetch(`/api/admin/players/${playerId}`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Igrač nije obrisan."));
}
