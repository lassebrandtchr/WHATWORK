/**
 * Broen mellem programmotoren og skærmene.
 *
 * Skærmene arbejder med `Program`-formatet fra `src/engine`. Motoren arbejder med
 * `ProgramV3`, som bærer faser, provenance, belastningsgrundlag og lint. Filen her
 * projicerer det ene ned i det andet, så den visuelle kontrakt kan bevares uden at
 * programlogikken skal presses ind i en datamodel bygget til Dagens WOD.
 */

import type { LevelId, Program, ProgramDay, ProgramWeek, Profile } from '../engine/types.js';
import { LIFT_NAMES } from '../domain/types.js';
import type { LiftId } from '../domain/types.js';
import type { ConstraintIssue } from '../domain/types.js';
import { sessionToWorkout } from './session.js';
import type { RenderContext } from './session.js';
import type { ProgramV3 } from './types.js';

export interface LegacyContext {
  profile: Profile;
  bodyweight: number;
  level: LevelId;
  equipment: string[];
  plates: number[];
  bars: number[];
}

const toNotes = (issues: ConstraintIssue[]): NonNullable<ProgramWeek['notes']> =>
  issues.map((i) => ({
    code: i.code,
    severity: i.severity,
    message: i.message,
    ...(i.fix ? { fix: i.fix } : {}),
  }));

/**
 * Bygger den `Program`, skærmene viser.
 *
 * Hver dags planlagte session renderes til en `Workout`, men den strukturerede plan
 * bliver ikke kasseret — den ligger stadig i programmet, som Historik gemmer.
 */
export function toLegacyProgram(plan: ProgramV3, ctx: LegacyContext): Program {
  const weeks: ProgramWeek[] = plan.weeks.map((week) => {
    const days: ProgramDay[] = week.days.map((day) => {
      if (!day.session) {
        return {
          day: day.day,
          status: day.status,
          workout: null,
          error: day.error ?? 'Passet kunne ikke bygges med de valgte data.',
          progression: 1,
        };
      }

      const renderCtx: RenderContext = {
        // Seeden pr. dag udledes af programmets seed, så et pas kan genskabes præcist.
        seed: plan.seed + week.index * 100 + day.day,
        profile: ctx.profile,
        bodyweight: ctx.bodyweight,
        level: ctx.level,
        equipment: ctx.equipment,
        plates: ctx.plates,
        bars: ctx.bars,
        minutes: plan.minutes,
        createdAt: plan.createdAt,
      };

      return {
        day: day.day,
        status: day.status,
        workout: sessionToWorkout(day.session, renderCtx),
        error: null,
        progression: 1,
        stimulus: day.session.stimulus,
        plannedMinutes: day.session.plannedMinutes,
      };
    });

    return {
      index: week.index,
      deload: week.deload,
      rationale: week.rationale,
      days,
      phaseName: week.phaseName,
      taper: week.taper,
      assessment: week.assessment,
      notes: toNotes(week.issues),
    };
  });

  const trainingMaxes = (Object.keys(plan.trainingMaxes) as LiftId[])
    .map((lift) => {
      const tm = plan.trainingMaxes[lift];
      if (!tm) return null;
      return {
        lift,
        name: LIFT_NAMES[lift],
        kg: tm.kg,
        coefficient: tm.coefficient,
        explanation: tm.explanation,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    id: plan.id,
    seed: plan.seed,
    goal: plan.sport,
    goalName: plan.goalName,
    weeks,
    createdAt: plan.createdAt,
    minutes: plan.minutes,
    daysPerWeek: plan.daysPerWeek,
    level: ctx.level,
    equipment: ctx.equipment,
    explanation: plan.explanation,
    notes: toNotes(plan.issues),
    assessment: plan.assessment
      ? { missing: plan.assessment.missing, explanation: plan.assessment.explanation }
      : null,
    trainingMaxes,
    provenance: plan.provenance,
    version: plan.version,
  };
}
