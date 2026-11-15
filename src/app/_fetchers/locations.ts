import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {LocationView} from "@/app/_interfaces/location";

// Lokacije: the shared list of places (LOCATIONS_PLAN.md)

export type LocationFields = {name?: string; address?: string | null; url?: string | null};

const json = (body: unknown): RequestInit => ({headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});

export async function getLocationsAPI(): Promise<LocationView[]> {
  const response = await apiFetch("/api/locations", {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Lokacije se nisu učitale."));
  return response.json();
}

export async function createLocationAPI(fields: LocationFields): Promise<LocationView> {
  const response = await apiFetch("/api/locations", {method: "POST", ...json(fields)});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Lokacija nije dodana."));
  return response.json();
}

export async function updateLocationAPI(id: number, fields: LocationFields): Promise<LocationView> {
  const response = await apiFetch(`/api/locations/${id}`, {method: "PATCH", ...json(fields)});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Lokacija nije spremljena."));
  return response.json();
}

export async function deleteLocationAPI(id: number): Promise<void> {
  const response = await apiFetch(`/api/locations/${id}`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Lokacija nije obrisana."));
}
