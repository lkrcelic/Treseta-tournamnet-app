// Treseta scoring rules, shared by the hand entry (what the players see) and the API (what gets saved).
// Keep this file free of framework imports so it can be used on both sides and tested on its own.

// A hand is worth 11 points: the points typed for one team, the rest to the other team
export const HAND_POINTS = 11;
// A custom hand (one cut short by "s ovim dosta", or a correction) is typed freely for each team, up to this
// many points. "Na prolaz" has no custom hand on the players' screens: Kaput (11 : 0) takes its key, and only an
// admin's correction is custom
export const CUSTOM_HAND_MAX = 99;
// A match is over once a team has this many points and the scores differ
export const MATCH_THRESHOLD = 41;
// Teams level at or above the target play on to a target this much higher (41 → 51 → 61 …)
export const TARGET_RAISE = 10;
// A bye round: the real team wins each of its matches by this many points to 0
export const BYE_MATCH_POINTS = 5;

export type Side = 1 | 2;

// How a tournament's matches end (Kraj partije; a league plays "s ovim dosta"):
//   S_OVIM_DOSTA: a team may call "s ovim dosta" (a custom hand), and teams level at or above the target play on to a
//                 target 10 higher
//   NA_PROLAZ: no call and no raise: once a team is at the target the team with more points wins; level at or above
//              it, one more hand is played (and again while level)
export const MATCH_ENDS = ["S_OVIM_DOSTA", "NA_PROLAZ"] as const;
export type MatchEnd = (typeof MATCH_ENDS)[number];
export const DEFAULT_MATCH_END: MatchEnd = "S_OVIM_DOSTA";

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

// ---------- Zvanja ----------
// On top of a hand's points each team may have zvanja, entered one click per zvanje:
//   3: tri trice, tri dvice, tri asa, or napola (A, 2 and 3 of one suit: špade, kope, bate, dinari)
//   4: četiri trice, četiri dvice, četiri asa
// Zvanja are one player's (two partners' cards never add up to one), and a card may count in more than one zvanje
// (the trica špada in tri trice and in napola špade). A custom hand has none: its typed points are the hand's total.
export const ZVANJA_VALUES = [3, 4] as const;
export type Zvanje = (typeof ZVANJA_VALUES)[number];
// a team's zvanja on one hand, by value
export type ZvanjaCounts = Record<Zvanje, number>;
export const NO_ZVANJA: ZvanjaCounts = {3: 0, 4: 0};

export const zvanjaPoints = (c: ZvanjaCounts): number => 3 * c[3] + 4 * c[4];
export const hasZvanja = (c: ZvanjaCounts): boolean => c[3] > 0 || c[4] > 0;

// A hand's zvanja as stored (Result, OngoingResult)
export type HandZvanja = {
  team1_zvanja3: number;
  team1_zvanja4: number;
  team2_zvanja3: number;
  team2_zvanja4: number;
};

export const handZvanja = (h: HandZvanja): [ZvanjaCounts, ZvanjaCounts] => [
  {3: h.team1_zvanja3, 4: h.team1_zvanja4},
  {3: h.team2_zvanja3, 4: h.team2_zvanja4},
];

export const zvanjaColumns = (z1: ZvanjaCounts, z2: ZvanjaCounts): HandZvanja => ({
  team1_zvanja3: z1[3],
  team1_zvanja4: z1[4],
  team2_zvanja3: z2[3],
  team2_zvanja4: z2[4],
});

export const NO_HAND_ZVANJA: HandZvanja = zvanjaColumns(NO_ZVANJA, NO_ZVANJA);

// A hand's zvanja from something that may leave counts out (a request, a hand from the server): a missing count is none
export const zvanjaOf = (h: Partial<HandZvanja>): HandZvanja => ({
  team1_zvanja3: h.team1_zvanja3 ?? 0,
  team1_zvanja4: h.team1_zvanja4 ?? 0,
  team2_zvanja3: h.team2_zvanja3 ?? 0,
  team2_zvanja4: h.team2_zvanja4 ?? 0,
});

// What the cards allow. Only the 12 cards A, 2 and 3 of the four suits make zvanja, and a player holds 10 of the 40.
// Counting every deal (each of the 12 cards with one of the four players, at most 10 each; zvanjaDeals.test.ts does it
// again), a hand's zvanja [team 1's threes, fours, team 2's threes, fours] can be at most one of these. A team may
// leave a zvanje unannounced, so anything below one of them is allowed too. A team alone has at most 21 (7 × 3), and
// both teams together too: they share the 12 cards. No simpler rule says it: 1 × 4 against 4 × 3, for one, can't
// happen, although each team could have its own on another deal.
export const ZVANJA_DEALS: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 3], [0, 0, 2, 2], [0, 0, 5, 1], [0, 0, 7, 0], [0, 1, 0, 2], [0, 1, 1, 1], [0, 2, 0, 1], [0, 3, 0, 0],
  [1, 0, 1, 2], [1, 0, 2, 1], [1, 0, 6, 0], [1, 1, 0, 1], [1, 1, 2, 0], [1, 2, 1, 0], [2, 0, 1, 1], [2, 0, 3, 0],
  [2, 1, 1, 0], [2, 2, 0, 0], [3, 0, 2, 0], [5, 1, 0, 0], [6, 0, 1, 0], [7, 0, 0, 0],
];

// one team on its own: 7 threes with no four, 5 with one, 2 with two, none with three (also the database's CHECK)
const TEAM_MAX_THREES = [7, 5, 2, 0] as const;

