/**
 * Eneste indgang til programmotoren (Motor B).
 *
 * Motor A ("Generér workout") må dele domæneservices med den her, men må aldrig
 * kalde `planProgram` som genvej — og omvendt. De to entrypoints er adskilte med
 * vilje, fordi en enkelt WOD og et flerugers forløb optimerer forskellige ting.
 */

export * from './types.js';
export { planProgram, buildTrainingMaxes, allocateStress, placeAnchors } from './planner.js';
export type { PlanInput, StressBudgetPlan } from './planner.js';
export { sessionToWorkout } from './session.js';
export type { RenderContext } from './session.js';
export { toLegacyProgram } from './legacy.js';
export type { LegacyContext } from './legacy.js';
export {
  chooseAssistance, defaultAssistanceFor, weakPoint, WEAK_POINT_LIST, MIN_ASSISTANCE_WEEKS,
} from './assistance.js';
export type { AssistanceChoice, AssistanceContext, WeakPoint, WeakPointId } from './assistance.js';
export {
  decideWeek, deloadSignals, adherence, advanceDoubleProgression,
  DELOAD_SIGNAL_THRESHOLD, RESCOPE_ADHERENCE,
} from './progression.js';
export type {
  DoubleProgressionState, ProgressionOutcome, ProgressionVariable, WeeklyActuals, WeeklyDecision,
} from './progression.js';
export { adaptProgram, applyTopSetResult } from './adapter.js';
export type { AdaptationResult } from './adapter.js';

/** Faserne, program-loading-skærmen viser. Teksterne beskriver, hvad motoren faktisk gør. */
export const PROGRAM_BUILD_PHASES: { to: number; label: string; text: string }[] = [
  { to: 14, label: 'Profil og screening', text: 'Læser din profil, screening og dine tal.' },
  { to: 30, label: 'Kravprofil', text: 'Fastlægger sportens krav og ugens obligatoriske eksponeringer.' },
  { to: 48, label: 'Blokke', text: 'Lægger faserne ud over ugerne.' },
  { to: 66, label: 'Stressbudget', text: 'Fordeler hårde sæt, aksial belastning og stød på dagene.' },
  { to: 84, label: 'Belastninger', text: 'Regner kilo ud af dine training max — med afrunding og forbehold.' },
  { to: 100, label: 'Kontrol', text: 'Kører lint på anchors, tid og samlet stress.' },
];
