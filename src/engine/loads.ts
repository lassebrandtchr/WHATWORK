import { DEFAULT_BARS, DEFAULT_PLATES, DEFAULT_SANDBAGS } from './data/equipment.js';
import { MIN_LOADS } from './data/exercises.js';
import { clamp, roundTo } from './rng.js';
import type { Exercise, LoadKind, LoadPrescription, PlatePlan, Person, Profile } from './types.js';

/** Referencekropsvægt pr. skaleringsprofil. */
export const REF_BW: Record<Profile, number> = { m: 88, f: 66, x: 77 };

/** Niveauets andel af referencebelastningen. Niveau 4 er referencen. */
export const LEVEL_MULT: Record<number, number> = { 1: 0.62, 2: 0.78, 3: 0.9, 4: 1.0, 5: 1.1 };

/** Kilo i dansk notation: "22,5 kg". To decimaler, så 1,25 kg-skiver skrives rigtigt. */
export const fmtKg = (v: number): string =>
  `${String(Math.round(v * 100) / 100).replace('.', ',')} kg`;

/** Faktiske kettlebell-størrelser i en almindelig sal. */
const KETTLEBELLS = [8, 10, 12, 16, 20, 24, 28, 32, 36, 40];
/** Wall balls findes i faste vægte. */
const WALLBALLS = [4, 6, 9, 10, 12];

function snapToList(value: number, list: number[], floor: number): number {
  const allowed = list.filter((v) => v >= floor - 0.001);
  const pool = allowed.length ? allowed : list;
  return pool.reduce((best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best), pool[0] as number);
}

/**
 * Lægger skiver på stangen med det udstyr, brugeren faktisk har valgt.
 *
 * Skiverne lægges grådigt fra den tungeste og ned. Kan vægten ikke rammes præcist,
 * markeres planen som omtrentlig, og den viste samlede vægt er den, stangen rent
 * faktisk kommer til at veje — ikke den beregnede.
 */
export function planPlates(targetKg: number, plates: number[] = DEFAULT_PLATES, bars: number[] = DEFAULT_BARS): PlatePlan {
  const barPool = (bars.length ? bars : DEFAULT_BARS).slice().sort((a, b) => b - a);
  const platePool = (plates.length ? plates : DEFAULT_PLATES).slice().sort((a, b) => b - a);
  const bar = barPool.find((b) => b <= targetKg) ?? (barPool[barPool.length - 1] as number);

  if (targetKg <= bar + 0.001) {
    return {
      bar, perSide: [], perSideKg: 0,
      text: `${fmtKg(bar)} stang uden skiver`,
      approximate: Math.abs(targetKg - bar) > 0.01,
    };
  }

  let remaining = (targetKg - bar) / 2;
  const perSide: number[] = [];
  // Maks. otte skiver pr. side — flere er hverken realistisk eller læsbart.
  while (perSide.length < 8) {
    const next = platePool.find((p) => p <= remaining + 0.001);
    if (next === undefined) break;
    perSide.push(next);
    remaining -= next;
  }

  // Grådig påfyldning rammer altid på eller under målet. Kan én skive mere komme
  // strengt tættere på, tages den med — ellers bliver den under, hvilket er den
  // sikre side at ramme forkert på.
  const smallest = platePool[platePool.length - 1] as number;
  const asIs = perSide.reduce((a, b) => a + b, 0);
  if (Math.abs(bar + (asIs + smallest) * 2 - targetKg) < Math.abs(bar + asIs * 2 - targetKg)) {
    perSide.push(smallest);
  }

  const perSideKg = perSide.reduce((a, b) => a + b, 0);
  const actual = bar + perSideKg * 2;
  const sideText = perSide.length
    ? `${fmtKg(bar)} stang + ${fmtKg(perSideKg)} på hver side`
      + (perSide.length > 1 ? `, fx ${perSide.map((p) => fmtKg(p)).join(' + ')}` : '')
    : `${fmtKg(bar)} stang uden skiver`;

  return {
    bar, perSide, perSideKg,
    text: sideText,
    approximate: Math.abs(actual - targetKg) > 0.01,
  };
}

export interface LoadContext {
  plates?: number[];
  bars?: number[];
  sandbags?: number[];
  inventory?: Record<string, number>;
}

function kindOf(ex: Exercise): LoadKind {
  if (ex.eq.includes('barbell')) return 'barbell';
  if (ex.eq.includes('sled')) return 'sled';
  if (ex.eq.includes('wallball')) return 'ball';
  if (ex.eq.includes('sandbag')) return 'bag';
  return ex.pair ? 'pair' : 'single';
}

