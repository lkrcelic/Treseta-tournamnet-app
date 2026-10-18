import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {teamLabel} from "@/app/_lib/bye";
import {recalcTeamScores} from "@/app/_lib/service/admin/recalc";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {nightValue} from "@/app/_lib/service/league/nights";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {approvalStatus, draftLetters, NO_DRAFT, NOTHING_APPROVED, PUBLISHED_ROUND, publishNumbers, RoundStatus, roundStatusOf, roundsToApprove, roundsToDiscard, roundsToPublish} from "@/app/_lib/roundStatus";
import {DraftNight, DraftRound} from "@/app/_interfaces/round";

// Upravljanje ligom · Skica: approving, publishing and discarding a night's rounds (the rules are in
// _lib/roundStatus.ts). A round is a round number on a night, one Round row per table; every change takes the league's
// lock, as round creation and the admin's table edits do. A round not published yet is Skica A, B, C… and gets its
// number when it is published.

type Tx = Prisma.TransactionClient;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const lockLeague = (tx: Tx, leagueId: number) => tx.$executeRaw`SELECT pg_advisory_xact_lock(${leagueId})`;

// Every table of the league's rounds on a night
const nightTables = (leagueId: number, date: string) => ({
  leagueRounds: {some: {league_id: leagueId}},
  round_date: nightValue(date),
  round_number: {not: null},
});

