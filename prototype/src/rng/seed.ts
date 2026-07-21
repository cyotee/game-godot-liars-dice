/** Mulberry32 seeded PRNG — pure, no Math.random for dice. */

export type Rng = () => number;

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: string): Rng {
  let a = hashSeed(seed) || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollDie(rng: Rng): number {
  return 1 + Math.floor(rng() * 6);
}

export function rollDice(count: number, rng: Rng): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(rollDie(rng));
  return out;
}

/** Derive a sub-rng for a sub-round so re-rolls differ but stay deterministic. */
export function saltSeed(seed: string, subRound: number): string {
  return `${seed}::sub:${subRound}`;
}
