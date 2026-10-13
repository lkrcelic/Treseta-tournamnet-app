// Treseta scoring rules, shared by the hand entry (what the players see) and the API (what gets saved).
// Keep this file free of framework imports so it can be used on both sides and tested on its own.

// A hand is worth 11 points: the points typed for one team, the rest to the other team
export const HAND_POINTS = 11;
// A custom hand (akuže and the like) is typed freely for each team, up to this many points
export const CUSTOM_HAND_MAX = 99;
// A match is over once a team has this many points and the scores differ
export const MATCH_THRESHOLD = 41;
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
