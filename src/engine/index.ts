/**
 * Eneste indgang til regelmotoren. Resten af appen importerer herfra, så motorens
 * interne opdeling kan ændres ét sted.
 */

export * from './types.js';
export * from './version.js';
export {
  EQUIPMENT, DEFAULT_EQUIPMENT, EQUIPMENT_BY_ID, PLATE_SIZES, DEFAULT_PLATES,
  BAR_SIZES, DEFAULT_BARS, SANDBAG_SIZES, DEFAULT_SANDBAGS, CARE_AREAS, FOCUS_TAGS, LEVELS,
} from './data/equipment.js';
export { EXERCISES, BY_ID, MIN_LOADS } from './data/exercises.js';
export { FORMATS, FORMAT_LIST, EVERY_SEC, isEmomFamily, formatName } from './data/formats.js';
export { makeSeed, mulberry32 } from './rng.js';
export { fmtKg, planPlates, scaleLoad, scaleLoadPct, REF_BW, LEVEL_MULT } from './loads.js';
export { unitLabel, unitName } from './movements.js';
export { normalizeRequest, peopleFromMix } from './request.js';
export { findBottlenecks, planPartner } from './partner.js';
export { DNA_AXES, computeDNA, scoreMatch, signatureOf, validate } from './validate.js';
export { MAX_CANDIDATES, budget, chooseExercises, generateWorkout, mainPool } from './smartmix.js';
export { buildTimerPlan } from './timerplan.js';
export { PROGRAM_GOALS, generateProgram } from './program.js';
export { WARMUP_MAX_MINUTES, WARMUP_MIN_MINUTES, buildWarmup, patternsOfBlocks } from './warmup.js';

/** Faserne, generatorskærmen viser mens Smart Mix arbejder. */
export const PHASES: { to: number; text: string }[] = [
  { to: 12, text: 'Læser dine valg, dine deltagere og dit udstyr.' },
  { to: 32, text: 'Bygger op til 64 variationer.' },
  { to: 55, text: 'Finder dem, der rammer bedst.' },
  { to: 74, text: 'Regner kilo, skiver og mål ud til hver deltager.' },
  { to: 90, text: 'Tjekker tid, logistik og variation mod dine seneste workouts.' },
  { to: 100, text: 'Vælger den bedste. Så er der serveret.' },
];
