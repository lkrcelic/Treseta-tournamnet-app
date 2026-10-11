import {responseErrorMessage} from "@/app/_fetchers/errorMessage";

// birthDate as YYYY-MM-DD
export async function updateBirthDateAPI(playerId: number, birthDate: string): Promise<void> {
  const response = await fetch(`/api/players/${playerId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({birth_date: birthDate}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Datum rođenja nije spremljen."));
}
