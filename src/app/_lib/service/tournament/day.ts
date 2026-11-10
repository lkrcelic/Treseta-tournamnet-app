import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {Viewer} from "@/app/_lib/players/privacy";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {admittedFromWaiting, arrivalPhase, arrivalWindow, DayEntry, hasRoom, startSwitch} from "@/app/_lib/tournamentDay";
import {lockTournament} from "./lock";
import {TOURNAMENT_NOT_FOUND} from "./tournaments";

// A tournament's day (Potvrda dolaska): Tu smo from Okupljanje to Početak, the switch at the start time, joining from
// the next Kolo (Tu smo · Želimo uskočiti) and leaving (Odlazimo), and the admin's Označi dolazak, Makni potvrdu,
// Aktivna, Isključi ekipu and Vrati. Every change holds the tournament's lock.

type Tx = Prisma.TransactionClient;

export const DAY_NOT_STARTED = "Potvrda dolaska još nije otvorena.";
export const LAST_KOLO_MADE = "Zadnje kolo je već složeno: više se ne može uskočiti.";

// The tournament's last Kolo exists (a draft counts): there is no next Kolo to come into
export async function lastKoloIsMade(tx: Tx, t: {tournament_id: number; rounds: number}): Promise<boolean> {
  return (await tx.round.count({where: {tournamentRounds: {some: {tournament_id: t.tournament_id}}, round_number: {gte: t.rounds}}})) > 0;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function windowOf(t: {date: Date; gathering_time: string | null; start_time: string | null}) {
  return arrivalWindow({date: isoDay(t.date), gathering_time: t.gathering_time, start_time: t.start_time});
}

// The day's switch has run, or the tournament started some other way (Kolo 1 published, or no start time)
export const dayClosed = (t: {arrival_closed_at: Date | null; started_at: Date | null}) => t.arrival_closed_at != null || t.started_at != null;

export async function dayEntries(tx: Tx, tournamentId: number): Promise<DayEntry[]> {
  const rows = await tx.tournamentTeam.findMany({
    where: {tournament_id: tournamentId},
    select: {team_id: true, status: true, registered_at: true, arrived_at: true, active: true, excluded_at: true},
  });
  return rows.map((r) => ({
    teamId: r.team_id,
    status: r.status,
    registeredAt: r.registered_at,
    arrived: r.arrived_at != null,
    active: r.active,
    excluded: r.excluded_at != null,
  }));
}

const entryKey = (tournamentId: number, teamId: number) => ({tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}});

// After the start: the confirmed teams of the waiting list come in while there is room (from the next Kolo)
export async function fillPlaces(tx: Tx, tournamentId: number, maxTeams: number | null): Promise<void> {
  for (const teamId of admittedFromWaiting(await dayEntries(tx, tournamentId), maxTeams)) {
    await tx.tournamentTeam.update({where: entryKey(tournamentId, teamId), data: {status: "REGISTERED", active: true}});
  }
}

// The start time's switch (run by the clock once Početak has come): sign-ups close (a tournament with Otvorene
// prijave keeps them open), the teams in that didn't confirm become inactive (still signed up), and the confirmed
// waiting teams come in while there is room. Once.
export async function closeArrival(tx: Tx, tournamentId: number, now: Date): Promise<boolean> {
  const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}});
  if (!t || t.cancelled_at || dayClosed(t)) return false;
  const window = windowOf(t);
  if (!window || now.getTime() < window.closes.getTime()) return false;
  const {inactive, admitted} = startSwitch(await dayEntries(tx, tournamentId), t.max_teams);
  if (inactive.length > 0) await tx.tournamentTeam.updateMany({where: {tournament_id: tournamentId, team_id: {in: inactive}}, data: {active: false}});
  for (const teamId of admitted) await tx.tournamentTeam.update({where: entryKey(tournamentId, teamId), data: {status: "REGISTERED", active: true}});
  // Otvorene prijave: the switch still decides who is here, but sign-ups stay open for the rest of the tournament
  await tx.tournament.update({where: {tournament_id: tournamentId}, data: {arrival_closed_at: now, ...(t.open_signups ? {} : {registrations_open: false})}});
  return true;
}

async function lockedTournament(tx: Tx, tournamentId: number) {
  await lockTournament(tx, tournamentId);
  const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}});
  if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
  if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");
  return t;
}

