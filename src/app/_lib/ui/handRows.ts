// The scorepad's running view of a match's hands (Claude Design "Score pad", A6): what each team has with the hand
// counted, who won it and how far the leader is ahead after it.

// a lead this big (or bigger) fills its half of the bar under a hand
export const LEAD_BAR_FULL = 300;

export type RunningHand = {
  // both teams' totals with this hand counted
  total: [number, number];
  // the team with more points in this hand; null on a tie
  winner: 0 | 1 | null;
  // the team ahead after this hand; null when level
  leader: 0 | 1 | null;
  lead: number;
  // how much of the leader's half of the bar is filled, 0 to 100
  leadPct: number;
};

// rows in the order they were played
export function runningHands(rows: {left: number; right: number}[]): RunningHand[] {
  let sum1 = 0;
  let sum2 = 0;
  return rows.map((r) => {
    sum1 += r.left;
    sum2 += r.right;
    const diff = sum1 - sum2;
    const lead = Math.abs(diff);
    return {
      total: [sum1, sum2],
      winner: r.left > r.right ? 0 : r.right > r.left ? 1 : null,
      leader: diff > 0 ? 0 : diff < 0 ? 1 : null,
      lead,
      leadPct: (Math.min(lead, LEAD_BAR_FULL) / LEAD_BAR_FULL) * 100,
    };
  });
}
