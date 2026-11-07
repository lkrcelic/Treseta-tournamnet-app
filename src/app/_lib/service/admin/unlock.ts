import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {PadLock} from "@/app/_interfaces/adminHand";
import {isByeTeam} from "@/app/_lib/bye";
import {GAME_MINUTES_ERROR, GAME_MINUTES_MAX, GAME_MINUTES_MIN, matchDeadline} from "@/app/_lib/gameTime";
import {ROUND_NOT_PUBLISHED} from "@/app/_lib/roundStatus";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {replayRatings} from "@/app/_lib/service/admin/recalc";
import {lockRound} from "@/app/_lib/service/round/finish";
import {lockTournament} from "@/app/_lib/service/tournament/lock";
import {lockKind} from "@/app/_lib/tableLock";

// Otključaj partiju (DECISIONS #89): a locked table of a tournament is played on again, with the Vrijeme partije the
// admin chooses as they unlock it (the table's own limit from then on, gameMinutesOf). What the lock did is undone with
// it, so the unlocked table is as it was before:
//   - Nedolazak (NO_SHOW): the matches the answer wrote (NO_SHOW_SCORE, scored as a bye) are deleted (a match an admin has since entered hands
//     into is real play and stays), the team that didn't come is back in the tournament and the app's own ban from
//     Kolo 1 is lifted. The table is new again: Započni igru starts the game.
//   - Preskočen (SKIPPED): nothing was played, so both teams come back and both bans are lifted.
//   - Vrijeme isteklo / Gotovo: the last match played is the match being played again, with its hands and the new
//     deadline, so the table carries on where it stopped. The win it was counted goes back off the table's score.
// The Kolos already made from the result stay as they are; the admin lays them out again if they want to.

type Tx = Prisma.TransactionClient;

export type UnlockKind = PadLock;

export type Unlocked = {kind: UnlockKind; minutes: number; ends_at: string; resumed: boolean; restored: string[]; bans_lifted: number};

export const NOT_LOCKED = "Ovaj stol nije zaključan.";
export const LEAGUE_TABLE = "Otključavanje je za turnirske stolove.";

const tableSelect = {
  id: true,
  status: true,
  open: true,
  round_number: true,
  team1_id: true,
  team2_id: true,
  attendance: true,
  attendance_team_id: true,
  matches_per_round: true,
  matches: {
    orderBy: {id: "asc"},
    select: {
      id: true,
      player_pair1_score: true,
      player_pair2_score: true,
      score_threshold: true,
      time_expired: true,
      match_date: true,
      // the stored winner ("s ovim dosta" can win with fewer points; null: an edit left the match without one)
      winner_side: true,
      results: {
        orderBy: {result_id: "asc"},
        select: {
          team1_game_points: true,
          team2_game_points: true,
          team1_zvanja3: true,
          team1_zvanja4: true,
          team2_zvanja3: true,
          team2_zvanja4: true,
          custom: true,
          dosta_side: true,
        },
      },
    },
  },
  _count: {select: {ongoingMatches: true}},
} as const;

type Table = Prisma.RoundGetPayload<{select: typeof tableSelect}>;
type TableMatch = Table["matches"][number];

// The teams the lock threw out of the tournament: the one that didn't come, or both of a skipped table
function excludedBy(t: Table, kind: UnlockKind): number[] {
  if (kind === "no_show") return [t.attendance_team_id === t.team1_id ? t.team2_id : t.team1_id];
  if (kind === "skipped") return [t.team1_id, t.team2_id];
  return [];
}

// Vrati u turnir, as the admin's Vrati does (tournament/day.ts), but only for a team this table's lock excluded: a team
// an admin excluded by hand, or that a later Kolo threw out, is left alone.
async function restoreTeams(tx: Tx, tournamentId: number, teamIds: number[], kolo: number | null): Promise<number[]> {
  const back: number[] = [];
  for (const teamId of teamIds) {
    const {count} = await tx.tournamentTeam.updateMany({
      where: {
        tournament_id: tournamentId,
        team_id: teamId,
        excluded_reason: {in: ["NO_SHOW", "SKIPPED"]},
        ...(kolo != null && {excluded_kolo: kolo}),
      },
      data: {excluded_at: null, excluded_kolo: null, excluded_reason: null, active: true, status: "REGISTERED"},
    });
    if (count > 0) back.push(teamId);
  }
  return back;
}

// The app's own ban after a no-show in Kolo 1 (autoBanTeam writes it with the tournament on it, which an admin's ban
// never has): lifted with the players it was written for
async function liftAutoBans(tx: Tx, tournamentId: number, teamIds: number[], by: number | null): Promise<number> {
  const bans = await tx.signupBan.findMany({
    where: {tournament_id: tournamentId, team_id: {in: teamIds}, lifted_at: null},
    select: {id: true},
  });
  if (bans.length === 0) return 0;
  const ids = bans.map((b) => b.id);
  const data = {lifted_at: new Date(), lifted_by: by};
  await tx.signupBan.updateMany({where: {id: {in: ids}}, data});
  await tx.signupBan.updateMany({where: {via_ban_id: {in: ids}, lifted_at: null}, data});
  return ids.length;
}

