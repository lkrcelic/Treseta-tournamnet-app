import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {AdminHand, HandKind, PadHand, PadMatch, TablePad} from "@/app/_interfaces/adminHand";
import {ResultCreateRequest} from "@/app/_interfaces/result";
import {isByeTeam, teamLabel} from "@/app/_lib/bye";
import {DEFAULT_MATCH_END, HandZvanja, handTotals, handZvanja, MATCH_THRESHOLD, MatchState, matchState, Side, zvanjaColumns, ZvanjaCounts} from "@/app/_lib/game/scoring";
import {assertZvanja, InvalidResultError, newHandZvanja, NoWinnerWarning, normalizeResult} from "@/app/_lib/validation/validateResult";
import {transformResult} from "@/app/_lib/helpers/databaseHelpers";
import {createResult} from "@/app/_lib/service/ongoingResult/create";
import {updateOngoingResult} from "@/app/_lib/service/ongoingResult/update";
import {assertCallStands, ongoingMatchState} from "@/app/_lib/service/ongoingResult/matchState";
import {createOngoingMatch} from "@/app/_lib/service/ongoingMatch/create";
import {finishOngoingMatch, FinishMatchOutcome} from "@/app/_lib/service/match/finishOngoingMatch";
import {lockRound} from "@/app/_lib/service/round/finish";
import {ROUND_NOT_PUBLISHED} from "@/app/_lib/roundStatus";
import {isRatedRound, recalcTeamScores, replayRatings} from "./recalc";
import {NotFoundError} from "./tables";
import {gameMinutesOf, syncDeadline} from "@/app/_lib/service/match/timeLimit";
import {matchDeadline, timeWinner} from "@/app/_lib/gameTime";
import {leagueNight} from "@/app/_lib/dates";
import {refuseUnlessMyTable} from "@/app/_lib/service/admin/tables";
import type {Viewer} from "@/app/_lib/players/privacy";

// The admin scorepad of a Daily table: every hand of the match being played and of the finished matches can be
// added, changed or deleted. Changing a finished match recounts its score, the round's wins, the standings and,
// when the round's outcome changed, the ratings.

type Tx = Prisma.TransactionClient;

// A hand as the server stores it, checked like a player's hand (a normal one adds up to 11, its zvanja are ones the
// cards allow, a custom one has none)
export function adminHandToResult(hand: AdminHand, matchId: number): ResultCreateRequest {
  return normalizeResult({
    match_id: matchId,
    team1_game_points: hand.points1,
    team2_game_points: hand.points2,
    ...zvanjaColumns(counts(hand.zvanja1), counts(hand.zvanja2)),
    custom: hand.custom,
    dosta_side: hand.dosta ?? null,
  });
}

// a team's zvanja as the admin's phone sent them (none when it sent nothing)
const counts = (z?: {3?: number; 4?: number}): ZvanjaCounts => ({3: z?.[3] ?? 0, 4: z?.[4] ?? 0});

type StoredHand = HandZvanja & {
  result_id: number;
  team1_game_points: number;
  team2_game_points: number;
  custom: boolean;
  dosta_side: number | null;
};

function toPadHand(h: StoredHand): PadHand {
  const dosta = h.dosta_side === 1 || h.dosta_side === 2 ? h.dosta_side : null;
  const [total1, total2] = handTotals(h);
  const [zvanja1, zvanja2] = handZvanja(h);
  return {id: h.result_id, total1, total2, points1: h.team1_game_points, points2: h.team2_game_points, zvanja1, zvanja2, custom: h.custom, dosta};
}

