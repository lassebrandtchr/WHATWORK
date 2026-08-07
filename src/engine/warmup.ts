import { BY_ID, EXERCISES } from './data/exercises.js';
import { buildMovement, unitLabel } from './movements.js';
import { clamp, shuffle } from './rng.js';
import type { Rng } from './rng.js';
import type {
  Block, Exercise, Movement, MovementPattern, NormalizedRequest,
} from './types.js';

/** Opvarmningen holdes altid i dette spænd, uanset hvor lang resten af sessionen er. */
export const WARMUP_MIN_MINUTES = 10;
export const WARMUP_MAX_MINUTES = 12;

const WARMUP_POOL = EXERCISES.filter((e) => e.cat === 'warmup');
const COOLDOWN_POOL = EXERCISES.filter((e) => e.cat === 'mobility');

/** Pulsgivere — opvarmningen starter altid med én af dem, og de skiftes ud. */
const PULSE_RAISERS = ['wu_easy_', 'wu_box_step', 'wu_sled_light', 'wu_bear_crawl'];

/**
 * Complexes med redskab dækker de samme mønstre. Der kommer højst én med, ellers
 * bliver opvarmningen tre varianter af det samme løft med tre forskellige redskaber.
 */
const COMPLEX_GROUP = ['wu_db_complex', 'wu_empty_bar', 'wu_plate_gtoh', 'wu_kb_flow'];
const isComplex = (id: string): boolean => COMPLEX_GROUP.includes(id);

function usable(ex: Exercise, req: NormalizedRequest): boolean {
  if (req.excluded.includes(ex.id)) return false;
  if (!ex.eq.every((e) => e === 'bodyweight' || (req.inventory[e] ?? 0) > 0)) return false;
  if (ex.avoid.some((a) => req.care.includes(a))) return false;
  return true;
}

/** Hvilke bevægelsesmønstre hoveddelen faktisk indeholder. */
export function patternsOfBlocks(blocks: Block[]): MovementPattern[] {
  const out = new Set<MovementPattern>();
  blocks
    .filter((b) => b.kind === 'conditioning' || b.kind === 'strength')
    .forEach((b) => b.movements.forEach((m) => {
      const ex = BY_ID[m.exerciseId];
      if (ex) out.add(ex.cat);
    }));
  return [...out];
}

/** Groft opdelt kropsdækning, så opvarmningen aldrig kun rammer ét hjørne. */
type Region = 'lower' | 'upper' | 'trunk';
const REGION_OF: Record<MovementPattern, Region> = {
  squat: 'lower', hinge: 'lower', cardio: 'lower', carry: 'trunk',
  press: 'upper', pull: 'upper', oly: 'upper',
  fullbody: 'trunk', core: 'trunk', warmup: 'trunk', mobility: 'trunk',
};

function regionsOf(ex: Exercise): Region[] {
  return [...new Set((ex.primes ?? []).map((p) => REGION_OF[p]))];
}

/**
 * Bygger opvarmningen ud fra den hoveddel, der allerede er valgt.
 *
 * Opvarmningen spejler hoveddelens bevægelsesmønstre, dækker hele kroppen og bygger
 * pulsen op mod RPE 5–6. Den er bevidst kort: den skal give sved på panden, ikke
 * bruge det, hoveddelen har brug for.
 */
