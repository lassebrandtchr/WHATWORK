import { scaleLoad, scaleLoadPct } from './loads.js';
import { clamp, roundTo } from './rng.js';
import type { Rng } from './rng.js';
import type {
  Exercise, Movement, NormalizedRequest, PersonTarget, Profile, Unit,
} from './types.js';

/** Enheden skrevet ud på dansk. Gentagelser står uden enhed, som i salen. */
export function unitLabel(unit: Unit, n: number): string {
  if (unit === 'cal') return `${n} cal`;
  if (unit === 'm') return `${n} m`;
  if (unit === 'sec') return `${n} sek`;
  return `${n}`;
}

/** Enhedens fulde danske navn — bruges hvor der er plads. */
export function unitName(unit: Unit, n: number): string {
  if (unit === 'cal') return n === 1 ? 'kalorie' : 'kalorier';
  if (unit === 'm') return 'meter';
  if (unit === 'sec') return n === 1 ? 'sekund' : 'sekunder';
  return n === 1 ? 'gentagelse' : 'gentagelser';
}

/**
 * Maskinarbejde skaleres pr. profil, så alle bliver færdige nogenlunde samtidig.
 * En kalorie på en RowERG koster ikke det samme for alle kroppe — samme tal ville
 * betyde, at nogle står og venter, mens andre stadig arbejder.
 */
const MACHINE_FACTOR: Record<Profile, number> = { m: 1, x: 0.88, f: 0.78 };

function stepFor(unit: Unit, value: number): number {
  if (unit === 'cal') return 1;
  if (unit === 'm') return 25;
  if (unit === 'sec') return 5;
  return value > 20 ? 5 : value > 10 ? 2 : 1;
}

export function repsFor(ex: Exercise, req: NormalizedRequest, rnd: Rng, intensity: number): number {
  const [lo, hi] = ex.rep ?? [10, 15];
  const span = hi - lo;
  const lvlBias = clamp((req.level - 2) / 3, 0, 1);
  let v = lo + span * (0.3 + 0.5 * rnd() + 0.2 * lvlBias) * intensity;
  v = clamp(v, lo, hi);
  const step = stepFor(ex.unit, v);
  return Math.max(step, roundTo(v, step));
}

/** Én persons mål for en øvelse: antal og eventuel belastning. */
function targetFor(
  ex: Exercise,
  person: NormalizedRequest['people'][number],
  baseAmount: number,
  req: NormalizedRequest,
  pct?: number,
): PersonTarget {
  let amount = baseAmount;
  if (ex.machine && (ex.unit === 'cal' || ex.unit === 'm')) {
    const factor = MACHINE_FACTOR[person.profile] ?? 0.9;
    const step = stepFor(ex.unit, baseAmount);
    amount = Math.max(step, roundTo(baseAmount * factor, step));
  }
  const ctx = { plates: req.plates, bars: req.bars, inventory: req.inventory };
  const load = pct === undefined ? scaleLoad(ex, person, ctx) : scaleLoadPct(ex, person, pct, ctx);
  return {
    label: person.label,
    profile: person.profile,
    amount,
    unit: ex.unit,
    amountText: unitLabel(ex.unit, amount),
    load,
  };
}

export interface MovementOptions {
  reps?: number;
  intensity?: number;
  /** Procentdel af arbejdsvægten — kun på styrkedele. */
  pct?: number;
  sets?: number;
  restSec?: number;
  /** Overskriv den viste tekst, fx "5 × 5 Back Squat". */
  display?: string;
  /** Det samlede arbejde deles mellem deltagerne i stedet for at gælde per person. */
  shared?: boolean;
}

export function buildMovement(
  ex: Exercise,
  req: NormalizedRequest,
  rnd: Rng,
  opts: MovementOptions = {},
): Movement {
  const intensity = opts.intensity ?? 1;
  const reps = opts.reps ?? repsFor(ex, req, rnd, intensity);

  const targets = req.people.map((p) => targetFor(ex, p, reps, req, opts.pct));
  const first = targets[0];
  const individualTargets = targets.length > 1 && targets.some((t) => (
    t.amount !== first?.amount || (t.load?.text ?? '') !== (first?.load?.text ?? '')
  ));

  const workSec = reps * ex.sec * (opts.sets ?? 1);
  const transitionSec = ex.machine ? 10 : ex.eq.includes('barbell') ? 8 : ex.eq.includes('sled') ? 12 : 5;

  return {
    exerciseId: ex.id,
    name: ex.name,
    unit: ex.unit,
    reps,
    display: opts.display ?? `${unitLabel(ex.unit, reps)} ${ex.name}`,
    cue: ex.warmupCue ? `${ex.da} ${ex.warmupCue}` : ex.da,
    workSec,
    transitionSec,
    targets,
    individualTargets,
    ...(opts.sets === undefined ? {} : { sets: opts.sets }),
    ...(opts.restSec === undefined ? {} : { restSec: opts.restSec }),
  };
}

/** Sekunder for én runde af en liste, inkl. skiftetid. */
export const roundSeconds = (movements: Movement[]): number =>
  movements.reduce((s, m) => s + m.workSec + m.transitionSec, 0);
