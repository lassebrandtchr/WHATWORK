import { describe, expect, it } from 'vitest';
import { buildStrength } from './blocks.js';
import { normalizeRequest } from './request.js';
import { BY_ID } from './data/exercises.js';
import type { Exercise, NormalizedRequest } from './types.js';

function req(level: number): NormalizedRequest {
  return normalizeRequest({ minutes: 30, men: 1, level, seed: 1 });
}

function byId(id: string): Exercise {
  const ex = BY_ID[id];
  if (!ex) throw new Error(`ukendt øvelse: ${id}`);
  return ex;
}

const backSquat = byId('back_squat');
const cleanAndJerk = byId('clean_and_jerk');

describe('buildStrength — ramp til tung 5RM', () => {
  it('kan vælge ramp-skemaet ved niveau 5 for et kvalificerende løft', () => {
    // rnd() returnerer altid 0.999 → pick() vælger sidste indgang i puljen, som er en
    // ramp-kopi, når niveau ≥ 3 og løftet kvalificerer.
    const rnd = () => 0.999;
    const block = buildStrength(req(5), rnd, 20, backSquat, null);

    expect(block.scheme).toBe('ramp');
    expect(block.movements).toHaveLength(5);
    expect(block.movements.every((m) => m.sets === 1 && m.restSec === 150)).toBe(true);
  });

  it('bygger fem sæt med stigende belastning, der ender i det tunge 5RM-sæt', () => {
    const rnd = () => 0.999;
    const block = buildStrength(req(5), rnd, 20, backSquat, null);
    const kilos = block.movements.map((m) => m.targets[0]?.load?.totalKg ?? 0);

    for (let i = 1; i < kilos.length; i++) {
      expect(kilos[i]).toBeGreaterThanOrEqual(kilos[i - 1] as number);
    }
    expect(block.movements[0]?.display).toContain('Eksempel');
    expect(block.movements[4]?.display).toContain('tung 5RM');
  });

  it('forklarer i cue\'en på første sæt, hvad en 5RM er, og at tallene er et eksempel', () => {
    const rnd = () => 0.999;
    const block = buildStrength(req(5), rnd, 20, backSquat, null);
    expect(block.movements[0]?.cue).toContain('5RM');
    expect(block.movements[0]?.cue).toContain('eksempel');
  });

  it('vælger aldrig ramp-skemaet under niveau 3', () => {
    const rnd = () => 0.999;
    const block = buildStrength(req(2), rnd, 20, backSquat, null);
    expect(block.scheme).toBeUndefined();
    expect(block.movements).toHaveLength(1);
  });

  it('vælger aldrig ramp-skemaet til et ikke-kvalificerende løft', () => {
    const rnd = () => 0.999;
    const block = buildStrength(req(5), rnd, 20, cleanAndJerk, null);
    expect(block.scheme).toBeUndefined();
  });

  it('bruger samme samlede sæt-tid som det tilsvarende flade 5×5-skema', () => {
    // pool[0] er altid det første flade skema i SCHEMES_TRAINED: { s: 5, r: 5, pct: 0.78 }.
    const flat = buildStrength(req(5), () => 0, 20, backSquat, null);
    const ramp = buildStrength(req(5), () => 0.999, 20, backSquat, null);

    const flatTime = flat.movements.reduce((s, m) => s + m.workSec, 0);
    const rampTime = ramp.movements.reduce((s, m) => s + m.workSec, 0);
    expect(flat.title).toContain('5 × 5');
    expect(rampTime).toBe(flatTime);
  });
});
