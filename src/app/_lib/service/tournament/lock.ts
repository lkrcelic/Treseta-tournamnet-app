import {Prisma} from "@prisma/client";

// pg_advisory_xact_lock(TOURNAMENT_LOCK, tournamentId): one change of a tournament at a time (sign-ups, the waiting
// list, its Kolos and their tables), so two taps or two admins can't both take the last place or make a Kolo twice. The
// two-number form never meets the leagues' one-number lock on the same id.
export const TOURNAMENT_LOCK = 7201;

export async function lockTournament(tx: Prisma.TransactionClient, tournamentId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TOURNAMENT_LOCK}::int, ${tournamentId}::int)`;
}
