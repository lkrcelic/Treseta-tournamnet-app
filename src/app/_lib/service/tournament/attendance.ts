import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {Viewer} from "@/app/_lib/players/privacy";
import {isByeTeam} from "@/app/_lib/bye";
import {leagueClock, leagueDateString} from "@/app/_lib/dates";
import {addToDay} from "@/app/_lib/bans";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {autoBanTeam} from "@/app/_lib/service/bans/bans";
import {NO_SHOW_BAN_MONTHS, NO_SHOW_SCORE, noShowStep, noShowTimes, playing, tournamentDays} from "@/app/_lib/tournamentDay";
import {dayEntries, fillPlaces} from "./day";
import {lockTournament} from "./lock";
import {afterTableClosed, dropTables} from "./kola";

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
  attendance_team_id: true,
  matches_per_round: true,
  score_threshold: true,
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
        score_threshold: table.score_threshold,
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

// The skip at 8 minutes: closed without a result, both teams out (and banned after Kolo 1). by: the admin whose
// result it is (Uredi ishod); null for the clock's skip
async function applySkip(tx: Tx, table: Table, now: Date, by: number | null = null) {
  const t = table.tournamentRounds[0].tournament;
  await tx.round.update({where: {id: table.id}, data: {attendance: "SKIPPED", attendance_team_id: null, attendance_by: by, attendance_at: now, open: false, active: false}});
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

// The tournament an admin changes a table of: there, and not cancelled
async function editableTournament(tx: Tx, tournamentId: number) {
  await lockTournament(tx, tournamentId);
  const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}, select: {cancelled_at: true}});
  if (!t) throw new NotFoundError("Turnir ne postoji.");
  if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");
}

// Kolo 1's sign-up bans the app gave the teams (with their players'), lifted by the admin
async function liftAutoBans(tx: Tx, tournamentId: number, teams: number[], adminId: number, now: Date) {
  if (teams.length === 0) return;
  const bans = await tx.signupBan.findMany({where: {tournament_id: tournamentId, team_id: {in: teams}, created_by: null, lifted_at: null}, select: {id: true}});
  const ids = bans.map((b) => b.id);
  if (ids.length > 0) {
    await tx.signupBan.updateMany({where: {OR: [{id: {in: ids}}, {via_ban_id: {in: ids}}], lifted_at: null}, data: {lifted_at: now, lifted_by: adminId}});
  }
}

// What a skipped table or a no-show did, undone: its no-show matches gone (written by the app, never played), the table
// open and live as if "Da, tu su" had been answered by the admin, the teams it put out back in the tournament
async function undoAttendance(tx: Tx, tournamentId: number, table: {id: number; round_number: number | null; team1_id: number; team2_id: number}, adminId: number, now: Date) {
  await tx.match.deleteMany({where: {round_id: table.id}});
  await tx.round.update({
    where: {id: table.id},
    data: {open: true, active: true, team1_wins: 0, team2_wins: 0, attendance: "PRESENT", attendance_team_id: table.team1_id, attendance_by: adminId, attendance_at: now},
  });
  await tx.tournamentTeam.updateMany({
    where: {tournament_id: tournamentId, team_id: {in: [table.team1_id, table.team2_id]}, excluded_reason: {in: ["SKIPPED", "NO_SHOW"]}, excluded_kolo: table.round_number ?? 0},
    data: {excluded_at: null, excluded_kolo: null, excluded_reason: null, active: true, status: "REGISTERED"},
  });
}

// A next Kolo's draft not published yet: it was made with the table as it was
async function dropUnpublished(tx: Tx, tournamentId: number) {
  const drafts = await tx.round.findMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}, status: {not: "PUBLISHED"}}, select: {id: true}});
  await dropTables(tx, drafts.map((d) => d.id));
}

// With a table's teams back the tournament may be over its limit: the teams that came in from the waiting list in their
// place (fillPlaces) and that no published table has yet go back to waiting, the last one in first. A team that already
// has a table stays; the admin decides about it.
async function returnOverflow(tx: Tx, tournamentId: number) {
  const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}, select: {max_teams: true}});
  if (t?.max_teams == null) return;
  const entries = await dayEntries(tx, tournamentId);
  const over = entries.filter(playing).length - t.max_teams;
  if (over <= 0) return;
  const tables = await tx.round.findMany({where: {tournamentRounds: {some: {tournament_id: tournamentId}}, status: "PUBLISHED"}, select: {team1_id: true, team2_id: true}});
  const seated = new Set(tables.flatMap((r) => [r.team1_id, r.team2_id]));
  const back = entries
    .filter((e) => playing(e) && e.arrived && !seated.has(e.teamId))
    .sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime() || b.teamId - a.teamId)
    .slice(0, over)
    .map((e) => e.teamId);
  if (back.length > 0) await tx.tournamentTeam.updateMany({where: {tournament_id: tournamentId, team_id: {in: back}}, data: {status: "WAITING", active: true}});
}