export async function getTablePad(roundId: number): Promise<TablePad> {
  const round = await prisma.round.findUnique({
    where: {id: roundId},
    include: {
      team1: {select: {team_id: true, team_name: true}},
      team2: {select: {team_id: true, team_name: true}},
      leagueRounds: {select: {league_id: true}},
      tournamentRounds: {select: {tournament_id: true}},
      matches: {orderBy: {id: "asc"}, include: {results: {orderBy: {result_id: "asc"}}}},
      ongoingMatches: {orderBy: {id: "desc"}, take: 1, include: {results: {orderBy: {result_id: "asc"}}}},
      _count: {select: {roundPlayers: true}},
    },
  });
  if (!round) throw new NotFoundError("Stol ne postoji.");

  const matches: PadMatch[] = round.matches.map((m, i) => {
    const {target} = matchState(m.results, m.score_threshold ?? MATCH_THRESHOLD, round.match_end);
    return {
      kind: "finished",
      id: m.id,
      number: i + 1,
      score1: m.player_pair1_score,
      score2: m.player_pair2_score,
      threshold: target,
      // the stored winner, which every edit keeps with the hands (changeFinishedMatch) and which a match closed by
      // Vrijeme partije has although no team reached the target
      winner: (m.winner_side as Side | null) ?? null,
      hands: m.results.map(toPadHand),
    };
  });
  const ongoing = round.ongoingMatches[0];
  if (ongoing) {
    const {target, winner} = matchState(ongoing.results, ongoing.score_threshold ?? MATCH_THRESHOLD, round.match_end);
    matches.push({
      kind: "ongoing",
      id: ongoing.id,
      number: matches.length + 1,
      score1: ongoing.player_pair1_score,
      score2: ongoing.player_pair2_score,
      threshold: target,
      winner,
      hands: ongoing.results.map(toPadHand),
    });
  }

  return {
    roundId: round.id,
    leagueId: round.leagueRounds[0]?.league_id ?? 0,
    tournamentId: round.tournamentRounds[0]?.tournament_id ?? null,
    matchesPerRound: round.matches_per_round,
    declarations: round.declarations,
    matchEnd: round.match_end,
    roundNumber: round.round_number,
    date: round.round_date ? round.round_date.toISOString().slice(0, 10) : null,
    table: round.table_number,
    smoking: round.smoking_table,
    team1: {id: round.team1.team_id, name: teamLabel(round.team1.team_id, round.team1.team_name)},
    team2: {id: round.team2.team_id, name: teamLabel(round.team2.team_id, round.team2.team_name)},
    done: !round.open,
    bye: isByeTeam(round.team1_id) || isByeTeam(round.team2_id),
    hasLineup: round._count.roundPlayers > 0,
    matches,
  };
}

// Returns whether the table plays with zvanja (a tournament's table "bez zvanja" takes none)
async function assertEditableTable(roundId: number): Promise<{declarations: boolean}> {
  const round = await prisma.round.findUnique({where: {id: roundId}, select: {team1_id: true, team2_id: true, status: true, declarations: true}});
  if (!round) throw new NotFoundError("Stol ne postoji.");
  if (isByeTeam(round.team1_id) || isByeTeam(round.team2_id)) throw new InvalidResultError("Za stolom sa slobodnom rundom nema igara za uređivanje.");
  // nothing is played in a round before it is published
  if (round.status !== "PUBLISHED") throw new InvalidResultError(ROUND_NOT_PUBLISHED);
  return {declarations: round.declarations};
}

// A finished match's hand at a table "bez zvanja" takes none (a match being played is checked when it is saved)
function assertTableZvanja(result: ResultCreateRequest, declarations: boolean) {
  assertZvanja(newHandZvanja(result), {custom: result.custom ?? false, declarations});
}

// A change of a finished match's hands that leaves a match that had a winner without one: the warning the admin
// confirms first, since the round then counts that match for neither team (a 2:0 can turn into a draw). Moving the win
// to the other team, or correcting a match that already had no winner, needs no warning. before: the match's
// winner_side; after: the hands replayed.
export function noWinnerWarning(before: Side | null, after: Pick<MatchState, "score1" | "score2" | "target" | "winner">): string | null {
  if (before == null || after.winner != null) return null;
  const score = `${after.score1}:${after.score2}`;
  const why = after.score1 === after.score2 ? score : `${score} i nitko nema ${after.target}`;
  return `Nakon ove promjene meč je ${why}, pa se ne broji nijednoj ekipi. Rezultat stola, poredak i rejting ponovno se računaju.`;
}