// A night's rounds in order with their tables and status (the Skica view); null when the league has none that night
export async function getDraftNight(leagueId: number, date: string): Promise<DraftNight | null> {
  const tables = await prisma.round.findMany({
    where: nightTables(leagueId, date),
    orderBy: [{round_number: "asc"}, {table_number: "asc"}, {id: "asc"}],
    select: {
      id: true,
      round_number: true,
      table_number: true,
      smoking_table: true,
      status: true,
      published_at: true,
      draft_order: true,
      team1: {select: {team_id: true, team_name: true}},
      team2: {select: {team_id: true, team_name: true}},
    },
  });
  if (tables.length === 0) return null;

  const byNumber = new Map<number, typeof tables>();
  for (const t of tables) byNumber.set(t.round_number!, [...(byNumber.get(t.round_number!) ?? []), t]);
  const letters = draftLetters(Array.from(byNumber, ([roundNumber, list]) => ({roundNumber, status: roundStatusOf(list), draftOrder: list[0].draft_order})));
  const rounds = Array.from(byNumber, ([roundNumber, list]): DraftRound => {
    const published = list.map((t) => t.published_at?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
    return {
      roundNumber,
      letter: letters.get(roundNumber) ?? null,
      status: roundStatusOf(list),
      publishedAt: published ? new Date(published).toISOString() : null,
      id: list[0].id,
      tables: list.map((t) => ({
        id: t.id,
        table: t.table_number,
        smoking: t.smoking_table,
        team1: {id: t.team1.team_id, name: teamLabel(t.team1.team_id, t.team1.team_name)},
        team2: {id: t.team2.team_id, name: teamLabel(t.team2.team_id, t.team2.team_name)},
      })),
    };
  });
  return {date, rounds};
}

export type RoundApproval = {leagueId: number; date: string; roundNumber: number; status: RoundStatus};

// "Odobri" (approve) or taking it back (approve = false) for the round a table belongs to: every table of the round
// changes. A published round stays as it is (InvalidResultError).
export async function setRoundApproval(roundId: number, approve: boolean): Promise<RoundApproval> {
  return prisma.$transaction(async (tx) => {
    const link = await tx.leagueRound.findFirst({where: {round_id: roundId}, select: {league_id: true}});
    if (!link) throw new NotFoundError("Kolo ne postoji.");
    await lockLeague(tx, link.league_id);
    // read after the lock, so a publish or discard that just ran is seen
    const table = await tx.round.findUnique({where: {id: roundId}, select: {round_number: true, round_date: true}});
    if (!table || table.round_number == null || table.round_date == null) throw new NotFoundError("Kolo ne postoji.");

    const date = isoDate(table.round_date);
    const tables = await tx.round.findMany({
      where: {...nightTables(link.league_id, date), round_number: table.round_number},
      select: {id: true, status: true},
    });
    const next = approvalStatus(roundStatusOf(tables), approve);
    if ("error" in next) throw new InvalidResultError(next.error);
    await tx.round.updateMany({
      where: {id: {in: tables.filter((t) => t.status !== "PUBLISHED").map((t) => t.id)}},
      data: {status: next.status},
    });
    return {leagueId: link.league_id, date, roundNumber: table.round_number, status: next.status};
  });
}

// "Odobri sva": every draft round of the night is approved at once (one request, so a phone on a weak connection
// doesn't stop halfway); approved and published rounds stay. Returns the round numbers approved (none: nothing was
// left to approve). A night without rounds not published yet is NotFoundError (NO_DRAFT).
export async function approveNight(leagueId: number, date: string): Promise<{rounds: number[]}> {
  return prisma.$transaction(async (tx) => {
    await lockLeague(tx, leagueId);
    const tables = await tx.round.findMany({where: nightTables(leagueId, date), select: {id: true, round_number: true, status: true}});
    if (roundsToDiscard(tables).length === 0) throw new NotFoundError(NO_DRAFT);
    const drafts = roundsToApprove(tables);
    if (drafts.length) await tx.round.updateMany({where: {id: {in: drafts.map((t) => t.id)}}, data: {status: "APPROVED"}});
    return {rounds: roundNumbers(drafts)};
  });
}

// "Objavi odobrena kola": the night's approved rounds are published at once; drafts stay drafts. The published ones are
// numbered after the league's last published round in their letter order, so there is no gap for a draft left out
// (publishNumbers). A bye table is closed (2:0) as soon as it is created, so its team's season row is counted again
// now that the round counts. Returns the round numbers published.
export async function publishNight(leagueId: number, date: string): Promise<{rounds: number[]; publishedAt: string}> {
  return prisma.$transaction(
    async (tx) => {
      await lockLeague(tx, leagueId);
      const tables = await tx.round.findMany({
        where: nightTables(leagueId, date),
        select: {id: true, round_number: true, status: true, open: true, team1_id: true, team2_id: true, draft_order: true},
      });
      const approved = roundsToPublish(tables);
      if (approved.length === 0) throw new InvalidResultError(NOTHING_APPROVED);

      const last = await tx.round.aggregate({
        _max: {round_number: true},
        where: {leagueRounds: {some: {league_id: leagueId}}, ...PUBLISHED_ROUND},
      });
      const waiting = new Map<number, typeof tables>();
      for (const t of roundsToDiscard(tables)) waiting.set(t.round_number!, [...(waiting.get(t.round_number!) ?? []), t]);
      const numbers = publishNumbers(
        Array.from(waiting, ([roundNumber, list]) => ({roundNumber, status: roundStatusOf(list), draftOrder: list[0].draft_order})),
        last._max.round_number ?? 0
      );

      const now = new Date();
      const published: number[] = [];
      for (const [from, list] of Array.from(waiting)) {
        const to = numbers.get(from)!;
        const publish = roundStatusOf(list) === "APPROVED";
        if (publish) published.push(to);
        if (!publish && to === from) continue;
        await tx.round.updateMany({
          where: {id: {in: list.map((t) => t.id)}},
          data: publish ? {round_number: to, status: "PUBLISHED", published_at: now, draft_order: null} : {round_number: to},
        });
      }
      await recalcTeamScores(
        tx,
        leagueId,
        approved.filter((t) => !t.open).flatMap((t) => [t.team1_id, t.team2_id])
      );
      return {rounds: published.sort((a, b) => a - b), publishedAt: now.toISOString()};
    },
    {timeout: 30000}
  );
}

// "Odbaci skicu": deletes the night's rounds that aren't published, with what is stored at their tables (a bye table's
// matches); published rounds stay. Nothing unpublished is counted in the standings, so they don't change. Returns the
// round numbers deleted and how many tables they had.
export async function discardDraft(leagueId: number, date: string): Promise<{rounds: number[]; tables: number}> {
  return prisma.$transaction(
    async (tx) => {
      await lockLeague(tx, leagueId);
      const tables = roundsToDiscard(
        await tx.round.findMany({where: nightTables(leagueId, date), select: {id: true, round_number: true, status: true}})
      );
      if (tables.length === 0) throw new NotFoundError(NO_DRAFT);

      const ids = tables.map((t) => t.id);
      await tx.ongoingMatch.deleteMany({where: {round_id: {in: ids}}});
      await tx.match.deleteMany({where: {round_id: {in: ids}}});
      await tx.round.deleteMany({where: {id: {in: ids}}});
      return {rounds: roundNumbers(tables), tables: tables.length};
    },
    {timeout: 30000}
  );
}

function roundNumbers(tables: {round_number: number | null}[]): number[] {
  return Array.from(new Set(tables.map((t) => t.round_number!))).sort((a, b) => a - b);
}
