import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {AdminHand, HandKind, PadHand, PadMatch, TablePad} from "@/app/_interfaces/adminHand";
import {ResultCreateRequest} from "@/app/_interfaces/result";
import {isByeTeam, teamLabel} from "@/app/_lib/bye";
import {MATCH_THRESHOLD, matchState} from "@/app/_lib/game/scoring";
import {InvalidResultError, normalizeResult} from "@/app/_lib/validation/validateResult";
import {transformResult} from "@/app/_lib/helpers/databaseHelpers";
import {createResult} from "@/app/_lib/service/ongoingResult/create";
import {updateOngoingResult} from "@/app/_lib/service/ongoingResult/update";
import {assertCallStands, ongoingMatchState} from "@/app/_lib/service/ongoingResult/matchState";
import {createOngoingMatch} from "@/app/_lib/service/ongoingMatch/create";
import {finishOngoingMatch, FinishMatchOutcome} from "@/app/_lib/service/match/finishOngoingMatch";
import {lockRound} from "@/app/_lib/service/round/finish";
import {isRatedRound, recalcTeamScores, replayRatings} from "./recalc";
import {NotFoundError} from "./tables";

// The admin scorepad of a Daily table: every hand of the match being played and of the finished matches can be
// added, changed or deleted. Changing a finished match recounts its score, the round's wins, the standings and,
// when the round's outcome changed, the ratings.

type Tx = Prisma.TransactionClient;

// A hand as the server stores it, checked like a player's hand (a normal one adds up to 11)
export function adminHandToResult(hand: AdminHand, matchId: number): ResultCreateRequest {
  return normalizeResult({
    match_id: matchId,
    team1_game_points: hand.points1,
    team2_game_points: hand.points2,
    custom: hand.custom,
    dosta_side: hand.dosta ?? null,
  });
}

type StoredHand = {
  result_id: number;
  team1_game_points: number;
  team2_game_points: number;
  custom: boolean;
  dosta_side: number | null;
};

function toPadHand(h: StoredHand): PadHand {
  const dosta = h.dosta_side === 1 || h.dosta_side === 2 ? h.dosta_side : null;
  return {id: h.result_id, total1: h.team1_game_points, total2: h.team2_game_points, custom: h.custom, dosta};
}

export async function getTablePad(roundId: number): Promise<TablePad> {
  const round = await prisma.round.findUnique({
    where: {id: roundId},
    include: {
      team1: {select: {team_id: true, team_name: true}},
      team2: {select: {team_id: true, team_name: true}},
      leagueRounds: {select: {league_id: true}},
      matches: {orderBy: {id: "asc"}, include: {results: {orderBy: {result_id: "asc"}}}},
      ongoingMatches: {orderBy: {id: "desc"}, take: 1, include: {results: {orderBy: {result_id: "asc"}}}},
      _count: {select: {roundPlayers: true}},
    },
  });
  if (!round) throw new NotFoundError("Stol ne postoji.");

  const matches: PadMatch[] = round.matches.map((m, i) => {
    const {target, winner} = matchState(m.results, m.score_threshold ?? MATCH_THRESHOLD);
    return {
      kind: "finished",
      id: m.id,
      number: i + 1,
      score1: m.player_pair1_score,
      score2: m.player_pair2_score,
      threshold: target,
      winner,
      hands: m.results.map(toPadHand),
    };
  });
  const ongoing = round.ongoingMatches[0];
  if (ongoing) {
    const {target, winner} = matchState(ongoing.results, ongoing.score_threshold ?? MATCH_THRESHOLD);
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
    roundNumber: round.round_number,
    date: round.round_date ? round.round_date.toISOString().slice(0, 10) : null,
    table: round.table_number,
    team1: {id: round.team1.team_id, name: teamLabel(round.team1.team_id, round.team1.team_name)},
    team2: {id: round.team2.team_id, name: teamLabel(round.team2.team_id, round.team2.team_name)},
    done: !round.open,
    bye: isByeTeam(round.team1_id) || isByeTeam(round.team2_id),
    hasLineup: round._count.roundPlayers > 0,
    matches,
  };
}

async function assertEditableTable(roundId: number) {
  const round = await prisma.round.findUnique({where: {id: roundId}, select: {team1_id: true, team2_id: true}});
  if (!round) throw new NotFoundError("Stol ne postoji.");
  if (isByeTeam(round.team1_id) || isByeTeam(round.team2_id)) throw new InvalidResultError("Za stolom sa slobodnom rundom nema igara za uređivanje.");
}

