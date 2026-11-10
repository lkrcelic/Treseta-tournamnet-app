import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {Viewer} from "@/app/_lib/players/privacy";
import {isByeTeam} from "@/app/_lib/bye";
import {leagueClock, leagueDateString} from "@/app/_lib/dates";
import {addToDay} from "@/app/_lib/bans";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {autoBanTeam} from "@/app/_lib/service/bans/bans";
import {NO_SHOW_BAN_MONTHS, NO_SHOW_SCORE, noShowStep, noShowTimes, tournamentDays} from "@/app/_lib/tournamentDay";
import {fillPlaces} from "./day";
import {lockTournament} from "./lock";
import {afterTableClosed} from "./kola";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";

// Nedolazak za stol: a published table of today's tournament where no game has started is asked "Jesu li … za
// stolom?" 3 minutes after its Kolo went out; the answer works from 5 minutes. Da, tu su: the question is gone and they
// play. Ne, nisu došli: the answering team wins every match of the table as a Slobodna runda is won (5:0) and the
// other team is out of the rest
// of the tournament. With no game and no answer at 8 minutes the match is skipped (not scored) and both teams are
// out. In Kolo 1 the team that didn't come (both, for a skipped match) also gets a ban on sign-ups: it had confirmed
// arrival. The first answer counts for the whole table. Neither kind of table is rated.

type Tx = Prisma.TransactionClient;

export type AttendanceAnswer = "PRESENT" | "NO_SHOW";

const tableSelect = {
  id: true,
  round_number: true,
  round_date: true,
  team1_id: true,
  team2_id: true,
  open: true,
  status: true,
  published_at: true,
  attendance: true,
  matches_per_round: true,
  tournamentRounds: {select: {tournament: {select: {tournament_id: true, tournament_name: true, max_teams: true}}}, take: 1},
  _count: {select: {matches: true, ongoingMatches: true}},
} as const;

type Table = Prisma.RoundGetPayload<{select: typeof tableSelect}>;

// A table the question is about: today's (days: tournamentDays), published, open, not a bye, no game started and not
// answered yet
export function awaitingPlay(t: Pick<Table, "status" | "open" | "attendance" | "team1_id" | "team2_id" | "_count" | "round_date" | "published_at">, days: Date[]): boolean {
  return (
    t.status === "PUBLISHED" &&
    t.open &&
    t.attendance == null &&
    t.published_at != null &&
    !isByeTeam(t.team1_id) &&
    !isByeTeam(t.team2_id) &&
    t._count.matches === 0 &&
    t._count.ongoingMatches === 0 &&
    t.round_date != null &&
    days.some((d) => d.getTime() === t.round_date!.getTime())
  );
}

const banUntil = () => addToDay(leagueDateString(), NO_SHOW_BAN_MONTHS, "months");

async function exclude(tx: Tx, tournamentId: number, teamId: number, kolo: number, reason: "NO_SHOW" | "SKIPPED") {
  await tx.tournamentTeam.updateMany({
    where: {tournament_id: tournamentId, team_id: teamId, excluded_at: null},
    data: {excluded_at: new Date(), excluded_kolo: kolo, excluded_reason: reason},
  });
}

// Ne, nisu došli: every match of the table won by the answering team as a bye is (5:0), the table closed, the other
// team out
async function applyNoShow(tx: Tx, table: Table, answeringTeam: number, by: number | null, now: Date) {
  const t = table.tournamentRounds[0].tournament;
  const first = answeringTeam === table.team1_id;
  const [winner, loser] = NO_SHOW_SCORE;
  for (let i = 0; i < table.matches_per_round; i++) {
    await tx.match.create({
      data: {
        round_id: table.id,
        player_pair1_score: first ? winner : loser,
        player_pair2_score: first ? loser : winner,
        score_threshold: MATCH_THRESHOLD,
        winner_side: first ? 1 : 2,
        start_time: now,
        end_time: now,
        match_date: table.round_date,
      },
    });
  }
  await tx.round.update({
    where: {id: table.id},
    data: {
      attendance: "NO_SHOW",
      attendance_team_id: answeringTeam,
      attendance_by: by,
      attendance_at: now,
      team1_wins: first ? table.matches_per_round : 0,
      team2_wins: first ? 0 : table.matches_per_round,
      open: false,
      active: false,
    },
  });
  const absent = first ? table.team2_id : table.team1_id;
  await exclude(tx, t.tournament_id, absent, table.round_number ?? 0, "NO_SHOW");
  if (table.round_number === 1) await autoBanTeam(tx, absent, t, banUntil());
  await fillPlaces(tx, t.tournament_id, t.max_teams);
}

