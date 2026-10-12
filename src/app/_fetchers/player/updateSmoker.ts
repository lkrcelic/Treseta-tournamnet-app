import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

// Saves the profile's "Pušiš li?" answer
export async function updateSmokerAPI(playerId: number, smoker: boolean): Promise<void> {
  const response = await apiFetch(`/api/players/${playerId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({smoker}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Odgovor nije spremljen."));
}
