import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {maxWeightMatching, WeightedEdge} from "./blossom";

export interface Team {
  readonly id: number;
  readonly name: string;
  readonly point_difference: number;
  readonly score: number;
  played_against: number[]; // ids of teams already played against (the bye counts too)!
}

export interface TeamPair {
  teamOne: Team;
  teamTwo: Team;
}

export interface MultiRoundMatchingOptions {
  windowSize: number;
  numberOfRounds: number;
  // pairs that already meet in today's earlier rounds; they shouldn't meet again today
  playedToday?: ReadonlyArray<readonly [number, number]>;
  // how long the search for a night without repeat matchups may run
  timeBudgetMs?: number;
}

export interface RoundsPlan {
  rounds: TeamPair[][];
  // pairs that meet more than once today; empty unless the night can't be made without it
  repeats: TeamPair[];
}

const DEFAULT_TIME_BUDGET_MS = 5000;
// the smallest last window: never under 6 teams, half a window, or one team more than there are rounds
const MIN_LAST_WINDOW = 6;
// the most improvement passes over a window's rounds (each pass re-solves every round)
const MAX_PASSES = 20;

function createByeTeam(): Team {
  return {id: BYE_TEAM_ID, name: "Bye", score: 0, point_difference: 0, played_against: []};
}

const byRank = (a: Team, b: Team) => (a.score === b.score ? b.point_difference - a.point_difference : b.score - a.score);

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function minLastWindow(windowSize: number, numberOfRounds: number): number {
  return Math.max(numberOfRounds + 1, windowSize / 2, MIN_LAST_WINDOW);
}

/**
 * Splits the teams, best first, into windows of windowSize. A last window smaller than minLastWindow joins the one
 * before it.
 */
function divideTeamsIntoWindows(sortedTeams: Team[], windowSize: number, numberOfRounds: number): Team[][] {
  const windows: Team[][] = [];
  for (let i = 0; i < sortedTeams.length; i += windowSize) {
    windows.push(sortedTeams.slice(i, i + windowSize));
  }
  if (windows.length > 1 && windows[windows.length - 1].length < minLastWindow(windowSize, numberOfRounds)) {
    const last = windows.pop()!;
    windows[windows.length - 1] = [...windows[windows.length - 1], ...last];
  }
  return windows;
}

function countMatchups(teamA: Team, teamB: Team): number {
  let count = 0;
  for (const id of teamA.played_against) {
    if (id === teamB.id) count++;
  }
  return count;
}

// A window's rounds as index pairs into the window's teams. The bye, when the window has an odd count, has index n.
type IndexRound = [number, number][];

class WindowPlanner {
  private readonly n: number;
  private readonly bye: number;
  // the price of a pair: earlier meetings squared, so one pair meeting a third time costs more than two meeting twice
  private readonly cost: number[][];
  // a pair that meets twice today costs more than any round without one
  private readonly repeatCost: number;
  private readonly today: boolean[][];
  // byeOf[r]: the team (index) that gets the bye in round r, or -1
  readonly byeOf: number[];
  // byeRepeat[r]: round r's bye goes to a team that already had one today
  private readonly byeRepeat: boolean[] = [];

  constructor(
    private readonly teams: Team[],
    private readonly rounds: number,
    playedToday: Set<string>,
    private readonly deadline: number
  ) {
    const n = teams.length;
    this.n = n;
    this.bye = n % 2 === 1 ? n : -1;
    this.cost = teams.map((a) => teams.map((b) => (a === b ? 0 : countMatchups(a, b) ** 2)));
    const maxCost = Math.max(0, ...this.cost.flat());
    this.repeatCost = (maxCost + 1) * Math.ceil(n / 2) + 1;
    this.today = teams.map((a) => teams.map((b) => a !== b && playedToday.has(pairKey(a.id, b.id))));
    this.byeOf = this.assignByes(playedToday);
  }

  // Round by round, the bye goes to a team that hasn't had one today: the one with the fewest byes this season, the
  // lowest-ranked of them. Only when every team already had today's bye does a team get it twice.
  private assignByes(playedToday: Set<string>): number[] {
    if (this.bye < 0) return new Array(this.rounds).fill(-1);
    const byes = this.teams.map((t) => countMatchups(t, createByeTeam()));
    const today = this.teams.map((t) => (playedToday.has(pairKey(t.id, BYE_TEAM_ID)) ? 1 : 0));
    const result: number[] = [];
    for (let r = 0; r < this.rounds; r++) {
      let pick = this.n - 1;
      for (let i = this.n - 2; i >= 0; i--) {
        if (today[i] < today[pick] || (today[i] === today[pick] && byes[i] < byes[pick])) pick = i;
      }
      // a team that already had today's bye gets it again: mark it like a repeat
      this.byeRepeat.push(today[pick] > 0);
      today[pick]++;
      byes[pick]++;
      result.push(pick);
    }
    return result;
  }

