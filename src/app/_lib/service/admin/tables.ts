import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {isByeTeam} from "@/app/_lib/bye";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {createByeMatches} from "@/app/_lib/service/round/insertPairRounds";
import {isRatedRound, recalcTeamScores, replayRatings} from "./recalc";

// Admin edits of a night's tables (a "round number" of a league on a date is a set of tables, one Round row each).
// A table whose teams change loses what was played at it; standings and, when a counted result changed, ratings
// are recalculated in the same transaction.

type Tx = Prisma.TransactionClient;
type TableRound = {id: number; team1_id: number; team2_id: number; open: boolean; round_number: number | null; round_date: Date | null; table_number: number | null};

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

const tableSelect = {id: true, team1_id: true, team2_id: true, open: true, round_number: true, round_date: true, table_number: true} as const;

// The table and the league it belongs to, with the league locked for edits (same lock as round creation)
async function loadTable(tx: Tx, roundId: number): Promise<{table: TableRound; leagueId: number}> {
  const link = await tx.leagueRound.findFirst({where: {round_id: roundId}, select: {league_id: true}});
  if (!link) {
    if (await tx.round.count({where: {id: roundId}})) throw new InvalidResultError("This table isn't part of a league.");
    throw new NotFoundError("Table not found.");
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${link.league_id})`;
  // read after the lock, so a concurrent edit of the same round is seen
  const table = await tx.round.findUniqueOrThrow({where: {id: roundId}, select: tableSelect});
  return {table, leagueId: link.league_id};
}

// The other tables of the same round number on the same night
function sameRound(tx: Tx, leagueId: number, t: {round_number: number | null; round_date: Date | null}) {
  return tx.round.findMany({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_number: t.round_number, round_date: t.round_date},
    select: tableSelect,
    orderBy: [{table_number: "asc"}, {id: "asc"}],
  });
}

async function assertLeagueTeams(tx: Tx, leagueId: number, teamIds: number[]) {
  const real = teamIds.filter((id) => !isByeTeam(id));
  const count = await tx.leagueTeam.count({where: {league_id: leagueId, team_id: {in: real}}});
  if (count !== new Set(real).size) throw new InvalidResultError("Both teams must be teams of this league.");
}

// Drops what was played at a table and seats the given teams. A table with the bye is settled right away (2:0).
async function reseat(tx: Tx, roundId: number, team1Id: number, team2Id: number) {
  await tx.ongoingMatch.deleteMany({where: {round_id: roundId}});
  await tx.match.deleteMany({where: {round_id: roundId}});
  const bye = isByeTeam(team1Id) || isByeTeam(team2Id);
  await tx.round.update({
    where: {id: roundId},
    data: {
      team1_id: team1Id,
      team2_id: team2Id,
      team1_wins: bye && !isByeTeam(team1Id) ? 2 : 0,
      team2_wins: bye && !isByeTeam(team2Id) ? 2 : 0,
      open: !bye,
      active: false,
    },
  });
  if (bye) await createByeMatches(tx, roundId, team1Id);
}

// After tables changed: the season rows of every team involved, and ratings if a rated result was undone or added
async function settle(tx: Tx, leagueId: number, before: TableRound[], after: TableRound[]) {
  const teams = [...before, ...after].flatMap((t) => [t.team1_id, t.team2_id]);
  await recalcTeamScores(tx, leagueId, teams);
  if (before.some(isRatedRound) || after.some(isRatedRound)) await replayRatings(tx);
}

export type PairChange = {roundId: number; team1Id: number; team2Id: number};

// The seats of a round after `tableId` gets `wanted` (team1, team2). A team taken from another table is replaced
// there by the team it pushes out, so every team keeps playing once. Returns a new map; the input is not changed.
export function planSeats(seats: Map<number, [number, number]>, tableId: number, wanted: [number, number]): Map<number, [number, number]> {
  const out = new Map(Array.from(seats, ([id, pair]) => [id, [pair[0], pair[1]] as [number, number]]));
  for (const side of [0, 1]) {
    const current = out.get(tableId)!;
    const newTeam = wanted[side];
    const oldTeam = current[side];
    if (newTeam === oldTeam) continue;
    for (const [id, pair] of Array.from(out)) {
      if (id === tableId) continue;
      const k = pair.indexOf(newTeam);
      if (k >= 0) {
        pair[k] = oldTeam;
        break;
      }
    }
    current[side] = newTeam;
  }
  return out;
}

// Seats two teams at a table. A team that sits at another table of the same round swaps places with the team it
// replaces, so every team still plays once in the round. Returns the tables that changed.
export async function editTablePair(roundId: number, team1Id: number, team2Id: number): Promise<PairChange[]> {
  if (team1Id === team2Id) throw new InvalidResultError("A team can't play against itself.");
  return prisma.$transaction(async (tx) => {
    const {table, leagueId} = await loadTable(tx, roundId);
    // the bye can stay at its table, but can't be seated anywhere new
    const byeHere = isByeTeam(table.team1_id) || isByeTeam(table.team2_id);
    if (!byeHere && (isByeTeam(team1Id) || isByeTeam(team2Id))) {
      throw new InvalidResultError("The bye can't be seated at a table.");
    }
    await assertLeagueTeams(tx, leagueId, [team1Id, team2Id]);

    const tables = await sameRound(tx, leagueId, table);
    const seats = planSeats(new Map(tables.map((t) => [t.id, [t.team1_id, t.team2_id]])), roundId, [team1Id, team2Id]);

    const changed = tables.filter((t) => {
      const [a, b] = seats.get(t.id)!;
      return a !== t.team1_id || b !== t.team2_id;
    });
    for (const t of changed) {
      const [a, b] = seats.get(t.id)!;
      if (a === b) throw new InvalidResultError("A team can't play against itself.");
      await reseat(tx, t.id, a, b);
    }
    const after = await tx.round.findMany({where: {id: {in: changed.map((t) => t.id)}}, select: tableSelect});
    await settle(tx, leagueId, changed, after);
    return changed.map((t) => ({roundId: t.id, team1Id: seats.get(t.id)![0], team2Id: seats.get(t.id)![1]}));
  }, {timeout: 30000});
}

// Removes a table and everything played at it
export async function removeTable(roundId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const {table, leagueId} = await loadTable(tx, roundId);
    await tx.ongoingMatch.deleteMany({where: {round_id: roundId}});
    await tx.match.deleteMany({where: {round_id: roundId}});
    await tx.round.delete({where: {id: roundId}});
    await settle(tx, leagueId, [table], []);
  }, {timeout: 30000});
}

// Adds a table to a round that exists on that night; both teams must not be playing in that round yet
export async function addTable(leagueId: number, roundDate: Date, roundNumber: number, team1Id: number, team2Id: number): Promise<number> {
  if (team1Id === team2Id) throw new InvalidResultError("A team can't play against itself.");
  if (isByeTeam(team1Id) || isByeTeam(team2Id)) throw new InvalidResultError("The bye can't be seated at a table.");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${leagueId})`;
    await assertLeagueTeams(tx, leagueId, [team1Id, team2Id]);
    const tables = await sameRound(tx, leagueId, {round_number: roundNumber, round_date: roundDate});
    if (tables.length === 0) throw new NotFoundError("This round doesn't exist.");
    const seated = new Set(tables.flatMap((t) => [t.team1_id, t.team2_id]));
    if (seated.has(team1Id) || seated.has(team2Id)) throw new InvalidResultError("A team already plays in this round.");

    const tableNumber = Math.max(0, ...tables.map((t) => t.table_number ?? 0)) + 1;
    const round = await tx.round.create({
      data: {
        round_number: roundNumber,
        round_date: roundDate,
        team1_id: team1Id,
        team2_id: team2Id,
        table_number: tableNumber,
        leagueRounds: {create: {league_id: leagueId}},
      },
    });
    return round.id;
  });
}

