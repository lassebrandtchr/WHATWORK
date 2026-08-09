/**
 * Benchmark store.
 *
 * Alle tal, motoren bruger til at fastsætte kilo, pace eller reps, kommer herfra.
 * Hvert benchmark bærer dato, protokol, enhed, gyldighed og confidence — og et
 * manglende benchmark er en reel tilstand, ikke et nul.
 */

import type {
  Benchmark, BenchmarkKind, LiftId, SportId, TestProtocol,
} from './types.js';
import { LIFT_NAMES } from './types.js';
import {
  BENCHMARK_FRESH_DAYS, estimate1rm, rollingE1rm, round1,
} from './strength.js';
import type { RollingE1rm, SetInput } from './strength.js';

/** Confidence pr. testprotokol, før alder og teknik trækkes fra. */
const PROTOCOL_CONFIDENCE: Record<TestProtocol, number> = {
  '1rm': 0.9,
  '3rm': 0.82,
  '5rm': 0.76,
  topSetRpe: 0.8,
  amrap: 0.6,
  timeTrial: 0.85,
  maxUnbroken: 0.78,
  estimate: 0.45,
  selfReported: 0.35,
};

let counter = 0;
/** Stabilt id uden afhængighed af crypto — appen skal virke uden netværk og i jsdom. */
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface RecordSetInput extends SetInput {
  /** Stabilt id for præcis variant, fx "back_squat" eller "deadlift_axle". */
  subjectId: string;
  protocol: TestProtocol;
  date?: string;
  note?: string;
}

/**
 * Gemmer ét arbejdssæt som styrke-benchmark og beregner e1RM med confidence.
 *
 * Sæt med teknikbrud eller smerte gemmes stadig — historikken skal være fuldstændig —
 * men markeres som ugyldige, så de ikke kan styre tunge loads.
 */
export function benchmarkFromSet(input: RecordSetInput): Benchmark {
  const est = estimate1rm(input);
  const invalid = Boolean(input.technicalFailure || input.painFlag) || !est.usableForHeavyLoads;
  const protocolBase = PROTOCOL_CONFIDENCE[input.protocol] ?? 0.5;

  const benchmark: Benchmark = {
    id: nextId('bm'),
    subjectId: input.subjectId,
    kind: 'strength',
    protocol: input.protocol,
    date: input.date ?? new Date().toISOString(),
    value: input.loadKg,
    unit: 'kg',
    reps: input.reps,
    e1rmKg: est.e1rmKg,
    confidence: round2(Math.min(protocolBase, est.confidence)),
    ...(input.rpe !== undefined ? { rpe: input.rpe } : {}),
    ...(invalid ? { invalid: true } : {}),
    ...(input.note ? { note: input.note } : {}),
  };
  return benchmark;
}

