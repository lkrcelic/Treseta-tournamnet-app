// Treseta scoring rules, shared by the hand entry (what the players see) and the API (what gets saved).
// Keep this file free of framework imports so it can be used on both sides and tested on its own.

// A hand is worth 11 points: the points typed for one team, the rest to the other team
export const HAND_POINTS = 11;
// A custom hand (one cut short by "s ovim dosta", or a correction) is typed freely for each team, up to this
// many points
export const CUSTOM_HAND_MAX = 99;
// A match is over once a team has this many points and the scores differ
export const MATCH_THRESHOLD = 41;
// Teams level at or above the target play on to a target this much higher (41 → 51 → 61 …)
export const TARGET_RAISE = 10;
// A bye round: the real team wins each of its matches by this many points to 0
export const BYE_MATCH_POINTS = 5;

export type Side = 1 | 2;

// Returns a reason the hand's points can't be right, or null when they are fine.
export function handError(points1: number, points2: number, custom: boolean): string | null {
  if (!Number.isInteger(points1) || !Number.isInteger(points2)) {
    return "Bodovi moraju biti cijeli brojevi.";
  }
  if (points1 < 0 || points2 < 0) {
    return "Bodovi ne mogu biti negativni.";
  }
  if (points1 === 0 && points2 === 0) {
    return "Upiši bodove barem jednoj ekipi.";
  }
  if (custom) {
    if (points1 > CUSTOM_HAND_MAX || points2 > CUSTOM_HAND_MAX) {
      return `Ručni unos ne može ekipi dati više od ${CUSTOM_HAND_MAX} bodova.`;
    }
    return null;
  }
  if (points1 + points2 !== HAND_POINTS) {
    return `Zbroj bodova mora biti ${HAND_POINTS}.`;
  }
  return null;
}

// A match is over once a team reaches the threshold and the two scores differ.
export function matchWinner(score1: number, score2: number, threshold: number): Side | null {
  if (score1 === score2) return null;
  if (score1 < threshold && score2 < threshold) return null;
  return score1 > score2 ? 1 : 2;
}

// A hand as the match plays it. `dosta_side` is the team that called "s ovim dosta" on it, if any.
export type PlayedHand = {
  team1_game_points: number;
  team2_game_points: number;
  dosta_side?: number | null;
};

export type MatchState = {
  score1: number;
  score2: number;
  // the points to reach: the match's threshold, raised each time the teams are level at or above it
  target: number;
  winner: Side | null;
  // the team that won by calling "s ovim dosta"
  calledBy: Side | null;
  // why a "s ovim dosta" mark can't stand, or null
  callError: string | null;
};

// Plays the hands in order:
//   - "s ovim dosta": the calling team wins once it has reached the target with that hand, even with fewer points
//   - level at or above the target: the target goes up by 10, and the rules apply again
//   - otherwise the first team over the target with more points wins (matchWinner)
export function matchState(hands: PlayedHand[], threshold = MATCH_THRESHOLD): MatchState {
  let score1 = 0;
  let score2 = 0;
  let target = threshold;
  let calledBy: Side | null = null;
  let callError: string | null = null;

  for (const hand of hands) {
    score1 += hand.team1_game_points;
    score2 += hand.team2_game_points;
    const caller = hand.dosta_side;
    if (caller === 1 || caller === 2) {
      if (calledBy !== null) {
        callError = "„S ovim dosta” može se zvati samo jednom.";
      } else if ((caller === 1 ? score1 : score2) < target) {
        callError = `Ekipa koja zove „s ovim dosta” mora s tom igrom doći do ${target}.`;
      } else {
        calledBy = caller;
      }
    }
    while (calledBy === null && score1 === score2 && score1 >= target) target += TARGET_RAISE;
  }

  const winner = calledBy ?? matchWinner(score1, score2, target);
  return {score1, score2, target, winner, calledBy, callError};
}

// The teams that may have called "s ovim dosta" on the last hand: those that reached the target with it
export function dostaCallers(hands: PlayedHand[], threshold = MATCH_THRESHOLD): Side[] {
  const last = hands[hands.length - 1];
  if (!last) return [];
  const before = matchState(hands.slice(0, -1), threshold);
  if (before.winner !== null) return [];
  const score1 = before.score1 + last.team1_game_points;
  const score2 = before.score2 + last.team2_game_points;
  return ([1, 2] as const).filter((side) => (side === 1 ? score1 : score2) >= before.target);
}

// A finished match as the ratings see it: a win for its winner, whatever the points ("s ovim dosta" can win with
// fewer). A match left without a winner by an admin's edit keeps its points.
type FinishedMatch = {player_pair1_score: number; player_pair2_score: number; winner_side: number | null};

export function ratedMatch(m: FinishedMatch): [number, number] {
  if (m.winner_side === 1) return [1, 0];
  if (m.winner_side === 2) return [0, 1];
  return [m.player_pair1_score, m.player_pair2_score];
}
