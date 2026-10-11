import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import type {Lineup, LineupSave} from "@/app/_lib/service/round/lineup";

export async function getLineupAPI(roundId: number): Promise<Lineup> {
  const response = await fetch(`/api/rounds/${roundId}/lineup`);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to load the lineup"));
  }
  return response.json();
}

export async function saveLineupAPI(roundId: number, lineup: LineupSave): Promise<void> {
  const response = await fetch(`/api/rounds/${roundId}/lineup`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(lineup),
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to save the lineup"));
  }
}
