import { describe, expect, it } from 'vitest';
import {
  adjustAfterTopSet, epley1rm, estimate1rm, median, percentOf1rm,
  rirToRpe, rollingE1rm, rpeToRir, trainingMaxFrom,
} from './strength.js';
import type { Benchmark } from './types.js';

const bm = (over: Partial<Benchmark>): Benchmark => ({
  id: 'x', subjectId: 'squat', kind: 'strength', protocol: 'topSetRpe',
  date: '2026-08-01T00:00:00.000Z', value: 150, unit: 'kg', confidence: 0.8, ...over,
});

describe('RPE og RIR', () => {
  it('spejler hinanden på skalaen', () => {
    expect(rpeToRir(10)).toBe(0);
    expect(rpeToRir(8)).toBe(2);
    expect(rirToRpe(2)).toBe(8);
    expect(rirToRpe(0)).toBe(10);
  });

  it('klemmer værdier uden for skalaen', () => {
    expect(rpeToRir(12)).toBe(0);
    expect(rirToRpe(9)).toBe(4);
  });
});

describe('percentOf1rm', () => {
  it('rammer tabellens hjørner', () => {
    expect(percentOf1rm(1, 10)).toBeCloseTo(1, 5);
    expect(percentOf1rm(5, 8)).toBeCloseTo(0.811, 3);
    expect(percentOf1rm(10, 6)).toBeCloseTo(0.626, 3);
  });

  it('interpolerer mellem halve RPE-trin', () => {
    const p = percentOf1rm(3, 8.25) as number;
    expect(p).toBeGreaterThan(percentOf1rm(3, 8) as number);
    expect(p).toBeLessThan(percentOf1rm(3, 8.5) as number);
  });

  it('afviser reps uden for tabellen', () => {
    expect(percentOf1rm(11, 8)).toBeNull();
    expect(percentOf1rm(0, 8)).toBeNull();
  });
});

describe('estimate1rm', () => {
  it('bruger RPE-tabellen når RPE er kendt', () => {
    const e = estimate1rm({ loadKg: 100, reps: 5, rpe: 8 });
    expect(e.method).toBe('rpe-table');
    // 100 / 0,811 ≈ 123,3
    expect(e.e1rmKg).toBeCloseTo(123.3, 1);
    expect(e.usableForHeavyLoads).toBe(true);
  });

  it('behandler en single ved RPE 10 som målt, ikke estimeret', () => {
    const e = estimate1rm({ loadKg: 180, reps: 1, rpe: 10 });
    expect(e.method).toBe('direct');
    expect(e.e1rmKg).toBe(180);
    expect(e.confidence).toBeGreaterThan(0.9);
  });

  it('falder tilbage til Epley uden RPE og med lavere confidence', () => {
    const withRpe = estimate1rm({ loadKg: 100, reps: 5, rpe: 8 });
    const without = estimate1rm({ loadKg: 100, reps: 5 });
    expect(without.method).toBe('epley');
    expect(without.e1rmKg).toBeCloseTo(epley1rm(100, 5), 1);
    expect(without.confidence).toBeLessThan(withRpe.confidence);
  });

  it('gør sæt med teknikbrud eller smerte ubrugelige til tunge loads', () => {
    const e = estimate1rm({ loadKg: 100, reps: 3, rpe: 9, technicalFailure: true });
    expect(e.usableForHeavyLoads).toBe(false);
    expect(e.confidence).toBeLessThanOrEqual(0.25);
  });

  it('markerer sæt over ti reps som ubrugelige til tunge loads', () => {
    const e = estimate1rm({ loadKg: 60, reps: 15 });
    expect(e.usableForHeavyLoads).toBe(false);
  });

  it('giver lavere confidence jo flere reps sættet har', () => {
    const few = estimate1rm({ loadKg: 150, reps: 2, rpe: 8 });
    const many = estimate1rm({ loadKg: 100, reps: 9, rpe: 8 });
    expect(many.confidence).toBeLessThan(few.confidence);
  });
});

