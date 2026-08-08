import { describe, expect, it } from 'vitest';
import { scaleLoad } from './loads.js';
import { BY_ID } from './data/exercises.js';
import { DEFAULT_SANDBAGS } from './data/equipment.js';
import type { Person } from './types.js';

const sandbagClean = BY_ID.sandbag_clean!;

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