// The warning when a finished match can't go back in play (reopenCheck says why): it stays without a winner until the
// admin adds the hands that were played
export function noWinnerAddHandsWarning(after: Pick<MatchState, "score1" | "score2" | "target">, why: string): string {
  return `Nakon ove promjene meč je ${after.score1}:${after.score2} i nitko nema ${after.target}. ${why}, pa se ne može ponovno otvoriti igračima: ostaje bez pobjednika dok ne dopišeš igre koje su odigrane. Rezultat stola, poredak i rejting ponovno se računaju.`;
}

// Options of a change of a finished match: allowNoWinner, the admin confirmed the "Meč ostaje bez pobjednika" warning
export type HandEditOptions = {allowNoWinner?: boolean};

// What a change of a finished match did: reopened, the match is back in play at its table (reopenMatch)
export type HandEditOutcome = {reopened: boolean};

type FinishedMatchRow = {
  id: number;
  round_id: number | null;
  score_threshold: number | null;
  match_date: Date | null;
  start_time: Date | null;
  end_time: Date | null;
};

// A table's won matches per team: a match without a winner counts for neither team
const roundWins = (matches: {winner_side: number | null}[]) => ({
  team1_wins: matches.filter((m) => m.winner_side === 1).length,
  team2_wins: matches.filter((m) => m.winner_side === 2).length,
});

// The clock of a match going back in play: its start moved on by the time it stood closed, so it has the time it had
// left when it was closed (and every later hand's deadline sync counts from there)
type ReopenClock = {startedAt: Date; endsAt: Date};

/**
 * Whether a finished match left without a winner can go back in play: the reason it can't, or its clock. The players
 * go on with it only at a table of tonight (a league night, a tournament day) while nothing came after it: no later
 * match at the table (one already opened is fine while it has no hand), and no next Kolo of its league or tournament
 * made yet, not even a draft. A match without a time it had left (no start or end stored, or none left when it was
 * closed) isn't reopened either. Otherwise only the admin adds its hands.
 *
 * The table's open match is locked first, so a player's hand saved into it at the same moment is either counted here
 * or waits until this change is done (and then finds its match gone).
 */
async function reopenCheck(tx: Tx, match: FinishedMatchRow, extensions: number): Promise<{why: string} | ReopenClock> {
  if (match.round_id == null) return {why: "Meč nije ni za jednim stolom"};
  const round = await tx.round.findUnique({
    where: {id: match.round_id},
    select: {
      round_number: true,
      round_date: true,
      status: true,
      attendance: true,
      leagueRounds: {select: {league_id: true}},
      tournamentRounds: {select: {tournament_id: true}},
    },
  });
  if (!round || round.status !== "PUBLISHED") return {why: "Stol nije objavljen"};
  if (round.attendance === "NO_SHOW" || round.attendance === "SKIPPED") return {why: "Stol nije odigran"};
  if (round.round_date?.getTime() !== leagueNight().getTime()) return {why: "Stol nije od večeras"};
  if ((await tx.match.count({where: {round_id: match.round_id, id: {gt: match.id}}})) > 0) return {why: "Za stolom je već odigran sljedeći meč"};
  await tx.$queryRaw`SELECT id FROM "OngoingMatch" WHERE round_id = ${match.round_id} FOR UPDATE`;
  if ((await tx.ongoingResult.count({where: {match: {round_id: match.round_id}}})) > 0) return {why: "Za stolom se već igra sljedeći meč"};
  const leagues = round.leagueRounds.map((l) => l.league_id);
  const tournaments = round.tournamentRounds.map((t) => t.tournament_id);
  const nextKolo = await tx.round.count({
    where: {
      round_number: {gt: round.round_number ?? 0},
      OR: [{leagueRounds: {some: {league_id: {in: leagues}}}}, {tournamentRounds: {some: {tournament_id: {in: tournaments}}}}],
    },
  });
  if (nextKolo > 0) return {why: "Sljedeće kolo je već složeno"};

  if (!match.start_time || !match.end_time) return {why: "Meč nema zapisano vrijeme"};
  const startedAt = new Date(Date.now() - (match.end_time.getTime() - match.start_time.getTime()));
  const endsAt = matchDeadline(startedAt, await gameMinutesOf(tx, match.round_id), extensions);
  if (endsAt.getTime() <= Date.now()) return {why: "Meču je vrijeme već isteklo"};
  return {startedAt, endsAt};
}

