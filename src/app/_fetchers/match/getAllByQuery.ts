import {MatchResponse} from "@/app/_interfaces/match";

type MatchQueryParams = {
  round_id?: number;
};

export async function getAllMatchesByQueryAPI(params?: MatchQueryParams): Promise<MatchResponse[]> {
  const queryParams = new URLSearchParams();

  if (params) {
    if (params.round_id) {
      queryParams.append("round_id", params.round_id.toString());
    }
  }

  const queryString = queryParams.toString();
  const url = `/api/matches${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {"Content-Type": "application/json"},
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch matches: ${response.statusText}`);
  }

  return await response.json();
}
