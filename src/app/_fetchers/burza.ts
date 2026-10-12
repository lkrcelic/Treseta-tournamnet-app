import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {AvailabilityRequest, BurzaAvailability, BurzaCreateRequest, BurzaList, BurzaPost, MyBurzaList, MyBurzaPost, MySchedule} from "@/app/_interfaces/burza";

// The open ads (public)
export async function getBurzaAPI(): Promise<BurzaPost[]> {
  const response = await apiFetch("/api/burza", {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Oglasi se nisu učitali."));
  return ((await response.json()) as BurzaList).posts;
}

// One ad (public); null when it doesn't exist
export async function getBurzaPostAPI(id: number): Promise<BurzaPost | null> {
  const response = await apiFetch(`/api/burza/${id}`, {cache: "no-store"});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Oglas se nije učitao."));
  return response.json();
}

export async function publishBurzaPostAPI(post: BurzaCreateRequest): Promise<BurzaPost> {
  const response = await apiFetch("/api/burza", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(post),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Oglas nije objavljen."));
  return response.json();
}

export async function closeBurzaPostAPI(id: number): Promise<BurzaPost> {
  const response = await apiFetch(`/api/burza/${id}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({closed: true}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Oglas nije zatvoren."));
  return response.json();
}

// Moji oglasi: the logged-in player's own ads
export async function getMyBurzaAPI(): Promise<MyBurzaList> {
  const response = await apiFetch("/api/burza/mine", {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Oglasi se nisu učitali."));
  return response.json();
}

// Objavi ponovno; night: a new night for a substitute ad. Resolves to the ad that is up now.
export async function repostBurzaPostAPI(id: number, night?: string): Promise<MyBurzaPost> {
  const response = await apiFetch(`/api/burza/${id}/repost`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(night ? {night} : {}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Oglas nije ponovno objavljen."));
  return response.json();
}

export async function getAvailabilityAPI(): Promise<BurzaAvailability> {
  const response = await apiFetch("/api/burza/availability", {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Dostupnost se nije učitala."));
  return response.json();
}

export async function setAvailabilityAPI(availability: AvailabilityRequest): Promise<BurzaAvailability> {
  const response = await apiFetch("/api/burza/availability", {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(availability),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Dostupnost nije spremljena."));
  return response.json();
}

// The leagues the logged-in player plays in, with their nights
export async function getMyScheduleAPI(): Promise<MySchedule> {
  const response = await apiFetch("/api/schedule", {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Raspored se nije učitao."));
  return response.json();
}
