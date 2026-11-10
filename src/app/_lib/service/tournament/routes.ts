import {NextResponse} from "next/server";
import {prisma} from "@/app/_lib/prisma";
import {STATUS} from "@/app/_lib/statusCodes";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {ForbiddenError} from "@/app/_lib/auth/forbidden";
import {canManageTournament} from "@/app/_lib/auth/ownership";
import type {Viewer} from "@/app/_lib/players/privacy";
import {getAdminTournament, NOT_YOUR_TOURNAMENT, TOURNAMENT_NOT_FOUND} from "./tournaments";

// Shared bits of the tournament routes

// a tournament id from the URL, or null for one that can't be a row (answered as not found)
export function tournamentIdOf(raw: string): number | null {
  const id = Number(raw);
  return isDbId(id) ? id : null;
}

// a new response each time (a response body can be sent only once)
export const tournamentNotFound = () => NextResponse.json({error: TOURNAMENT_NOT_FOUND}, {status: STATUS.NotFound});

// public reads change with every table: never cached
export const NO_STORE = {"Cache-Control": "private, no-store"};

/**
 * Whose tournament it is (DECISIONS #86). `requireCan` has already said the player may run a tournament; this says it
 * is this one. An admin passes everything, an organizer only the tournament they made, and nobody the ownerless
 * tournaments from before the role came in.
 *
 * Every write to a tournament calls this first, before it changes anything — the services take no viewer, so the check
 * can't live in them. One indexed read of one column, so it costs nothing next to the write that follows.
 */
export async function refuseUnlessMine(id: number, viewer: Viewer): Promise<void> {
  const tournament = await prisma.tournament.findUnique({where: {tournament_id: id}, select: {created_by: true}});
  if (!tournament) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
  if (!canManageTournament(viewer, tournament)) throw new ForbiddenError(NOT_YOUR_TOURNAMENT);
}

// A finished tournament's sign-ups and waiting list stay as they were (its Kolos, results and details can still change):
// Dodaj ekipu, Makni, Ubaci, Označi dolazak, Aktivna, Isključi and Vrati are refused
export async function refuseIfFinished(id: number, viewer: Viewer): Promise<void> {
  if ((await getAdminTournament(id, viewer)).phase === "finished") throw new InvalidResultError("Turnir je završen: prijave i lista čekanja se više ne mijenjaju.");
}
