import { describe, expect, it } from 'vitest';
import { chooseExercises, ensureFullBodyCoverage, mainPool } from './smartmix.js';
import { normalizeRequest } from './request.js';
import { mulberry32 } from './rng.js';
import { BY_ID } from './data/exercises.js';
import type { Exercise, NormalizedRequest } from './types.js';

function byId(id: string): Exercise {
  const ex = BY_ID[id];
  if (!ex) throw new Error(`ukendt øvelse: ${id}`);
  return ex;
}

function req(focus: NormalizedRequest['focus'] = 'allround'): NormalizedRequest {
  return normalizeRequest({ minutes: 30, men: 1, level: 3, focus, seed: 1 });
}

const strictPress = byId('strict_press');
const pushPress = byId('push_press');
const dbRow = byId('db_row');

describe('ensureFullBodyCoverage', () => {
  it('bytter en overrepræsenteret skulderøvelse ud, når trækmønsteret helt mangler', () => {
    const r = req('allround');
    const pool = mainPool(r);
    const out = [strictPress, pushPress, byId('air_squat')];

    const balanced = ensureFullBodyCoverage(out, pool, r, mulberry32(1));

    expect(balanced.some((e) => e.cat === 'pull')).toBe(true);
    expect(balanced.filter((e) => e.cat === 'press')).toHaveLength(1);
    expect(balanced).toHaveLength(3);
  });

  it('rører ikke listen, når intet mønster er overrepræsenteret', () => {
    const r = req('allround');
    const pool = mainPool(r);
    const out = [strictPress, dbRow, byId('air_squat')];

    const balanced = ensureFullBodyCoverage(out, pool, r, mulberry32(1));

    expect(balanced).toEqual(out);
  });

  it('griber ikke ind, når brugeren selv har valgt et snævrende fokus', () => {
    const r = req('upper');
    const pool = mainPool(r);
    const out = [strictPress, pushPress, byId('bench_press')];

    const balanced = ensureFullBodyCoverage(out, pool, r, mulberry32(1));

    expect(balanced).toEqual(out);
  });
});

describe('chooseExercises — fuld krop og bredere variation', () => {
  it('vælger aldrig to skulderøvelser, mens trækmønsteret helt mangler, ved bredt fokus', () => {
    const r = req('allround');
    for (let seed = 1; seed <= 150; seed++) {
      const exs = chooseExercises(r, mulberry32(seed), 4);
      const press = exs.filter((e) => e.cat === 'press').length;
      const pull = exs.filter((e) => e.cat === 'pull').length;
      if (press >= 2) {
        expect(pull).toBeGreaterThan(0);
      }
    }
  });
});