export function buildWarmup(
  req: NormalizedRequest,
  rnd: Rng,
  minutes: number,
  mainBlocks: Block[],
): Block {
  const min = clamp(Math.round(minutes), WARMUP_MIN_MINUTES, WARMUP_MAX_MINUTES);
  const patterns = patternsOfBlocks(mainBlocks);

  const available = WARMUP_POOL.filter((e) => usable(e, req));

  const overlap = (e: Exercise): number =>
    (e.primes ?? []).filter((p) => patterns.includes(p)).length;

  // 1. En pulsgiver først — den skiftes ud fra gang til gang.
  const raisers = shuffle(rnd, available.filter((e) => PULSE_RAISERS.some((id) => e.id.startsWith(id))));
  const chosen: Exercise[] = [];
  const first = raisers[0] ?? available[0];
  if (first) chosen.push(first);

  // 2. Resten vælges efter, hvor godt de spejler hoveddelen — med tilfældig rækkefølge
  //    inden for samme relevans, så to workouts med samme mønstre ikke får samme opvarmning.
  const rest = shuffle(rnd, available.filter((e) => !chosen.includes(e)))
    .sort((a, b) => overlap(b) - overlap(a));

  // Teknikprimeren lægger sig oven i cirklen, så der er én plads færre til den.
  const technical = mainBlocks
    .flatMap((b) => b.movements)
    .map((m) => BY_ID[m.exerciseId])
    .filter((e): e is Exercise => Boolean(e) && (e as Exercise).tech >= 3)
    .sort((a, b) => b.tech - a.tech)[0];
  const withPrimer = Boolean(technical) && min >= 6;

  const wanted = Math.max(3, (min >= 8 ? 5 : min >= 6 ? 4 : 3) - (withPrimer ? 1 : 0));
  const regions = new Set<Region>(chosen.flatMap(regionsOf));
  let complexTaken = chosen.some((e) => isComplex(e.id));
  for (const e of rest) {
    if (chosen.length >= wanted) break;
    if (isComplex(e.id)) {
      if (complexTaken) continue;
      complexTaken = true;
    }
    chosen.push(e);
    regionsOf(e).forEach((r) => regions.add(r));
  }
  // 3. Mangler en kropsregion, byttes den mindst relevante ud.
  (['lower', 'upper', 'trunk'] as Region[]).forEach((region) => {
    if (regions.has(region)) return;
    const filler = rest.find((e) => (
      !chosen.includes(e) && regionsOf(e).includes(region) && !(complexTaken && isComplex(e.id))
    ));
    if (!filler) return;
    if (chosen.length >= wanted) chosen.pop();
    chosen.push(filler);
    regions.add(region);
  });

  // Tiden fordeles på to runder, så bevægelserne når at blive bedre anden gang.
  const rounds = min >= 6 ? 2 : 1;
  const transitionSec = 5;
  const perItem = Math.floor((min * 60) / rounds / Math.max(1, chosen.length));
  const workSec = clamp(perItem - transitionSec, 25, 50);

  const movements: Movement[] = chosen.map((ex) => {
    const [lo, hi] = ex.rep ?? [5, 12];
    const reps = ex.unit === 'sec'
      ? workSec
      : ex.unit === 'm'
        ? Math.max(10, Math.round(workSec / ex.sec / 5) * 5)
        : clamp(Math.round(workSec / ex.sec), lo, hi);
    const m = buildMovement(ex, req, rnd, { reps, intensity: 0.6 });
    return {
      ...m,
      display: ex.unit === 'sec'
        ? `${workSec} sek ${ex.name}`
        : `${unitLabel(ex.unit, reps)} ${ex.name}`,
      workSec,
      transitionSec,
    };
  });

  // Teknikprimer: den mest tekniske øvelse fra hoveddelen, kørt let.
  if (technical && withPrimer) {
    const primer = buildMovement(technical, req, rnd, { reps: 5, pct: 0.4 });
    movements.push({
      ...primer,
      display: `5 ${technical.name} — let vægt`,
      cue: `Teknikprimer for hoveddelen. Kør ${technical.name} langsomt og let, så bevægelsen sidder, før det gælder.`,
      workSec: 45,
      transitionSec,
    });
  }

  const timing = `${workSec} sekunders arbejde · ${transitionSec} sekunders skift`;

  return {
    id: 'warmup',
    kind: 'warmup',
    title: `Opvarmning · ${min} min`,
    format: null,
    minutes: min,
    prescription: `${rounds} ${rounds === 1 ? 'runde' : 'runder'} · ${timing}`,
    movements,
    rounds,
    workSec,
    restSec: transitionSec,
    timing,
  };
}

/** Cooldown holdes bevidst adskilt fra opvarmningen og er roligere. */
export function buildCooldown(req: NormalizedRequest, rnd: Rng, minutes: number): Block {
  const min = clamp(Math.round(minutes), 2, 8);
  const pool = COOLDOWN_POOL.filter((e) => usable(e, req));
  const chosen = shuffle(rnd, pool).slice(0, 3);
  const perItem = Math.max(30, Math.floor((min * 60) / Math.max(1, chosen.length)));

  const movements = chosen.map((ex) => {
    const reps = ex.unit === 'sec' ? Math.min(perItem, 60) : Math.max(5, Math.round(perItem / ex.sec / 2));
    const m = buildMovement(ex, req, rnd, { reps, intensity: 0.5 });
    return { ...m, workSec: perItem, transitionSec: 5 };
  });

  return {
    id: 'cooldown',
    kind: 'cooldown',
    title: `Cooldown · ${min} min`,
    format: null,
    minutes: min,
    prescription: `Rolig vejrtrækning, ingen hast · ca. ${perItem} sekunder pr. øvelse`,
    movements,
  };
}
