import {Prisma} from "@prisma/client";
import {CreateRoundDraft} from "@/app/_lib/createRoundDraft";
import {leagueNightString} from "@/app/_lib/dates";
import {prisma} from "@/app/_lib/prisma";

// The admin's Novo kolo for the league tonight; null when they haven't changed anything tonight (a draft of an earlier
// night doesn't count). slot: the place of a two-place night (1 or 2), 0 on a one-place night.
export async function getCreateRoundDraft(playerId: number, leagueId: number, now: Date = new Date(), slot = 0): Promise<CreateRoundDraft | null> {
  const row = await prisma.createRoundDraft.findUnique({where: {player_id_league_id_slot: {player_id: playerId, league_id: leagueId, slot}}});
  if (!row || row.night.toISOString().slice(0, 10) !== leagueNightString(now)) return null;
  return {rounds: row.rounds, window_size: row.window_size, smoking_on: row.smoking_on, smoking_tables: row.smoking_tables, sitting_out: row.sitting_out};
}

// Saves it for tonight, over the admin's draft of an earlier night. Returns false when the league doesn't exist.
export async function saveCreateRoundDraft(playerId: number, leagueId: number, draft: CreateRoundDraft, now: Date = new Date(), slot = 0): Promise<boolean> {
  const {rounds, window_size, smoking_on, smoking_tables, sitting_out} = draft;
  const data = {night: new Date(`${leagueNightString(now)}T00:00:00.000Z`), rounds, window_size, smoking_on, smoking_tables, sitting_out};
  try {
    await prisma.createRoundDraft.upsert({
      where: {player_id_league_id_slot: {player_id: playerId, league_id: leagueId, slot}},
      create: {player_id: playerId, league_id: leagueId, slot, ...data},
      update: data,
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return false;
    throw error;
  }
}
