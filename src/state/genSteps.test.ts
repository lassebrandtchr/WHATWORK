import { describe, expect, it } from 'vitest';
import { freshGen, genStepsFor } from './useWhatwork.js';
import { emptyScreening } from '../domain/safety.js';
import type { UserProfile } from '../types.js';

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  name: 'Test', level: 3, sex: 'm', bodyweight: 82,
  equipment: ['bodyweight', 'barbell'], counts: {},
  plates: [25, 20, 15, 10, 5], bars: [20], sandbags: [20],
  onboarded: true, age: null, benchmarks: [], competence: [], weakPoints: [],
  screening: emptyScreening(), ...over,
});

/** Trin, brugeren aktivt skal svare på — opsummeringen er en bekræftelse, ikke et valg. */
const choices = (steps: string[]): string[] => steps.filter((s) => s !== 'summary');

describe('generatorens trin', () => {
  it('lader en tilbagevendende bruger nøjes med omkring tre valg', () => {
    const p = profile();
    const steps = genStepsFor(p, freshGen(p), 12);
    expect(choices(steps)).toEqual(['time', 'people', 'direction']);
  });

  it('lader en ny bruger komme i gang med omkring fem svar', () => {
    const p = profile({ onboarded: true });
    const steps = genStepsFor(p, freshGen(p), 0);
    expect(choices(steps)).toEqual(['time', 'people', 'level', 'equip', 'direction']);
  });

  it('spørger kun om deltagernes vægt, når der er flere deltagere', () => {
    const p = profile();
    const solo = genStepsFor(p, freshGen(p), 12);
    expect(solo).not.toContain('weight');

    const pair = genStepsFor(p, { ...freshGen(p), women: 1 }, 12);
    expect(pair).toContain('weight');
  });

  it('slutter altid med opsummeringen', () => {
    const p = profile();
    [0, 1, 20].forEach((count) => {
      const steps = genStepsFor(p, freshGen(p), count);
      expect(steps[steps.length - 1]).toBe('summary');
    });
  });

  it('spørger om niveau og udstyr igen, hvis brugeren ikke har gennemført onboarding', () => {
    const p = profile({ onboarded: false });
    const steps = genStepsFor(p, freshGen(p), 20);
    expect(steps).toContain('level');
    expect(steps).toContain('equip');
  });

  it('gentager aldrig et trin', () => {
    const p = profile();
    const steps = genStepsFor(p, { ...freshGen(p), women: 2 }, 0);
    expect(new Set(steps).size).toBe(steps.length);
  });
});
