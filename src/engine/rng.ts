/** Deterministisk PRNG. Samme seed giver altid samme workout. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rnd: Rng, arr: readonly T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(rnd() * arr.length)];
}

export function shuffle<T>(rnd: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const ai = a[i] as T;
    a[i] = a[j] as T;
    a[j] = ai;
  }
  return a;
}

/** Vægtet valg. Øvelser med højere `weight` vælges oftere. */
export function pickWeighted<T>(rnd: Rng, arr: readonly T[], weightOf: (item: T) => number): T | undefined {
  if (!arr.length) return undefined;
  const total = arr.reduce((sum, item) => sum + Math.max(0.01, weightOf(item)), 0);
  let roll = rnd() * total;
  for (const item of arr) {
    roll -= Math.max(0.01, weightOf(item));
    if (roll <= 0) return item;
  }
  return arr[arr.length - 1];
}

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export const roundTo = (v: number, step: number): number => Math.round(v / step) * step;

export function makeSeed(): number {
  return Math.floor(Math.random() * 1e9);
}