// A match played is the match being played again, with its hands, from now until the new deadline
async function resumeMatch(tx: Tx, m: TableMatch, roundId: number, now: Date, minutes: number) {
  await tx.ongoingMatch.create({
    data: {
      round_id: roundId,
      player_pair1_score: m.player_pair1_score,
      player_pair2_score: m.player_pair2_score,
      score_threshold: m.score_threshold,
      match_date: now,
      start_time: now,
      started_at: now,
      ends_at: matchDeadline(now, minutes),
      // Treseta's hands as they were, zvanja and "s ovim dosta" with them (the match's state is replayed from them)
      results: {create: m.results.map((r) => ({...r}))},
    },
  });
  await tx.match.delete({where: {id: m.id}});
}

// The table's score from the matches that are left: each match's stored winner (Treseta's winner_side; a match without
// a winner counts for neither team, as the scorepad's changes already count it)
async function recountWins(tx: Tx, roundId: number) {
  const matches = await tx.match.findMany({where: {round_id: roundId}, select: {winner_side: true}});
  const winners = matches.map((m) => m.winner_side);
  await tx.round.update({
    where: {id: roundId},
    data: {team1_wins: winners.filter((w) => w === 1).length, team2_wins: winners.filter((w) => w === 2).length},
  });
}

export async function unlockTable(roundId: number, minutes: number, by: number | null = null): Promise<Unlocked> {
  if (!Number.isInteger(minutes) || minutes < GAME_MINUTES_MIN || minutes > GAME_MINUTES_MAX) throw new InvalidResultError(GAME_MINUTES_ERROR);
  const link = await prisma.tournamentRound.findFirst({where: {round_id: roundId}, select: {tournament_id: true}});
  if (!link) {
    const exists = await prisma.round.count({where: {id: roundId}});
    if (!exists) throw new NotFoundError("Stol ne postoji.");
    throw new InvalidResultError(LEAGUE_TABLE);
  }
  const tournamentId = link.tournament_id;

  return prisma.$transaction(async (tx) => {
    await lockTournament(tx, tournamentId);
    await lockRound(tx, roundId);
    const table = await tx.round.findUnique({where: {id: roundId}, select: tableSelect});
    if (!table) throw new NotFoundError("Stol ne postoji.");
    if (table.status !== "PUBLISHED") throw new InvalidResultError(ROUND_NOT_PUBLISHED);
    if (isByeTeam(table.team1_id) || isByeTeam(table.team2_id)) throw new InvalidResultError("Stol sa slobodnom rundom se ne otključava.");
    const kind = lockKind({open: table.open, attendance: table.attendance, matches: table.matches, ongoing: table._count.ongoingMatches});
    if (!kind) throw new InvalidResultError(NOT_LOCKED);

    const now = new Date();
    // the Vrijeme partije of this table from now on: the match resumed here, and every match started at it later
    await tx.round.update({where: {id: roundId}, data: {game_minutes: minutes, open: true, active: false, attendance: null, attendance_team_id: null, attendance_by: null, attendance_at: null}});

    // Nedolazak: the matches its answer wrote (NO_SHOW_SCORE, no hands) are not play and go; one an admin has entered
    // hands into is a real result and stays
    if (kind === "no_show") {
      const written = table.matches.filter((m) => m.results.length === 0).map((m) => m.id);
      if (written.length > 0) await tx.match.deleteMany({where: {id: {in: written}}});
    }

    // Vrijeme isteklo / Gotovo: carry on with the last match played
    const left = await tx.match.findMany({where: {round_id: roundId}, orderBy: {id: "desc"}, take: 1, select: {id: true}});
    const resume = (kind === "time_expired" || kind === "done") && left.length > 0;
    if (resume) {
      const last = table.matches.find((m) => m.id === left[0].id);
      if (last) await resumeMatch(tx, last, roundId, now, minutes);
      await tx.round.update({where: {id: roundId}, data: {active: true}});
    }
    await recountWins(tx, roundId);

    const back = await restoreTeams(tx, tournamentId, excludedBy(table, kind), table.round_number);
    const lifted = back.length > 0 ? await liftAutoBans(tx, tournamentId, back, by) : 0;
    // the table counted for the ratings while it was closed; open, it counts for nothing (isRatedRound)
    await replayRatings(tx);

    const names = back.length > 0 ? await tx.team.findMany({where: {team_id: {in: back}}, select: {team_name: true}}) : [];
    return {
      kind,
      minutes,
      ends_at: matchDeadline(now, minutes).toISOString(),
      resumed: resume,
      restored: names.map((t) => t.team_name),
      bans_lifted: lifted,
    };
  }, {timeout: 60_000});
}