// The viewer's entry in the tournament (in it or waiting)
async function myEntry(tx: Tx, tournamentId: number, viewer: Viewer) {
  const entry = await tx.tournamentTeam.findFirst({
    where: {tournament_id: tournamentId, team: {teamPlayers: {some: {player_id: viewer.id}}}},
  });
  if (!entry) throw new InvalidResultError("Tvoja ekipa nije prijavljena na ovaj turnir.");
  return entry;
}

export type ArrivalAction = "confirm" | "cancel" | "join" | "leave";

// A team's own buttons on the tournament day: Tu smo (confirm, from Okupljanje to Početak; after the start it is
// join), Ipak otkazujemo (cancel, until Početak), Tu smo · Želimo uskočiti (join: an inactive team plays from the next
// Kolo, or waits when the tournament is full), Odlazimo (leave: inactive from the next Kolo, a confirmed waiting team
// takes its place). Any of its players presses them for the whole team.
export async function arrivalAction(tournamentId: number, viewer: Viewer, action: ArrivalAction): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const t = await lockedTournament(tx, tournamentId);
    const now = new Date();
    await closeArrival(tx, tournamentId, now);
    const fresh = (await tx.tournament.findUnique({where: {tournament_id: tournamentId}}))!;
    const entry = await myEntry(tx, tournamentId, viewer);
    if (entry.excluded_at) throw new InvalidResultError("Ekipa je isključena iz turnira. Za povratak se javi organizatoru.");
    const phase = arrivalPhase(windowOf(t), now, fresh.arrival_closed_at);
    const closed = dayClosed(fresh);

    if (action === "confirm" && !closed) {
      if (phase !== "open") throw new InvalidResultError(DAY_NOT_STARTED);
      if (entry.arrived_at) return;
      await tx.tournamentTeam.update({where: entryKey(tournamentId, entry.team_id), data: {arrived_at: now, arrived_by: viewer.id, arrived_by_admin: false}});
      return;
    }
    if (action === "cancel") {
      if (closed) throw new InvalidResultError("Turnir je počeo: potvrda se više ne otkazuje. Ako odlazite, stisni Odlazimo.");
      await tx.tournamentTeam.update({where: entryKey(tournamentId, entry.team_id), data: {arrived_at: null, arrived_by: null, arrived_by_admin: false}});
      return;
    }
    if (action === "confirm" || action === "join") {
      if (!closed) throw new InvalidResultError(DAY_NOT_STARTED);
      await joinFromNextKolo(tx, fresh, entry.team_id, {arrived_by: viewer.id, arrived_by_admin: false}, now);
      return;
    }
    // leave
    if (!closed) throw new InvalidResultError("Prije početka turnira ekipu odjavljuješ s turnira.");
    if (entry.status === "WAITING") {
      await tx.tournamentTeam.update({where: entryKey(tournamentId, entry.team_id), data: {arrived_at: null, arrived_by: null, arrived_by_admin: false}});
      return;
    }
    if (!entry.active) return;
    await tx.tournamentTeam.update({where: entryKey(tournamentId, entry.team_id), data: {active: false}});
    await fillPlaces(tx, tournamentId, fresh.max_teams);
  });
}

// After the start, a team that has come: an inactive team in plays from the next Kolo when there is room, else it waits
// (on the waiting list, confirmed); a waiting team is confirmed and comes in when there is room. Once the last Kolo is
// made (a draft too) there is no next Kolo: a team that doesn't play can't join.
async function joinFromNextKolo(tx: Tx, t: {tournament_id: number; max_teams: number | null; rounds: number}, teamId: number, by: {arrived_by: number | null; arrived_by_admin: boolean}, now: Date) {
  const entry = await tx.tournamentTeam.findUniqueOrThrow({where: entryKey(t.tournament_id, teamId)});
  if (!(entry.status === "REGISTERED" && entry.active) && (await lastKoloIsMade(tx, t))) throw new InvalidResultError(LAST_KOLO_MADE);
  const arrival = entry.arrived_at ? {} : {arrived_at: now, ...by};
  if (entry.status === "REGISTERED") {
    if (entry.active) {
      if (!entry.arrived_at) await tx.tournamentTeam.update({where: entryKey(t.tournament_id, teamId), data: arrival});
      return;
    }
    const room = hasRoom(await dayEntries(tx, t.tournament_id), t.max_teams);
    await tx.tournamentTeam.update({
      where: entryKey(t.tournament_id, teamId),
      // full: it waits, first in line by its sign-up time
      data: room ? {...arrival, active: true} : {...arrival, status: "WAITING", active: true},
    });
    return;
  }
  await tx.tournamentTeam.update({where: entryKey(t.tournament_id, teamId), data: arrival});
  await fillPlaces(tx, t.tournament_id, t.max_teams);
}

