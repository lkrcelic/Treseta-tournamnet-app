// Glicko-2 (Mark Glickman, "Example of the Glicko-2 system", 2012) for teams of two.
//
// A rating period is one league night. Every match a team plays that night is a game. A team plays as one
// opponent: the average rating of its players and their combined RD. Each player is then updated from the team's
// games with their own RD and volatility, so a new player (high RD) moves a lot and a settled one little. A player
// who skips a night only gets less certain (RD grows), up to the starting RD.
// Framework free, so it can be unit tested.

export const MU0 = 1500; // starting rating
export const PHI0 = 350; // starting RD, also the most uncertain a rating gets
export const SIGMA0 = 0.06; // starting volatility
// how much the volatility may change per period; 0.3-1.2 per Glickman, lower is steadier
export const TAU = 0.5;
// a rating with fewer rated rounds than this is still settling ("Privremeno")
export const PROVISIONAL_ROUNDS = 8;

const SCALE = 173.7178;
const EPSILON = 0.000001;

export type PlayerRating = {rating: number; rd: number; vol: number};

// One match: the players of each team and team A's result (1 win, 0.5 draw, 0 loss)
export type Game = {teamA: number[]; teamB: number[]; scoreA: number};

export const initialRating = (): PlayerRating => ({rating: MU0, rd: PHI0, vol: SIGMA0});

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muOpp: number, phiOpp: number) => 1 / (1 + Math.exp(-g(phiOpp) * (mu - muOpp)));

// The new volatility (step 5 of the paper, the Illinois algorithm)
function newVolatility(phi: number, sigma: number, v: number, delta: number, tau = TAU): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

type Internal = {mu: number; phi: number; sigma: number};
const toInternal = (r: PlayerRating): Internal => ({mu: (r.rating - MU0) / SCALE, phi: r.rd / SCALE, sigma: r.vol});
const fromInternal = (r: Internal): PlayerRating => ({rating: r.mu * SCALE + MU0, rd: r.phi * SCALE, vol: r.sigma});

// a team as one opponent: the players' average rating, and their RDs combined as the root mean square
function team(ids: number[], before: Map<number, Internal>): {mu: number; phi: number} {
  const players = ids.map((id) => before.get(id)!);
  const mu = players.reduce((s, p) => s + p.mu, 0) / players.length;
  const phi = Math.sqrt(players.reduce((s, p) => s + p.phi * p.phi, 0) / players.length);
  return {mu, phi};
}

/**
 * One rating period (a league night). ratings holds every known player and is not changed; the result holds
 * everyone's rating after the night: players who played are updated from their games, the others only get a
 * larger RD (capped at the starting RD). Players in games who aren't in ratings start at the defaults.
 */
export function ratePeriod(ratings: ReadonlyMap<number, PlayerRating>, games: Game[]): Map<number, PlayerRating> {
  const before = new Map<number, Internal>();
  ratings.forEach((r, id) => before.set(id, toInternal(r)));
  for (const {teamA, teamB} of games) {
    for (const id of [...teamA, ...teamB]) if (!before.has(id)) before.set(id, toInternal(initialRating()));
  }

  // per player: Σ g²E(1−E) and Σ g(s−E) over their team's games
  const sums = new Map<number, {vInv: number; d: number}>();
  const add = (ids: number[], own: {mu: number}, opp: {mu: number; phi: number}, s: number) => {
    const gOpp = g(opp.phi);
    const E = expected(own.mu, opp.mu, opp.phi);
    for (const id of ids) {
      const acc = sums.get(id) ?? {vInv: 0, d: 0};
      acc.vInv += gOpp * gOpp * E * (1 - E);
      acc.d += gOpp * (s - E);
      sums.set(id, acc);
    }
  };
  for (const {teamA, teamB, scoreA} of games) {
    if (teamA.length === 0 || teamB.length === 0) continue;
    const a = team(teamA, before);
    const b = team(teamB, before);
    add(teamA, a, b, scoreA);
    add(teamB, b, a, 1 - scoreA);
  }

  const after = new Map<number, PlayerRating>();
  const maxPhi = PHI0 / SCALE;
  before.forEach((p, id) => {
    const acc = sums.get(id);
    if (!acc || acc.vInv === 0) {
      after.set(id, fromInternal({...p, phi: Math.min(maxPhi, Math.sqrt(p.phi * p.phi + p.sigma * p.sigma))}));
      return;
    }
    const v = 1 / acc.vInv;
    const sigma = newVolatility(p.phi, p.sigma, v, v * acc.d);
    const phiStar = Math.min(maxPhi, Math.sqrt(p.phi * p.phi + sigma * sigma));
    const phi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
    after.set(id, fromInternal({mu: p.mu + phi * phi * acc.d, phi, sigma}));
  });
  return after;
}
