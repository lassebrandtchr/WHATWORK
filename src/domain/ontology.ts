/**
 * Exercise ontology.
 *
 * Det eksisterende øvelseskatalog beskriver, hvordan en øvelse udføres. Ontologien
 * her beskriver, hvad den koster, hvad den overfører til, og hvad den kræver af
 * atleten — det er de tags, assistance- og substitutionsregelmotorerne arbejder på.
 *
 * Laget er bevidst en overlay frem for en udvidelse af `Exercise`: kataloget er
 * UI-ejet og ændrer sig ofte, mens ontologien er programmeringslogik.
 */

import { BY_ID, EXERCISES } from '../engine/data/exercises.js';
import type { Exercise, MovementPattern } from '../engine/types.js';
import type { CompetenceLevel, LiftId, SportId } from './types.js';

/** Grov gruppering, substitution og duplikatdetektion arbejder på. */
export type SubstitutionGroup =
  | 'squat-specific' | 'hinge-specific' | 'press-vertical' | 'press-horizontal'
  | 'pull-vertical' | 'pull-horizontal' | 'olympic' | 'carry' | 'core'
  | 'monostructural' | 'jump' | 'mixed-modal' | 'lunge';

export interface FatigueCost {
  /** Lokal muskulær træthed. */
  local: number;
  /** Aksial belastning af rygsøjlen. */
  axial: number;
  /** Systemisk/CNS. */
  systemic: number;
  /** Stød mod led og væv. */
  impact: number;
  grip: number;
}

export interface OntologyEntry {
  exerciseId: string;
  pattern: MovementPattern;
  group: SubstitutionGroup;
  /** 1–5. Fem er konkurrencegymnastik og olympiske løft under fatigue. */
  skill: number;
  fatigue: FatigueCost;
  /** Kompetenceniveau, der kræves før øvelsen må programmeres i en hoveddel. */
  requiresCompetence: CompetenceLevel;
  /** Sandt når øvelsen kun må køres til failure under kontrollerede forhold. */
  failureAllowed: boolean;
  unilateral: boolean;
  /** Sekunder til opsætning før første rep. Tæller med i tidsbudgettet. */
  setupSeconds: number;
  /** Hovedløft, øvelsen har dokumenteret overførsel til. */
  transfersTo: LiftId[];
  /** Sportsgrene, hvor øvelsen er specifik frem for generel. */
  sportsTransfer: SportId[];
  /** Egnede rep ranges i en hoveddel. */
  allowedRepRange: [number, number];
}

/** Bevægelser, der aldrig må vælges alene ud fra et generelt niveau som "Elite". */
export const HIGH_SKILL_IDS = [
  'hspu', 'chest_to_bar', 'toes_to_bar', 'power_snatch', 'overhead_squat',
  'clean_and_jerk', 'double_under', 'pistol_squat', 'push_jerk', 'power_clean',
  'hang_power_clean', 'thruster', 'dip',
] as const;

