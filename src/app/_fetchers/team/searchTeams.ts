import { TeamsResponseValidation } from "@/app/_interfaces/team";

export async function searchTeamsAPI(query: string) {
  const url = new URL(`/api/teams`, window.location.origin);
  if (query) url.searchParams.set("search", query);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to search teams: ${res.statusText}`);
  }
  const json = await res.json();
  return TeamsResponseValidation.parse(json);
}