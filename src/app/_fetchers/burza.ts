import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {AvailabilityRequest, BurzaAvailability, BurzaCreateRequest, BurzaList, BurzaPost, MySchedule} from "@/app/_interfaces/burza";

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
