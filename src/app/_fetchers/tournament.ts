import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {
  AdminTournament,
  CandidateTeam,
  RegistrationRequest,
  TournamentCard,
  TournamentDetail,
  TournamentRequest,
  TournamentResults,
} from "@/app/_interfaces/tournament";
import type {KoloPair} from "@/app/_lib/matching/tournamentPairing";
import type {Attention} from "@/app/_lib/service/tournament/attention";
import type {BanView} from "@/app/_lib/service/bans/bans";

// Turniri: the public reads, a player's sign-up, and the admin's tournament management (see /api/tournaments and
// /api/admin/tournaments)

async function send<T>(url: string, method: string, body: unknown, fallback: string): Promise<T> {
  const response = await apiFetch(url, {
    method,
    cache: method === "GET" ? "no-store" : undefined,
    headers: body === undefined ? undefined : {"Content-Type": "application/json"},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new TournamentError(await responseErrorMessage(response, fallback), response.status, await codeOf(response));
  return (response.status === 204 ? null : await response.json()) as T;
}

async function codeOf(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().json();
    return typeof body?.code === "string" ? body.code : null;
  } catch {
    return null;
  }
}

// a refusal with its status (404: the tournament doesn't exist) and code (STALE_DRAFT)
export class TournamentError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) {
    super(message);
    this.name = "TournamentError";
  }
}

// ---------- players and visitors ----------

export const getTournamentsAPI = () => send<TournamentCard[]>("/api/tournaments", "GET", undefined, "Turniri se nisu učitali.");
export const getTournamentAPI = (id: number) => send<TournamentDetail>(`/api/tournaments/${id}`, "GET", undefined, "Turnir se nije učitao.");
export const getTournamentResultsAPI = (id: number) => send<TournamentResults>(`/api/tournaments/${id}/results`, "GET", undefined, "Poredak se nije učitao.");

export const signUpAPI = (id: number, body: RegistrationRequest) =>
  send<{teamId: number; status: "REGISTERED" | "WAITING"}>(`/api/tournaments/${id}/registrations`, "POST", body, "Ekipa nije prijavljena.");
export const signOffAPI = (id: number, teamId: number) => send<null>(`/api/tournaments/${id}/registrations/${teamId}`, "DELETE", undefined, "Ekipa nije odjavljena.");

// Potvrda dolaska: confirm (Tu smo), cancel (Ipak otkazujemo), join (Tu smo · Želimo uskočiti), leave (Odlazimo)
export const arrivalAPI = (id: number, action: "confirm" | "cancel" | "join" | "leave") =>
  send<TournamentDetail>(`/api/tournaments/${id}/arrival`, "POST", {action}, "Nije spremljeno.");

// Nedolazak za stol: the question about the player's table, and the answer
export const getAttentionAPI = () => send<Attention>("/api/tournaments/attention", "GET", undefined, "Provjera stola nije uspjela.");
export const answerAttendanceAPI = (roundId: number, answer: "PRESENT" | "NO_SHOW") =>
  send<{outcome: "PRESENT" | "NO_SHOW" | "SKIPPED" | "STARTED"}>(`/api/rounds/${roundId}/attendance`, "POST", {answer}, "Odgovor nije spremljen.");

export type TeammateHit = {id: number; name: string; username: string; photo_url: string | null};
export const searchTeammatesAPI = (q: string) => send<TeammateHit[]>(`/api/players/search?q=${encodeURIComponent(q)}`, "GET", undefined, "Igrači se nisu učitali.");

// ---------- admin ----------

const admin = (id: number) => `/api/admin/tournaments/${id}`;

export const getAdminTournamentsAPI = () => send<TournamentCard[]>("/api/admin/tournaments", "GET", undefined, "Turniri se nisu učitali.");
export const createTournamentAPI = (body: TournamentRequest) => send<{id: number}>("/api/admin/tournaments", "POST", body, "Turnir nije kreiran.");
export const getAdminTournamentAPI = (id: number) => send<AdminTournament>(admin(id), "GET", undefined, "Turnir se nije učitao.");
export const updateTournamentAPI = (id: number, body: TournamentRequest) => send<AdminTournament>(admin(id), "PATCH", body, "Promjene nisu spremljene.");
export const deleteTournamentAPI = (id: number) => send<null>(admin(id), "DELETE", undefined, "Turnir nije obrisan.");
export const cancelTournamentAPI = (id: number) => send<AdminTournament>(`${admin(id)}/cancel`, "POST", undefined, "Turnir nije otkazan.");
// Vrati turnir: undoes Otkaži, with the sign-ups open
export const restoreTournamentAPI = (id: number) => send<AdminTournament>(`${admin(id)}/cancel`, "DELETE", undefined, "Turnir nije vraćen.");
export const setRegistrationsOpenAPI = (id: number, open: boolean) => send<AdminTournament>(`${admin(id)}/registrations`, "PATCH", {open}, "Prijave nisu promijenjene.");
export const candidateTeamsAPI = (id: number, q: string) => send<CandidateTeam[]>(`${admin(id)}/candidates?q=${encodeURIComponent(q)}`, "GET", undefined, "Ekipe se nisu učitale.");
export const addTournamentTeamAPI = (id: number, teamId: number) => send<AdminTournament>(`${admin(id)}/teams`, "POST", {team_id: teamId}, "Ekipa nije dodana.");
export const removeTournamentTeamAPI = (id: number, teamId: number) => send<AdminTournament>(`${admin(id)}/teams/${teamId}`, "DELETE", undefined, "Ekipa nije maknuta.");
// the admin's buttons on the tournament's day: {arrived} (Označi dolazak / Makni potvrdu), {active}, {excluded}
export const setTeamDayAPI = (id: number, teamId: number, body: {arrived?: boolean; active?: boolean; excluded?: boolean}) =>
  send<AdminTournament>(`${admin(id)}/teams/${teamId}`, "PATCH", body, "Promjena nije spremljena.");
