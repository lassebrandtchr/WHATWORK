/**
 * Historik: appens varige source of truth for planlagt og faktisk træning.
 *
 * To regler bærer hele modellen:
 *
 *  1. Planen overskrives aldrig. Retter man noget, oprettes en revision ved siden af.
 *  2. En gemt, men ikke gennemført workout er ikke træning og tæller ikke med.
 *
 * Uden dem kan man hverken forklare, hvorfor programmet tilpassede sig, eller finde
 * fejl i motoren bagefter.
 */

import type { EngineProvenance } from './versions.js';
import { SESSION_SCHEMA_VERSION } from './versions.js';

export type SessionState =
  | 'generated' | 'saved' | 'scheduled' | 'in_progress'
  | 'completed' | 'aborted' | 'skipped';

export type SourceMode = 'quick-wod' | 'program' | 'manual' | 'import';

export const SESSION_STATE_LABELS: Record<SessionState, string> = {
  generated: 'Bygget',
  saved: 'Gemt',
  scheduled: 'Planlagt',
  in_progress: 'I gang',
  completed: 'Gennemført',
  aborted: 'Afbrudt',
  skipped: 'Sprunget over',
};

/** Kun de her tilstande tæller som træning, der faktisk er lavet. */
export const COUNTS_AS_TRAINING: SessionState[] = ['completed'];

/** Tilstande, hvor der blev udført arbejde, selv om passet ikke blev fuldført. */
export const HAS_ACTUAL_WORK: SessionState[] = ['completed', 'aborted', 'in_progress'];

export const countsAsTraining = (state: SessionState): boolean =>
  COUNTS_AS_TRAINING.includes(state);

/* ---------- Faktisk udført arbejde ---------- */

export interface ActualSet {
  exerciseId: string;
  /** Præcis variant. "Dødløft" alene kan ikke skelne conventional fra sumo eller axle. */
  variantId?: string;
  setIndex: number;
  loadKg: number | null;
  reps: number;
  rpe: number | null;
  rir: number | null;
  /** Sandt når teknikken brød sammen i sættet. */
  technicalFailure?: boolean;
  painScore?: number;
  tempo?: string;
  restSeconds?: number;
}

export interface ActualInterval {
  index: number;
  exerciseId: string;
  /** Reps, meter eller kalorier. */
  amount: number;
  /** Sekunder brugt på arbejdet. */
  workSeconds: number;
  /** Antal gange atleten satte af undervejs. */
  breaks?: number;
}

export interface ActualConditioning {
  exerciseId: string;
  modality: string;
  distanceM: number | null;
  calories: number | null;
  elapsedSeconds: number;
  /** Sekunder pr. kilometer eller pr. 500 meter. */
  paceSecPerUnit: number | null;
  averageHeartRate: number | null;
}

export interface Substitution {
  fromExerciseId: string;
  toExerciseId: string;
  reason: string;
  /** Sandt når erstatningen bevarede bevægelsesmønster og formål. */
  preservedStimulus: boolean;
}

export interface SessionActual {
  durationSeconds: number;
  /** Andel af det planlagte arbejde, der blev gennemført. 0-100. */
  completionPct: number;
  sets: ActualSet[];
  intervals: ActualInterval[];
  conditioning: ActualConditioning[];
  substitutions: Substitution[];
  /** Score som tekst: tid, runder + reps eller gennemførte intervaller. */
  score: string;
}

export interface SessionFeedback {
  /** 1-10. Hvor hårdt hele passet føltes. */
  sessionRpe: number | null;
  painBefore: number | null;
  painAfter: number | null;
  notes: string;
  /** Hvorfor passet blev stoppet, hvis det blev det. */
  stopReason?: string;
}

export interface SessionRevision {
  revision: number;
  editedAt: string;
  reason: string;
}

export interface ProgramLink {
  programId: string;
  programVersion: number;
  week: number;
  day: number;
}

export interface WodLink {
  stimulus: string;
  format: string;
  /**
   * Nøglen, to resultater skal dele for at kunne sammenlignes som præstation.
   * `null` betyder, at workouten er en tilfældig variation, som kun må trendes
   * som træningsmængde — ikke som performance.
   */
  comparabilityKey: string | null;
}

