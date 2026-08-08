import { describe, expect, it } from 'vitest';
import { scaleLoad, stepLoad } from './loads.js';
import { BY_ID } from './data/exercises.js';
import { DEFAULT_SANDBAGS } from './data/equipment.js';
import type { Exercise, Person } from './types.js';

function byId(id: string): Exercise {
  const ex = BY_ID[id];
  if (!ex) throw new Error(`ukendt øvelse: ${id}`);
  return ex;
}

const sandbagClean = byId('sandbag_clean');

const person = (overrides: Partial<Person> = {}): Person => ({
  label: 'Test', profile: 'm', bodyweight: 88, level: 4, ...overrides,
});

describe('scaleLoad — sandbag snapper til brugerens eget udstyr', () => {
  it('snapper til standardlisten (10/20/30 kg), når intet udstyr er angivet', () => {
    const load = scaleLoad(sandbagClean, person());
    expect(load).not.toBeNull();
    expect(DEFAULT_SANDBAGS).toContain(load?.totalKg);
  });

  it('snapper til den brugerangivne liste, ikke standardlisten', () => {
    const load = scaleLoad(sandbagClean, person(), { sandbags: [10] });
    expect(load?.totalKg).toBe(10);
  });

  it('falder tilbage til standardlisten, hvis brugeren ikke har markeret nogen sandbag-vægte', () => {
    const load = scaleLoad(sandbagClean, person(), { sandbags: [] });
    expect(DEFAULT_SANDBAGS).toContain(load?.totalKg);
  });

  it('en let, uøvet kvinde lander på en lettere sandbag end en referencemand', () => {
    const light = scaleLoad(sandbagClean, person({ profile: 'f', level: 1, bodyweight: 55 }), {
      sandbags: [10, 20, 30],
    });
    const reference = scaleLoad(sandbagClean, person(), { sandbags: [10, 20, 30] });
    expect(light?.totalKg).toBeLessThan(reference?.totalKg ?? 0);
  });
});

describe('stepLoad — juster vægten ét trin op eller ned', () => {
  const benchPress = byId('bench_press');
  const kbSwing = byId('kb_swing');
  const sandbagClean2 = byId('sandbag_clean');

  it('lægger 5 kg til en vægtstangsøvelse og genberegner skiverne', () => {
    const next = stepLoad(benchPress, 'barbell', 60, 1, {});
    expect(next.totalKg).toBe(65);
    expect(next.plates).toBeDefined();
    expect(next.text).toContain('65 kg i alt');
  });

  it('trækker 5 kg fra en vægtstangsøvelse', () => {
    const next = stepLoad(benchPress, 'barbell', 60, -1, {});
    expect(next.totalKg).toBe(55);
  });

  it('rammer den faktiske nabo-kettlebell, ikke en vilkårlig ±2,5 kg', () => {
    // KETTLEBELLS = [8, 10, 12, 16, 20, 24, 28, 32, 36, 40] — fra 20 er naboen 24, ikke 22,5.
    const up = stepLoad(kbSwing, 'single', 20, 1, {});
    expect(up.eachKg).toBe(24);
    const down = stepLoad(kbSwing, 'single', 20, -1, {});
    expect(down.eachKg).toBe(16);
  });

  it('går ikke under/over listens grænser ved gentagne tryk', () => {
    const atMax = stepLoad(kbSwing, 'single', 40, 1, {});
    expect(atMax.eachKg).toBe(40);
    const atMin = stepLoad(kbSwing, 'single', 8, -1, {});
    expect(atMin.eachKg).toBe(8);
  });

  it('bruger brugerens egen sandbag-liste, ligesom scaleLoad', () => {
    const next = stepLoad(sandbagClean2, 'bag', 10, 1, { sandbags: [10, 20, 30] });
    expect(next.eachKg).toBe(20);
  });
});