// The skip at 8 minutes: closed without a result, both teams out (and banned after Kolo 1)
async function applySkip(tx: Tx, table: Table, now: Date) {
  const t = table.tournamentRounds[0].tournament;
  await tx.round.update({where: {id: table.id}, data: {attendance: "SKIPPED", attendance_at: now, open: false, active: false}});
  for (const team of [table.team1_id, table.team2_id]) {
    await exclude(tx, t.tournament_id, team, table.round_number ?? 0, "SKIPPED");
    if (table.round_number === 1) await autoBanTeam(tx, team, t, banUntil());
  }
  await fillPlaces(tx, t.tournament_id, t.max_teams);
}

// Skips the tournament's tables whose 8 minutes are over (the clock). Answers with the tables it closed.
export async function skipDueTables(tournamentId: number, now = new Date()): Promise<number[]> {
  const today = tournamentDays(now);
  const candidates = await prisma.round.findMany({
    where: {tournamentRounds: {some: {tournament_id: tournamentId}}, status: "PUBLISHED", open: true, attendance: null, round_date: {in: today}},
    select: tableSelect,
  });
  const due = candidates.filter((t) => awaitingPlay(t, today) && noShowStep(t.published_at!, now) === "due");
  if (due.length === 0) return [];
  const closed = await prisma.$transaction(async (tx) => {
    await lockTournament(tx, tournamentId);
    const out: number[] = [];
    for (const d of due) {
      const table = await tx.round.findUniqueOrThrow({where: {id: d.id}, select: tableSelect});
      if (!awaitingPlay(table, today)) continue;
      await applySkip(tx, table, now);
      out.push(table.id);
    }
    return out;
  }, {timeout: 30_000});
  for (const id of closed) await afterTableClosed(id);
  return closed;
}

// The answer of one of the table's players. The first answer counts: a later one gets the table as it is. Answers with
// what the table is now.
export async function answerAttendance(roundId: number, viewer: Viewer, answer: AttendanceAnswer): Promise<"PRESENT" | "NO_SHOW" | "SKIPPED" | "STARTED"> {
  const link = await prisma.tournamentRound.findFirst({where: {round_id: roundId}, select: {tournament_id: true}});
  if (!link) throw new NotFoundError("Stol ne postoji.");
  const now = new Date();
  const today = tournamentDays(now);
  const outcome = await prisma.$transaction(async (tx) => {
    await lockTournament(tx, link.tournament_id);
    const table = await tx.round.findUnique({where: {id: roundId}, select: tableSelect});
    if (!table) throw new NotFoundError("Stol ne postoji.");
    const member = await tx.teamPlayer.findFirst({where: {player_id: viewer.id, team_id: {in: [table.team1_id, table.team2_id]}}, select: {team_id: true}});
    if (!member) throw new InvalidResultError("Ovo pitanje je za igrače tog stola.");
    if (table.attendance) return table.attendance;
    if (table._count.matches > 0 || table._count.ongoingMatches > 0 || !table.open) return "STARTED" as const;
    if (!awaitingPlay(table, today)) throw new InvalidResultError("Za ovaj stol se više ne pita.");
    const times = noShowTimes(table.published_at!);
    const step = noShowStep(table.published_at!, now);
    if (step === "waiting" || step === "asking") throw new InvalidResultError(`Odgovor je moguć od ${leagueClock(times.unlock)}.`);
    if (step === "due") {
      await applySkip(tx, table, now);
      return "SKIPPED" as const;
    }
    if (answer === "PRESENT") {
      await tx.round.update({where: {id: roundId}, data: {attendance: "PRESENT", attendance_team_id: member.team_id, attendance_by: viewer.id, attendance_at: now}});
      return "PRESENT" as const;
    }
    await applyNoShow(tx, table, member.team_id, viewer.id, now);
    return "NO_SHOW" as const;
  }, {timeout: 30_000});
  if (outcome === "NO_SHOW" || outcome === "SKIPPED") await afterTableClosed(roundId);
  return outcome;
}
