import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {LogoBackground, SponsorAdmin, SponsorPublic} from "@/app/_interfaces/sponsor";

// The logo as the admin's browser prepared it (shrunk, base64) with its size in pixels
export type LogoUpload = {data: string; width: number; height: number};
export type SponsorFields = {name?: string; url?: string | null; message?: string; background?: LogoBackground; logo?: LogoUpload};

const json = (body: unknown): RequestInit => ({headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});

// ---------- the admin's list ----------

export async function getAdminSponsorsAPI(): Promise<SponsorAdmin[]> {
  const response = await apiFetch("/api/admin/sponsors", {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Sponzori se nisu učitali."));
  return response.json();
}

export async function createSponsorAPI(fields: SponsorFields): Promise<SponsorAdmin> {
  const response = await apiFetch("/api/admin/sponsors", {method: "POST", ...json(fields)});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Sponzor nije dodan."));
  return response.json();
}

export async function updateSponsorAPI(id: number, fields: SponsorFields): Promise<SponsorAdmin> {
  const response = await apiFetch(`/api/admin/sponsors/${id}`, {method: "PATCH", ...json(fields)});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Sponzor nije spremljen."));
  return response.json();
}

export async function deleteSponsorAPI(id: number): Promise<void> {
  const response = await apiFetch(`/api/admin/sponsors/${id}`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Sponzor nije obrisan."));
}

// ---------- a league's sponsors ----------

export async function getLeagueSponsorsAPI(leagueId: number): Promise<SponsorPublic[]> {
  const response = await apiFetch(`/api/leagues/${leagueId}/sponsors`, {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Sponzori lige se nisu učitali."));
  return response.json();
}

// all of the league's sponsors, in their order
export async function setLeagueSponsorsAPI(leagueId: number, sponsorIds: number[]): Promise<SponsorPublic[]> {
  const response = await apiFetch(`/api/leagues/${leagueId}/sponsors`, {method: "PUT", ...json({sponsor_ids: sponsorIds})});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Sponzori lige nisu spremljeni."));
  return response.json();
}

// ---------- counts ----------

// Fire and forget: a count that doesn't arrive isn't worth an error on the screen. keepalive lets the opening of a
// sponsor's page be counted even though the app may go to the background right after.
export function sendSponsorEvent(leagueId: number, kind: "view" | "click", sponsorIds: number[]): void {
  if (!sponsorIds.length) return;
  fetch("/api/sponsors/events", {method: "POST", keepalive: true, ...json({league_id: leagueId, kind, sponsor_ids: sponsorIds})}).catch(() => {
    // offline: the count is lost, nothing else
  });
}
