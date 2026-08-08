import { describe, expect, it } from 'vitest';
import { BY_ID } from './exercises.js';

describe('nye pres-øvelser (Del C+G)', () => {
  it('Bench Press og Dumbbell Bench Press bruger en bænk, ikke en box', () => {
    expect(BY_ID.bench_press?.eq).toEqual(['barbell', 'bench']);
    expect(BY_ID.db_bench?.eq).toEqual(['dumbbell', 'bench']);
  });

  it('Incline Bench Press findes, bruger en bænk, og har lavere referencevægt end fladt bænkpres', () => {
    const incline = BY_ID.incline_bench_press;
    const flat = BY_ID.bench_press;
    expect(incline).toBeDefined();
    expect(incline?.eq).toEqual(['barbell', 'bench']);
    expect(incline?.eq).not.toContain('box');
    expect(incline?.load?.m ?? 0).toBeLessThan(flat?.load?.m ?? 0);
    expect(incline?.load?.f ?? 0).toBeLessThan(flat?.load?.f ?? 0);
  });

  it('Diamond og Decline Push-up findes og er fuldgyldige hoveddels-øvelser, ikke skaleringer', () => {
    expect(BY_ID.diamond_push_up).toBeDefined();
    expect(BY_ID.diamond_push_up?.accessory).toBeUndefined();
    expect(BY_ID.diamond_push_up?.eq).toEqual(['bodyweight']);

    expect(BY_ID.decline_push_up).toBeDefined();
    expect(BY_ID.decline_push_up?.accessory).toBeUndefined();
    expect(BY_ID.decline_push_up?.eq).toEqual(['box']);
  });

  it('almindelig Push-up findes stadig uændret', () => {
    expect(BY_ID.push_up).toBeDefined();
    expect(BY_ID.push_up?.eq).toEqual(['bodyweight']);
  });
});