/** Snapper en rå kilovægt til det udstyr, der faktisk står i salen. */
function prescribe(ex: Exercise, kind: LoadKind, perUnit: number, floor: number, ctx: LoadContext): LoadPrescription {
  switch (kind) {
    case 'barbell': {
      // Programmeringsvægte skrives i hele 5 kg. Det holder skiverne pr. side på
      // rigtige størrelser i stedet for 1,25 kg-fnidder på hver ende af stangen.
      const target = Math.max(floor, roundTo(Math.max(perUnit, floor), 5));
      const plan = planPlates(target, ctx.plates, ctx.bars);
      const total = plan.bar + plan.perSideKg * 2;
      return {
        totalKg: total, eachKg: total, kind, plates: plan,
        text: `${fmtKg(total)} i alt — ${plan.text}`,
      };
    }
    case 'ball': {
      const kg = snapToList(perUnit, WALLBALLS, floor);
      return { totalKg: kg, eachKg: kg, kind, text: fmtKg(kg) };
    }
    case 'bag': {
      const list = ctx.sandbags?.length ? ctx.sandbags : DEFAULT_SANDBAGS;
      const kg = snapToList(perUnit, list, floor);
      return { totalKg: kg, eachKg: kg, kind, text: fmtKg(kg) };
    }
    case 'sled': {
      const kg = Math.max(floor, clamp(roundTo(perUnit, 5), 20, 220));
      return { totalKg: kg, eachKg: kg, kind, text: `${fmtKg(kg)} på slæden` };
    }
    case 'pair': {
      const kg = ex.eq.includes('kettlebell')
        ? snapToList(perUnit, KETTLEBELLS, floor)
        : Math.max(floor, clamp(roundTo(perUnit, 2.5), 5, 50));
      return { totalKg: kg * 2, eachKg: kg, kind, text: `2 × ${fmtKg(kg)}` };
    }
    default: {
      const kg = ex.eq.includes('kettlebell')
        ? snapToList(perUnit, KETTLEBELLS, floor)
        : Math.max(floor, clamp(roundTo(perUnit, 2.5), 5, 60));
      return { totalKg: kg, eachKg: kg, kind, text: fmtKg(kg) };
    }
  }
}

/** Den rå, usnappede kilovægt pr. redskab før udstyrets trin lægges på. */
function rawPerUnit(ex: Exercise, person: Person): { perUnit: number; kind: LoadKind; floor: number } {
  const prof: Profile = person.profile === 'f' ? 'f' : person.profile === 'm' ? 'm' : 'x';
  const load = ex.load as { m: number; f: number };
  const base = prof === 'f' ? load.f : prof === 'm' ? load.m : (load.m + load.f) / 2;
  const bwRatio = clamp((person.bodyweight || REF_BW[prof]) / REF_BW[prof], 0.72, 1.3);
  const mult = LEVEL_MULT[person.level] ?? 0.9;

  const kind = kindOf(ex);
  const units = kind === 'pair' ? 2 : 1;

  // Minimumsforslag gælder fra "let øvet" og op. Begyndere må gerne ligge lavere.
  const floorSpec = MIN_LOADS[ex.id];
  const floor = floorSpec && person.level >= 2 ? floorSpec[prof] : 0;

  return { perUnit: (base * bwRatio * mult) / units, kind, floor };
}

/**
 * Belastning for én person til én øvelse.
 *
 * Rækkefølgen er bevidst: skalér efter profil, kropsvægt og niveau → læg
 * minimumsforslaget på som gulv for trænede → snap til det udstyr, der findes.
 * Gulvet er et programmeringsforslag, ikke et præstationskrav.
 */
export function scaleLoad(ex: Exercise, person: Person, ctx: LoadContext = {}): LoadPrescription | null {
  if (!ex.load) return null;
  const { perUnit, kind, floor } = rawPerUnit(ex, person);
  return prescribe(ex, kind, Math.max(perUnit, floor), floor, ctx);
}

/**
 * Samme belastning ved en procentdel af arbejdsvægten — bruges på styrkedele,
 * hvor 5 × 5 køres lettere end et maksimalt sæt. Minimumsgulvet gælder ikke her:
 * en procentsats under 100 er netop meningen med et arbejdssæt.
 */
export function scaleLoadPct(
  ex: Exercise, person: Person, pct: number, ctx: LoadContext = {},
): LoadPrescription | null {
  if (!ex.load) return null;
  const { perUnit, kind, floor } = rawPerUnit(ex, person);
  return prescribe(ex, kind, Math.max(perUnit, floor) * pct, 0, ctx);
}

/** Faste lister, ét trin op/ned skal bevæge sig til nabo-værdien i, i stedet for at
 * lægge et fast antal kilo til og risikere at snappe tilbage til samme værdi. */
function listFor(ex: Exercise, kind: LoadKind, ctx: LoadContext): number[] | null {
  if (kind === 'ball') return WALLBALLS;
  if (kind === 'bag') return ctx.sandbags?.length ? ctx.sandbags : DEFAULT_SANDBAGS;
  if ((kind === 'pair' || kind === 'single') && ex.eq.includes('kettlebell')) return KETTLEBELLS;
  return null;
}

/**
 * Ét trin op eller ned fra `currentEachKg` — til "juster vægten"-knapperne i UI'et.
 * Genbruger `prescribe` til selve formateringen, så teksten altid matcher det, motoren
 * ville have skrevet ved generering.
 */
export function stepLoad(
  ex: Exercise, kind: LoadKind, currentEachKg: number, direction: 1 | -1, ctx: LoadContext = {},
): LoadPrescription {
  const list = listFor(ex, kind, ctx);
  let nextEach: number;
  if (list) {
    const sorted = [...list].sort((a, b) => a - b);
    let idx = 0;
    sorted.forEach((v, i) => {
      if (Math.abs(v - currentEachKg) < Math.abs((sorted[idx] as number) - currentEachKg)) idx = i;
    });
    nextEach = sorted[clamp(idx + direction, 0, sorted.length - 1)] as number;
  } else {
    const step = kind === 'barbell' || kind === 'sled' ? 5 : 2.5;
    const floor = kind === 'barbell' ? 0 : kind === 'sled' ? 20 : 1;
    nextEach = Math.max(floor, roundTo(currentEachKg + direction * step, step));
  }
  return prescribe(ex, kind, nextEach, 0, ctx);
}