// Vrati stol: a skipped table or a no-show is back in play, its excluded teams back in the tournament
export const restoreTableAPI = (id: number, tableId: number) => send<AdminTournament>(`${admin(id)}/tables/${tableId}/restore`, "POST", undefined, "Stol nije vraćen.");
// Uredi ishod: a skipped table or a no-show gets the result picked (a team's win as a no-show gives it, or skipped)
export const setTableOutcomeAPI = (id: number, tableId: number, outcome: "TEAM1" | "TEAM2" | "SKIPPED") =>
  send<AdminTournament>(`${admin(id)}/tables/${tableId}/outcome`, "POST", {outcome}, "Ishod nije spremljen.");
export const admitTournamentTeamAPI = (id: number, teamId: number) => send<AdminTournament>(`${admin(id)}/teams/${teamId}/admit`, "POST", undefined, "Ekipa nije ubačena.");
export const makeKoloAPI = (id: number, redo = false) =>
  send<{made: {number: number; tables: number; repeats: KoloPair[]}; tournament: AdminTournament}>(`${admin(id)}/kola`, "POST", {redo}, "Kolo nije složeno.");
export const publishKoloAPI = (id: number, kolo: number) => send<AdminTournament>(`${admin(id)}/kola/${kolo}/publish`, "POST", undefined, "Kolo nije objavljeno.");
// Dodaj kolo: kolo is the new last one (the count + 1); Obriši kolo: kolo is the last one, withResults once the admin
// saw the warning that its results go too
export const addKoloAPI = (id: number, kolo: number) => send<AdminTournament>(`${admin(id)}/kola/${kolo}`, "PUT", undefined, "Kolo nije dodano.");
export const deleteKoloAPI = (id: number, kolo: number, withResults = false) =>
  send<AdminTournament>(`${admin(id)}/kola/${kolo}${withResults ? "?rezultati=1" : ""}`, "DELETE", undefined, "Kolo nije obrisano.");
export const addKoloTableAPI = (id: number, kolo: number, team1Id: number, team2Id: number) =>
  send<{id: number}>(`${admin(id)}/kola/${kolo}/tables`, "POST", {team1_id: team1Id, team2_id: team2Id}, "Stol nije dodan.");

// ---------- Zabrana prijava (admin) ----------

export type TeamBanState = {ban: BanView | null; players: Record<number, BanView | null>};
export type PlayerBanState = {ban: BanView | null; teams: Record<number, BanView | null>};
export type BanBody = {until: string | null; reason: string; player_ids?: number[]};

export const getTeamBanAPI = (teamId: number) => send<TeamBanState>(`/api/admin/bans?team_id=${teamId}`, "GET", undefined, "Zabrana se nije učitala.");
export const getPlayerBanAPI = (playerId: number) => send<PlayerBanState>(`/api/admin/bans?player_id=${playerId}`, "GET", undefined, "Zabrana se nije učitala.");
export const banTeamAPI = (teamId: number, body: BanBody) => send<TeamBanState>("/api/admin/bans", "POST", {team_id: teamId, ...body}, "Zabrana nije spremljena.");
export const banPlayerAPI = (playerId: number, body: BanBody) => send<PlayerBanState>("/api/admin/bans", "POST", {player_id: playerId, ...body}, "Zabrana nije spremljena.");
export const changeBanAPI = (banId: number, body: BanBody) => send<null>(`/api/admin/bans/${banId}`, "PATCH", body, "Zabrana nije promijenjena.");
export const liftBanAPI = (banId: number, withPlayers = false) => send<null>(`/api/admin/bans/${banId}${withPlayers ? "?igraci=1" : ""}`, "DELETE", undefined, "Zabrana nije ukinuta.");
