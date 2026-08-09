import { describe, expect, it } from 'vitest';
import {
  buildLoadRange, loadRangeText, loadableOnBar, populationPriorRange,
  roundDownToStep, roundToStep,
} from './rounding.js';

describe('afrunding', () => {
  it('runder til nærmeste trin', () => {
    expect(roundToStep(101.2, 2.5)).toBe(100);
    expect(roundToStep(101.5, 2.5)).toBe(102.5);
    expect(roundToStep(103.8, 5)).toBe(105);
  });

  it('runder ned, når den sikre side er nedad', () => {
    expect(roundDownToStep(101.2, 2.5)).toBe(100);
    expect(roundDownToStep(104.9, 5)).toBe(100);
    expect(roundDownToStep(100, 2.5)).toBe(100);
  });
});

describe('loadableOnBar', () => {
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];

  it('godkender en vægt, skiverne kan ramme præcist', () => {
    expect(loadableOnBar(100, 20, plates)).toBe(100);
    expect(loadableOnBar(20, 20, plates)).toBe(20);
  });

  it('afviser en vægt, der ikke kan samles', () => {
    expect(loadableOnBar(101, 20, [25, 20, 15, 10, 5])).toBeNull();
  });

  it('afviser en vægt under stangen', () => {
    expect(loadableOnBar(15, 20, plates)).toBeNull();
  });
});

describe('buildLoadRange', () => {
  it('bygger et interval med sporbar provenance', () => {
    const r = buildLoadRange({
      referenceKg: 180, basis: 'trainingMax', percent: 0.82, confidence: 0.8,
      benchmarkIds: ['bm1'], referenceLabel: 'training max',
    });
    expect(r.targetKg).toBe(147.5);
    expect(r.lowKg).toBeLessThanOrEqual(r.targetKg);
    expect(r.highKg).toBeGreaterThanOrEqual(r.targetKg);
    expect(r.provenance.basis).toBe('trainingMax');
    expect(r.provenance.benchmarkIds).toEqual(['bm1']);
    expect(r.provenance.roundingKg).toBe(2.5);
    expect(r.provenance.explanation).toContain('82 %');
    expect(r.provenance.explanation).toContain('training max');
  });

  it('gør intervallet bredere ved lav confidence', () => {
    const sure = buildLoadRange({
      referenceKg: 180, basis: 'e1rm', percent: 0.8, confidence: 0.85,
      benchmarkIds: [], referenceLabel: 'e1RM',
    });
    const unsure = buildLoadRange({
      referenceKg: 180, basis: 'e1rm', percent: 0.8, confidence: 0.35,
      benchmarkIds: [], referenceLabel: 'e1RM',
    });
    expect(unsure.highKg - unsure.lowKg).toBeGreaterThan(sure.highKg - sure.lowKg);
  });
});

describe('populationPriorRange', () => {
  it('mærkes altid som lav confidence', () => {
    const r = populationPriorRange({ estimateKg: 60, reason: 'Ingen registrerede sæt.' });
    expect(r.provenance.basis).toBe('populationPrior');
    expect(r.provenance.confidence).toBeLessThan(0.45);
    expect(r.provenance.benchmarkIds).toHaveLength(0);
  });
});

describe('loadRangeText', () => {
  it('skriver dansk decimalkomma', () => {
    const r = buildLoadRange({
      referenceKg: 100, basis: 'e1rm', percent: 0.775, confidence: 0.8,
      benchmarkIds: [], referenceLabel: 'e1RM',
    });
    expect(loadRangeText(r)).toContain('kg');
    expect(loadRangeText(r)).not.toContain('.');
  });
});
