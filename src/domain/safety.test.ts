import { describe, expect, it } from 'vitest';
import {
  PAIN_STOP_THRESHOLD, assessReadiness, assessSafety, checkPain,
  emptyScreening, resolveScreeningStatus,
} from './safety.js';
import {
  CONSTRAINT_CODES, checkConfidence, checkDuration, checkStressBudget,
  dedupe, errorsOf, hasErrors, issue, severityOf, warningsOf,
} from './constraints.js';
import { estimateSession, itemSeconds, restForPurpose, trimToFit, wodBudget } from './timeEstimator.js';
import type { TimedItem } from './timeEstimator.js';
import type { PainEntry, Screening } from './types.js';

const NOW = '2026-08-09T00:00:00.000Z';

const screening = (over: Partial<Screening> = {}): Screening => ({
  ...emptyScreening(), answeredAt: NOW, status: 'cleared', ...over,
});

const pain = (over: Partial<PainEntry> = {}): PainEntry => ({
  region: 'shoulder', score: 2, aggravators: [], updatedAt: NOW, ...over,
});

describe('screening', () => {
  it('giver refer ved alarmsymptom', () => {
    expect(resolveScreeningStatus(['chest_pain'])).toBe('refer');
    expect(resolveScreeningStatus(['syncope'])).toBe('refer');
  });

  it('giver restricted ved kendt sygdom', () => {
    expect(resolveScreeningStatus(['known_cardiac'])).toBe('restricted');
  });

  it('giver cleared uden flag', () => {
    expect(resolveScreeningStatus([])).toBe('cleared');
  });

  it('stopper generering ved alarmsymptom og henviser videre', () => {
    const v = assessSafety(screening({ flags: ['chest_pain'] }), NOW);
    expect(v.mayTrain).toBe(false);
    expect(hasErrors(v.issues)).toBe(true);
    expect(v.issues[0]?.fix).toContain('læge');
  });

  it('diagnosticerer ikke, men henviser', () => {
    const v = assessSafety(screening({ flags: ['chest_pain'] }), NOW);
    const text = v.issues.map((i) => `${i.message} ${i.fix ?? ''}`).join(' ');
    expect(text).not.toMatch(/diagnos|sygdom er|du har en/i);
    expect(text).toContain('vurdere');
  });

  it('slår høj intensitet fra ved sygdom uden at blokere træning', () => {
    const v = assessSafety(screening({ flags: ['illness_fever'] }), NOW);
    expect(v.mayTrain).toBe(true);
    expect(v.allowsHighIntensity).toBe(false);
    expect(v.allowsMaxTesting).toBe(false);
  });

  it('advarer om en gammel screening', () => {
    const v = assessSafety(screening({ answeredAt: '2025-08-09T00:00:00.000Z' }), NOW);
    expect(v.issues.some((i) => i.code === 'SCREEN_STALE')).toBe(true);
  });

  it('advarer, når screeningen aldrig er besvaret', () => {
    const v = assessSafety(emptyScreening(), NOW);
    expect(v.issues.some((i) => i.code === 'SCREEN_MISSING')).toBe(true);
    expect(v.mayTrain).toBe(true);
  });
});

describe('smerte', () => {
  it('blokerer en øvelse, brugeren selv har markeret som forværrende', () => {
    const v = checkPain('dip', [pain({ aggravators: ['dip'] })]);
    expect(v.blocked).toBe(true);
    expect(v.reason).toContain('dips');
  });

  it('blokerer ved smerte på 4 eller derover i et relevant område', () => {
    const v = checkPain('bench_press', [pain({ region: 'shoulder', score: PAIN_STOP_THRESHOLD })]);
    expect(v.blocked).toBe(true);
  });

  it('begrænser, men blokerer ikke, ved let kendt smerte', () => {
    const v = checkPain('bench_press', [pain({ region: 'shoulder', score: 2 })]);
    expect(v.blocked).toBe(false);
    expect(v.restricted).toBe(true);
    expect(v.reason).toContain('Stop, hvis det bliver værre');
  });

  it('rører ikke øvelser uden for smerteområdet', () => {
    const v = checkPain('back_squat', [pain({ region: 'shoulder', score: 6 })]);
    expect(v.blocked).toBe(false);
    expect(v.restricted).toBe(false);
  });
});

describe('readiness', () => {
  it('ændrer intet uden data', () => {
    const v = assessReadiness(null);
    expect(v.volumeFactor).toBe(1);
    expect(v.loadFactor).toBe(1);
  });

  it('reducerer kun let ved lav readiness og beder om revurdering', () => {
    const v = assessReadiness({ sleep: 1, stress: 5, soreness: 5, motivation: 1 });
    expect(v.volumeFactor).toBeGreaterThanOrEqual(0.8);
    expect(v.message).toContain('Revurdér efter opvarmningen');
  });

  it('lader god readiness køre planen som skrevet', () => {
    const v = assessReadiness({ sleep: 5, stress: 1, soreness: 1, motivation: 5 });
    expect(v.volumeFactor).toBe(1);
  });
});

