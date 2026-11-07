import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {AdminHand, HandKind, TablePad} from "@/app/_interfaces/adminHand";

// Admin edits of the Daily tables and their results (see /api/admin)

// The server's warning that a change leaves a finished match without a winner (409, code "no_winner"): the scorepad
// asks the admin and, on Spremi svejedno, sends the same change again with allowNoWinner
export class NoWinnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoWinnerError";
  }
}

async function send(url: string, method: string, body: unknown, fallback: string) {
  const response = await apiFetch(url, {
    method,
    headers: body === undefined ? undefined : {"Content-Type": "application/json"},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 409) {
    const answer = await response.json().catch(() => null);
    const message = typeof answer?.error === "string" ? answer.error : fallback;
    throw answer?.code === "no_winner" ? new NoWinnerError(message) : new Error(message);
  }
  if (!response.ok) throw new Error(await responseErrorMessage(response, fallback));
  return response.status === 204 ? null : response.json();
}

export const getTablePadAPI = (roundId: number): Promise<TablePad> => send(`/api/admin/tables/${roundId}`, "GET", undefined, "Stol se nije učitao.");

export const setTablePairAPI = (roundId: number, team1Id: number, team2Id: number) =>
  send(`/api/admin/tables/${roundId}`, "PATCH", {team1_id: team1Id, team2_id: team2Id}, "Par nije spremljen.");

export const removeTableAPI = (roundId: number) => send(`/api/admin/tables/${roundId}`, "DELETE", undefined, "Stol nije uklonjen.");

export const addTableAPI = (leagueId: number, date: string, roundNumber: number, team1Id: number, team2Id: number) =>
  send(`/api/admin/leagues/${leagueId}/tables`, "POST", {date, round_number: roundNumber, team1_id: team1Id, team2_id: team2Id}, "Stol nije dodan.");

export type HandTarget = {kind: "ongoing"} | {kind: "finished"; matchId: number};

// allowNoWinner: the admin confirmed that a finished match is left without a winner (NoWinnerError)
const allowing = (allowNoWinner: boolean) => (allowNoWinner ? "?allow_no_winner=1" : "");

export const addHandAPI = (roundId: number, target: HandTarget, hand: AdminHand, allowNoWinner = false) =>
  send(`/api/admin/tables/${roundId}/hands${allowing(allowNoWinner)}`, "POST", {target, hand}, "Igra nije spremljena.");

export const updateHandAPI = (kind: HandKind, resultId: number, hand: AdminHand, allowNoWinner = false) =>
  send(`/api/admin/hands/${kind}/${resultId}${allowing(allowNoWinner)}`, "PUT", hand, "Igra nije spremljena.");

export const deleteHandAPI = (kind: HandKind, resultId: number, allowNoWinner = false) =>
  send(`/api/admin/hands/${kind}/${resultId}${allowing(allowNoWinner)}`, "DELETE", undefined, "Igra nije obrisana.");

export const finishTableMatchAPI = (roundId: number) => send(`/api/admin/tables/${roundId}/finish`, "POST", undefined, "Meč nije završen.");

// status: how far a published round got; a round not published yet is "draft" or "approved" (Upravljanje ligom · Skica)
// and has a letter (Skica A) instead of a number to show
export type LeagueRoundSummary = {date: string; roundNumber: number; letter: string | null; tables: number; status: "draft" | "approved" | "played" | "live" | "new"};

export const getLeagueRoundsAPI = (leagueId: number): Promise<LeagueRoundSummary[]> =>
  send(`/api/admin/leagues/${leagueId}/rounds`, "GET", undefined, "Kola se nisu učitala.");

// keepalive: a delete waiting for its undo window still goes out when the page is closed
export async function deleteLeagueRoundAPI(leagueId: number, date: string, roundNumber: number, keepalive = false) {
  const response = await apiFetch(`/api/admin/leagues/${leagueId}/rounds?date=${date}&round_number=${roundNumber}`, {method: "DELETE", keepalive});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Kolo nije obrisano."));
}
