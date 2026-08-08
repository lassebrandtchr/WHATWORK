import { describe, expect, it } from 'vitest';
import { buildConditioning, buildStrength } from './blocks.js';
import { normalizeRequest } from './request.js';
import { mulberry32 } from './rng.js';
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
const pushPress = byId('push_press');
const burpee = byId('burpee');
const ski = byId('ski');
const row = byId('row');

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

describe('buildConditioning — realistisk tempo på tungt udstyr', () => {
  // Reproducerer bug-scenariet: team rotation med høj kondition giver 45 sek. arbejde
  // pr. station. Med det gamle, faste fill (0.9) og loft (hi × 1.5) blev det til 14
  // Push Press på 45 sek. — over øvelsens eget rep-loft på 12.
  const heavyReq = normalizeRequest({ minutes: 20, men: 1, level: 4, condition: 9, seed: 1 });

  it('overskrider aldrig øvelsens eget rep-loft for tungt udstyr i team rotation', () => {
    const block = buildConditioning(heavyReq, mulberry32(1), {
      format: 'team_rotation', exercises: [pushPress], minutes: 12,
    });
    const reps = block?.movements[0]?.reps ?? 0;
    expect(reps).toBeGreaterThan(0);
    expect(reps).toBeLessThanOrEqual(12);
  });

  it('tilføjer en "bryd op i sæt"-cue, når reptallet er højt på tungt udstyr', () => {
    const block = buildConditioning(heavyReq, mulberry32(1), {
      format: 'team_rotation', exercises: [pushPress], minutes: 12,
    });
    const m = block?.movements[0];
    expect(m?.reps).toBeGreaterThanOrEqual(7);
    expect(m?.cue).toContain('bryd det gerne op');
  });

  it('ændrer ikke tempoet eller cuen for kropsvægtsøvelser', () => {
    const block = buildConditioning(heavyReq, mulberry32(1), {
      format: 'team_rotation', exercises: [burpee], minutes: 12,
    });
    const m = block?.movements[0];
    expect(m?.cue).not.toContain('bryd det gerne op');
  });
});

describe('buildConditioning — EMOM med hvileminut', () => {
  it('indsætter intet hvileminut, når intensiteten er lav', () => {
    const req = normalizeRequest({ minutes: 20, men: 1, level: 3, condition: 4, seed: 1 });
    const block = buildConditioning(req, mulberry32(1), {
      format: 'emom', exercises: [ski, row], minutes: 20,
    });
    expect(block?.restEveryCycle).toBeUndefined();
  });

  it('indsætter et hvileminut for hver fulde rotation, når intensiteten er høj', () => {
    const req = normalizeRequest({ minutes: 25, men: 1, level: 3, condition: 9, seed: 1 });
    const block = buildConditioning(req, mulberry32(1), {
      format: 'emom', exercises: [ski, row], minutes: 25,
    });
    expect(block?.restEveryCycle).toBe(true);
    // 2 øvelser + 1 hvile = 3 min pr. cyklus → floor(25/3) = 8 cyklusser.
    expect(block?.rounds).toBe(8);
    expect(block?.title).toContain('med hvile');
    expect(block?.prescription).toContain('hvileminut');
  });

  it('kræver mindst 2 øvelser for at aktivere hvile-cyklussen', () => {
    const req = normalizeRequest({ minutes: 20, men: 1, level: 3, condition: 9, seed: 1 });
    const block = buildConditioning(req, mulberry32(1), {
      format: 'emom', exercises: [ski], minutes: 20,
    });
    expect(block?.restEveryCycle).toBeUndefined();
  });

  it('rører ikke E2MOM — kun almindelig EMOM får hvile-cyklussen', () => {
    const req = normalizeRequest({ minutes: 25, men: 1, level: 3, condition: 9, seed: 1 });
    const block = buildConditioning(req, mulberry32(1), {
      format: 'e2mom', exercises: [ski, row], minutes: 25,
    });
    expect(block?.restEveryCycle).toBeUndefined();
  });
});