/** Eksplicitte overrides. Alt andet udledes af kataloget. */
const OVERRIDES: Record<string, Partial<OntologyEntry>> = {
  back_squat: { group: 'squat-specific', transfersTo: ['squat'], sportsTransfer: ['powerlifting', 'strength4', 'strongman'], failureAllowed: false, setupSeconds: 60, allowedRepRange: [1, 10] },
  front_squat: { group: 'squat-specific', transfersTo: ['squat'], sportsTransfer: ['crossfit', 'strength4'], setupSeconds: 60, allowedRepRange: [1, 8] },
  overhead_squat: { group: 'squat-specific', transfersTo: ['squat', 'ohp'], requiresCompetence: 'stable_fatigued', setupSeconds: 60 },
  goblet_squat: { group: 'squat-specific', transfersTo: ['squat'], setupSeconds: 15 },
  air_squat: { group: 'squat-specific', transfersTo: ['squat'], setupSeconds: 0 },
  bulgarian_split_squat: { group: 'lunge', unilateral: true, transfersTo: ['squat'] },
  pistol_squat: { group: 'lunge', unilateral: true, requiresCompetence: 'stable_fresh' },
  walking_lunge: { group: 'lunge', unilateral: true },
  reverse_lunge: { group: 'lunge', unilateral: true },
  db_walking_lunge: { group: 'lunge', unilateral: true },
  db_reverse_lunge: { group: 'lunge', unilateral: true },
  db_front_rack_lunge: { group: 'lunge', unilateral: true },

  deadlift: { group: 'hinge-specific', transfersTo: ['deadlift'], sportsTransfer: ['powerlifting', 'strength4', 'strongman'], failureAllowed: false, setupSeconds: 60, allowedRepRange: [1, 10] },
  rdl: { group: 'hinge-specific', transfersTo: ['deadlift'], setupSeconds: 45 },
  good_morning: { group: 'hinge-specific', transfersTo: ['squat', 'deadlift'], setupSeconds: 45 },
  hip_thrust: { group: 'hinge-specific', transfersTo: ['deadlift'], setupSeconds: 60 },
  kb_swing: { group: 'hinge-specific', transfersTo: ['deadlift'] },
  sandbag_clean: { group: 'hinge-specific', sportsTransfer: ['strongman', 'hyrox'] },

  bench_press: { group: 'press-horizontal', transfersTo: ['bench'], sportsTransfer: ['powerlifting', 'strength4'], failureAllowed: false, setupSeconds: 60, allowedRepRange: [1, 10] },
  incline_bench_press: { group: 'press-horizontal', transfersTo: ['bench'], setupSeconds: 60 },
  db_bench: { group: 'press-horizontal', transfersTo: ['bench'], setupSeconds: 30 },
  push_up: { group: 'press-horizontal', transfersTo: ['bench'] },
  diamond_push_up: { group: 'press-horizontal', transfersTo: ['bench'] },
  decline_push_up: { group: 'press-horizontal', transfersTo: ['bench'] },
  hr_push_up: { group: 'press-horizontal', transfersTo: ['bench'] },
  knee_push_up: { group: 'press-horizontal' },
  dip: { group: 'press-horizontal', transfersTo: ['bench'], requiresCompetence: 'stable_fresh' },

  strict_press: { group: 'press-vertical', transfersTo: ['ohp'], sportsTransfer: ['strength4', 'strongman'], failureAllowed: false, setupSeconds: 45, allowedRepRange: [1, 10] },
  push_press: { group: 'press-vertical', transfersTo: ['ohp'], sportsTransfer: ['crossfit', 'strongman'], setupSeconds: 45 },
  push_jerk: { group: 'press-vertical', transfersTo: ['ohp'], requiresCompetence: 'stable_fresh', setupSeconds: 45 },
  db_shoulder_press: { group: 'press-vertical', transfersTo: ['ohp'], setupSeconds: 20 },
  db_push_press: { group: 'press-vertical', transfersTo: ['ohp'], setupSeconds: 20 },
  hspu: { group: 'press-vertical', transfersTo: ['ohp'], requiresCompetence: 'stable_fatigued' },

  pull_up: { group: 'pull-vertical', requiresCompetence: 'stable_fresh' },
  band_pull_up: { group: 'pull-vertical' },
  chest_to_bar: { group: 'pull-vertical', requiresCompetence: 'stable_fatigued' },
  jumping_pull_up: { group: 'pull-vertical' },
  toes_to_bar: { group: 'core', requiresCompetence: 'stable_fatigued' },
  hanging_knee_raise: { group: 'core' },
  ring_row: { group: 'pull-horizontal' },
  db_row: { group: 'pull-horizontal', unilateral: true, transfersTo: ['deadlift'] },
  barbell_row: { group: 'pull-horizontal', transfersTo: ['deadlift'], setupSeconds: 45 },
  db_curl: { group: 'pull-horizontal' },

  power_clean: { group: 'olympic', requiresCompetence: 'stable_fresh', sportsTransfer: ['crossfit', 'strongman'], setupSeconds: 60, failureAllowed: false },
  hang_power_clean: { group: 'olympic', requiresCompetence: 'stable_fresh', setupSeconds: 60, failureAllowed: false },
  clean_and_jerk: { group: 'olympic', requiresCompetence: 'stable_fatigued', setupSeconds: 60, failureAllowed: false },
  power_snatch: { group: 'olympic', requiresCompetence: 'stable_fatigued', setupSeconds: 60, failureAllowed: false },

  farmer_carry: { group: 'carry', sportsTransfer: ['hyrox', 'strongman'] },
  front_rack_carry: { group: 'carry' },
  farmer_hold: { group: 'carry' },
  sandbag_carry: { group: 'carry', sportsTransfer: ['hyrox', 'strongman'] },
  sled_push: { group: 'carry', sportsTransfer: ['hyrox', 'strongman'] },
  sled_pull: { group: 'carry', sportsTransfer: ['hyrox', 'strongman'] },

  row: { group: 'monostructural', sportsTransfer: ['hyrox', 'crossfit'] },
  ski: { group: 'monostructural', sportsTransfer: ['hyrox', 'crossfit'] },
  bike: { group: 'monostructural' },
  assault: { group: 'monostructural' },
  run_dist: { group: 'monostructural', sportsTransfer: ['hyrox'] },
  air_run: { group: 'monostructural', sportsTransfer: ['hyrox'] },
  shuttle_run: { group: 'monostructural' },
  double_under: { group: 'monostructural', requiresCompetence: 'stable_fresh' },
  single_under: { group: 'monostructural' },

  box_jump: { group: 'jump' },
  box_jump_over: { group: 'jump' },
  box_step_over: { group: 'jump' },
  box_step_up: { group: 'jump' },
  burpee_broad_jump: { group: 'jump', sportsTransfer: ['hyrox'] },

  thruster: { group: 'mixed-modal', requiresCompetence: 'stable_fresh', sportsTransfer: ['crossfit'] },
  db_thruster: { group: 'mixed-modal' },
  wall_ball: { group: 'mixed-modal', sportsTransfer: ['hyrox', 'crossfit'] },
  burpee: { group: 'mixed-modal' },
  devil_press: { group: 'mixed-modal' },
  db_snatch: { group: 'mixed-modal' },
  sandbag_shoulder: { group: 'mixed-modal', sportsTransfer: ['strongman'] },
};