// ---------- the admin ----------

async function adminEntry(tx: Tx, tournamentId: number, teamId: number) {
  const entry = await tx.tournamentTeam.findUnique({where: entryKey(tournamentId, teamId)});
  if (!entry) throw new NotFoundError("Ekipa nije prijavljena na ovaj turnir.");
  return entry;
}

// Označi dolazak (a team without a phone) and Makni potvrdu. After the start Označi dolazak works as the team's own
// Želimo uskočiti.
export async function adminSetArrival(tournamentId: number, teamId: number, arrived: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const t = await lockedTournament(tx, tournamentId);
    const now = new Date();
    await closeArrival(tx, tournamentId, now);
    const entry = await adminEntry(tx, tournamentId, teamId);
    const fresh = (await tx.tournament.findUnique({where: {tournament_id: tournamentId}}))!;
    if (!arrived) {
      await tx.tournamentTeam.update({where: entryKey(tournamentId, teamId), data: {arrived_at: null, arrived_by: null, arrived_by_admin: false}});
      return;
    }
    if (entry.excluded_at) throw new InvalidResultError("Ekipa je isključena: prvo je vrati u turnir.");
    if (!dayClosed(fresh)) {
      if (!entry.arrived_at) await tx.tournamentTeam.update({where: entryKey(tournamentId, teamId), data: {arrived_at: now, arrived_by: null, arrived_by_admin: true}});
      return;
    }
    await joinFromNextKolo(tx, t, teamId, {arrived_by: null, arrived_by_admin: true}, now);
  });
}

// The Aktivna switch: a team in plays the next Kolo or not. Switching on a waiting team lets it in (Ubaci u turnir:
// the limit grows by one when it is full).
export async function adminSetActive(tournamentId: number, teamId: number, active: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const t = await lockedTournament(tx, tournamentId);
    const entry = await adminEntry(tx, tournamentId, teamId);
    if (entry.excluded_at) throw new InvalidResultError("Ekipa je isključena: prvo je vrati u turnir.");
    if (entry.status === "WAITING") {
      if (!active) return;
      const full = !hasRoom(await dayEntries(tx, tournamentId), t.max_teams);
      await tx.tournamentTeam.update({where: entryKey(tournamentId, teamId), data: {status: "REGISTERED", active: true}});
      if (full && t.max_teams != null) await tx.tournament.update({where: {tournament_id: tournamentId}, data: {max_teams: t.max_teams + 1}});
      return;
    }
    if (entry.active === active) return;
    await tx.tournamentTeam.update({where: entryKey(tournamentId, teamId), data: {active}});
    if (!active && dayClosed(t)) await fillPlaces(tx, tournamentId, t.max_teams);
  });
}

// The last Kolo out (the one a team is excluded after)
async function lastKolo(tx: Tx, tournamentId: number): Promise<number> {
  const r = await tx.round.aggregate({_max: {round_number: true}, where: {tournamentRounds: {some: {tournament_id: tournamentId}}, status: "PUBLISHED"}});
  return r._max.round_number ?? 0;
}

// Isključi ekipu (once the tournament has started; before it the team is removed instead): out of the rest of the
// tournament, its Kolos played stay in the standings. A confirmed waiting team takes its place.
export async function excludeTeam(tournamentId: number, teamId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const t = await lockedTournament(tx, tournamentId);
    if (!t.started_at) throw new InvalidResultError("Turnir još nije počeo: ekipu makni s turnira.");
    const entry = await adminEntry(tx, tournamentId, teamId);
    if (entry.excluded_at) return;
    await tx.tournamentTeam.update({
      where: entryKey(tournamentId, teamId),
      data: {excluded_at: new Date(), excluded_kolo: await lastKolo(tx, tournamentId), excluded_reason: "ADMIN"},
    });
    await fillPlaces(tx, tournamentId, t.max_teams);
  });
}

// Vrati: an excluded team is back from the next Kolo (active), whatever excluded it
export async function restoreTeam(tournamentId: number, teamId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockedTournament(tx, tournamentId);
    const entry = await adminEntry(tx, tournamentId, teamId);
    if (!entry.excluded_at) return;
    await tx.tournamentTeam.update({
      where: entryKey(tournamentId, teamId),
      data: {excluded_at: null, excluded_kolo: null, excluded_reason: null, active: true, status: "REGISTERED"},
    });
  });
}