describe('rollingE1rm', () => {
  const now = '2026-08-09T00:00:00.000Z';

  it('bruger medianen, så ét godt sæt ikke flytter programmet', () => {
    const list = [
      bm({ id: 'a', e1rmKg: 180, date: '2026-08-01T00:00:00.000Z' }),
      bm({ id: 'b', e1rmKg: 182, date: '2026-07-25T00:00:00.000Z' }),
      bm({ id: 'c', e1rmKg: 230, date: '2026-07-18T00:00:00.000Z' }),
    ];
    const r = rollingE1rm(list, 'squat', now);
    expect(r?.currentKg).toBe(182);
    expect(r?.bestRecentKg).toBe(230);
  });

  it('ignorerer ugyldige sæt', () => {
    const list = [
      bm({ id: 'a', e1rmKg: 180 }),
      bm({ id: 'b', e1rmKg: 400, invalid: true }),
    ];
    const r = rollingE1rm(list, 'squat', now);
    expect(r?.bestRecentKg).toBe(180);
    expect(r?.sampleSize).toBe(1);
  });

  it('sænker confidence for gamle tests', () => {
    const fresh = rollingE1rm([bm({ e1rmKg: 180, date: '2026-08-05T00:00:00.000Z' })], 'squat', now);
    const old = rollingE1rm([bm({ e1rmKg: 180, date: '2026-01-05T00:00:00.000Z' })], 'squat', now);
    expect((old?.confidence ?? 1)).toBeLessThan(fresh?.confidence ?? 0);
  });

  it('returnerer null uden data', () => {
    expect(rollingE1rm([], 'squat', now)).toBeNull();
  });

  it('bruger højst fire sæt', () => {
    const list = Array.from({ length: 8 }, (_, i) => bm({
      id: `b${i}`, e1rmKg: 100 + i, date: `2026-0${8 - Math.floor(i / 4)}-0${(i % 4) + 1}T00:00:00.000Z`,
    }));
    expect(rollingE1rm(list, 'squat', now)?.sampleSize).toBe(4);
  });
});

describe('trainingMaxFrom', () => {
  it('bruger 90 % som standard og gemmer koefficienten', () => {
    const tm = trainingMaxFrom(200, 0.8);
    expect(tm.kg).toBe(180);
    expect(tm.coefficient).toBe(0.9);
    expect(tm.explanation).toContain('90 %');
    expect(tm.explanation).toContain('training max');
  });

  it('bliver mere konservativ ved lav confidence', () => {
    const tm = trainingMaxFrom(200, 0.3);
    expect(tm.coefficient).toBe(0.85);
    expect(tm.kg).toBe(170);
  });
});

describe('adjustAfterTopSet', () => {
  it('holder planen inden for en halv RPE', () => {
    expect(adjustAfterTopSet({ targetRpe: 8, actualRpe: 8.25 }).outcome).toBe('hold');
  });

  it('øger let, når top-sættet var lettere end målet', () => {
    const a = adjustAfterTopSet({ targetRpe: 8, actualRpe: 7 });
    expect(a.outcome).toBe('increase');
    expect(a.loadFactor).toBeGreaterThan(1);
  });

  it('reducerer ved én RPE over målet', () => {
    const a = adjustAfterTopSet({ targetRpe: 8, actualRpe: 9 });
    expect(a.outcome).toBe('reduce_small');
    expect(a.loadFactor).toBeCloseTo(0.96, 2);
    expect(a.dropSets).toBe(0);
  });

  it('reducerer mere og fjerner et sæt ved to RPE over', () => {
    const a = adjustAfterTopSet({ targetRpe: 8, actualRpe: 10 });
    expect(a.outcome).toBe('reduce_large');
    expect(a.dropSets).toBe(1);
  });

  it('stopper bevægelsen ved smerte på 4 eller derover', () => {
    const a = adjustAfterTopSet({ targetRpe: 8, actualRpe: 8, painScore: 5 });
    expect(a.outcome).toBe('stop');
    expect(a.explanation).toContain('Smerte');
  });

  it('stopper ved teknikbrud', () => {
    expect(adjustAfterTopSet({ targetRpe: 8, actualRpe: 8, technicalFailure: true }).outcome).toBe('stop');
  });
});

describe('median', () => {
  it('håndterer lige og ulige længder', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
