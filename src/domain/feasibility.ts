/**
 * Feasibility-modellen: kan arbejdet faktisk klares?
 *
 * Specifikationen kræver en completion-time distribution frem for ét gennemsnit, og
 * at datakilderne bruges i en fast prioriteret rækkefølge. Alder, køn og kropsvægt
 * må kun være en konservativ startprior — atletens egne splits vinder altid.
 */

import { BY_ID } from '../engine/data/exercises.js';
import type { Exercise } from '../engine/types.js';
import { effectiveConfidence, latestFor } from './benchmarks.js';
import { ontologyFor } from './ontology.js';
import type { Benchmark } from './types.js';

/** Datakilderne i den prioriterede rækkefølge fra specifikationen. */
export type FeasibilityBasis =
  | 'athlete-history'
  | 'movement-benchmark'
  | 'related-variation'
  | 'population-prior';

export const BASIS_LABELS: Record<FeasibilityBasis, string> = {
  'athlete-history': 'dine egne splits',
  'movement-benchmark': 'dine benchmarks',
  'related-variation': 'en beslægtet øvelse',
  'population-prior': 'et konservativt standardbud',
};

export interface CycleTimeEstimate {
  /** Sekunder pr. rep, meter eller kalorie ved bæredygtigt tempo. */
  secondsPerUnit: number;
  basis: FeasibilityBasis;
  confidence: number;
  explanation: string;
  benchmarkIds: string[];
}

export interface AthleteSplit {
  exerciseId: string;
  /** Reps, meter eller kalorier. */
  amount: number;
  /** Sekunder brugt på arbejdet, uden pauser. */
  workSeconds: number;
  loadKg?: number;
  date: string;
}

export interface FeasibilityInput {
  exerciseId: string;
  /** Reps, meter eller kalorier i ét arbejdsvindue. */
  amount: number;
  /** Antal gange arbejdet gentages — runder eller intervaller. */
  rounds: number;
  loadKg?: number | undefined;
  /** Belastning som andel af atletens tekniske max. Styrer cycle time og breaks. */
  loadFraction?: number | undefined;
  benchmarks?: Benchmark[];
  splits?: AthleteSplit[];
  /** Frisk maksimalt ubrudt sæt, kun relevant for gymnastik. */
  maxUnbroken?: number | undefined;
  /** Antal vendinger i en shuttle eller carry. */
  turns?: number;
  /** Sandt for HYROX-agtigt løb udført under fatigue. */
  compromised?: boolean;
}

export interface FeasibilityResult {
  /** Forventet arbejdstid i sekunder pr. runde. */
  predictedWorkSeconds: { p50: number; p90: number };
  /** Forventede pauser inde i arbejdsvinduet. */
  expectedBreakSeconds: number;
  /** Opsætning før første rep. */
  setupSeconds: number;
  /** Hvor meget langsommere sidste tredjedel bliver. 1,0 = ingen decay. */
  fatigueDecay: number;
  basis: FeasibilityBasis;
  confidence: number;
  explanation: string;
  benchmarkIds: string[];
}

/* ---------- Cycle time ---------- */

const daysSince = (iso: string, now: string): number =>
  Math.max(0, (new Date(now).getTime() - new Date(iso).getTime()) / 86_400_000);

/**
 * Finder sekunder pr. enhed for én bevægelse.
 *
 * Rækkefølgen er hele pointen: atletens egne splits på samme øvelse og lignende load
 * slår ethvert katalogtal. Kataloget selv er population prior og mærkes derefter.
 */