const GROUP_BY_PATTERN: Record<MovementPattern, SubstitutionGroup> = {
  squat: 'squat-specific',
  hinge: 'hinge-specific',
  press: 'press-horizontal',
  pull: 'pull-vertical',
  oly: 'olympic',
  carry: 'carry',
  core: 'core',
  cardio: 'monostructural',
  fullbody: 'mixed-modal',
  warmup: 'mixed-modal',
};

/**
 * Oversætter katalogets fatigue-vektor til ontologiens fem akser.
 *
 * Kataloget tænker i DNA-akser (engine, legs, hinge, press …); programmering har
 * brug for at vide, hvad der belaster rygsøjlen, hvad der slider grebet, og hvad
 * der koster centralt. Konverteringen er én gang og ét sted.
 */
function fatigueOf(ex: Exercise): FatigueCost {
  const f = ex.fat;
  const local = Math.max(
    f.legs ?? 0, f.press ?? 0, f.pull ?? 0, f.shoulder ?? 0, f.core ?? 0, f.hinge ?? 0,
  );
  const axial = Math.max(
    f.hinge ?? 0,
    ex.eq.includes('barbell') && (ex.cat === 'squat' || ex.cat === 'hinge' || ex.cat === 'oly')
      ? Math.max(2, f.legs ?? 0)
      : 0,
  );
  const systemic = Math.max(f.cns ?? 0, f.engine ?? 0);
  const impact = ex.id.includes('jump') || ex.id.includes('burpee') || ex.id.includes('run')
    || ex.id === 'double_under' || ex.id === 'single_under'
    ? 2 + (ex.cat === 'cardio' ? 0 : 1)
    : 0;
  return {
    local, axial, systemic,
    impact: Math.min(3, impact),
    grip: f.grip ?? 0,
  };
}

function competenceFor(ex: Exercise): CompetenceLevel {
  if ((HIGH_SKILL_IDS as readonly string[]).includes(ex.id)) return 'stable_fresh';
  if (ex.tech >= 4) return 'stable_fresh';
  if (ex.tech === 3) return 'introduced';
  return 'unknown';
}

function build(ex: Exercise): OntologyEntry {
  const base: OntologyEntry = {
    exerciseId: ex.id,
    pattern: ex.cat,
    group: GROUP_BY_PATTERN[ex.cat],
    skill: ex.tech,
    fatigue: fatigueOf(ex),
    requiresCompetence: competenceFor(ex),
    failureAllowed: ex.tech <= 2 && !ex.eq.includes('barbell'),
    unilateral: false,
    setupSeconds: ex.eq.includes('barbell') ? 45 : ex.machine ? 15 : ex.eq.includes('bodyweight') ? 0 : 20,
    transfersTo: [],
    sportsTransfer: [],
    allowedRepRange: ex.rep ?? [5, 15],
  };
  return { ...base, ...OVERRIDES[ex.id] };
}

export const ONTOLOGY: Record<string, OntologyEntry> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, build(e)]),
);

export function ontologyFor(exerciseId: string): OntologyEntry | null {
  return ONTOLOGY[exerciseId] ?? null;
}

/** Alle øvelser i en substitutionsgruppe, sorteret efter stigende skill. */
export function inGroup(group: SubstitutionGroup): OntologyEntry[] {
  return Object.values(ONTOLOGY)
    .filter((o) => o.group === group)
    .sort((a, b) => a.skill - b.skill);
}

/** Summer fatigue over en liste øvelser. Bruges til stressbudgettet. */
export function sumFatigue(exerciseIds: string[]): FatigueCost {
  return exerciseIds.reduce<FatigueCost>((acc, id) => {
    const o = ONTOLOGY[id];
    if (!o) return acc;
    return {
      local: acc.local + o.fatigue.local,
      axial: acc.axial + o.fatigue.axial,
      systemic: acc.systemic + o.fatigue.systemic,
      impact: acc.impact + o.fatigue.impact,
      grip: acc.grip + o.fatigue.grip,
    };
  }, { local: 0, axial: 0, systemic: 0, impact: 0, grip: 0 });
}

/** Sandt når to øvelser belaster den samme hovedstressor og derfor dublerer den. */
export function overlaps(aId: string, bId: string): boolean {
  const a = ONTOLOGY[aId];
  const b = ONTOLOGY[bId];
  if (!a || !b || aId === bId) return aId === bId;
  return a.group === b.group;
}

/** Øvelser med dokumenteret overførsel til et hovedløft. */
export function transferTo(lift: LiftId): OntologyEntry[] {
  return Object.values(ONTOLOGY).filter((o) => o.transfersTo.includes(lift));
}

export const isHighSkill = (exerciseId: string): boolean =>
  (HIGH_SKILL_IDS as readonly string[]).includes(exerciseId);

export const exerciseName = (id: string): string => BY_ID[id]?.name ?? id;
