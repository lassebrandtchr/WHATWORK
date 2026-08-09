/**
 * Constraint validation: hard errors og warnings.
 *
 * Alle koder ligger i ét register, så en fejl har præcis én dansk formulering,
 * uanset om den kommer fra Program eller fra Generér workout. Hard errors blokerer
 * output; warnings vises, men stopper ikke.
 */

import type { ConstraintIssue, ConstraintSeverity } from './types.js';

export const CONSTRAINT_CODES = {
  /* Hard errors */
  MISSING_ANCHOR: 'MISSING_ANCHOR',
  MISSING_BENCHMARK: 'MISSING_BENCHMARK',
  LOAD_WITHOUT_BASIS: 'LOAD_WITHOUT_BASIS',
  INVALID_RULESET: 'INVALID_RULESET',
  TIME_IMPOSSIBLE: 'TIME_IMPOSSIBLE',
  EQUIPMENT_INSUFFICIENT: 'EQUIPMENT_INSUFFICIENT',
  COMPETENCE_CONFLICT: 'COMPETENCE_CONFLICT',
  PAIN_CONFLICT: 'PAIN_CONFLICT',
  CONTRADICTORY_CONSTRAINTS: 'CONTRADICTORY_CONSTRAINTS',
  DUPLICATE_STRESSOR: 'DUPLICATE_STRESSOR',
  SCREEN_ALARM: 'SCREEN_ALARM',

  /* Warnings */
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  HIGH_TOTAL_STRESS: 'HIGH_TOTAL_STRESS',
  VOLUME_JUMP: 'VOLUME_JUMP',
  FATIGUE_CONFLICT: 'FATIGUE_CONFLICT',
  MISSING_READINESS: 'MISSING_READINESS',
  NEAR_TIME_LIMIT: 'NEAR_TIME_LIMIT',
  POPULATION_ASSUMPTION: 'POPULATION_ASSUMPTION',
  STALE_BENCHMARK: 'STALE_BENCHMARK',
  NO_PROGRESSION: 'NO_PROGRESSION',
  NO_DELOAD: 'NO_DELOAD',
  CONDITIONING_BEFORE_STRENGTH: 'CONDITIONING_BEFORE_STRENGTH',
  ASSISTANCE_CHURN: 'ASSISTANCE_CHURN',
  RULESET_UNVERIFIED: 'RULESET_UNVERIFIED',
} as const;

export type ConstraintCode = typeof CONSTRAINT_CODES[keyof typeof CONSTRAINT_CODES];

const SEVERITY: Record<ConstraintCode, ConstraintSeverity> = {
  MISSING_ANCHOR: 'error',
  MISSING_BENCHMARK: 'error',
  LOAD_WITHOUT_BASIS: 'error',
  INVALID_RULESET: 'error',
  TIME_IMPOSSIBLE: 'error',
  EQUIPMENT_INSUFFICIENT: 'error',
  COMPETENCE_CONFLICT: 'error',
  PAIN_CONFLICT: 'error',
  CONTRADICTORY_CONSTRAINTS: 'error',
  DUPLICATE_STRESSOR: 'error',
  SCREEN_ALARM: 'error',

  LOW_CONFIDENCE: 'warning',
  HIGH_TOTAL_STRESS: 'warning',
  VOLUME_JUMP: 'warning',
  FATIGUE_CONFLICT: 'warning',
  MISSING_READINESS: 'warning',
  NEAR_TIME_LIMIT: 'warning',
  POPULATION_ASSUMPTION: 'warning',
  STALE_BENCHMARK: 'warning',
  NO_PROGRESSION: 'warning',
  NO_DELOAD: 'warning',
  CONDITIONING_BEFORE_STRENGTH: 'warning',
  ASSISTANCE_CHURN: 'warning',
  RULESET_UNVERIFIED: 'warning',
};

export const severityOf = (code: ConstraintCode): ConstraintSeverity => SEVERITY[code];

export function issue(
  code: ConstraintCode,
  message: string,
  opts: { fix?: string; scope?: string } = {},
): ConstraintIssue {
  return {
    code,
    severity: SEVERITY[code],
    message,
    ...(opts.fix ? { fix: opts.fix } : {}),
    ...(opts.scope ? { scope: opts.scope } : {}),
  };
}