/** Ikke-styrke-benchmarks: max unbroken, pace, cadence, stationstider, løbevolumen. */
export function benchmarkFromValue(input: {
  subjectId: string;
  kind: Exclude<BenchmarkKind, 'strength'>;
  protocol: TestProtocol;
  value: number;
  unit: Benchmark['unit'];
  date?: string;
  note?: string;
  confidence?: number;
}): Benchmark {
  return {
    id: nextId('bm'),
    subjectId: input.subjectId,
    kind: input.kind,
    protocol: input.protocol,
    date: input.date ?? new Date().toISOString(),
    value: input.value,
    unit: input.unit,
    confidence: round2(input.confidence ?? PROTOCOL_CONFIDENCE[input.protocol] ?? 0.5),
    ...(input.note ? { note: input.note } : {}),
  };
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

const ageDays = (iso: string, now: string): number =>
  Math.max(0, (new Date(now).getTime() - new Date(iso).getTime()) / 86_400_000);

/** Sandt når benchmarket er nyt nok til at styre tunge loads uden en advarsel. */
export function isFresh(b: Benchmark, now: string = new Date().toISOString()): boolean {
  return ageDays(b.date, now) <= BENCHMARK_FRESH_DAYS;
}

/**
 * Confidence justeret for alder. Et otte måneder gammelt 1RM er stadig data,
 * men det må ikke vægte som et fra i går.
 */
export function effectiveConfidence(b: Benchmark, now: string = new Date().toISOString()): number {
  if (b.invalid) return 0;
  const age = ageDays(b.date, now);
  if (age <= BENCHMARK_FRESH_DAYS) return b.confidence;
  const decay = Math.max(0.3, 1 - (age - BENCHMARK_FRESH_DAYS) / 150);
  return round2(b.confidence * decay);
}

export function latestFor(
  benchmarks: Benchmark[],
  subjectId: string,
  kind?: BenchmarkKind,
): Benchmark | null {
  const list = benchmarks
    .filter((b) => b.subjectId === subjectId && !b.invalid && (!kind || b.kind === kind))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return list[0] ?? null;
}

export function e1rmFor(
  benchmarks: Benchmark[],
  subjectId: string,
  now?: string,
): RollingE1rm | null {
  return rollingE1rm(benchmarks, subjectId, now);
}

/* ---------- Manglende data og assessment ---------- */

export interface MissingDataItem {
  subjectId: string;
  /** Dansk navn til brugeren. */
  label: string;
  kind: BenchmarkKind;
  /** Sandt når feltet blokerer et flerugers program helt. */
  blocking: boolean;
  /** Hvad appen foreslår i stedet — aldrig et gættet maksimum. */
  suggestion: string;
}

/** Løbe- og maskinbenchmarks, HYROX-programmering ikke kan undvære. */
const HYROX_REQUIRED: { subjectId: string; label: string; kind: BenchmarkKind }[] = [
  { subjectId: 'run_5k', label: '5 km tid eller critical speed', kind: 'pace' },
  { subjectId: 'run_weekly_km', label: 'Ugentlige løbekilometer', kind: 'runVolume' },
  { subjectId: 'ski_1k', label: '1000 m SkiErg', kind: 'stationTime' },
  { subjectId: 'row_1k', label: '1000 m romaskine', kind: 'stationTime' },
];

const CROSSFIT_REQUIRED: { subjectId: string; label: string; kind: BenchmarkKind }[] = [
  { subjectId: 'back_squat', label: 'Back squat', kind: 'strength' },
  { subjectId: 'strict_press', label: 'Strict press', kind: 'strength' },
  { subjectId: 'pull_up', label: 'Maksimalt ubrudte pull-ups', kind: 'maxUnbroken' },
  { subjectId: 'row_2k', label: '2000 m romaskine', kind: 'stationTime' },
];

/**
 * Finder de benchmarks, den valgte sport ikke kan programmeres uden.
 *
 * Produktreglen fra specifikationen: intet flerugers program må genereres, før
 * minimumsdata for sporten er komplette. Mangler de, bygges en assessment-uge.
 */
export function missingBenchmarks(
  sport: SportId,
  benchmarks: Benchmark[],
  lifts: LiftId[] = ['squat', 'bench', 'deadlift', 'ohp'],
  now: string = new Date().toISOString(),
): MissingDataItem[] {
  const has = (subjectId: string, kind: BenchmarkKind): boolean =>
    benchmarks.some((b) => (
      b.subjectId === subjectId && b.kind === kind && !b.invalid && effectiveConfidence(b, now) >= 0.3
    ));

  const out: MissingDataItem[] = [];

  if (sport === 'strength4' || sport === 'powerlifting') {
    const required = sport === 'powerlifting'
      ? lifts.filter((l) => l !== 'ohp')
      : lifts;
    required.forEach((lift) => {
      if (has(lift, 'strength')) return;
      out.push({
        subjectId: lift,
        label: LIFT_NAMES[lift],
        kind: 'strength',
        blocking: true,
        suggestion:
          `Kør et teknisk top-sæt på 3-5 reps ved RPE 7-8 i ${LIFT_NAMES[lift].toLowerCase()}. `
          + 'Du behøver ikke teste en ægte 1RM.',
      });
    });
  }

  if (sport === 'hyrox') {
    HYROX_REQUIRED.forEach((r) => {
      if (has(r.subjectId, r.kind)) return;
      out.push({
        ...r,
        blocking: r.subjectId === 'run_weekly_km' || r.subjectId === 'run_5k',
        suggestion: r.kind === 'runVolume'
          ? 'Angiv, hvor mange kilometer du løber om ugen lige nu. Skriv 0, hvis du ikke løber.'
          : 'Læg testen ind i en indkøringsuge, fordelt over 7-14 dage.',
      });
    });
  }

  if (sport === 'crossfit') {
    CROSSFIT_REQUIRED.forEach((r) => {
      if (has(r.subjectId, r.kind)) return;
      out.push({
        ...r,
        blocking: false,
        suggestion: r.kind === 'maxUnbroken'
          ? 'Tag ét frisk, ubrudt sæt og skriv antallet ned.'
          : 'Læg testen ind i en indkøringsuge.',
      });
    });
  }

  if (sport === 'strongman') {
    ['deadlift', 'ohp'].forEach((lift) => {
      if (has(lift, 'strength')) return;
      out.push({
        subjectId: lift,
        label: LIFT_NAMES[lift as LiftId],
        kind: 'strength',
        blocking: true,
        suggestion: 'Basisløftene skal kendes, før eventarbejdet kan doseres.',
      });
    });
  }

  return out;
}

/** Sandt når data er så mangelfulde, at et flerugers program ikke må genereres. */
export const needsAssessmentWeek = (missing: MissingDataItem[]): boolean =>
  missing.some((m) => m.blocking);

/* ---------- Max unbroken ---------- */

/**
 * Programmeringsandelen af et frisk max-unbroken sæt.
 *
 * Gymnastikreps sættes konservativt, fordi kapaciteten falder markant fra runde til
 * runde. Andelen er en startværdi, ikke en fysiologisk konstant.
 */
export function repsFromMaxUnbroken(
  maxUnbroken: number,
  opts: { rounds: number; sustained: boolean },
): { reps: number; explanation: string } {
  const share = opts.sustained
    ? (opts.rounds >= 8 ? 0.35 : opts.rounds >= 5 ? 0.42 : 0.5)
    : 0.6;
  const reps = Math.max(1, Math.floor(maxUnbroken * share));
  return {
    reps,
    explanation:
      `${Math.round(share * 100)} % af dit friske max på ${maxUnbroken} ubrudte reps — `
      + `sat lavt, fordi der er ${opts.rounds} runder.`,
  };
}

export { round1 };
