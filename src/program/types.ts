/**
 * Programmotorens datamodel (Motor B).
 *
 * Et program er ikke en pose Dagens WODs. Det er en sekvens af blokke med
 * obligatoriske ugentlige anchors, et stressbudget, en progression og en
 * dokumenteret adaptation. Modellen her holder planen adskilt fra visningen —
 * `sessionToWorkout` i `session.ts` oversætter til det format, skærmene bruger.
 */

import type { ConstraintIssue, LiftId, LoadRange, SportId } from '../domain/types.js';
import type { PhaseId } from '../domain/sport.js';
import type { EngineProvenance } from '../domain/versions.js';
import type { TrainingMax } from '../domain/strength.js';

export type SetType = 'top' | 'backoff' | 'supplemental' | 'assistance' | 'interval' | 'warmup';

export interface SetPrescription {
  id: string;
  type: SetType;
  exerciseId: string;
  /** Dansk navn, så visningen ikke skal slå op. */
  name: string;
  sets: number;
  reps: number;
  targetRpe: number | null;
  targetRir: number | null;
  /** Grundlaget for procenten. `none` betyder kropsvægt eller tid. */
  percentBasis: 'e1rm' | 'trainingMax' | 'none';
  percent: number | null;
  /** null når øvelsen ikke har ekstern belastning. */
  load: LoadRange | null;
  restSeconds: [number, number];
  /** Danske stopregler, fx "stop ved smerte på 4 eller derover". */
  stopRules: string[];
  /** Hvorfor netop denne øvelse er valgt. */
  rationale: string;
  /** Sekunder pr. rep ved arbejdstempo — bruges af tidsberegningen. */
  secondsPerRep: number;
}

export interface SessionStress {
  hardSets: number;
  axial: number;
  impact: number;
  highSkillFatigue: number;
}

export interface ConditioningPrescription {
  id: string;
  exerciseId: string;
  name: string;
  /** Lav, moderat eller høj intensitet. */
  zone: 'low' | 'moderate' | 'high';
  modality: string;
  /** Minutter for kontinuerligt arbejde. */
  minutes: number;
  intervals: { work: number; rest: number; rounds: number } | null;
  targetText: string;
  rationale: string;
}

export interface ProgramSession {
  id: string;
  /** Én sætning, der beskriver dagens stimulus. */
  stimulus: string;
  plannedMinutes: number;
  warmup: SetPrescription[];
  anchors: SetPrescription[];
  supplemental: SetPrescription[];
  assistance: SetPrescription[];
  conditioning: ConditioningPrescription[];
  stress: SessionStress;
  /** Hvilke ugentlige anchors dagen dækker. */
  coversAnchors: string[];
  issues: ConstraintIssue[];
  explanation: string[];
}

export type DayStatus = 'planned' | 'done' | 'partial' | 'skipped';

export interface ProgramDayV3 {
  day: number;
  status: DayStatus;
  session: ProgramSession | null;
  error: string | null;
}

export interface ProgramWeekV3 {
  index: number;
  phase: PhaseId;
  phaseName: string;
  /** Sandt for planlagte eller responsudløste deloads. */
  deload: boolean;
  taper: boolean;
  /** Sandt for en assessment- eller indkøringsuge. */
  assessment: boolean;
  rationale: string;
  days: ProgramDayV3[];
  /** Ugens samlede stressbudget. */
  stress: SessionStress;
  issues: ConstraintIssue[];
}

export interface AssessmentPlan {
  /** Hvad der mangler, og hvorfor der ikke bygges et fuldt program endnu. */
  missing: { label: string; suggestion: string }[];
  weeks: number;
  explanation: string;
}

export interface ProgramV3 {
  id: string;
  seed: number;
  sport: SportId;
  goalName: string;
  createdAt: string;
  weeks: ProgramWeekV3[];
  minutes: number;
  daysPerWeek: number;
  /** Training max pr. hovedløft, med koefficient og forklaring. */
  trainingMaxes: Partial<Record<LiftId, TrainingMax>>;
  provenance: EngineProvenance;
  assessment: AssessmentPlan | null;
  issues: ConstraintIssue[];
  explanation: string[];
  /** Version af selve programobjektet. Øges ved hver adaptation. */
  version: number;
}