export const hasErrors = (issues: ConstraintIssue[]): boolean =>
  issues.some((i) => i.severity === 'error');

export const errorsOf = (issues: ConstraintIssue[]): ConstraintIssue[] =>
  issues.filter((i) => i.severity === 'error');

export const warningsOf = (issues: ConstraintIssue[]): ConstraintIssue[] =>
  issues.filter((i) => i.severity === 'warning');

/** Fjerner dubletter, så samme fejl ikke vises fem gange for fem dage. */
export function dedupe(issues: ConstraintIssue[]): ConstraintIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.code}|${i.scope ?? ''}|${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ---------- Konkrete kontroller ---------- */

/** Passet må højst overskride brugerens tid med 10 %. */
export const TIME_OVERRUN_TOLERANCE = 0.1;
/** Over 90 % af den tilgængelige tid er stadig lovligt, men værd at sige. */
export const TIME_WARNING_THRESHOLD = 0.9;

export function checkDuration(
  estimatedMinutes: number,
  availableMinutes: number,
  scope = 'session',
): ConstraintIssue[] {
  if (availableMinutes <= 0) return [];
  const ratio = estimatedMinutes / availableMinutes;
  if (ratio > 1 + TIME_OVERRUN_TOLERANCE) {
    return [issue(
      CONSTRAINT_CODES.TIME_IMPOSSIBLE,
      `Passet er beregnet til ${estimatedMinutes} minutter, men du har afsat ${availableMinutes}.`,
      {
        fix: 'Sæt tiden op, eller lad motoren fjerne den lavest prioriterede assistance.',
        scope,
      },
    )];
  }
  if (ratio >= TIME_WARNING_THRESHOLD) {
    return [issue(
      CONSTRAINT_CODES.NEAR_TIME_LIMIT,
      `Passet fylder ${Math.round(ratio * 100)} % af din tid. Der er ikke meget luft til skift.`,
      { scope },
    )];
  }
  return [];
}

export function checkConfidence(
  confidence: number,
  what: string,
  scope = 'load',
): ConstraintIssue[] {
  if (confidence >= 0.45) return [];
  return [issue(
    CONSTRAINT_CODES.LOW_CONFIDENCE,
    `${what} bygger på et usikkert grundlag (${Math.round(confidence * 100)} % sikkerhed).`,
    { fix: 'Log et sæt eller en test, så bliver forslaget dit eget.', scope },
  )];
}

export interface StressBudget {
  hardSets: number;
  axial: number;
  impact: number;
  highSkillFatigue: number;
}

/**
 * Kontrollerer ugens samlede stress mod atletens dokumenterede tolerance.
 *
 * Grænserne er relative til, hvad atleten faktisk har lavet de seneste fire uger —
 * ikke absolutte tal. Det er forskellen på et budget og et gæt.
 */
export function checkStressBudget(
  planned: StressBudget,
  tolerance: StressBudget,
  scope = 'week',
): ConstraintIssue[] {
  const out: ConstraintIssue[] = [];
  const jump = (a: number, b: number): number => (b <= 0 ? (a > 0 ? 99 : 1) : a / b);

  if (jump(planned.hardSets, tolerance.hardSets) > 1.3 && tolerance.hardSets > 0) {
    out.push(issue(
      CONSTRAINT_CODES.VOLUME_JUMP,
      `Ugen har ${planned.hardSets} hårde sæt mod dine seneste ${tolerance.hardSets}. `
      + 'Det er en større stigning, end der normalt er brug for.',
      { fix: 'Skru et par sæt ned, eller læg stigningen over to uger.', scope },
    ));
  }
  if (planned.axial > tolerance.axial * 1.4 && tolerance.axial > 0) {
    out.push(issue(
      CONSTRAINT_CODES.HIGH_TOTAL_STRESS,
      'Ugen indeholder markant mere tung aksial belastning, end du plejer.',
      { scope },
    ));
  }
  if (planned.impact > tolerance.impact * 1.5 && tolerance.impact > 0) {
    out.push(issue(
      CONSTRAINT_CODES.HIGH_TOTAL_STRESS,
      'Ugen indeholder markant flere stødbelastende bevægelser, end du plejer.',
      { fix: 'Byt en løbe- eller hopdel ud med maskinarbejde.', scope },
    ));
  }
  return out;
}