export function cycleTime(
  input: FeasibilityInput,
  now: string = new Date().toISOString(),
): CycleTimeEstimate {
  const ex = BY_ID[input.exerciseId];
  const fallbackSec = ex?.sec ?? 3;

  // 1. Samme atlet, samme bevægelse og sammenlignelig belastning.
  const own = (input.splits ?? [])
    .filter((s) => s.exerciseId === input.exerciseId && s.amount > 0 && s.workSeconds > 0)
    .filter((s) => {
      if (input.loadKg === undefined || s.loadKg === undefined) return true;
      // Kun splits inden for ±15 % load er sammenlignelige.
      return Math.abs(s.loadKg - input.loadKg) <= input.loadKg * 0.15;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  if (own.length) {
    const perUnit = own.map((s) => s.workSeconds / s.amount);
    const value = perUnit.reduce((a, b) => a + b, 0) / perUnit.length;
    const age = daysSince(own[0]?.date ?? now, now);
    const confidence = Math.max(0.5, Math.min(0.9, 0.9 - age / 200)) * (own.length >= 2 ? 1 : 0.9);
    return {
      secondsPerUnit: round2(value),
      basis: 'athlete-history',
      confidence: round2(confidence),
      benchmarkIds: [],
      explanation:
        `Bygger på ${own.length} af dine egne registrerede sæt i samme bevægelse.`,
    };
  }

  // 2. Movement-specifikt benchmark: cadence eller pace.
  const bm = input.benchmarks
    ? latestFor(input.benchmarks, input.exerciseId, 'cadence')
      ?? latestFor(input.benchmarks, input.exerciseId, 'pace')
    : null;
  if (bm && effectiveConfidence(bm, now) >= 0.3) {
    const perUnit = bm.kind === 'cadence' ? 60 / Math.max(1, bm.value) : bm.value;
    return {
      secondsPerUnit: round2(perUnit),
      basis: 'movement-benchmark',
      confidence: effectiveConfidence(bm, now),
      benchmarkIds: [bm.id],
      explanation: 'Bygger på dit registrerede benchmark for bevægelsen.',
    };
  }

  // 3. Beslægtet variation med usikkerhedsstraf.
  const related = (ex?.sub ?? [])
    .map((id) => (input.splits ?? []).find((s) => s.exerciseId === id))
    .find((s): s is AthleteSplit => Boolean(s));
  if (related && related.amount > 0) {
    return {
      secondsPerUnit: round2((related.workSeconds / related.amount) * 1.1),
      basis: 'related-variation',
      confidence: 0.4,
      benchmarkIds: [],
      explanation:
        `Bygger på ${BY_ID[related.exerciseId]?.name ?? related.exerciseId}, som ligner. `
        + 'Der er lagt 10 % til for usikkerheden.',
    };
  }

  // 4. Konservativ populationsprior.
  return {
    secondsPerUnit: fallbackSec,
    basis: 'population-prior',
    confidence: 0.3,
    benchmarkIds: [],
    explanation:
      'Konservativt standardbud — du har ikke registreret tal for bevægelsen endnu.',
  };
}

/* ---------- Feasibility ---------- */

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Straf for vendinger i shuttle run og carries. Acceleration koster mere end distancen. */
const TURN_PENALTY_SEC = 1.2;

/** Compromised running er langsommere end frisk løb. Startværdien er konservativ. */
const COMPROMISED_RUN_FACTOR = 1.12;

/**
 * Hvor meget langsommere arbejdet bliver i sidste tredjedel.
 *
 * Grind-niveauet fra kataloget er den bedste eksisterende proxy for, hvor hurtigt en
 * bevægelse falder fra hinanden under fatigue.
 */
function decayFactor(ex: Exercise | undefined, rounds: number, loadFraction: number): number {
  const grind = ex?.grind ?? 'low';
  const perRound = grind === 'high' ? 0.035 : grind === 'medium' ? 0.02 : 0.008;
  const loadTax = Math.max(0, loadFraction - 0.6) * 0.35;
  return 1 + Math.min(0.6, perRound * Math.max(0, rounds - 1) + loadTax);
}

/**
 * Forventede pauser inde i arbejdsvinduet.
 *
 * For gymnastik sættes de ud fra frisk max-unbroken: skal atleten tage 12 reps med et
 * frisk max på 14, går sættet i stykker længe før sidste runde.
 */
function breakSeconds(input: FeasibilityInput, perUnit: number): number {
  const ex = BY_ID[input.exerciseId];
  if (!ex) return 0;

  if (input.maxUnbroken && input.maxUnbroken > 0 && ex.unit === 'reps') {
    // Antag at kapaciteten falder til ca. 60 % af frisk max, når der er flere runder.
    const effective = Math.max(2, input.maxUnbroken * (input.rounds > 3 ? 0.6 : 0.8));
    const breaks = Math.max(0, Math.ceil(input.amount / effective) - 1);
    return breaks * 6;
  }

  const load = input.loadFraction ?? 0;
  if (load >= 0.75) return Math.max(0, Math.floor(input.amount / 3)) * 4;
  if (load >= 0.6) return Math.max(0, Math.floor(input.amount / 6)) * 3;
  if ((ex.grind ?? 'low') === 'high') return Math.max(0, Math.floor(input.amount / 10)) * 3;
  return perUnit * input.amount > 90 ? 5 : 0;
}

/**
 * Estimerer, hvor lang tid ét arbejdsvindue tager — inklusive opsætning, pauser,
 * vendinger og fatigue.
 */
export function estimateFeasibility(
  input: FeasibilityInput,
  now: string = new Date().toISOString(),
): FeasibilityResult {
  const ex = BY_ID[input.exerciseId];
  const cycle = cycleTime(input, now);
  const loadFraction = input.loadFraction ?? 0;

  let perUnit = cycle.secondsPerUnit;
  if (input.compromised && ex?.cat === 'cardio') perUnit *= COMPROMISED_RUN_FACTOR;

  const work = perUnit * input.amount;
  const turns = (input.turns ?? 0) * TURN_PENALTY_SEC;
  const breaks = breakSeconds(input, perUnit);
  const decay = decayFactor(ex, input.rounds, loadFraction);
  const setup = ontologyFor(input.exerciseId)?.setupSeconds ?? 0;

  const p50 = Math.round(work + turns + breaks);
  // p90 tager både fatigue-decay og estimatets egen usikkerhed med. Lav confidence
  // skal give et bredere, ikke et mere optimistisk, øvre skøn.
  const uncertainty = 1 + (1 - cycle.confidence) * 0.35;
  const p90 = Math.round((work * decay + turns + breaks) * uncertainty);

  return {
    predictedWorkSeconds: { p50, p90: Math.max(p90, p50) },
    expectedBreakSeconds: Math.round(breaks),
    setupSeconds: setup,
    fatigueDecay: round2(decay),
    basis: cycle.basis,
    confidence: cycle.confidence,
    benchmarkIds: cycle.benchmarkIds,
    explanation: cycle.explanation,
  };
}

/* ---------- Interval-guardrails ---------- */

export interface IntervalVerdict {
  ok: boolean;
  /** Sekunder tilbage til pause og skift ved det konservative øvre skøn. */
  restSeconds: number;
  completionProbability: number;
  message: string;
  /** Foreslået reduktion, hvis vinduet ikke holder. 1,0 = ingen ændring. */
  suggestedRepFactor: number;
}

/** Mindste reelle pause i en EMOM, før vinduet ikke længere er en EMOM. */
export const MIN_EMOM_REST_SEC = 12;

/**
 * Godkender eller afviser et intervalvindue.
 *
 * Reglen fra specifikationen: godkend kun, hvis det konservative øvre estimat
 * normalt giver mindst 10-15 sekunders reel pause og stadig holder i sidste tredjedel.
 */
export function checkInterval(
  result: FeasibilityResult,
  windowSeconds: number,
  opts: { transitionSeconds?: number; minRestSeconds?: number } = {},
): IntervalVerdict {
  const transition = opts.transitionSeconds ?? 5;
  const minRest = opts.minRestSeconds ?? MIN_EMOM_REST_SEC;
  const worst = result.predictedWorkSeconds.p90 + transition;
  const rest = windowSeconds - worst;

  // Sandsynligheden falder brat, når det øvre skøn nærmer sig hele vinduet.
  const headroom = rest / windowSeconds;
  const raw = headroom >= 0.3 ? 0.95
    : headroom >= 0.2 ? 0.88
      : headroom >= (minRest / windowSeconds) ? 0.75
        : headroom >= 0 ? 0.5
          : 0.2;
  const completionProbability = round2(raw * (0.75 + result.confidence * 0.25));

  if (rest >= minRest) {
    return {
      ok: true,
      restSeconds: Math.round(rest),
      completionProbability,
      suggestedRepFactor: 1,
      message:
        `Arbejdet ventes at tage op til ${result.predictedWorkSeconds.p90} sekunder, `
        + `så der er cirka ${Math.round(rest)} sekunders reel pause tilbage.`,
    };
  }

  // Hvor meget skal reps ned, for at vinduet holder? Beregnet på det øvre skøn.
  const target = Math.max(1, windowSeconds - minRest - transition);
  const factor = Math.max(0.4, target / Math.max(1, result.predictedWorkSeconds.p90));

  return {
    ok: false,
    restSeconds: Math.round(rest),
    completionProbability,
    suggestedRepFactor: round2(factor),
    message:
      `Arbejdet kan tage op til ${result.predictedWorkSeconds.p90} sekunder ud af `
      + `${windowSeconds}. Der er ikke ${minRest} sekunders reel pause tilbage, `
      + 'og intervallet holder ikke i de sidste runder.',
  };
}

/**
 * Samlet sandsynlighed for at gennemføre en workout inden for time cap.
 *
 * Bruges til AMRAP og For Time, hvor der ikke er et fast vindue pr. runde.
 */
export function completionProbability(
  totalWorkSeconds: number,
  capSeconds: number,
  confidence: number,
): number {
  if (capSeconds <= 0) return 0;
  const ratio = totalWorkSeconds / capSeconds;
  const base = ratio <= 0.7 ? 0.95
    : ratio <= 0.85 ? 0.88
      : ratio <= 1 ? 0.7
        : ratio <= 1.15 ? 0.4
          : 0.15;
  return round2(base * (0.7 + confidence * 0.3));
}

/**
 * Gruppelogistik: den langsomste relevante deltager bestemmer rotationen.
 *
 * Gennemsnittet må ikke bruges — det er præcis den fejl, der får en gruppe til at
 * stå og vente på én person hver eneste runde.
 */
export function slowestFits(
  results: FeasibilityResult[],
  windowSeconds: number,
  transitionSeconds = 5,
): { ok: boolean; slowestSeconds: number; message: string } {
  if (!results.length) return { ok: true, slowestSeconds: 0, message: 'Ingen deltagere at kontrollere.' };
  const slowest = Math.max(...results.map((r) => r.predictedWorkSeconds.p90));
  const ok = slowest + transitionSeconds <= windowSeconds;
  return {
    ok,
    slowestSeconds: slowest,
    message: ok
      ? `Den langsomste deltager ventes at bruge op til ${slowest} sekunder og når rotationen.`
      : `Den langsomste deltager ventes at bruge op til ${slowest} sekunder, `
        + `hvilket er mere end de ${windowSeconds} sekunder, rotationen giver. `
        + 'Skalér den enkelte deltager i stedet for at flytte klokken.',
  };
}
