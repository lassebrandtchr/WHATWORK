import { describe, expect, it } from 'vitest';
import { freshGen } from './useWhatwork.js';
import type { UserProfile } from '../types.js';

const profile: UserProfile = {
  name: 'Test', level: 3, sex: 'm', bodyweight: 82,
  equipment: null, counts: {}, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  bars: [20, 15], onboarded: true,
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
