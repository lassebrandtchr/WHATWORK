/**
 * Domænetyperne.
 *
 * Laget her ejer atleten, hendes data og de regler, der bestemmer, om et tal
 * må bruges. Regelmotoren i `src/engine` og programmotoren i `src/program`
 * bygger begge oven på det — ingen af dem må definere deres egen version af
 * e1RM, confidence eller belastningsgrundlag.
 */

import type { CareId, LevelId, Profile } from '../engine/types.js';

/* ---------- Sport og mål ---------- */

export type SportId =
  | 'strength4'
  | 'powerlifting'
  | 'crossfit'
  | 'hyrox'
  | 'strongman'
  | 'functional';

/** De fire hovedløft i WHATWORKs styrkemodel. Overhead press er appens fjerde
 * løft og er bevidst ikke et officielt IPF-konkurrenceløft. */
export type LiftId = 'squat' | 'bench' | 'deadlift' | 'ohp';

export const COMPETITION_LIFTS: LiftId[] = ['squat', 'bench', 'deadlift'];
export const STRENGTH4_LIFTS: LiftId[] = ['squat', 'bench', 'deadlift', 'ohp'];

export const LIFT_NAMES: Record<LiftId, string> = {
  squat: 'Squat',
  bench: 'Bænkpres',
  deadlift: 'Dødløft',
  ohp: 'Overhead press',
};

/** Øvelses-id i det eksisterende katalog, der repræsenterer hovedløftet. */
export const LIFT_EXERCISE: Record<LiftId, string> = {
  squat: 'back_squat',
  bench: 'bench_press',
  deadlift: 'deadlift',
  ohp: 'strict_press',
};

/* ---------- Screening ---------- */

export type ScreeningStatus = 'cleared' | 'restricted' | 'refer' | 'unknown';

export type ScreeningFlagId =
  | 'chest_pain'
  | 'syncope'
  | 'unusual_breathlessness'
  | 'known_cardiac'
  | 'known_metabolic'
  | 'known_renal'
  | 'pregnancy'
  | 'recent_surgery'
  | 'illness_fever';

export interface ScreeningFlag {
  id: ScreeningFlagId;
  /** Dansk tekst, som vises til brugeren. */
  label: string;
  /** Alarmsymptom: appen stopper og henviser i stedet for at programmere videre. */
  alarm: boolean;
}

export interface PainEntry {
  region: CareId;
  /** 0–10. Appen diagnosticerer ikke — tallet styrer kun, hvor konservativt der programmeres. */
  score: number;
  /** Øvelses-id'er, brugeren selv angiver som forværrende. */
  aggravators: string[];
  /** ISO-dato. */
  updatedAt: string;
}

export interface Screening {
  status: ScreeningStatus;
  flags: ScreeningFlagId[];
  pain: PainEntry[];
  /** ISO-dato for seneste besvarelse. Gammel screening udløser en warning. */
  answeredAt: string | null;
}

/* ---------- Benchmarks ---------- */

export type BenchmarkKind =
  /** Maksimal styrke i kg for et navngivet løft. */
  | 'strength'
  /** Frisk maksimalt ubrudt sæt i reps for en gymnastikbevægelse. */
  | 'maxUnbroken'
  /** Pace i sekunder pr. km eller pr. 500 m. */
  | 'pace'
  /** Cykliske reps pr. minut ved bæredygtigt tempo. */
  | 'cadence'
  /** Tid i sekunder for en standardiseret distance/station. */
  | 'stationTime'
  /** Ugentlig løbevolumen i km. */
  | 'runVolume';

export type TestProtocol =
  | '1rm'
  | '3rm'
  | '5rm'
  | 'topSetRpe'
  | 'amrap'
  | 'timeTrial'
  | 'maxUnbroken'
  | 'estimate'
  | 'selfReported';

export interface Benchmark {
  id: string;
  /** Stabilt id for præcis variant — "deadlift" er ikke nok til at skille sumo fra axle. */
  subjectId: string;
  kind: BenchmarkKind;
  protocol: TestProtocol;
  /** ISO-dato for hvornår testen blev udført. */
  date: string;
  value: number;
  unit: 'kg' | 'reps' | 'sec' | 'm' | 'km' | 'sec_per_km' | 'sec_per_500m';
  reps?: number;
  rpe?: number;
  /** Beregnet e1RM i kg, kun for `kind: 'strength'`. */
  e1rmKg?: number;
  /** 0–1. Sættes af benchmarkService ud fra protokol, alder og teknikstatus. */
  confidence: number;
  /** Sandt når teknikken var ustabil, der var smerte, eller sættet var for højt i reps
   * til at styre tunge loads. Ugyldige sæt må ikke flytte e1RM. */
  invalid?: boolean;
  note?: string;
}

/* ---------- Movement competence ---------- */

/**
 * Specifikationens fem trin. High-skill-bevægelser må aldrig programmeres alene
 * ud fra et generelt niveau som "Elite" — der skal være et dokumenteret trin her.
 */
export type CompetenceLevel =
  | 'unknown'
  | 'introduced'
  | 'stable_fresh'
  | 'stable_fatigued'
  | 'competition_ready';

export const COMPETENCE_ORDER: CompetenceLevel[] = [
  'unknown', 'introduced', 'stable_fresh', 'stable_fatigued', 'competition_ready',
];

