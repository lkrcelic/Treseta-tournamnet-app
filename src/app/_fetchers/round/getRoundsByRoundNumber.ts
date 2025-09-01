import {RoundMatchup} from "@/app/_lib/service/round/getRoundMatchups";

export async function getRoundsByRoundNumber(roundNumber: number): Promise<RoundMatchup[]> {
  try {
    if (roundNumber === undefined || roundNumber <= 0) {
      console.log(`Invalid round number: ${roundNumber}`);
      return [];
    }

    const url = `/api/roundMatchups/${roundNumber}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {"Content-Type": "application/json"},
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch team data: ${response.status} ${response.statusText}`);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching round data:", error);
    return [];
  }
}
