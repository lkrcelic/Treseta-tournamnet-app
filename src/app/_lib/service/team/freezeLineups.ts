import {Prisma} from "@prisma/client";
import {BYE_TEAM_ID, isByeTeam} from "@/app/_lib/bye";
import {lineupFreezeRows} from "@/app/_lib/lineup";
import {RATINGS_FROM} from "@/app/_lib/service/admin/recalc";
import {PUBLISHED_ROUND} from "@/app/_lib/roundStatus";

/**
 * Before these teams' rosters change (a player added, removed or deleted), saves each team's roster of today as the
 * lineup of every rated round it played without one (lineupFreezeRows), so the next rating replay gives everyone the
 * same rating as before. Call it inside the transaction that changes the roster, after lockRatings(tx), so a replay
 * never reads a roster halfway. A table re-paired later (admin/tables.ts reseat) loses its saved lineup with its result.
 */
export async function freezeRosterLineups(tx: Prisma.TransactionClient, teamIds: number[]): Promise<void> {
  const ids = Array.from(new Set(teamIds)).filter((id) => !isByeTeam(id));
  if (ids.length === 0) return;

  // the rounds the rating replay counts (replayRatings): finished, published, no bye, since ratings began
  const rounds = await tx.round.findMany({
    where: {
      open: false,
      ...PUBLISHED_ROUND,
      round_date: {gte: RATINGS_FROM},
      team1_id: {not: BYE_TEAM_ID},
      team2_id: {not: BYE_TEAM_ID},
      OR: [{team1_id: {in: ids}}, {team2_id: {in: ids}}],
    },
    select: {id: true, open: true, team1_id: true, team2_id: true, roundPlayers: {select: {player_id: true, team_id: true}}},
  });
  const members = await tx.teamPlayer.findMany({where: {team_id: {in: ids}}, select: {team_id: true, player_id: true}});
  const rosters = new Map<number, number[]>(ids.map((id) => [id, []]));
  for (const m of members) rosters.get(m.team_id)!.push(m.player_id);

  const rows = lineupFreezeRows(
    rounds.map(({roundPlayers, ...r}) => ({...r, lineup: roundPlayers})),
    rosters
  );
  for (let i = 0; i < rows.length; i += 1000) {
    await tx.roundPlayer.createMany({data: rows.slice(i, i + 1000), skipDuplicates: true});
  }
}
