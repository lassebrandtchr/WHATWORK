import { describe, expect, it } from 'vitest';
import { freshGen, personWeight } from './useWhatwork.js';
import type { UserProfile } from '../types.js';

const profile: UserProfile = {
  name: 'Test', level: 3, sex: 'm', bodyweight: 82,
  equipment: null, counts: {}, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  bars: [20, 15], sandbags: [10, 20, 30], onboarded: true,
};

describe('freshGen — individuel kropsvægt', () => {
  it('starter i gennemsnit-tilstand med tomme individuelle vægte', () => {
    const g = freshGen(profile);
    expect(g.individualWeights).toBe(false);
    expect(g.weightsM).toEqual([]);
    expect(g.weightsF).toEqual([]);
    expect(g.weightsX).toEqual([]);
  });
});

describe('personWeight', () => {
  it('falder tilbage til gruppens gennemsnit, når personen ikke er individuelt justeret', () => {
    const g = { ...freshGen(profile), bwM: 90, weightsM: [] };
    expect(personWeight(g, 'M', 0)).toBe(90);
  });

  it('bruger den individuelt satte vægt, når den findes', () => {
    const g = { ...freshGen(profile), bwM: 90, weightsM: [78] };
    expect(personWeight(g, 'M', 0)).toBe(78);
    expect(personWeight(g, 'M', 1)).toBe(90);
  });
});