const teamPossible = (c: ZvanjaCounts) => c[4] <= 3 && c[3] <= TEAM_MAX_THREES[c[4]];

const dealPossible = (z1: ZvanjaCounts, z2: ZvanjaCounts) =>
  ZVANJA_DEALS.some(([a3, a4, b3, b4]) => z1[3] <= a3 && z1[4] <= a4 && z2[3] <= b3 && z2[4] <= b4);

export type ZvanjaRules = {
  // a custom hand: no zvanja
  custom?: boolean;
  // false: the table is a tournament's "bez zvanja" (Round.declarations)
  declarations?: boolean;
};

// Returns a reason a hand's zvanja can't be right, or null when they are fine
export function zvanjaError(z1: ZvanjaCounts, z2: ZvanjaCounts, {custom = false, declarations = true}: ZvanjaRules = {}): string | null {
  const counts = [z1[3], z1[4], z2[3], z2[4]];
  if (counts.some((n) => !Number.isInteger(n) || n < 0)) return "Zvanja moraju biti cijeli brojevi od 0.";
  if (!hasZvanja(z1) && !hasZvanja(z2)) return null;
  if (custom) return "Ručni unos nema zvanja.";
  if (!declarations) return "Ovaj turnir se igra bez zvanja.";
  if (!teamPossible(z1) || !teamPossible(z2)) return "Ekipa ne može imati ta zvanja.";
  if (!dealPossible(z1, z2)) return "Obje ekipe ne mogu imati ta zvanja u istoj igri.";
  return null;
}

// Whether one more zvanje of `value` for `team` would still be possible (the entry disables the button otherwise)
export function canAddZvanje(z1: ZvanjaCounts, z2: ZvanjaCounts, team: Side, value: Zvanje): boolean {
  const add = (c: ZvanjaCounts) => ({...c, [value]: c[value] + 1});
  return team === 1 ? zvanjaError(add(z1), z2) === null : zvanjaError(z1, add(z2)) === null;
}

// A hand's total for each team: its points and its zvanja
export function handTotals(h: PlayedHand): [number, number] {
  const [z1, z2] = handZvanja(h);
  return [h.team1_game_points + zvanjaPoints(z1), h.team2_game_points + zvanjaPoints(z2)];
}

// A match is over once a team reaches the threshold and the two scores differ.
export function matchWinner(score1: number, score2: number, threshold: number): Side | null {
  if (score1 === score2) return null;
  if (score1 < threshold && score2 < threshold) return null;
  return score1 > score2 ? 1 : 2;
}

// A hand as the match plays it: its points and zvanja (required, so a caller that forgets to read the zvanja doesn't
// compile rather than counting the hand without them). `dosta_side` is the team that called "s ovim dosta" on it.
export type PlayedHand = HandZvanja & {
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
  // the times the match got more time (TARGET_RAISE_MINUTES each): every raise of the target, or "na prolaz" every
  // hand that left the teams level at or above it
  extensions: number;
  // "na prolaz": the teams are level at or above the target, so one more hand is played
  levelAtTarget: boolean;
};

// Plays the hands in order:
//   - "s ovim dosta": the calling team wins once it has reached the target with that hand, even with fewer points
//   - level at or above the target: the target goes up by 10, and the rules apply again ("na prolaz": it stays, and
//     the next hand decides)
//   - otherwise the first team over the target with more points wins (matchWinner)
export function matchState(hands: PlayedHand[], threshold = MATCH_THRESHOLD, end: MatchEnd = DEFAULT_MATCH_END): MatchState {
  let score1 = 0;
  let score2 = 0;
  let target = threshold;
  let calledBy: Side | null = null;
  let callError: string | null = null;
  let extensions = 0;

  for (const hand of hands) {
    const [total1, total2] = handTotals(hand);
    score1 += total1;
    score2 += total2;
    const caller = hand.dosta_side;
    if (caller === 1 || caller === 2) {
      if (end === "NA_PROLAZ") {
        callError = "Na prolaz se ne zove „s ovim dosta”.";
      } else if (calledBy !== null) {
        callError = "„S ovim dosta” može se zvati samo jednom.";
      } else if ((caller === 1 ? score1 : score2) < target) {
        callError = `Ekipa koja zove „s ovim dosta” mora s tom igrom doći do ${target}.`;
      } else {
        calledBy = caller;
      }
    }
    if (end === "NA_PROLAZ") {
      if (score1 === score2 && score1 >= target) extensions++;
      continue;
    }
    while (calledBy === null && score1 === score2 && score1 >= target) {
      target += TARGET_RAISE;
      extensions++;
    }
  }

  const winner = calledBy ?? matchWinner(score1, score2, target);
  const levelAtTarget = end === "NA_PROLAZ" && score1 === score2 && score1 >= target;
  return {score1, score2, target, winner, calledBy, callError, extensions, levelAtTarget};
}

// The teams that may have called "s ovim dosta" on the last hand: those that reached the target with it ("na prolaz":
// none)
export function dostaCallers(hands: PlayedHand[], threshold = MATCH_THRESHOLD, end: MatchEnd = DEFAULT_MATCH_END): Side[] {
  const last = hands[hands.length - 1];
  if (!last || end === "NA_PROLAZ") return [];
  const before = matchState(hands.slice(0, -1), threshold);
  if (before.winner !== null) return [];
  const [total1, total2] = handTotals(last);
  const score1 = before.score1 + total1;
  const score2 = before.score2 + total2;
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
