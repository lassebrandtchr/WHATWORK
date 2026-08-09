/**
 * Weekly adapter: den sløjfe, der gør programmet adaptivt.
 *
 * Ugens actuals afgør, hvad næste uge gør — og programmet skal kunne forklare
 * præcis hvilke actuals der udløste progress, hold, regress eller deload.
 */

import { buildLoadRange } from '../domain/rounding.js';
import { adjustAfterTopSet } from '../domain/strength.js';
import type { LoadRange } from '../domain/types.js';
import { decideWeek } from './progression.js';
import type { ProgressionOutcome, WeeklyActuals } from './progression.js';
import type { ProgramV3, ProgramWeekV3, SetPrescription } from './types.js';

export interface AdaptationResult {
  program: ProgramV3;
  outcome: ProgressionOutcome;
  /** Menneskelæsbar sporing af, hvad der blev ændret. */
  changes: string[];
}

function scaleLoadRange(range: LoadRange, factor: number): LoadRange {
  if (factor === 1) return range;
  const percent = (range.provenance.percent ?? 1) * factor;
  // Grundtallet udledes tilbage fra target, så provenance-teksten bliver ved med
  // at pege på det rigtige training max.
  const reference = range.provenance.percent
    ? range.targetKg / range.provenance.percent
    : range.targetKg;
  return buildLoadRange({
    referenceKg: reference,
    basis: range.provenance.basis,
    percent,
    confidence: range.provenance.confidence,
    benchmarkIds: range.provenance.benchmarkIds,
    referenceLabel: range.provenance.basis === 'trainingMax' ? 'training max' : 'e1RM',
    stepKg: range.provenance.roundingKg,
  });
}

function adaptSet(set: SetPrescription, outcome: ProgressionOutcome): SetPrescription {
  const next: SetPrescription = { ...set };

  if (outcome.variable === 'load' && set.load) {
    next.load = scaleLoadRange(set.load, outcome.loadFactor);
    next.percent = set.percent === null ? null : set.percent * outcome.loadFactor;
  }
  if (outcome.volumeFactor !== 1 && set.type !== 'top') {
    next.sets = Math.max(1, Math.round(set.sets * outcome.volumeFactor));
  }
  if (outcome.decision === 'deload' && set.type === 'assistance') {
    // Assistance med høj træthed fjernes ikke her, men skæres til ét sæt.
    next.sets = 1;
  }
  return next;
}

/**
 * Anvender ugens beslutning på den næste ikke-gennemførte uge.
 *
 * De uger, der allerede er gennemført, røres ikke — historikken skal blive ved med
 * at vise, hvad der faktisk stod i planen.
 */
export function adaptProgram(
  program: ProgramV3,
  completedWeekIndex: number,
  actuals: WeeklyActuals,
): AdaptationResult {
  const outcome = decideWeek(actuals);
  const changes: string[] = [];

  const weeks: ProgramWeekV3[] = program.weeks.map((week) => {
    if (week.index <= completedWeekIndex) return week;
    // Kun den førstkommende uge justeres. Resten af forløbet ligger fast, indtil
    // den uge også er kørt — ellers ville én dårlig uge skrive hele blokken om.
    if (week.index !== completedWeekIndex + 1) return week;

    const days = week.days.map((day) => {
      if (!day.session) return day;
      const session = {
        ...day.session,
        anchors: day.session.anchors.map((s) => adaptSet(s, outcome)),
        supplemental: day.session.supplemental.map((s) => adaptSet(s, outcome)),
        assistance: outcome.decision === 'deload'
          ? day.session.assistance.slice(0, 1).map((s) => adaptSet(s, outcome))
          : day.session.assistance.map((s) => adaptSet(s, outcome)),
        conditioning: outcome.decision === 'deload' || outcome.decision === 'regress'
          ? day.session.conditioning.map((c) => ({
            ...c,
            zone: 'low' as const,
            minutes: Math.max(8, Math.round(c.minutes * 0.7)),
          }))
          : day.session.conditioning,
        explanation: [
          ...day.session.explanation,
          `Justeret efter uge ${completedWeekIndex}: ${outcome.explanation}`,
        ],
      };
      return { ...day, session };
    });

    // Ved rescope skæres antallet af pas ned til det, brugeren reelt gennemfører.
    const trimmed = outcome.suggestedSessions !== null
      ? days.slice(0, outcome.suggestedSessions).map((d, i) => ({ ...d, day: i + 1 }))
      : days;

    if (outcome.suggestedSessions !== null) {
      changes.push(
        `Uge ${week.index} er skrevet om til ${outcome.suggestedSessions} pas i stedet for `
        + `${week.days.length}.`,
      );
    }
    if (outcome.loadFactor !== 1) {
      changes.push(
        `Belastningen i uge ${week.index} er ganget med ${outcome.loadFactor.toFixed(3)}.`,
      );
    }
    if (outcome.volumeFactor !== 1) {
      changes.push(`Volumen i uge ${week.index} er sat til ${Math.round(outcome.volumeFactor * 100)} %.`);
    }

    return {
      ...week,
      deload: outcome.decision === 'deload' ? true : week.deload,
      days: trimmed,
      rationale: outcome.decision === 'deload'
        ? `Roligere uge udløst af dine actuals: ${outcome.triggers.join(' ')}`
        : week.rationale,
      issues: [...week.issues, ...outcome.issues],
    };
  });

  return {
    program: { ...program, weeks, version: program.version + 1 },
    outcome,
    changes: changes.length ? changes : ['Ingen ændringer — planen holdes som skrevet.'],
  };
}

/**
 * Justerer resten af dagens pas ud fra et gennemført top-sæt.
 *
 * Det er den korte sløjfe: dagens performance kalibrerer backoff, i stedet for at
 * et tal fra sidste måned bestemmer hele passet.
 */
export function applyTopSetResult(
  sets: SetPrescription[],
  topSetId: string,
  result: { actualRpe: number; technicalFailure?: boolean; painScore?: number; missedRep?: boolean },
): { sets: SetPrescription[]; explanation: string } {
  const top = sets.find((s) => s.id === topSetId);
  if (!top || top.targetRpe === null) {
    return { sets, explanation: 'Top-sættet kunne ikke findes, så backoff er uændret.' };
  }

  const adjustment = adjustAfterTopSet({
    targetRpe: top.targetRpe,
    actualRpe: result.actualRpe,
    ...(result.technicalFailure !== undefined ? { technicalFailure: result.technicalFailure } : {}),
    ...(result.painScore !== undefined ? { painScore: result.painScore } : {}),
    ...(result.missedRep !== undefined ? { missedRep: result.missedRep } : {}),
  });

  if (adjustment.outcome === 'stop') {
    return {
      sets: sets.filter((s) => s.exerciseId !== top.exerciseId || s.id === topSetId),
      explanation: adjustment.explanation,
    };
  }

  let dropped = 0;
  const next = sets.map((s) => {
    if (s.type !== 'backoff' || s.exerciseId !== top.exerciseId) return s;
    if (dropped < adjustment.dropSets && s.sets > 1) {
      dropped += 1;
      return {
        ...s,
        sets: s.sets - 1,
        load: s.load ? scaleLoadRange(s.load, adjustment.loadFactor) : null,
      };
    }
    return { ...s, load: s.load ? scaleLoadRange(s.load, adjustment.loadFactor) : null };
  });

  return { sets: next, explanation: adjustment.explanation };
}