/**
 * Puts a finished match back in play at its table (reopenCheck allowed it): it is the table's match being played
 * again, with its hands and the time it had left. The empty match its closing opened is dropped, and a closed table
 * opens again: it no longer counts in the standings and the ratings until it closes.
 */
async function reopenMatch(tx: Tx, match: FinishedMatchRow, results: StoredHand[], state: MatchState, clock: ReopenClock) {
  const roundId = match.round_id!;
  await tx.ongoingMatch.deleteMany({where: {round_id: roundId}});
  const ongoing = await tx.ongoingMatch.create({
    data: {
      round_id: roundId,
      player_pair1_score: state.score1,
      player_pair2_score: state.score2,
      score_threshold: match.score_threshold,
      match_date: match.match_date ?? clock.startedAt,
      start_time: clock.startedAt,
      started_at: clock.startedAt,
      ends_at: clock.endsAt,
    },
    select: {id: true},
  });
  await tx.ongoingResult.createMany({
    data: results.map((h) => ({
      match_id: ongoing.id,
      team1_game_points: h.team1_game_points,
      team2_game_points: h.team2_game_points,
      team1_zvanja3: h.team1_zvanja3,
      team1_zvanja4: h.team1_zvanja4,
      team2_zvanja3: h.team2_zvanja3,
      team2_zvanja4: h.team2_zvanja4,
      custom: h.custom,
      dosta_side: h.dosta_side,
    })),
  });
  await tx.match.delete({where: {id: match.id}});

  const round = await tx.round.findUniqueOrThrow({
    where: {id: roundId},
    select: {open: true, team1_id: true, team2_id: true, leagueRounds: {select: {league_id: true}}, matches: {select: {winner_side: true}}},
  });
  await tx.round.update({where: {id: roundId}, data: {open: true, active: true, ...roundWins(round.matches)}});
  if (round.open) return;
  for (const {league_id} of round.leagueRounds) {
    await recalcTeamScores(tx, league_id, [round.team1_id, round.team2_id]);
  }
  if (isRatedRound(round)) await replayRatings(tx);
}

/**
 * After a finished match's hands changed: its score and winner, the round's wins, and for a finished round the
 * standings (and the ratings when the round's outcome changed).
 *
 * A match closed by Vrijeme partije goes to the team with more points, as it did when the time ran out ("s ovim
 * dosta" isn't called once the time is up); a level score leaves it without a winner. A match closed with time left
 * that no team has won any more goes back in play (reopenMatch) when nothing came after it; otherwise it is left
 * without a winner until the admin adds its hands. A match left without a winner that had one needs the admin's
 * confirmation.
 */