/**
 * Én session i historikken.
 *
 * `planned` er den workout, motoren leverede. `actual` er det, der faktisk skete.
 * De to må aldrig blandes sammen.
 */
export interface SessionRecord {
  schemaVersion: number;
  sessionId: string;
  athleteId: string;
  sourceMode: SourceMode;
  state: SessionState;
  startedAt: string | null;
  endedAt: string | null;
  timezone: string;
  provenance: EngineProvenance;
  programRef: ProgramLink | null;
  wodRef: WodLink | null;
  actual: SessionActual;
  feedback: SessionFeedback;
  revisions: SessionRevision[];
}

let counter = 0;
export function newSessionId(): string {
  counter += 1;
  return `s_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const emptyActual = (): SessionActual => ({
  durationSeconds: 0,
  completionPct: 0,
  sets: [],
  intervals: [],
  conditioning: [],
  substitutions: [],
  score: '',
});

export const emptyFeedback = (): SessionFeedback => ({
  sessionRpe: null, painBefore: null, painAfter: null, notes: '',
});

export function createSession(input: {
  sourceMode: SourceMode;
  state: SessionState;
  provenance: EngineProvenance;
  programRef?: ProgramLink | null;
  wodRef?: WodLink | null;
  athleteId?: string;
}): SessionRecord {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: newSessionId(),
    athleteId: input.athleteId ?? 'local',
    sourceMode: input.sourceMode,
    state: input.state,
    startedAt: null,
    endedAt: null,
    timezone: typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Europe/Copenhagen',
    provenance: input.provenance,
    programRef: input.programRef ?? null,
    wodRef: input.wodRef ?? null,
    actual: emptyActual(),
    feedback: emptyFeedback(),
    revisions: [],
  };
}

/**
 * Retter en session uden at slette det, der stod før.
 *
 * Hver rettelse lægger en revision på. Det gør det muligt at se, at et tal er
 * korrigeret bagefter — og dermed at behandle det med den forsigtighed, det
 * fortjener, når programmet regner videre på det.
 */
export function reviseSession(
  session: SessionRecord,
  patch: Partial<Pick<SessionRecord, 'actual' | 'feedback' | 'state'>>,
  reason: string,
  at: string = new Date().toISOString(),
): SessionRecord {
  return {
    ...session,
    ...patch,
    revisions: [
      ...session.revisions,
      { revision: session.revisions.length + 1, editedAt: at, reason },
    ],
  };
}

/**
 * "Kør igen" kopierer workouten til en ny session.
 *
 * Den oprindelige post røres ikke — historikken er en log, ikke et arbejdsdokument.
 */
export function repeatSession(session: SessionRecord): SessionRecord {
  return {
    ...session,
    sessionId: newSessionId(),
    state: 'generated',
    startedAt: null,
    endedAt: null,
    actual: emptyActual(),
    feedback: emptyFeedback(),
    revisions: [],
  };
}

/**
 * Bygger nøglen, to workouts skal dele for at kunne sammenlignes som præstation.
 *
 * Kun standardiserede workouts får en nøgle. To tilfældige AMRAP'er med forskellige
 * øvelser har ingen — og må derfor ikke stilles op mod hinanden som fremgang.
 */
export function comparabilityKey(input: {
  format: string;
  movements: { exerciseId: string; reps: number; loadKg: number | null }[];
  minutes: number;
  standardised: boolean;
}): string | null {
  if (!input.standardised) return null;
  const parts = input.movements
    .map((m) => `${m.exerciseId}:${m.reps}:${m.loadKg ?? 'bw'}`)
    .sort();
  return `${input.format}|${input.minutes}|${parts.join(',')}`;
}

/** Sandt når to sessioner må sammenlignes direkte som præstation. */
export function isComparable(a: SessionRecord, b: SessionRecord): boolean {
  const ka = a.wodRef?.comparabilityKey;
  const kb = b.wodRef?.comparabilityKey;
  if (!ka || !kb) return false;
  if (ka !== kb) return false;
  // Forskellige regelversioner kan betyde forskellige vægte og standarder.
  return JSON.stringify(a.provenance.ruleVersions) === JSON.stringify(b.provenance.ruleVersions);
}
