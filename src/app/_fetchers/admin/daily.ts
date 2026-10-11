import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {AdminHand, HandKind, TablePad} from "@/app/_interfaces/adminHand";

// Admin edits of the Daily tables and their results (see /api/admin)

async function send(url: string, method: string, body: unknown, fallback: string) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : {"Content-Type": "application/json"},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, fallback));
  return response.status === 204 ? null : response.json();
}

export const getTablePadAPI = (roundId: number): Promise<TablePad> => send(`/api/admin/tables/${roundId}`, "GET", undefined, "Stol nije moguće učitati");

export const setTablePairAPI = (roundId: number, team1Id: number, team2Id: number) =>
  send(`/api/admin/tables/${roundId}`, "PATCH", {team1_id: team1Id, team2_id: team2Id}, "Par nije spremljen");

export const removeTableAPI = (roundId: number) => send(`/api/admin/tables/${roundId}`, "DELETE", undefined, "Stol nije uklonjen");

export const addTableAPI = (leagueId: number, date: string, roundNumber: number, team1Id: number, team2Id: number) =>
  send(`/api/admin/leagues/${leagueId}/tables`, "POST", {date, round_number: roundNumber, team1_id: team1Id, team2_id: team2Id}, "Stol nije dodan");

export type HandTarget = {kind: "ongoing"} | {kind: "finished"; matchId: number};

export const addHandAPI = (roundId: number, target: HandTarget, hand: AdminHand) =>
  send(`/api/admin/tables/${roundId}/hands`, "POST", {target, hand}, "Igra nije spremljena");

export const updateHandAPI = (kind: HandKind, resultId: number, hand: AdminHand) =>
  send(`/api/admin/hands/${kind}/${resultId}`, "PUT", hand, "Igra nije spremljena");

export const deleteHandAPI = (kind: HandKind, resultId: number) =>
  send(`/api/admin/hands/${kind}/${resultId}`, "DELETE", undefined, "Igra nije obrisana");

export const finishTableMatchAPI = (roundId: number) => send(`/api/admin/tables/${roundId}/finish`, "POST", undefined, "Meč nije završen");

export type LeagueRoundSummary = {date: string; roundNumber: number; tables: number; status: "played" | "live" | "new"};

export const getLeagueRoundsAPI = (leagueId: number): Promise<LeagueRoundSummary[]> =>
  send(`/api/admin/leagues/${leagueId}/rounds`, "GET", undefined, "Runde nije moguće učitati");

// keepalive: a delete waiting for its undo window still goes out when the page is closed
export async function deleteLeagueRoundAPI(leagueId: number, date: string, roundNumber: number, keepalive = false) {
  const response = await fetch(`/api/admin/leagues/${leagueId}/rounds?date=${date}&round_number=${roundNumber}`, {method: "DELETE", keepalive});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Runda nije obrisana"));
}
