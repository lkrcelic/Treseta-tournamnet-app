// A seeded random generator: the same E2E_SEED gives the same world every time, so a failure can be replayed.
// mulberry32: small, fast and good enough for test data (not for anything secret).

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  shuffle<T>(items: readonly T[]): T[];
  sample<T>(items: readonly T[], n: number): T[];
  fork(label: string): Rng;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const rng: Rng = {
    next,
    // an integer from min to max, both included
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(probability: number): boolean {
      return next() < probability;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("pick from an empty list");
      return items[Math.floor(next() * items.length)];
    },
    // picks by weight: [[value, weight], ...]
    weighted<T>(entries: readonly (readonly [T, number])[]): T {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll < 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    // n distinct items
    sample<T>(items: readonly T[], n: number): T[] {
      return rng.shuffle(items).slice(0, n);
    },
    // a child generator, so adding a scenario doesn't shift the random numbers of the ones after it
    fork(label: string): Rng {
      let hash = state ^ 0x9e3779b9;
      for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 0x01000193);
      return createRng(hash >>> 0);
    },
  };
  return rng;
}
