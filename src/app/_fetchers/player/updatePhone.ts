import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

// Saves the profile's phone number (null removes it) and returns it as stored ("+385 91 234 5678")
export async function updatePhoneAPI(playerId: number, phone: string | null): Promise<string | null> {
  const response = await apiFetch(`/api/players/${playerId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({phone}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Broj nije spremljen."));
  return (await response.json()).phone ?? null;
}
