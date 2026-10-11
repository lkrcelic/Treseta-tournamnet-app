import {responseErrorMessage} from "@/app/_fetchers/errorMessage";

// Returns the username as it was saved (lowercase). A taken username throws "This username is taken."
export async function updateUsernameAPI(playerId: number, username: string): Promise<string> {
  const response = await fetch(`/api/players/${playerId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({username}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Username not saved"));
  return (await response.json()).username;
}
