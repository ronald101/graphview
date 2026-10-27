// The seeded random number generator of "graphview-gen/1": mulberry32 (specification 8.5).
// Its output for a given seed must never change under this generator version.

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** A whole number in [0, n). */
  below(n: number): number;
  /** Shuffles in place (Fisher–Yates) and returns the list. */
  shuffle<T>(items: T[]): T[];
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const below = (n: number) => Math.floor(next() * n);
  return {
    next,
    below,
    shuffle<T>(items: T[]) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = below(i + 1);
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
  };
}