export type RoundSummary = {
  date: string; // YYYY-MM-DD
  roundNumber: number;
  tables: number;
  status: "played" | "live" | "new";
};

// The league's rounds (a round number on a night), newest first, with how far they got
export async function listLeagueRounds(leagueId: number): Promise<RoundSummary[]> {
  const rounds = await prisma.round.findMany({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_number: {not: null}},
    select: {
      ...tableSelect,
      active: true,
      _count: {select: {matches: true, ongoingMatches: true}},
    },
  });
  const groups = new Map<string, typeof rounds>();
  for (const r of rounds) {
    const key = `${r.round_date?.toISOString().slice(0, 10) ?? ""}|${r.round_number}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const isBye = (r: (typeof rounds)[number]) => isByeTeam(r.team1_id) || isByeTeam(r.team2_id);
  return Array.from(groups, ([key, tables]) => {
    const [date, n] = key.split("|");
    const played = tables.filter((t) => !isBye(t));
    const status: RoundSummary["status"] = played.length > 0 && played.every((t) => !t.open)
      ? "played"
      : played.some((t) => !t.open || t.active || t._count.matches > 0 || t._count.ongoingMatches > 0)
        ? "live"
        : "new";
    return {date, roundNumber: Number(n), tables: tables.length, status};
  }).sort((a, b) => b.date.localeCompare(a.date) || b.roundNumber - a.roundNumber);
}

// Deletes every table of a round on a night, with what was played at them
export async function deleteLeagueRound(leagueId: number, roundDate: Date, roundNumber: number): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${leagueId})`;
    const tables = await sameRound(tx, leagueId, {round_number: roundNumber, round_date: roundDate});
    if (tables.length === 0) throw new NotFoundError("This round doesn't exist.");
    const ids = tables.map((t) => t.id);
    await tx.ongoingMatch.deleteMany({where: {round_id: {in: ids}}});
    await tx.match.deleteMany({where: {round_id: {in: ids}}});
    await tx.round.deleteMany({where: {id: {in: ids}}});
    await settle(tx, leagueId, tables, []);
    return tables.length;
  }, {timeout: 60000});
}