export const COMPETENCE_LABELS: Record<CompetenceLevel, string> = {
  unknown: 'Ukendt',
  introduced: 'Introduceret',
  stable_fresh: 'Stabil i friske sæt',
  stable_fatigued: 'Stabil under træthed',
  competition_ready: 'Konkurrenceklar',
};

export interface CompetenceEntry {
  exerciseId: string;
  level: CompetenceLevel;
  updatedAt: string;
}

/* ---------- Træningshistorik som input ---------- */

export interface TrainingHistorySummary {
  lookbackDays: number;
  sessions: number;
  /** Hårde arbejdssæt pr. bevægelsesmønster de seneste `lookbackDays`. */
  hardSetsByPattern: Record<string, number>;
  runKm: number;
  highIntensityMinutes: number;
  /** Sessioner pr. uge, brugeren reelt har gennemført. Bruges til at skrive planen om
   * frem for at lægge mere progression oven på en plan, der ikke bliver fulgt. */
  completedPerWeek: number;
}

/* ---------- Atletprofilen ---------- */

export interface AthleteAvailability {
  /** Faktisk tilgængelige dage pr. uge. */
  days: number;
  /** Minutter pr. pas. */
  minutes: number;
}

export interface AthleteProfile {
  id: string;
  /** null = ikke oplyst. Appen skal kunne skelne "ved ikke" fra 0. */
  age: number | null;
  bodyMassKg: number | null;
  sex: Profile;
  level: LevelId;
  generalTrainingYears: number | null;
  sportTrainingYears: number | null;
  availability: AthleteAvailability;
  screening: Screening;
  competence: CompetenceEntry[];
  /** Sætter et gulv for, hvor konservativt der må programmeres. */
  care: CareId[];
  excludedExerciseIds: string[];
  updatedAt: string;
}

/* ---------- Regelsæt ---------- */

export interface RuleSetRef {
  organization: string;
  version: string;
  season?: string;
  /** ISO-dato for hvornår reglerne sidst blev kontrolleret mod kilden. */
  checkedAt: string;
  sourceUrl: string;
}

/* ---------- Mål ---------- */

export type BaselineStrategy = 'known' | 'assessment' | 'conservative';

export interface Goal {
  sport: SportId;
  primary: string;
  secondary: string[];
  /** ISO-dato for konkurrence/race. null når der ikke er en. */
  eventDate: string | null;
  ruleSet: RuleSetRef | null;
  baselineStrategy: BaselineStrategy;
  /** Kun relevant for HYROX. */
  division?: string;
  /** Kun relevant for strongman: den konkrete eventliste. Uden den bygges der ikke
   * et konkurrenceprogram — motoren opfinder ikke en generisk contest prep. */
  events?: StrongmanEvent[];
}

export interface StrongmanEvent {
  id: string;
  name: string;
  category: 'maxStrength' | 'repsForTime' | 'movingLoad' | 'loading' | 'pullPush' | 'throw' | 'medley';
  implement: string;
  loadKg: number | null;
  distanceM: number | null;
  timeCapSec: number | null;
  reps: number | null;
  notes?: string;
}

/* ---------- Belastningsgrundlag ---------- */

export type LoadBasis =
  /** Procent af et beregnet e1RM. */
  | 'e1rm'
  /** Procent af et training max. */
  | 'trainingMax'
  /** Direkte fra atletens egen nylige session. */
  | 'recentSession'
  /** Officielt konkurrenceload fra et versioneret regelsæt. */
  | 'ruleSet'
  /** Konservativ populationsprior — skal altid vises som lav confidence. */
  | 'populationPrior'
  /** Brugerens eget valg. */
  | 'userSet';

/**
 * Sporbarheden bag ét enkelt tal. Specifikationen forbyder kilo uden dokumenteret
 * grundlag; det er den her, der gør forbuddet håndhævbart.
 */
export interface LoadProvenance {
  basis: LoadBasis;
  /** Dansk forklaring, fx "82 % af training max 180 kg". */
  explanation: string;
  /** 0–1. */
  confidence: number;
  /** Benchmark-id'er, tallet bygger på. */
  benchmarkIds: string[];
  /** Afrundingstrin i kg. */
  roundingKg: number;
  percent?: number;
}

export interface LoadRange {
  lowKg: number;
  highKg: number;
  /** Den værdi, der vises som forslag — altid inden for [low, high]. */
  targetKg: number;
  provenance: LoadProvenance;
}

/* ---------- Confidence ---------- */

export type ConfidenceBand = 'low' | 'medium' | 'high';

export const confidenceBand = (value: number): ConfidenceBand =>
  (value >= 0.7 ? 'high' : value >= 0.45 ? 'medium' : 'low');

export const CONFIDENCE_LABELS: Record<ConfidenceBand, string> = {
  low: 'Lav sikkerhed',
  medium: 'Middel sikkerhed',
  high: 'Høj sikkerhed',
};

/* ---------- Constraints ---------- */

export type ConstraintSeverity = 'error' | 'warning';

export interface ConstraintIssue {
  code: string;
  severity: ConstraintSeverity;
  /** Dansk besked til brugeren. */
  message: string;
  /** Hvad brugeren kan gøre ved det. */
  fix?: string;
  /** Hvilken del af planen det gælder. */
  scope?: string;
}
