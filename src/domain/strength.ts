/**
 * Styrkematematik: e1RM, RPE/RIR, training max og rolling estimater.
 *
 * Reglen fra specifikationen er, at en reps+RPE-procenttabel er den foretrukne kilde,
 * og at Epley kun er fallback for fåtallige reps tæt på failure — og altid mærkes som
 * estimat med lavere confidence. Sæt over ti reps, sæt med ustabil teknik, smerte eller
 * ukendt RIR må ikke bruges til at styre tunge loads.
 */

import type { Benchmark, ConfidenceBand } from './types.js';
import { confidenceBand } from './types.js';

/* ---------- RPE og RIR ---------- */

/** RPE 10 = 0 RIR, RPE 9 = 1 RIR og så videre. Klemmes til skalaens gyldige spænd. */
export const rpeToRir = (rpe: number): number => clampRange(10 - rpe, 0, 6);
export const rirToRpe = (rir: number): number => clampRange(10 - rir, 4, 10);

function clampRange(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * RPE-procenttabel (procent af 1RM) for reps 1–10 ved RPE 6–10 i halve trin.
 *
 * Tabellen er den udbredte RIR-baserede skala fra styrkelitteraturen og bruges som
 * startværdi. Den er ikke en fysiologisk konstant — når atleten har egne valide sæt,
 * kalibreres den med `calibrateTable`.
 */
const RPE_STEPS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

const RPE_TABLE: Record<number, number[]> = {
  1: [86.3, 87.8, 89.2, 90.7, 92.2, 93.9, 95.5, 97.8, 100],
  2: [83.7, 85.0, 86.3, 87.8, 89.2, 90.7, 92.2, 93.9, 95.5],
  3: [81.1, 82.4, 83.7, 85.0, 86.3, 87.8, 89.2, 90.7, 92.2],
  4: [78.6, 79.9, 81.1, 82.4, 83.7, 85.0, 86.3, 87.8, 89.2],
  5: [76.2, 77.4, 78.6, 79.9, 81.1, 82.4, 83.7, 85.0, 86.3],
  6: [73.9, 75.1, 76.2, 77.4, 78.6, 79.9, 81.1, 82.4, 83.7],
  7: [70.7, 72.3, 73.9, 75.1, 76.2, 77.4, 78.6, 79.9, 81.1],
  8: [68.0, 69.4, 70.7, 72.3, 73.9, 75.1, 76.2, 77.4, 78.6],
  9: [65.3, 66.7, 68.0, 69.4, 70.7, 72.3, 73.9, 75.1, 76.2],
  10: [62.6, 64.0, 65.3, 66.7, 68.0, 69.4, 70.7, 72.3, 73.9],
};

/** Højeste antal reps, tabellen dækker. Derover er estimatet for upræcist til tunge loads. */
export const MAX_TABLE_REPS = 10;

/**
 * Procent af 1RM for et sæt på `reps` ved `rpe`. Interpolerer lineært mellem
 * halve RPE-trin, så RPE 8,2 ikke bliver til RPE 8.
 *
 * Returnerer null, hvis sættet ligger uden for tabellens gyldige område.
 */
export function percentOf1rm(reps: number, rpe: number): number | null {
  const row = RPE_TABLE[Math.round(reps)];
  if (!row || reps < 1 || reps > MAX_TABLE_REPS) return null;
  const r = clampRange(rpe, 6, 10);

  const exact = RPE_STEPS.indexOf(r as (typeof RPE_STEPS)[number]);
  if (exact >= 0) return (row[exact] as number) / 100;

  let lower = 0;
  for (let i = 0; i < RPE_STEPS.length; i++) {
    if ((RPE_STEPS[i] as number) <= r) lower = i;
  }
  const upper = Math.min(lower + 1, RPE_STEPS.length - 1);
  if (lower === upper) return (row[lower] as number) / 100;

  const lo = RPE_STEPS[lower] as number;
  const hi = RPE_STEPS[upper] as number;
  const t = (r - lo) / (hi - lo);
  const value = (row[lower] as number) + ((row[upper] as number) - (row[lower] as number)) * t;
  return value / 100;
}

/** Epley. Kun fallback — bruges når RPE ikke er kendt. */
export const epley1rm = (loadKg: number, reps: number): number => loadKg * (1 + reps / 30);

export type E1rmMethod = 'rpe-table' | 'epley' | 'direct';

export interface E1rmEstimate {
  e1rmKg: number;
  method: E1rmMethod;
  confidence: number;
  /** Dansk forklaring af, hvordan tallet er fremkommet. */
  explanation: string;
  /** Sandt når sættet ikke må bruges til at styre tunge loads. */
  usableForHeavyLoads: boolean;
}

export interface SetInput {
  loadKg: number;
  reps: number;
  /** Udeladt betyder "ved ikke" — ikke RPE 10. */
  rpe?: number | undefined;
  /** Sandt når teknikken brød sammen, eller sættet gav smerte. */
  technicalFailure?: boolean;
  painFlag?: boolean;
}

/**
 * Estimerer 1RM ud fra ét sæt.
 *
 * Rækkefølgen er specifikationens: RPE-tabel når RPE findes, ellers Epley med lavere
 * confidence. Et sæt på én rep ved RPE 10 er ikke et estimat, men en målt single.
 */
export function estimate1rm(set: SetInput): E1rmEstimate {
  const { loadKg, reps, rpe } = set;
  const invalid = Boolean(set.technicalFailure || set.painFlag);

  if (reps === 1 && rpe !== undefined && rpe >= 9.75 && !invalid) {
    return {
      e1rmKg: loadKg,
      method: 'direct',
      confidence: 0.92,
      explanation: `Målt single på ${fmt(loadKg)} kg ved RPE ${fmt(rpe)}.`,
      usableForHeavyLoads: true,
    };
  }

  if (rpe !== undefined) {
    const pct = percentOf1rm(reps, rpe);
    if (pct !== null) {
      // Confidence falder med antal reps: RIR-vurderinger er mest præcise tæt på failure.
      const repPenalty = Math.min(0.22, Math.max(0, reps - 3) * 0.028);
      const effortPenalty = rpe < 7 ? 0.14 : rpe < 8 ? 0.06 : 0;
      const confidence = clampRange(0.86 - repPenalty - effortPenalty, 0.3, 0.9);
      return {
        e1rmKg: round1(loadKg / pct),
        method: 'rpe-table',
        confidence: invalid ? Math.min(confidence, 0.25) : confidence,
        explanation:
          `${reps} reps × ${fmt(loadKg)} kg ved RPE ${fmt(rpe)} svarer til `
          + `${Math.round(pct * 100)} % af 1RM.`,
        usableForHeavyLoads: !invalid && reps <= MAX_TABLE_REPS,
      };
    }
  }

  const confidence = reps <= 5 ? 0.55 : reps <= MAX_TABLE_REPS ? 0.42 : 0.25;
  return {
    e1rmKg: round1(epley1rm(loadKg, reps)),
    method: 'epley',
    confidence: invalid ? Math.min(confidence, 0.2) : confidence,
    explanation:
      `${reps} reps × ${fmt(loadKg)} kg omregnet med Epley-formlen. `
      + 'Uden RPE er det et groft estimat.',
    usableForHeavyLoads: !invalid && reps <= MAX_TABLE_REPS,
  };
}

/* ---------- Rolling e1RM ---------- */

export interface RollingE1rm {
  /** Medianen af de gyldige, nyere sæt. */
  currentKg: number;
  /** Højeste gyldige estimat i vinduet. */
  bestRecentKg: number;
  confidence: number;
  band: ConfidenceBand;
  /** Antal sæt, der indgik. */
  sampleSize: number;
  /** ISO-dato for det nyeste sæt, der indgik. */
  latestDate: string | null;
  /** Dansk forklaring, der kan vises direkte. */
  explanation: string;
  benchmarkIds: string[];
}

/** Hvor gammelt et benchmark må være, før det tæller som forældet. */
export const BENCHMARK_FRESH_DAYS = 56;

const daysBetween = (a: string, b: string): number =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Rolling e1RM: medianen af 2–4 nyere, valide sæt.
 *
 * Medianen er valgt bevidst frem for gennemsnittet — ét enkelt godt eller dårligt sæt
 * må ikke flytte hele programmet.
 */
export function rollingE1rm(
  benchmarks: Benchmark[],
  subjectId: string,
  now: string = new Date().toISOString(),
): RollingE1rm | null {
  const valid = benchmarks
    .filter((b) => b.subjectId === subjectId && b.kind === 'strength' && !b.invalid)
    .filter((b) => typeof b.e1rmKg === 'number' && (b.e1rmKg as number) > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!valid.length) return null;

  const window = valid.slice(0, 4);
  const values = window.map((b) => b.e1rmKg as number);
  const currentKg = round1(median(values));
  const bestRecentKg = round1(Math.max(...values));
  const latestDate = window[0]?.date ?? null;

  const ageDays = latestDate ? daysBetween(now, latestDate) : 999;
  // Confidence falder med alder og stiger med antal samstemmende sæt.
  const ageFactor = ageDays <= BENCHMARK_FRESH_DAYS
    ? 1
    : clampRange(1 - (ageDays - BENCHMARK_FRESH_DAYS) / 120, 0.35, 1);
  const sampleFactor = window.length >= 3 ? 1 : window.length === 2 ? 0.9 : 0.78;
  const base = median(window.map((b) => b.confidence));
  const confidence = round2(clampRange(base * ageFactor * sampleFactor, 0.1, 0.95));

  return {
    currentKg,
    bestRecentKg,
    confidence,
    band: confidenceBand(confidence),
    sampleSize: window.length,
    latestDate,
    benchmarkIds: window.map((b) => b.id),
    explanation: window.length === 1
      ? `Bygger på ét sæt fra ${daLabel(latestDate)}.`
      : `Median af ${window.length} sæt, senest ${daLabel(latestDate)}.`,
  };
}

/* ---------- Training max ---------- */

/** Systemvalget fra specifikationen: 85–90 % af bedste gymløft. */
export const DEFAULT_TM_COEFFICIENT = 0.9;
export const CONSERVATIVE_TM_COEFFICIENT = 0.85;

export interface TrainingMax {
  kg: number;
  /** Koefficienten gemmes, så procentarbejde altid kan forklares som procent af TM. */
  coefficient: number;
  sourceE1rmKg: number;
  confidence: number;
  explanation: string;
}

/**
 * Et training max er en konservativ programmeringsanchor — ikke et nyt navn for
 * en sand 1RM. Procentarbejdet er procent af TM, og det skal fremgå.
 */
export function trainingMaxFrom(
  e1rmKg: number,
  confidence: number,
  coefficient: number = DEFAULT_TM_COEFFICIENT,
): TrainingMax {
  // Lav confidence trækker koefficienten ned frem for at lade som om tallet er sikkert.
  const effective = confidence < 0.5
    ? Math.min(coefficient, CONSERVATIVE_TM_COEFFICIENT)
    : coefficient;
  // Rundes til 2,5 kg, fordi et training max vises for brugeren og bruges som
  // grundtal. Et krummet tal som 156,4 kg er hverken en vægt, der kan sættes på
  // stangen, eller et tal, der er værd at huske.
  const kg = Math.round((e1rmKg * effective) / 2.5) * 2.5;
  return {
    kg: round1(kg),
    coefficient: effective,
    sourceE1rmKg: round1(e1rmKg),
    confidence,
    explanation:
      `Training max er ${Math.round(effective * 100)} % af e1RM ${fmt(round1(e1rmKg))} kg. `
      + 'Procenterne i programmet regnes af training max, ikke af 1RM.',
  };
}

/* ---------- Justering efter top-sæt ---------- */

export type TopSetOutcome = 'increase' | 'hold' | 'reduce_small' | 'reduce_large' | 'stop';

export interface TopSetAdjustment {
  outcome: TopSetOutcome;
  /** Multiplikator til backoff-load, fx 0,95. */
  loadFactor: number;
  /** Antal backoff-sæt der fjernes. */
  dropSets: number;
  explanation: string;
}

/**
 * Standardjusteringen efter et top-sæt.
 *
 * Tallene er startguardrails fra coach-praksis, ikke naturlove — derfor er de samlet
 * ét sted og forklares altid over for brugeren.
 */
export function adjustAfterTopSet(input: {
  targetRpe: number;
  actualRpe: number;
  technicalFailure?: boolean;
  painScore?: number;
  missedRep?: boolean;
}): TopSetAdjustment {
  const { targetRpe, actualRpe } = input;
  const delta = actualRpe - targetRpe;
  const hardStop = Boolean(input.technicalFailure) || (input.painScore ?? 0) >= 4;

  if (hardStop) {
    return {
      outcome: 'stop',
      loadFactor: 0,
      dropSets: 99,
      explanation: (input.painScore ?? 0) >= 4
        ? 'Smerte på 4 eller derover. Stop bevægelsen i dag, og vælg en godkendt substitution.'
        : 'Teknikken brød sammen. Stop løftet i dag frem for at køre videre på en dårlig position.',
    };
  }

  if (input.missedRep || delta >= 2) {
    return {
      outcome: 'reduce_large',
      loadFactor: 0.92,
      dropSets: 1,
      explanation: input.missedRep
        ? 'Misset rep. Backoff sættes 8 % ned, og ét sæt fjernes.'
        : `RPE lå ${fmt(delta)} over målet. Backoff sættes 8 % ned, og ét sæt fjernes.`,
    };
  }

  if (delta >= 1) {
    return {
      outcome: 'reduce_small',
      loadFactor: 0.96,
      dropSets: 0,
      explanation: `RPE lå ${fmt(delta)} over målet. Backoff sættes 4 % ned.`,
    };
  }

  if (delta <= -0.5) {
    return {
      outcome: 'increase',
      loadFactor: 1.025,
      dropSets: 0,
      explanation: `RPE lå ${fmt(Math.abs(delta))} under målet med god teknik. `
        + 'Backoff må gå 2,5 % op inden for intervallet.',
    };
  }

  return {
    outcome: 'hold',
    loadFactor: 1,
    dropSets: 0,
    explanation: 'RPE ramte målet inden for en halv enhed. Planen holdes.',
  };
}

/* ---------- Hjælpere ---------- */

export const round1 = (v: number): number => Math.round(v * 10) / 10;
export const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Dansk decimalkomma uden hængende nul. */
export function fmt(v: number): string {
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

function daLabel(iso: string | null): string {
  if (!iso) return 'ukendt dato';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ukendt dato';
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}
