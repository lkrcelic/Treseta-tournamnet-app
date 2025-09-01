import { RoundType } from "@/app/_interfaces/round";

type RoundsQueryParams = {
  round_date?: string;
  open?: boolean;
  round_number?: number;
  team_id?: number;
  league_id?: number;
}

export async function getRoundsAPI(params?: RoundsQueryParams): Promise<RoundType[]> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    if (params.round_date) {
      queryParams.append('round_date', params.round_date);
    }
    
    if (params.open !== undefined) {
      queryParams.append('open', params.open.toString());
    }
    
    if (params.round_number !== undefined) {
      queryParams.append('round_number', params.round_number.toString());
    }
    
    if (params.team_id !== undefined) {
      queryParams.append('team_id', params.team_id.toString());
    }
    
    if (params.league_id !== undefined) {
      queryParams.append('league_id', params.league_id.toString());
    }
  }
  
  const queryString = queryParams.toString();
  const url = `/api/rounds${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch rounds: ${response.statusText}`);
  }
  
  return await response.json();
}
