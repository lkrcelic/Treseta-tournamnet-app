// Playing a table now, through the app's own services, exactly as the phones do it: Tko igra (saveLineup), the first
// match (createOngoingMatch), each hand (createResult, which normalizes and validates it), Završi meč
// (finishOngoingMatch, which closes the table, updates the standings and replays the ratings).
// Live tables play normal hands only (11 points, zvanja); "s ovim dosta" and Kaput are left to the tests.
import {MATCH_THRESHOLD, type MatchEnd} from "@/app/_lib/game/scoring";
import {createResult} from "@/app/_lib/service/ongoingResult/create";
import {createOngoingMatch} from "@/app/_lib/service/ongoingMatch/create";
import {finishOngoingMatch} from "@/app/_lib/service/match/finishOngoingMatch";
import {saveLineup} from "@/app/_lib/service/round/lineup";
import {afterTableClosed} from "@/app/_lib/service/tournament/kola";
import type {Ctx} from "./context";
import {type Hand, lineups, makeHand, resultColumns, stateOf} from "./play";
import type {Rng} from "./rng";

export type LivePlan = {
  // matches played to the end and closed with Završi meč (a league table has 2, a tournament table 1 or 2)
  finished: number;
  // hands entered in the match after them (0 = the next match is open but empty)
  handsInOpenMatch?: number;
  // play the open match until a team has won (41 and ahead) but leave Završi meč to the test
  toThreshold?: boolean;
  // no lineup and no match: the table waits for Tko igra
  untouched?: boolean;
};

export type LiveTable = {roundId: number; openMatchId: number | null; closed: boolean};

export async function playLiveTable(
  ctx: Ctx,
  rng: Rng,
  table: {roundId: number; team1: number; team2: number; matchesPerRound: number; declarations: boolean; end?: MatchEnd; edge: number},
  rosters: Map<number, number[]>,
  plan: LivePlan,
): Promise<LiveTable> {
  if (plan.untouched) return {roundId: table.roundId, openMatchId: null, closed: false};
  const end = table.end ?? "S_OVIM_DOSTA";
  const [players1, players2] = lineups(rng, rosters.get(table.team1) ?? [], rosters.get(table.team2) ?? []);
  await saveLineup(table.roundId, {
    teams: [
      {team_id: table.team1, player_ids: players1},
      {team_id: table.team2, player_ids: players2},
    ],
  });
  let matchId: number | null = (await createOngoingMatch({round_id: table.roundId, score_threshold: MATCH_THRESHOLD})).id;

  const playHands = async (limit: number, stopBeforeWinner: boolean) => {
    const hands: Hand[] = [];
    for (let n = 0; n < limit; n++) {
      let hand = makeHand(rng, table.edge, table.declarations);
      // an open match stops short of a winner unless the plan wants it there
      for (let tries = 0; stopBeforeWinner && stateOf([...hands, hand], end).winner !== null && tries < 20; tries++) {
        hand = makeHand(rng, table.edge, table.declarations);
      }
      if (stopBeforeWinner && stateOf([...hands, hand], end).winner !== null) return;
      await createResult({match_id: matchId!, ...resultColumns(hand)});
      hands.push(hand);
      if (stateOf(hands, end).winner !== null) return;
    }
  };

  for (let m = 0; m < plan.finished; m++) {
    await playHands(60, false);
    const outcome = await finishOngoingMatch(matchId!);
    matchId = outcome.nextOngoingMatchId ?? null;
    if (outcome.roundFinished) {
      await afterTableClosed(outcome.roundId);
      return {roundId: table.roundId, openMatchId: null, closed: true};
    }
  }
  if (plan.toThreshold) await playHands(60, false);
  else if (plan.handsInOpenMatch) await playHands(plan.handsInOpenMatch, true);
  return {roundId: table.roundId, openMatchId: matchId, closed: false};
}

// usernames of a team's players, for the catalog (the tests log in as them)
export async function usernames(ctx: Ctx, rosters: Map<number, number[]>, teamId: number): Promise<string[]> {
  const ids = rosters.get(teamId) ?? [];
  const rows = await ctx.prisma.player.findMany({where: {id: {in: ids}, active: true}, select: {username: true}});
  return rows.map((r) => r.username);
}