  plan(): {rounds: IndexRound[]; repeats: [number, number][]} {
    const plan: IndexRound[] = [];
    const used = new PairCounter();
    for (let r = 0; r < this.rounds; r++) {
      const round = this.solveRound(r, used);
      plan.push(round);
      used.add(round);
    }
    this.improve(plan, used, true);

    if (this.repeatsOf(plan).length > 0) {
      const found = this.searchWithoutRepeats();
      if (found) {
        const foundUsed = new PairCounter();
        found.forEach((round) => foundUsed.add(round));
        this.improve(found, foundUsed, false);
        return {rounds: found, repeats: this.repeatsOf(found)};
      }
    }
    return {rounds: plan, repeats: this.repeatsOf(plan)};
  }

  // Re-solves one round at a time with the others fixed, as long as that lowers the night's cost
  private improve(plan: IndexRound[], used: PairCounter, respectDeadline: boolean) {
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let improved = false;
      for (let r = 0; r < plan.length; r++) {
        if (respectDeadline && Date.now() > this.deadline) return;
        used.remove(plan[r]);
        const candidate = this.solveRound(r, used);
        if (this.roundCost(candidate, used) < this.roundCost(plan[r], used)) {
          plan[r] = candidate;
          improved = true;
        }
        used.add(plan[r]);
      }
      if (!improved) return;
    }
  }

  private pairCost(i: number, j: number, used: PairCounter): number {
    return this.cost[i][j] + (this.today[i][j] || used.has(i, j) ? this.repeatCost : 0);
  }

  private roundCost(round: IndexRound, used: PairCounter): number {
    return round.reduce((sum, [i, j]) => sum + (j === this.bye ? 0 : this.pairCost(i, j, used)), 0);
  }

  // The cheapest pairing of round r's teams (everyone except its bye team), out of all possible pairings
  private solveRound(r: number, used: PairCounter): IndexRound {
    const playing = Array.from({length: this.n}, (_, i) => i).filter((i) => i !== this.byeOf[r]);
    const costs: number[][] = playing.map((i) => playing.map((j) => (i === j ? 0 : this.pairCost(i, j, used))));
    const top = Math.max(0, ...costs.flat()) + 1;
    const edges: WeightedEdge[] = [];
    for (let a = 0; a < playing.length; a++) {
      for (let b = a + 1; b < playing.length; b++) edges.push([a, b, top - costs[a][b]]);
    }
    const mate = maxWeightMatching(edges, true);
    const round: IndexRound = [];
    for (let a = 0; a < playing.length; a++) {
      if (mate[a] > a) round.push([playing[a], playing[mate[a]]]);
    }
    if (this.byeOf[r] >= 0) round.push([this.byeOf[r], this.bye]);
    return round;
  }

  // Pairs that meet twice today: with an earlier round today, or in two of these rounds
  private repeatsOf(plan: IndexRound[]): [number, number][] {
    const seen = new PairCounter();
    const repeats: [number, number][] = [];
    plan.forEach((round, r) => {
      for (const [i, j] of round) {
        const twice = j === this.bye ? this.byeRepeat[r] : this.today[i][j] || seen.has(i, j);
        if (twice && !repeats.some(([a, b]) => pairKey(a, b) === pairKey(i, j))) repeats.push([i, j]);
      }
      seen.add(round.filter(([, j]) => j !== this.bye));
    });
    return repeats;
  }

  // Backtracking search for rounds without any repeat matchup, cheapest partners first. Used when the round by round
  // pairing paints itself into a corner; gives up at the deadline.
  private searchWithoutRepeats(): IndexRound[] | null {
    const used = new PairCounter();
    const rounds: IndexRound[] = [];
    let steps = 0;
    let timedOut = false;
    const free = (i: number, j: number) => !this.today[i][j] && !used.has(i, j);

    const fillRound = (r: number, open: number[], round: IndexRound): boolean => {
      if (++steps % 1000 === 0 && Date.now() > this.deadline) timedOut = true;
      if (timedOut) return false;
      if (open.length === 0) {
        const done: IndexRound = this.byeOf[r] >= 0 ? [...round, [this.byeOf[r], this.bye]] : [...round];
        rounds.push(done);
        used.add(round);
        if (r + 1 === this.rounds || fillRound(r + 1, this.playingIn(r + 1), [])) return true;
        used.remove(round);
        rounds.pop();
        return false;
      }
      const [i, ...rest] = open;
      // every team still to seat needs at least one partner left
      if (rest.some((a) => !open.some((b) => b !== a && free(a, b)))) return false;
      const partners = rest.filter((j) => free(i, j)).sort((a, b) => this.cost[i][a] - this.cost[i][b] || a - b);
      for (const j of partners) {
        if (fillRound(r, rest.filter((k) => k !== j), [...round, [i, j]])) return true;
        if (timedOut) return false;
      }
      return false;
    };

    return fillRound(0, this.playingIn(0), []) ? rounds : null;
  }

  private playingIn(r: number): number[] {
    return Array.from({length: this.n}, (_, i) => i).filter((i) => i !== this.byeOf[r]);
  }
}