// Vrati stol (admin or the organizer whose tournament it is): a skipped table, or one closed by "Ne, nisu došli", is
// back in play as if "Da, tu su" had been answered (by the admin): open, its no-show matches gone, no question and no
// skip any more. The teams this table put out are back from now (active), and the ban Kolo 1 gave them is lifted. A
// next Kolo's draft not published yet is dropped: it was made without this table, and comes again once its Kolo is
// played. A waiting team that came in for them and has no table yet goes back to waiting (returnOverflow). A table that
// isn't skipped or a no-show is left as it is.
export async function restoreTable(tournamentId: number, roundId: number, adminId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await editableTournament(tx, tournamentId);
    const table = await tx.round.findFirst({
      where: {id: roundId, tournamentRounds: {some: {tournament_id: tournamentId}}},
      select: {id: true, round_number: true, team1_id: true, team2_id: true, attendance: true},
    });
    if (!table) throw new NotFoundError("Stol ne postoji.");
    if (table.attendance !== "SKIPPED" && table.attendance !== "NO_SHOW") return;
    const now = new Date();
    await undoAttendance(tx, tournamentId, table, adminId, now);
    if (table.round_number === 1) await liftAutoBans(tx, tournamentId, [table.team1_id, table.team2_id], adminId, now);
    await dropUnpublished(tx, tournamentId);
    await returnOverflow(tx, tournamentId);
  }, {timeout: 30_000});
}

// Uredi ishod: the admin's own result of a skipped table or a no-show
// - TEAM1 / TEAM2: that team wins every match of the table as "Ne, nisu došli" gives it (5:0), the other is out
// - SKIPPED: no result, both teams out
export type TableOutcome = "TEAM1" | "TEAM2" | "SKIPPED";

// Uredi ishod (admin or the organizer whose tournament it is): a skipped table or a no-show gets the result the admin
// picks, as if the table had been closed so: the matches, who is out of the tournament and, in Kolo 1, whose sign-ups
// are banned follow it (a team that is no longer at fault is back in and its ban lifted; one that now is gets out, its
// earlier ban back in force). A next Kolo's draft not published yet is made again. The result it already has changes
// nothing.
export async function setTableOutcome(tournamentId: number, roundId: number, outcome: TableOutcome, adminId: number): Promise<void> {
  const changed = await prisma.$transaction(async (tx) => {
    await editableTournament(tx, tournamentId);
    const table = await tx.round.findFirst({where: {id: roundId, tournamentRounds: {some: {tournament_id: tournamentId}}}, select: tableSelect});
    if (!table) throw new NotFoundError("Stol ne postoji.");
    if (table.attendance !== "SKIPPED" && table.attendance !== "NO_SHOW") throw new InvalidResultError("Ishod se bira samo preskočenom stolu ili stolu s nedolaskom.");
    const winner = outcome === "TEAM1" ? table.team1_id : outcome === "TEAM2" ? table.team2_id : null;
    if (winner == null ? table.attendance === "SKIPPED" : table.attendance === "NO_SHOW" && table.attendance_team_id === winner) return false;

    const now = new Date();
    await undoAttendance(tx, tournamentId, table, adminId, now);
    const fresh = await tx.round.findUniqueOrThrow({where: {id: roundId}, select: tableSelect});
    if (winner == null) await applySkip(tx, fresh, now, adminId);
    else await applyNoShow(tx, fresh, winner, adminId, now);

    // Kolo 1's bans follow the new result: the winner's is lifted, a team now out has its ban (the one it had, if any)
    if (table.round_number === 1) {
      const t = table.tournamentRounds[0].tournament;
      const out = winner == null ? [table.team1_id, table.team2_id] : [winner === table.team1_id ? table.team2_id : table.team1_id];
      if (winner != null) await liftAutoBans(tx, tournamentId, [winner], adminId, now);
      for (const team of out) {
        const banned = await tx.signupBan.count({where: {tournament_id: tournamentId, team_id: team, created_by: null, lifted_at: null}});
        if (banned > 0) continue;
        const lifted = await tx.signupBan.findFirst({where: {tournament_id: tournamentId, team_id: team, created_by: null}, orderBy: {id: "desc"}, select: {id: true}});
        if (lifted) {
          await tx.signupBan.updateMany({where: {OR: [{id: lifted.id}, {via_ban_id: lifted.id}]}, data: {lifted_at: null, lifted_by: null}});
        } else {
          await autoBanTeam(tx, team, t, banUntil());
        }
      }
    }
    await dropUnpublished(tx, tournamentId);
    await returnOverflow(tx, tournamentId);
    return true;
  }, {timeout: 30_000});
  if (changed) await afterTableClosed(roundId);
}
