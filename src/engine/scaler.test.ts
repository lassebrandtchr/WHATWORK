import { describe, expect, it } from 'vitest';
import { generateWorkout } from './smartmix.js';
import { restDescription, sameIdentity, scaleWorkout } from './scaler.js';
import type { Workout } from './types.js';

function build(seed: number, over: Record<string, unknown> = {}): Workout {
  const res = generateWorkout({
    minutes: 30, level: 3, condition: 6, strength: 5, men: 1, seed, ...over,
  });
  if (!res.ok) throw new Error(res.error);
  return res.workout;
}

describe('scaleWorkout bevarer workoutens identitet', () => {
  const seeds = [11, 222, 3333, 44444, 555555, 6, 77, 888];

  it('beholder format og øvelser i begge retninger', () => {
    seeds.forEach((seed) => {
      const original = build(seed);
      (['easier', 'harder'] as const).forEach((direction) => {
        const scaled = scaleWorkout(original, direction).workout;
        expect(sameIdentity(original, scaled), `seed ${seed} ${direction}`).toBe(true);
      });
    });
  });

  it('beholder workoutens id og signatur', () => {
    const original = build(4242);
    const scaled = scaleWorkout(original, 'easier').workout;
    expect(scaled.id).toBe(original.id);
    expect(scaled.signature.key).toBe(original.signature.key);
    expect(scaled.format).toBe(original.format);
  });

  it('rører ikke opvarmningen', () => {
    const original = build(909);
    const scaled = scaleWorkout(original, 'easier').workout;
    const warm = (w: Workout): string => JSON.stringify(w.blocks.filter((b) => b.kind === 'warmup'));
    expect(warm(scaled)).toBe(warm(original));
  });

  it('gør arbejdet mindre, når der gøres lettere', () => {
    const original = build(1234);
    const scaled = scaleWorkout(original, 'easier').workout;
    const work = (w: Workout): number => w.blocks
      .filter((b) => b.kind !== 'warmup')
      .reduce((s, b) => s + b.movements.reduce((x, m) => x + m.reps, 0), 0);
    expect(work(scaled)).toBeLessThan(work(original));
  });

  it('gør arbejdet større, når der gøres hårdere', () => {
    const original = build(1234);
    const scaled = scaleWorkout(original, 'harder').workout;
    const work = (w: Workout): number => w.blocks
      .filter((b) => b.kind !== 'warmup')
      .reduce((s, b) => s + b.movements.reduce((x, m) => x + m.reps, 0), 0);
    expect(work(scaled)).toBeGreaterThan(work(original));
  });
});

describe('scaleWorkout leverer en konkret diff', () => {
  it('viser hvad der blev ændret, med fra og til', () => {
    const result = scaleWorkout(build(555), 'easier');
    expect(result.changes.length).toBeGreaterThan(0);
    result.changes.forEach((c) => {
      expect(c.from).toBeTruthy();
      expect(c.to).toBeTruthy();
      expect(c.from).not.toBe(c.to);
      expect(c.text).toContain('→');
    });
  });

  it('forklarer hvad der blev bevaret', () => {
    const result = scaleWorkout(build(555), 'easier');
    expect(result.preserved).toContain('Samme');
    expect(result.preserved).toContain('minutter');
  });

  it('giver ikke fem identiske linjer for fem deltagere', () => {
    const result = scaleWorkout(build(31, { men: 3, women: 2 }), 'easier');
    const keys = result.changes.map((c) => `${c.kind}|${c.subject}|${c.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('opdaterer også deltagernes mål, ikke kun overskriften', () => {
    const original = build(777);
    const scaled = scaleWorkout(original, 'easier').workout;
    const main = scaled.blocks.find((b) => b.kind !== 'warmup');
    main?.movements.forEach((m) => {
      expect(m.targets[0]?.amount).toBe(m.reps);
    });
  });

  it('skriver ændringen ind i forklaringen', () => {
    const result = scaleWorkout(build(888), 'easier');
    expect(result.workout.explanation.join(' ')).toContain('Gjort lettere');
  });
});

describe('sameIdentity', () => {
  it('afviser to forskellige workouts', () => {
    expect(sameIdentity(build(1), build(999999))).toBe(false);
  });

  it('godkender en workout mod sig selv', () => {
    const w = build(42);
    expect(sameIdentity(w, w)).toBe(true);
  });
});

describe('restDescription', () => {
  it('siger tydeligt fra, når der ikke er en reel pause', () => {
    const block = {
      id: 'b', kind: 'conditioning' as const, title: 'EMOM', format: 'emom' as const,
      minutes: 10, prescription: '', everySec: 60,
      movements: [{ workSec: 58 } as never],
    };
    expect(restDescription(block)).toContain('ikke en reel pause');
  });

  it('angiver pausens længde, når der er en', () => {
    const block = {
      id: 'b', kind: 'conditioning' as const, title: 'EMOM', format: 'emom' as const,
      minutes: 10, prescription: '', everySec: 60,
      movements: [{ workSec: 30 } as never],
    };
    expect(restDescription(block)).toContain('30 sekunder');
  });

  it('siger ingenting for formater uden intervalvindue', () => {
    const block = {
      id: 'b', kind: 'conditioning' as const, title: 'AMRAP', format: 'amrap' as const,
      minutes: 10, prescription: '', movements: [],
    };
    expect(restDescription(block)).toBe('');
  });
});
