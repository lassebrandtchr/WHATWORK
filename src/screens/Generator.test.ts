import { describe, expect, it } from 'vitest';
import { PICKABLE } from './Generator.js';
import { BY_ID } from '../engine/data/exercises.js';

describe('PICKABLE — ønskede/udelukkede øvelser i generatoren', () => {
  it('indeholder bænkpres, skrå bænkpres og push-up-varianterne', () => {
    ['bench_press', 'incline_bench_press', 'push_up', 'diamond_push_up', 'decline_push_up']
      .forEach((id) => expect(PICKABLE).toContain(id));
  });

  it('alle id\'er i listen findes rent faktisk i øvelseskataloget', () => {
    PICKABLE.forEach((id) => {
      expect(BY_ID[id], `ukendt øvelse i PICKABLE: ${id}`).toBeDefined();
    });
  });
});