async function recountFinishedMatch(tx: Tx, matchId: number, allowNoWinner: boolean): Promise<HandEditOutcome> {
  const found = await tx.match.findUniqueOrThrow({
    where: {id: matchId},
    select: {
      id: true,
      round_id: true,
      score_threshold: true,
      winner_side: true,
      time_expired: true,
      match_date: true,
      start_time: true,
      end_time: true,
      results: {orderBy: {result_id: "asc"}},
      round: {select: {match_end: true}},
    },
  });
  const {score_threshold, winner_side, results, round: table} = found;
  const state = matchState(results, score_threshold ?? MATCH_THRESHOLD, table?.match_end ?? DEFAULT_MATCH_END);
  assertCallStands(state);

  let winner: Side | null = state.winner;
  if (found.time_expired) {
    winner = timeWinner(state.score1, state.score2);
  } else if (winner == null) {
    const check = await reopenCheck(tx, found, state.extensions);
    if (!("why" in check)) {
      await reopenMatch(tx, found, results, state, check);
      return {reopened: true};
    }
    if (!allowNoWinner && winner_side != null) throw new NoWinnerWarning(noWinnerAddHandsWarning(state, check.why));
  }
  const warning = allowNoWinner ? null : noWinnerWarning(winner_side as Side | null, {...state, winner});
  if (warning) throw new NoWinnerWarning(warning);
  const match = await tx.match.update({
    where: {id: matchId},
    data: {player_pair1_score: state.score1, player_pair2_score: state.score2, winner_side: winner},
    select: {round_id: true},
  });
  if (match.round_id == null) return {reopened: false};

  const round = await tx.round.findUniqueOrThrow({
    where: {id: match.round_id},
    select: {
      id: true,
      open: true,
      team1_id: true,
      team2_id: true,
      team1_wins: true,
      team2_wins: true,
      leagueRounds: {select: {league_id: true}},
      matches: {select: {winner_side: true}},
    },
  });
  // a match without a winner (the admin confirmed it) counts for neither team
  const wins = roundWins(round.matches);
  await tx.round.update({where: {id: round.id}, data: wins});

  if (round.open) return {reopened: false};
  for (const {league_id} of round.leagueRounds) {
    await recalcTeamScores(tx, league_id, [round.team1_id, round.team2_id]);
  }
  const outcome = (a: number, b: number) => Math.sign(a - b);
  if (isRatedRound(round) && outcome(round.team1_wins, round.team2_wins) !== outcome(wins.team1_wins, wins.team2_wins)) {
    await replayRatings(tx);
  }
  return {reopened: false};
}

// Runs a change of a finished match's hands with the round locked, then recounts
async function changeFinishedMatch(matchId: number, change: (tx: Tx) => Promise<void>, options: HandEditOptions): Promise<HandEditOutcome> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({where: {id: matchId}, select: {round_id: true}});
    if (!match) throw new NotFoundError("Meč ne postoji.");
    if (match.round_id != null) await lockRound(tx, match.round_id);
    await change(tx);
    return recountFinishedMatch(tx, matchId, options.allowNoWinner === true);
  }, {timeout: 60000});
}

export type HandTarget = {kind: "ongoing"} | {kind: "finished"; matchId: number};

export async function addHand(roundId: number, target: HandTarget, hand: AdminHand, options: HandEditOptions = {}): Promise<HandEditOutcome> {
  const {declarations} = await assertEditableTable(roundId);
  if (target.kind === "ongoing") {
    // a table that hasn't started gets its first match here (refused when the round is over)
    const ongoing =
      (await prisma.ongoingMatch.findFirst({where: {round_id: roundId}, orderBy: {id: "desc"}, select: {id: true}})) ??
      (await createOngoingMatch({round_id: roundId, score_threshold: MATCH_THRESHOLD}));
    const result = adminHandToResult(hand, ongoing.id);
    // an admin's hand is never refused for being late: they enter what was played, Vrijeme partije or not
    await createResult(result, (r) => r, {admin: true});
    return {reopened: false};
  }

  const match = await prisma.match.findUnique({where: {id: target.matchId}, select: {round_id: true}});
  if (!match || match.round_id !== roundId) throw new NotFoundError("Taj meč nije za ovim stolom.");
  const result = adminHandToResult(hand, target.matchId);
  assertTableZvanja(result, declarations);
  return changeFinishedMatch(target.matchId, async (tx) => {
    await tx.result.create({data: transformResult(result)});
  }, options);
}

/**
 * Whose hand it is. These two routes get only a hand's id, so the table it was played at is looked up through its
 * match, and the table says whose it is (refuseUnlessMyTable, DECISIONS #86). A hand with no table left (its round was
 * deleted) is nobody's but the admin's.
 */
