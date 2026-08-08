import { describe, expect, it } from 'vitest';
import { PICKABLE } from './Generator.js';
import { BY_ID, EXERCISES } from '../engine/data/exercises.js';

describe('PICKABLE — ønskede/udelukkede øvelser i generatoren', () => {
  it('indeholder bænkpres, skrå bænkpres og push-up-varianterne', () => {
    ['bench_press', 'incline_bench_press', 'push_up', 'diamond_push_up', 'decline_push_up']
      .forEach((id) => expect(PICKABLE).toContain(id));
  });

  it('indeholder bicep curl med håndvægte', () => {
    expect(PICKABLE).toContain('db_curl');
  });

  it('alle id\'er i listen findes rent faktisk i øvelseskataloget', () => {
    PICKABLE.forEach((id) => {
      expect(BY_ID[id], `ukendt øvelse i PICKABLE: ${id}`).toBeDefined();
    });
  });

  /* Det var netop det, den håndplukkede liste blev ved med at fejle på: en ny
     øvelse kom i kataloget, men aldrig i generatoren. */
  it('dækker hele kataloget bortset fra opvarmning og deaktiverede øvelser', () => {
    const expected = EXERCISES
      .filter((e) => e.cat !== 'warmup' && e.elig !== 'disabled' && e.elig !== 'coach-only')
      .map((e) => e.id);
    expect([...PICKABLE].sort()).toEqual([...expected].sort());
  });

  it('indeholder ingen opvarmningsøvelser', () => {
    PICKABLE.forEach((id) => expect(BY_ID[id]?.cat).not.toBe('warmup'));
  });
});
