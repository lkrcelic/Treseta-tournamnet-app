import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

// Returns the username as it was saved (lowercase). A taken username throws "To korisničko ime je zauzeto."
export async function updateUsernameAPI(playerId: number, username: string): Promise<string> {
  const response = await apiFetch(`/api/players/${playerId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({username}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Korisničko ime nije spremljeno."));
  return (await response.json()).username;
}