export async function refuseUnlessMyHand(kind: HandKind, resultId: number, viewer: Viewer): Promise<void> {
  const roundId =
    kind === "ongoing"
      ? (await prisma.ongoingResult.findUnique({where: {result_id: resultId}, select: {match: {select: {round_id: true}}}}))?.match.round_id
      : (await prisma.result.findUnique({where: {result_id: resultId}, select: {match: {select: {round_id: true}}}}))?.match.round_id;
  if (roundId == null) throw new NotFoundError("Igra ne postoji.");
  await refuseUnlessMyTable(roundId, viewer);
}

export async function updateHand(kind: HandKind, resultId: number, hand: AdminHand, options: HandEditOptions = {}): Promise<HandEditOutcome> {
  if (kind === "ongoing") {
    const stored = await prisma.ongoingResult.findUnique({where: {result_id: resultId}, select: {match_id: true}});
    if (!stored) throw new NotFoundError("Igra ne postoji.");
    const result = adminHandToResult(hand, stored.match_id);
    await updateOngoingResult({result_id: resultId, resultData: result, normalize: (r) => r, admin: true});
    return {reopened: false};
  }

  const stored = await prisma.result.findUnique({
    where: {result_id: resultId},
    select: {match_id: true, match: {select: {round: {select: {declarations: true}}}}},
  });
  if (!stored) throw new NotFoundError("Igra ne postoji.");
  const result = adminHandToResult(hand, stored.match_id);
  assertTableZvanja(result, stored.match.round?.declarations ?? true);
  return changeFinishedMatch(stored.match_id, async (tx) => {
    await tx.result.update({
      where: {result_id: resultId},
      data: {
        team1_game_points: result.team1_game_points,
        team2_game_points: result.team2_game_points,
        ...newHandZvanja(result),
        custom: result.custom,
        dosta_side: result.dosta_side ?? null,
      },
    });
  }, options);
}

export async function deleteHand(kind: HandKind, resultId: number, options: HandEditOptions = {}): Promise<HandEditOutcome> {
  if (kind === "ongoing") {
    await prisma.$transaction(async (tx) => {
      const [hand] = await tx.$queryRaw<(HandZvanja & {match_id: number; team1_game_points: number; team2_game_points: number})[]>`
          SELECT match_id, team1_game_points, team2_game_points, team1_zvanja3, team1_zvanja4, team2_zvanja3, team2_zvanja4
          FROM "OngoingResult" WHERE result_id = ${resultId} FOR UPDATE`;
      if (!hand) throw new NotFoundError("Igra ne postoji.");
      // the hand's total: its points and its zvanja
      const [total1, total2] = handTotals(hand);
      // the match row is locked by the update, so a hand saved at the same moment is applied before or after this
      const match = await tx.ongoingMatch.update({
        where: {id: hand.match_id},
        data: {
          player_pair1_score: {decrement: total1},
          player_pair2_score: {decrement: total2},
        },
        select: {score_threshold: true},
      });
      await tx.ongoingResult.delete({where: {result_id: resultId}});
      const state = await ongoingMatchState(tx, hand.match_id, match.score_threshold);
      assertCallStands(state);
      // the target may have fallen back with the deleted hand, and the deadline with it
      await syncDeadline(tx, hand.match_id, state);
    });
    return {reopened: false};
  }

  const stored = await prisma.result.findUnique({where: {result_id: resultId}, select: {match_id: true}});
  if (!stored) throw new NotFoundError("Igra ne postoji.");
  return changeFinishedMatch(stored.match_id, async (tx) => {
    await tx.result.delete({where: {result_id: resultId}});
  }, options);
}

// Finishes the table's match in progress (as "Završi meč" on the scoreboard)
export async function finishTableMatch(roundId: number): Promise<FinishMatchOutcome> {
  const ongoing = await prisma.ongoingMatch.findFirst({where: {round_id: roundId}, orderBy: {id: "desc"}, select: {id: true}});
  if (!ongoing) throw new NotFoundError("Za ovim stolom se trenutno ne igra meč.");
  return finishOngoingMatch(ongoing.id);
}
