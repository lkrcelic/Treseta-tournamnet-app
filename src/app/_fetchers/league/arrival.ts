import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {LeagueArrivals, MyLeagueArrival} from "@/app/_interfaces/leagueArrival";
import {LeagueArrivalAction} from "@/app/_lib/leagueArrival";
import {Slot, slotQuery} from "@/app/_lib/locations";

// Potvrda dolaska in the league (DECISIONS #73)

async function send<T>(url: string, method: string, body: unknown, fallback: string): Promise<T> {
  const response = await apiFetch(url, {
    method,
    headers: body === undefined ? undefined : {"Content-Type": "application/json"},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, fallback));
  return response.json();
}

// A player's Tu smo, or Ipak otkazujemo / Odlazimo, for their team tonight; answers with the team's card
export const leagueArrivalAPI = (leagueId: number, teamId: number, action: LeagueArrivalAction) =>
  send<MyLeagueArrival>(`/api/leagues/${leagueId}/arrival`, "POST", {team_id: teamId, action}, "Nije spremljeno.");

// Novo kolo: tonight's arrivals (admin); slot: the teams at that place of a two-place night
export const getLeagueArrivalsAPI = (leagueId: number, slot: Slot | null = null) =>
  send<LeagueArrivals>(`/api/leagues/${leagueId}/arrivals${slotQuery(slot)}`, "GET", undefined, "Dolasci se nisu učitali.");

// Novo kolo's switches: these teams are here or not (admin)
export const setLeagueArrivalsAPI = (leagueId: number, teamIds: number[], here: boolean, slot: Slot | null = null) =>
  send<LeagueArrivals>(`/api/leagues/${leagueId}/arrivals`, "POST", {team_ids: teamIds, here, ...(slot != null && {slot})}, "Nije spremljeno.");
