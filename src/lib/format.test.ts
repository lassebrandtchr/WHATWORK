import { describe, expect, it } from 'vitest';
import { fmtTime, initialsOf, plural, relDate } from './format.js';

describe('fmtTime', () => {
  it('formaterer under et minut', () => {
    expect(fmtTime(7)).toBe('0:07');
  });

  it('nulstiller sekunder ved hele minutter', () => {
    expect(fmtTime(600)).toBe('10:00');
  });

  it('viser fortegn, når tiden er løbet over cap', () => {
    expect(fmtTime(-65)).toBe('-1:05');
  });
});

describe('relDate', () => {
  const now = new Date('2026-08-07T12:00:00Z');

  it('kalder samme dag "I dag"', () => {
    expect(relDate('2026-08-07T06:00:00Z', now)).toBe('I dag');
  });

  it('kalder dagen før "I går"', () => {
    expect(relDate('2026-08-06T06:00:00Z', now)).toBe('I går');
  });

  it('tæller dage inden for ugen', () => {
    expect(relDate('2026-08-03T12:00:00Z', now)).toBe('4 dage siden');
  });

  it('falder tilbage til en dato efter en uge', () => {
    expect(relDate('2026-06-01T12:00:00Z', now)).toMatch(/juni|jun/);
  });

  it('returnerer tom streng for ugyldig dato', () => {
    expect(relDate('ikke en dato', now)).toBe('');
  });
});

describe('plural og initialer', () => {
  it('vælger ental ved 1', () => {
    expect(plural(1, 'session', 'sessioner')).toBe('session');
    expect(plural(2, 'session', 'sessioner')).toBe('sessioner');
  });

  it('falder tilbage til G, når navnet er tomt', () => {
    expect(initialsOf('')).toBe('G');
    expect(initialsOf('lasse')).toBe('L');
  });
});
