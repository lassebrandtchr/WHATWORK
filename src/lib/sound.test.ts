import { describe, expect, it } from 'vitest';
import { kindFor } from './sound.js';

describe('kindFor — hvilken ankomst-lyd/tekst der vises ved et segmentskift', () => {
  it('markerer sessionens start, når arbejdet begynder efter "gør klar"', () => {
    expect(kindFor('prep', 'work')).toBe('start');
  });

  it('markerer at en pause starter, uanset om man kommer fra arbejde eller et skift', () => {
    expect(kindFor('work', 'rest')).toBe('rest_start');
    expect(kindFor('transition', 'rest')).toBe('rest_start');
  });

  it('markerer at pausen slutter, og arbejdet genoptages', () => {
    expect(kindFor('rest', 'work')).toBe('rest_end');
  });

  it('markerer et øvelsesskift mellem to arbejdssegmenter, eller ind i et skift-segment', () => {
    expect(kindFor('work', 'work')).toBe('switch');
    expect(kindFor('work', 'transition')).toBe('switch');
  });

  it('returnerer null for overgange, der ikke skal varsles med en nedtælling', () => {
    expect(kindFor('work', 'done')).toBeNull();
    expect(kindFor('transition', 'transition')).toBeNull();
    expect(kindFor('rest', 'done')).toBeNull();
  });
});