class PairCounter {
  private readonly counts = new Map<string, number>();

  add(round: IndexRound) {
    for (const [i, j] of round) this.counts.set(pairKey(i, j), (this.counts.get(pairKey(i, j)) ?? 0) + 1);
  }

  remove(round: IndexRound) {
    for (const [i, j] of round) {
      const left = (this.counts.get(pairKey(i, j)) ?? 0) - 1;
      if (left > 0) this.counts.set(pairKey(i, j), left);
      else this.counts.delete(pairKey(i, j));
    }
  }

  has(i: number, j: number): boolean {
    return this.counts.has(pairKey(i, j));
  }
}

/**
 * Pairs the teams for numberOfRounds rounds. Teams are ranked and split into windows; inside a window every round
 * is the pairing with the fewest earlier meetings (squared), and no two teams meet twice today. If that can't be
 * done, the plan still comes back, with the pairs that meet twice in repeats.
 */
export function generateMultipleRoundPairings(teams: Team[], options: MultiRoundMatchingOptions): RoundsPlan {
  const {windowSize, numberOfRounds} = options;

  if (windowSize % 2 === 1) {
    throw new Error("Invalid arguments, window size must be even!");
  }
  if (numberOfRounds >= windowSize) {
    throw new Error("Invalid arguments, number of rounds can't be bigger or equal than window size!");
  }
  if (numberOfRounds >= teams.length) {
    throw new Error("Invalid arguments, number of rounds can't be bigger than number of teams!");
  }

  const deadline = Date.now() + (options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
  const playedToday = new Set((options.playedToday ?? []).map(([a, b]) => pairKey(a, b)));
  const windows = divideTeamsIntoWindows([...teams].sort(byRank), windowSize, numberOfRounds);
  const bye = createByeTeam();

  const rounds: TeamPair[][] = Array.from({length: numberOfRounds}, () => []);
  const byePairs: (TeamPair | null)[] = new Array(numberOfRounds).fill(null);
  const repeats: TeamPair[] = [];

  for (const window of windows) {
    const planned = new WindowPlanner(window, numberOfRounds, playedToday, deadline).plan();
    const team = (i: number) => (i < window.length ? window[i] : bye);
    planned.rounds.forEach((round, r) => {
      // tables go top-ranked first; the bye goes after every real table
      const ordered = round
        .map(([i, j]) => (i < j ? [i, j] : [j, i]))
        .sort((a, b) => a[0] - b[0]);
      for (const [i, j] of ordered) {
        const pair = {teamOne: team(i), teamTwo: team(j)};
        if (j === window.length) byePairs[r] = pair;
        else rounds[r].push(pair);
      }
    });
    repeats.push(...planned.repeats.map(([i, j]) => ({teamOne: team(Math.min(i, j)), teamTwo: team(Math.max(i, j))})));
  }

  byePairs.forEach((pair, r) => pair && rounds[r].push(pair));
  return {rounds, repeats};
}

/**
 * Legacy function for backward compatibility
 * Matches teams for a single round
 */
export function matchTeams(teams: Team[]): TeamPair[] {
  // Use the new system with default values
  // The window size has to be even (24-31 teams used to give 3 and fail), so an odd size is rounded up
  const windowSize = Math.max(Math.floor(teams.length / 8), 2);
  const options: MultiRoundMatchingOptions = {
    windowSize: windowSize % 2 === 0 ? windowSize : windowSize + 1,
    numberOfRounds: 1,
  };

  return generateMultipleRoundPairings(teams, options).rounds[0] ?? [];
}
