import {maxWeightMatching, WeightedEdge} from "./blossom";
import {BYE_TEAM_ID, isByeTeam} from "@/app/_lib/bye";

// The tables of a tournament's Kolo (Turniri · Kola). Kolo 1 is drawn at random. From Kolo 2 the teams are paired by
// the standings, as in a Swiss system: neighbours in the standings meet, no two teams meet twice while any other
// pairing avoids it, and with an odd number of teams the lowest team that hasn't had a bye yet gets Slobodna runda.
// The league's windows aren't used: inside a window they pair by earlier meetings and age only, so 1st could meet 8th.
// Framework free so it can be unit tested.

// team1, team2; the bye (BYE_TEAM_ID) is always the second
export type KoloPair = [number, number];

// Kolo 1: the teams in a random order, the first with the second, the third with the fourth…; with an odd number the
// last one drawn gets the bye. random: a number in [0, 1), Math.random unless a test fixes it
export function firstKoloPairs(teamIds: number[], random: () => number = Math.random): KoloPair[] {
  const order = [...teamIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const pairs: KoloPair[] = [];
  for (let i = 0; i + 1 < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  if (order.length % 2 === 1) pairs.push([order[order.length - 1], BYE_TEAM_ID]);
  return pairs;
}

export type SwissTeam = {
  id: number;
  points: number;
  difference: number;
  // every opponent so far, once per meeting; BYE_TEAM_ID once per bye
  opponents: number[];
};

export type SwissPlan = {
  // in standings order (table 1 is the top pair), the better team first, the bye last
  pairs: KoloPair[];
  // pairs that meet again because no other pairing was possible
  repeats: KoloPair[];
};

// What the pairing of n teams weighs, each far above everything after it, so no amount of a later one buys an
// earlier one: an earlier meeting (or a second bye; two earlier meetings cost four times as much), then the bye going
// to a team above the lowest one that can take it (per place), then the gaps between the places of the teams that
// meet. A repeat is made only when nothing else is possible, and the lowest team without a bye gets it even when
// that keeps the leaders apart, as in the Swiss rules.
function weights(n: number) {
  // more than every pair's gap² together
  const byePlace = n * (n - 1) ** 2 + 1;
  // more than the bye at the top of the table plus every gap
  const repeat = byePlace * n + 1;
  return {byePlace, repeat};
}

// The next Kolo by the standings. standings: the teams in standings order (points, then difference, then the table's
// own tie-break); they are sorted again only by points and difference, keeping that order for ties.
export function swissPairs(standings: SwissTeam[]): SwissPlan {
  const teams = [...standings].sort((a, b) => b.points - a.points || b.difference - a.difference);
  const n = teams.length;
  if (n === 0) return {pairs: [], repeats: []};
  if (n === 1) return {pairs: [[teams[0].id, BYE_TEAM_ID]], repeats: teams[0].opponents.some(isByeTeam) ? [[teams[0].id, BYE_TEAM_ID]] : []};

  const meetings = (a: number, b: number) => teams[a].opponents.filter((o) => o === teams[b].id).length;
  const byes = (a: number) => teams[a].opponents.filter(isByeTeam).length;
  // vertex n is the bye when the number of teams is odd
  const odd = n % 2 === 1;
  const {byePlace, repeat} = weights(n);
  const cost = (a: number, b: number) =>
    b === n
      ? byes(a) ** 2 * repeat + (n - 1 - a) * byePlace // the lowest team that hasn't had one takes the bye
      : meetings(a, b) ** 2 * repeat + (a - b) ** 2; // neighbours in the standings are the cheapest pair
  const vertices = odd ? n + 1 : n;
  const costs: [number, number, number][] = [];
  for (let a = 0; a < vertices; a++) {
    for (let b = a + 1; b < vertices; b++) costs.push([a, b, cost(a, b)]);
  }
  const top = Math.max(...costs.map((c) => c[2])) + 1;
  const edges: WeightedEdge[] = costs.map(([a, b, c]) => [a, b, top - c]);
  const mate = maxWeightMatching(edges, true);

  const pairs: KoloPair[] = [];
  const repeats: KoloPair[] = [];
  let bye: KoloPair | null = null;
  for (let a = 0; a < n; a++) {
    const b = mate[a];
    if (b === n) {
      bye = [teams[a].id, BYE_TEAM_ID];
      if (byes(a) > 0) repeats.push(bye);
    } else if (b > a) {
      pairs.push([teams[a].id, teams[b].id]);
      if (meetings(a, b) > 0) repeats.push([teams[a].id, teams[b].id]);
    }
  }
  if (bye) pairs.push(bye);
  return {pairs, repeats};
}