// After a finished match's hands changed: its score and winner, the round's wins, and for a finished round the
// standings (and the ratings when the round's outcome changed)
async function recountFinishedMatch(tx: Tx, matchId: number) {
  const {score_threshold, results} = await tx.match.findUniqueOrThrow({
    where: {id: matchId},
    select: {score_threshold: true, results: {orderBy: {result_id: "asc"}}},
  });
  const state = matchState(results, score_threshold ?? MATCH_THRESHOLD);
  assertCallStands(state);
  const match = await tx.match.update({
    where: {id: matchId},
    data: {player_pair1_score: state.score1, player_pair2_score: state.score2, winner_side: state.winner},
    select: {round_id: true},
  });
  if (match.round_id == null) return;

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
  // a match without a winner (nobody over the threshold after an edit) counts for neither team
  const team1Wins = round.matches.filter((m) => m.winner_side === 1).length;
  const team2Wins = round.matches.filter((m) => m.winner_side === 2).length;
  await tx.round.update({where: {id: round.id}, data: {team1_wins: team1Wins, team2_wins: team2Wins}});

  if (round.open) return;
  for (const {league_id} of round.leagueRounds) {
    await recalcTeamScores(tx, league_id, [round.team1_id, round.team2_id]);
  }
  const outcome = (a: number, b: number) => Math.sign(a - b);
  if (isRatedRound(round) && outcome(round.team1_wins, round.team2_wins) !== outcome(team1Wins, team2Wins)) {
    await replayRatings(tx);
  }
}

// Runs a change of a finished match's hands with the round locked, then recounts
async function changeFinishedMatch(matchId: number, change: (tx: Tx) => Promise<void>) {
  await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({where: {id: matchId}, select: {round_id: true}});
    if (!match) throw new NotFoundError("Meč ne postoji.");
    if (match.round_id != null) await lockRound(tx, match.round_id);
    await change(tx);
    await recountFinishedMatch(tx, matchId);
  }, {timeout: 60000});
}

export type HandTarget = {kind: "ongoing"} | {kind: "finished"; matchId: number};

export async function addHand(roundId: number, target: HandTarget, hand: AdminHand): Promise<void> {
  await assertEditableTable(roundId);
  if (target.kind === "ongoing") {
    // a table that hasn't started gets its first match here (refused when the round is over)
    const ongoing =
      (await prisma.ongoingMatch.findFirst({where: {round_id: roundId}, orderBy: {id: "desc"}, select: {id: true}})) ??
      (await createOngoingMatch({round_id: roundId, score_threshold: MATCH_THRESHOLD}));
    const result = adminHandToResult(hand, ongoing.id);
    await createResult(result, (r) => r);
    return;
  }

  const match = await prisma.match.findUnique({where: {id: target.matchId}, select: {round_id: true}});
  if (!match || match.round_id !== roundId) throw new NotFoundError("Taj meč nije za ovim stolom.");
  const result = adminHandToResult(hand, target.matchId);
  await changeFinishedMatch(target.matchId, async (tx) => {
    await tx.result.create({data: transformResult(result)});
  });
}

export async function updateHand(kind: HandKind, resultId: number, hand: AdminHand): Promise<void> {
  if (kind === "ongoing") {
    const stored = await prisma.ongoingResult.findUnique({where: {result_id: resultId}, select: {match_id: true}});
    if (!stored) throw new NotFoundError("Igra ne postoji.");
    const result = adminHandToResult(hand, stored.match_id);
    await updateOngoingResult({result_id: resultId, resultData: result, normalize: (r) => r});
    return;
  }

  const stored = await prisma.result.findUnique({where: {result_id: resultId}, select: {match_id: true}});
  if (!stored) throw new NotFoundError("Igra ne postoji.");
  const result = adminHandToResult(hand, stored.match_id);
  await changeFinishedMatch(stored.match_id, async (tx) => {
    await tx.result.update({
      where: {result_id: resultId},
      data: {
        team1_game_points: result.team1_game_points,
        team2_game_points: result.team2_game_points,
        custom: result.custom,
        dosta_side: result.dosta_side ?? null,
      },
    });
  });
}

export async function deleteHand(kind: HandKind, resultId: number): Promise<void> {
  if (kind === "ongoing") {
    await prisma.$transaction(async (tx) => {
      const [hand] = await tx.$queryRaw<{match_id: number; team1_game_points: number; team2_game_points: number}[]>`
          SELECT match_id, team1_game_points, team2_game_points
          FROM "OngoingResult" WHERE result_id = ${resultId} FOR UPDATE`;
      if (!hand) throw new NotFoundError("Igra ne postoji.");
      // the match row is locked by the update, so a hand saved at the same moment is applied before or after this
      const match = await tx.ongoingMatch.update({
        where: {id: hand.match_id},
        data: {
          player_pair1_score: {decrement: hand.team1_game_points},
          player_pair2_score: {decrement: hand.team2_game_points},
        },
        select: {score_threshold: true},
      });
      await tx.ongoingResult.delete({where: {result_id: resultId}});
      assertCallStands(await ongoingMatchState(tx, hand.match_id, match.score_threshold));
    });
    return;
  }

  const stored = await prisma.result.findUnique({where: {result_id: resultId}, select: {match_id: true}});
  if (!stored) throw new NotFoundError("Igra ne postoji.");
  await changeFinishedMatch(stored.match_id, async (tx) => {
    await tx.result.delete({where: {result_id: resultId}});
  });
}

// Finishes the table's match in progress (as "Završi meč" on the scoreboard)
export async function finishTableMatch(roundId: number): Promise<FinishMatchOutcome> {
  const ongoing = await prisma.ongoingMatch.findFirst({where: {round_id: roundId}, orderBy: {id: "desc"}, select: {id: true}});
  if (!ongoing) throw new NotFoundError("Za ovim stolom se trenutno ne igra meč.");
  return finishOngoingMatch(ongoing.id);
}
