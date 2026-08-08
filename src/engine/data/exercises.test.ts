import { describe, expect, it } from 'vitest';
import { BY_ID, EXERCISES } from './exercises.js';
import { MUSCLE_BY_ID } from './muscles.js';

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

describe('bicep curl med håndvægte', () => {
  const curl = BY_ID.db_curl;

  it('findes, kræver håndvægte og er et par', () => {
    expect(curl).toBeDefined();
    expect(curl?.eq).toEqual(['dumbbell']);
    expect(curl?.pair).toBe(true);
    expect(curl?.load?.m).toBeGreaterThan(0);
    expect(curl?.load?.f).toBeGreaterThan(0);
  });

  it('rammer arme og greb', () => {
    expect(curl?.mus).toContain('arms');
    expect(curl?.mus).toContain('grip');
  });

  /* En isolationsøvelse må aldrig bære en Hyrox-hoveddel af sig selv — men den
     skal stadig kunne lægges ind, når brugeren udtrykkeligt ønsker den. */
  it('er en accessory, så den kun kommer med når den ønskes', () => {
    expect(curl?.accessory).toBe(true);
  });

  it('regnes som muskulært krævende, så intervaller får realistiske reps og pauser', () => {
    expect(curl?.grind).toBe('high');
  });
});

describe('muskelgrupper på øvelserne', () => {
  const pickable = EXERCISES.filter((e) => e.cat !== 'warmup');

  it('hver øvelse uden for opvarmningen har mindst én muskelgruppe', () => {
    pickable.forEach((e) => {
      expect(e.mus.length, `${e.id} mangler muskelgruppe`).toBeGreaterThan(0);
    });
  });

  it('alle muskelgrupper er kendte id\'er', () => {
    EXERCISES.forEach((e) => e.mus.forEach((m) => {
      expect(MUSCLE_BY_ID[m], `ukendt muskelgruppe "${m}" på ${e.id}`).toBeDefined();
    }));
  });

  it('ingen øvelse gentager den samme muskelgruppe', () => {
    EXERCISES.forEach((e) => {
      expect(new Set(e.mus).size, `dublet i mus på ${e.id}`).toBe(e.mus.length);
    });
  });
});

describe('Burpee Broad Jump (Del P)', () => {
  it('findes i kataloget som en fuldgyldig hoveddels-øvelse', () => {
    const ex = BY_ID.burpee_broad_jump;
    expect(ex).toBeDefined();
    expect(ex?.accessory).toBeUndefined();
    expect(ex?.elig).not.toBe('disabled');
    expect(ex?.elig).not.toBe('coach-only');
  });
});
