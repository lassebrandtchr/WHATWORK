/**
 * Belastningsberegning og afrunding.
 *
 * Specifikationen forbyder faste kilo uden dokumenteret grundlag. Alt herfra
 * returnerer derfor et interval plus en `LoadProvenance`, der siger præcis hvad
 * tallet bygger på, hvor sikkert det er, og hvordan der er rundet af.
 */

import type { LoadBasis, LoadProvenance, LoadRange } from './types.js';
import { fmt, round1 } from './strength.js';

/** Coach-workbookens afrundingstrin for stangarbejde. */
export const BARBELL_STEP_KG = 2.5;
/** Håndvægte og kettlebells findes sjældent i finere trin end det her. */
export const IMPLEMENT_STEP_KG = 2.5;

export function roundToStep(kg: number, stepKg: number): number {
  if (stepKg <= 0) return round1(kg);
  return round1(Math.round(kg / stepKg) * stepKg);
}

/** Rund ned til nærmeste mulige trin — den sikre side at ramme forkert på. */
export function roundDownToStep(kg: number, stepKg: number): number {
  if (stepKg <= 0) return round1(kg);
  return round1(Math.floor(kg / stepKg + 1e-9) * stepKg);
}

/**
 * Rundes en vægt til det, stangen faktisk kan samles til med de skiver, brugeren har.
 * Returnerer null, hvis vægten ikke kan rammes nøjagtigt — så skal kaldstedet vise
 * det nærmeste mulige i stedet for at foregive præcision.
 */
export function loadableOnBar(targetKg: number, barKg: number, plates: number[]): number | null {
  if (targetKg < barKg) return null;
  const perSide = (targetKg - barKg) / 2;
  if (perSide === 0) return barKg;
  const sorted = [...plates].sort((a, b) => b - a);
  let remaining = perSide;
  for (const p of sorted) {
    while (remaining >= p - 1e-9) remaining -= p;
  }
  return Math.abs(remaining) < 1e-6 ? round1(targetKg) : null;
}

export interface LoadRangeInput {
  /** Grundtallet procenten regnes af. */
  referenceKg: number;
  basis: LoadBasis;
  /** 0–1. */
  percent: number;
  confidence: number;
  benchmarkIds: string[];
  stepKg?: number;
  /** Halv bredde af intervallet som andel, fx 0,025 = ±2,5 %. */
  spread?: number;
  /** Dansk navn på grundtallet, fx "training max" eller "e1RM". */
  referenceLabel: string;
}

/**
 * Bygger et belastningsinterval frem for et enkelt vilkårligt kilotal.
 *
 * Workbooken beregner et lavt og et højt kg-tal omkring en procent og runder til
 * 2,5 kg. Det er den logik, der er oversat her — men med eksplicit provenance, så
 * brugeren kan se, at intervallet ikke er falsk præcision.
 */
export function buildLoadRange(input: LoadRangeInput): LoadRange {
  const step = input.stepKg ?? BARBELL_STEP_KG;
  const spread = input.spread ?? (input.confidence >= 0.7 ? 0.025 : 0.05);
  const center = input.referenceKg * input.percent;

  const target = roundToStep(center, step);
  const low = roundDownToStep(center * (1 - spread), step);
  const high = roundToStep(center * (1 + spread), step);

  const provenance: LoadProvenance = {
    basis: input.basis,
    percent: input.percent,
    confidence: input.confidence,
    benchmarkIds: input.benchmarkIds,
    roundingKg: step,
    explanation:
      `${Math.round(input.percent * 100)} % af ${input.referenceLabel} `
      + `${fmt(round1(input.referenceKg))} kg, afrundet til nærmeste ${fmt(step)} kg.`,
  };

  return {
    lowKg: Math.min(low, target),
    highKg: Math.max(high, target),
    targetKg: target,
    provenance,
  };
}

/**
 * En konservativ populationsprior. Bruges kun, når atleten ikke har egne data —
 * og mærkes altid som lav confidence, så den aldrig ligner et målt tal.
 */
export function populationPriorRange(input: {
  estimateKg: number;
  reason: string;
  stepKg?: number;
}): LoadRange {
  const step = input.stepKg ?? BARBELL_STEP_KG;
  const target = roundToStep(input.estimateKg, step);
  return {
    lowKg: roundDownToStep(input.estimateKg * 0.85, step),
    highKg: roundToStep(input.estimateKg * 1.0, step),
    targetKg: target,
    provenance: {
      basis: 'populationPrior',
      confidence: 0.3,
      benchmarkIds: [],
      roundingKg: step,
      explanation:
        `Konservativt startbud uden dine egne tal. ${input.reason} `
        + 'Log et sæt, så bliver forslaget dit eget.',
    },
  };
}

/** Dansk visningstekst for et interval. Ét tal vises kun, når intervallet er kollapset. */
export function loadRangeText(range: LoadRange): string {
  if (Math.abs(range.lowKg - range.highKg) < 0.01) return `${fmt(range.targetKg)} kg`;
  return `${fmt(range.lowKg)}–${fmt(range.highKg)} kg (sigt efter ${fmt(range.targetKg)} kg)`;
}
