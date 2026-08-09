import { describe, expect, it } from 'vitest';
import {
  benchmarkFromSet, benchmarkFromValue, e1rmFor, effectiveConfidence, isFresh,
  latestFor, missingBenchmarks, needsAssessmentWeek, repsFromMaxUnbroken,
} from './benchmarks.js';
import type { Benchmark } from './types.js';

const NOW = '2026-08-09T00:00:00.000Z';

describe('benchmarkFromSet', () => {
  it('gemmer e1RM, protokol og confidence', () => {
    const b = benchmarkFromSet({
      subjectId: 'squat', protocol: 'topSetRpe', loadKg: 150, reps: 3, rpe: 8, date: NOW,
    });
    expect(b.kind).toBe('strength');
    expect(b.e1rmKg).toBeGreaterThan(150);
    expect(b.confidence).toBeGreaterThan(0.5);
    expect(b.invalid).toBeUndefined();
  });

  it('markerer sæt med smerte som ugyldige', () => {
    const b = benchmarkFromSet({
      subjectId: 'squat', protocol: 'topSetRpe', loadKg: 150, reps: 3, rpe: 8, painFlag: true, date: NOW,
    });
    expect(b.invalid).toBe(true);
  });

  it('markerer højreps-sæt som ugyldige til tunge loads', () => {
    const b = benchmarkFromSet({
      subjectId: 'squat', protocol: 'amrap', loadKg: 60, reps: 20, date: NOW,
    });
    expect(b.invalid).toBe(true);
  });

  it('lader ikke protokollen give højere confidence end estimatet', () => {
    const b = benchmarkFromSet({
      subjectId: 'squat', protocol: '1rm', loadKg: 100, reps: 8, date: NOW,
    });
    expect(b.confidence).toBeLessThan(0.9);
  });
});

describe('friskhed og confidence', () => {
  const base: Benchmark = {
    id: 'a', subjectId: 'squat', kind: 'strength', protocol: '1rm',
    date: '2026-08-01T00:00:00.000Z', value: 180, unit: 'kg', confidence: 0.9, e1rmKg: 180,
  };

  it('regner et nyt benchmark som friskt', () => {
    expect(isFresh(base, NOW)).toBe(true);
  });

  it('regner et gammelt benchmark som forældet', () => {
    expect(isFresh({ ...base, date: '2026-01-01T00:00:00.000Z' }, NOW)).toBe(false);
  });

  it('trækker confidence ned med alderen', () => {
    const old = effectiveConfidence({ ...base, date: '2026-01-01T00:00:00.000Z' }, NOW);
    expect(old).toBeLessThan(base.confidence);
    expect(old).toBeGreaterThan(0);
  });

  it('giver ugyldige benchmarks nul vægt', () => {
    expect(effectiveConfidence({ ...base, invalid: true }, NOW)).toBe(0);
  });
});

describe('latestFor og e1rmFor', () => {
  const list: Benchmark[] = [
    { id: 'a', subjectId: 'squat', kind: 'strength', protocol: '1rm', date: '2026-07-01T00:00:00.000Z', value: 170, unit: 'kg', confidence: 0.9, e1rmKg: 170 },
    { id: 'b', subjectId: 'squat', kind: 'strength', protocol: '1rm', date: '2026-08-01T00:00:00.000Z', value: 180, unit: 'kg', confidence: 0.9, e1rmKg: 180 },
  ];

  it('finder det nyeste', () => {
    expect(latestFor(list, 'squat')?.id).toBe('b');
  });

  it('leverer et rullende e1RM med benchmark-id-er', () => {
    const r = e1rmFor(list, 'squat', NOW);
    expect(r?.currentKg).toBe(175);
    expect(r?.benchmarkIds).toHaveLength(2);
  });
});

describe('missingBenchmarks', () => {
  it('kræver alle fire løft for strength4', () => {
    const missing = missingBenchmarks('strength4', [], undefined, NOW);
    expect(missing.map((m) => m.subjectId).sort()).toEqual(['bench', 'deadlift', 'ohp', 'squat']);
    expect(needsAssessmentWeek(missing)).toBe(true);
  });

  it('kræver kun de tre officielle løft for powerlifting', () => {
    const missing = missingBenchmarks('powerlifting', [], undefined, NOW);
    expect(missing.map((m) => m.subjectId)).not.toContain('ohp');
    expect(missing).toHaveLength(3);
  });

  it('kræver løbedata for HYROX og blokerer uden dem', () => {
    const missing = missingBenchmarks('hyrox', [], undefined, NOW);
    expect(missing.some((m) => m.subjectId === 'run_weekly_km' && m.blocking)).toBe(true);
  });

  it('blokerer ikke CrossFit på manglende benchmarks', () => {
    const missing = missingBenchmarks('crossfit', [], undefined, NOW);
    expect(missing.length).toBeGreaterThan(0);
    expect(needsAssessmentWeek(missing)).toBe(false);
  });

  it('fjerner et krav, når der findes et gyldigt benchmark', () => {
    const bm = benchmarkFromSet({
      subjectId: 'squat', protocol: 'topSetRpe', loadKg: 150, reps: 3, rpe: 8, date: NOW,
    });
    const missing = missingBenchmarks('strength4', [bm], undefined, NOW);
    expect(missing.map((m) => m.subjectId)).not.toContain('squat');
  });

  it('foreslår aldrig et gættet maksimum', () => {
    missingBenchmarks('strength4', [], undefined, NOW).forEach((m) => {
      expect(m.suggestion.length).toBeGreaterThan(10);
      expect(m.suggestion).not.toMatch(/\d+\s?kg/);
    });
  });
});

describe('benchmarkFromValue', () => {
  it('gemmer ikke-styrke-benchmarks med enhed', () => {
    const b = benchmarkFromValue({
      subjectId: 'pull_up', kind: 'maxUnbroken', protocol: 'maxUnbroken',
      value: 12, unit: 'reps', date: NOW,
    });
    expect(b.kind).toBe('maxUnbroken');
    expect(b.unit).toBe('reps');
    expect(b.confidence).toBeGreaterThan(0.5);
  });
});

describe('repsFromMaxUnbroken', () => {
  it('sætter reps konservativt og lavere med flere runder', () => {
    const few = repsFromMaxUnbroken(20, { rounds: 3, sustained: true });
    const many = repsFromMaxUnbroken(20, { rounds: 10, sustained: true });
    expect(few.reps).toBeGreaterThan(many.reps);
    expect(many.reps).toBeLessThan(20);
    expect(many.explanation).toContain('%');
  });

  it('giver altid mindst én rep', () => {
    expect(repsFromMaxUnbroken(1, { rounds: 12, sustained: true }).reps).toBe(1);
  });
});