describe('constraints', () => {
  it('kender sværhedsgraden for hver kode', () => {
    expect(severityOf(CONSTRAINT_CODES.MISSING_ANCHOR)).toBe('error');
    expect(severityOf(CONSTRAINT_CODES.LOW_CONFIDENCE)).toBe('warning');
  });

  it('afviser et pas, der overskrider tiden med mere end 10 %', () => {
    const errs = errorsOf(checkDuration(60, 45));
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe('TIME_IMPOSSIBLE');
  });

  it('accepterer en overskridelse inden for 10 %', () => {
    expect(errorsOf(checkDuration(48, 45))).toHaveLength(0);
  });

  it('advarer tæt på tidsgrænsen', () => {
    const w = warningsOf(checkDuration(43, 45));
    expect(w[0]?.code).toBe('NEAR_TIME_LIMIT');
  });

  it('advarer om lav confidence', () => {
    expect(checkConfidence(0.3, 'Belastningen')).toHaveLength(1);
    expect(checkConfidence(0.8, 'Belastningen')).toHaveLength(0);
  });

  it('advarer om et stort volumenspring', () => {
    const w = checkStressBudget(
      { hardSets: 40, axial: 10, impact: 5, highSkillFatigue: 1 },
      { hardSets: 20, axial: 10, impact: 5, highSkillFatigue: 1 },
    );
    expect(w.some((i) => i.code === 'VOLUME_JUMP')).toBe(true);
  });

  it('fjerner dubletter', () => {
    const a = issue(CONSTRAINT_CODES.LOW_CONFIDENCE, 'Samme');
    expect(dedupe([a, { ...a }])).toHaveLength(1);
  });
});

describe('time estimator', () => {
  const item = (over: Partial<TimedItem> = {}): TimedItem => ({
    id: 'a', label: 'Back squat', exerciseId: 'back_squat', priority: 'anchor',
    sets: 4, reps: 5, secondsPerRep: 4, restSeconds: 210, ...over,
  });

  it('regner pauser med, ikke kun reps', () => {
    const short = itemSeconds(item({ restSeconds: 60 }));
    const long = itemSeconds(item({ restSeconds: 240 }));
    expect(long - short).toBe(3 * 180);
  });

  it('holder ikke pause efter sidste sæt', () => {
    expect(itemSeconds(item({ sets: 1, restSeconds: 300 })))
      .toBe(itemSeconds(item({ sets: 1, restSeconds: 30 })));
  });

  it('lægger skift og brief oveni', () => {
    const e = estimateSession([item(), item({ id: 'b' })]);
    expect(e.transitionSeconds).toBeGreaterThan(0);
    expect(e.totalSeconds).toBeGreaterThan(itemSeconds(item()) * 2);
  });

  it('trimmer assistance før hovedarbejdet', () => {
    const items = [
      item({ id: 'squat', priority: 'anchor' }),
      item({ id: 'bench', priority: 'anchor', exerciseId: 'bench_press', label: 'Bænkpres' }),
      item({ id: 'curl', priority: 'assistance', exerciseId: 'db_curl', label: 'Curl', sets: 3, reps: 12, secondsPerRep: 3, restSeconds: 90 }),
      item({ id: 'row', priority: 'conditioning', exerciseId: 'row', label: 'RowERG', sets: 1, reps: 40, secondsPerRep: 4, restSeconds: 0 }),
    ];
    // Passet er beregnet til ca. 37 minutter, så 30 tvinger en trimning.
    expect(estimateSession(items).totalMinutes).toBeGreaterThan(30);
    const r = trimToFit(items, 30);
    expect(r.removed.map((x) => x.id)).toContain('curl');
    expect(r.items.map((x) => x.id)).toContain('squat');
    expect(r.items.map((x) => x.id)).toContain('bench');
    expect(r.stillTooLong).toBe(false);
  });

  it('rører ikke et pas, der allerede passer i tiden', () => {
    const items = [item({ id: 'squat' }), item({ id: 'curl', priority: 'assistance' })];
    expect(trimToFit(items, 90).removed).toHaveLength(0);
  });

  it('skærer aldrig i pauserne til hovedløftene', () => {
    const items = [item({ id: 'squat', priority: 'anchor', restSeconds: 240 })];
    const r = trimToFit(items, 5);
    expect(r.items[0]?.restSeconds).toBe(240);
    expect(r.stillTooLong).toBe(true);
  });

  it('giver realistiske pauser til tunge compounds', () => {
    const [lo, hi] = restForPurpose('strength');
    expect(lo).toBeGreaterThanOrEqual(180);
    expect(hi).toBeGreaterThanOrEqual(300);
  });

  it('følger specifikationens tidsbudgetter for Dagens WOD', () => {
    expect(wodBudget(12).warmupMinutes).toEqual([4, 6]);
    expect(wodBudget(30).mainMinutes).toEqual([10, 20]);
    expect(wodBudget(45).warmupMinutes).toEqual([10, 15]);
    expect(wodBudget(90).rule).toContain('tilfældigt metcon');
  });
});
