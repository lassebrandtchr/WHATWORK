/**
 * Oversætter et planlagt programpas til det `Workout`-format, skærmene og timeren
 * allerede bruger.
 *
 * Adskillelsen er bevidst: planlæggeren tænker i sæt, procenter og provenance;
 * visningen tænker i blokke og bevægelser. Uden det her lag ville programlogikken
 * blive presset ind i en datamodel, der er bygget til Dagens WOD.
 */

import { BY_ID } from '../engine/data/exercises.js';
import { fmtKg, planPlates } from '../engine/loads.js';
import { normalizeRequest } from '../engine/request.js';
import { computeDNA, scoreMatch, signatureOf } from '../engine/validate.js';
import { ENGINE_VERSION, EXERCISE_DATA_VERSION, RULES_VERSION } from '../engine/version.js';
import type {
  Block, Issue, LoadPrescription, Movement, PersonTarget, Profile, Unit, Workout,
} from '../engine/types.js';
import { loadRangeText } from '../domain/rounding.js';
import type { LoadRange } from '../domain/types.js';
import type { ConditioningPrescription, ProgramSession, SetPrescription } from './types.js';

export interface RenderContext {
  seed: number;
  profile: Profile;
  bodyweight: number;
  level: number;
  equipment: string[];
  plates: number[];
  bars: number[];
  minutes: number;
  createdAt: string;
}

/**
 * Oversætter et domæne-belastningsinterval til den visningsmodel, engine bruger.
 *
 * Skiveplanen beregnes af den samme funktion som i Dagens WOD, så en 100 kg squat
 * skrives på præcis samme måde begge steder.
 */
function toLoadPrescription(
  range: LoadRange,
  exerciseId: string,
  ctx: RenderContext,
): LoadPrescription {
  const ex = BY_ID[exerciseId];
  const isBar = Boolean(ex?.eq.includes('barbell'));
  if (isBar) {
    const plates = planPlates(range.targetKg, ctx.plates, ctx.bars);
    const total = plates.bar + plates.perSideKg * 2;
    return {
      totalKg: total,
      eachKg: total,
      kind: 'barbell',
      plates,
      text: `${loadRangeText(range)} — ${plates.text}`,
    };
  }
  const pair = Boolean(ex?.pair);
  return {
    totalKg: pair ? range.targetKg * 2 : range.targetKg,
    eachKg: range.targetKg,
    kind: pair ? 'pair' : 'single',
    text: pair ? `2 × ${fmtKg(range.targetKg)}` : loadRangeText(range),
  };
}

function targetFor(
  prescription: SetPrescription,
  ctx: RenderContext,
): PersonTarget {
  const ex = BY_ID[prescription.exerciseId];
  const unit: Unit = ex?.unit ?? 'reps';
  return {
    label: 'Dig',
    profile: ctx.profile,
    amount: prescription.reps,
    unit,
    amountText: `${prescription.reps} ${unit === 'reps' ? 'reps' : unit}`,
    load: prescription.load ? toLoadPrescription(prescription.load, prescription.exerciseId, ctx) : null,
  };
}

/**
 * Sættets rolle skrevet ud, så "4 Squat" ikke står alene.
 *
 * Uden den er der ingen forskel at se på dagens tunge sæt og de lettere sæt
 * bagefter — og hele pointen med at kalibrere efter top-sættet forsvinder.
 */
const SET_TYPE_LABELS: Record<SetPrescription['type'], string> = {
  top: 'Dagens tunge sæt',
  backoff: 'Arbejdssæt',
  supplemental: 'Ekstra hovedarbejde',
  assistance: 'Hjælpeøvelse',
  interval: 'Interval',
  warmup: 'Opvarmning',
};

/** Én linje, der beskriver sættets rolle, antal sæt og gentagelser. */
function displayFor(p: SetPrescription): string {
  const scheme = p.sets > 1 ? `${p.sets} × ${p.reps}` : `1 × ${p.reps}`;
  const role = p.type === 'top' || p.type === 'backoff' || p.type === 'assistance'
    ? `${SET_TYPE_LABELS[p.type]}: `
    : '';
  return `${role}${scheme} ${p.name}`;
}

function cueFor(p: SetPrescription): string {
  const parts: string[] = [];
  if (p.load) parts.push(loadRangeText(p.load));
  if (p.targetRpe !== null) parts.push(`RPE ${p.targetRpe}`);
  if (p.percent !== null && p.percentBasis !== 'none') {
    parts.push(`${Math.round(p.percent * 100)} % af ${p.percentBasis === 'trainingMax' ? 'training max' : 'e1RM'}`);
  }
  parts.push(`pause ${Math.round(p.restSeconds[0] / 60)}-${Math.round(p.restSeconds[1] / 60)} min`);
  const technique = BY_ID[p.exerciseId]?.da;
  return [parts.join(' · '), technique].filter(Boolean).join(' — ');
}

function movementFor(p: SetPrescription, ctx: RenderContext): Movement {
  const ex = BY_ID[p.exerciseId];
  return {
    exerciseId: p.exerciseId,
    name: p.name,
    unit: ex?.unit ?? 'reps',
    reps: p.reps,
    display: displayFor(p),
    cue: cueFor(p),
    workSec: Math.round(p.reps * p.secondsPerRep),
    transitionSec: 10,
    targets: [targetFor(p, ctx)],
    individualTargets: false,
    sets: p.sets,
    restSec: Math.round((p.restSeconds[0] + p.restSeconds[1]) / 2),
  };
}

function conditioningMovement(c: ConditioningPrescription, ctx: RenderContext): Movement {
  const ex = BY_ID[c.exerciseId];
  const unit: Unit = ex?.unit ?? 'sec';
  const amount = c.intervals ? c.intervals.work : c.minutes * 60;
  return {
    exerciseId: c.exerciseId,
    name: c.name,
    unit,
    reps: amount,
    display: c.intervals
      ? `${c.intervals.rounds} × ${Math.round(c.intervals.work / 60)} min ${c.name}`
      : `${c.minutes} min ${c.name}`,
    cue: `${c.targetText} ${c.rationale}`,
    workSec: amount,
    transitionSec: 10,
    targets: [{
      label: 'Dig', profile: ctx.profile, amount, unit,
      amountText: c.intervals
        ? `${c.intervals.rounds} × ${c.intervals.work} sek`
        : `${c.minutes} min`,
      load: null,
    }],
    individualTargets: false,
    ...(c.intervals ? { sets: c.intervals.rounds, restSec: c.intervals.rest } : {}),
  };
}

const minutesOf = (movements: Movement[]): number => Math.max(
  1,
  Math.round(movements.reduce(
    (s, m) => s + (m.sets ?? 1) * m.workSec + Math.max(0, (m.sets ?? 1) - 1) * (m.restSec ?? 0),
    0,
  ) / 60),
);

/**
 * Bygger den `Workout`, Program-, Resultat- og Timer-skærmen kan vise.
 *
 * Den planlagte session bevares uændret i programmet — det her er en projektion,
 * ikke en erstatning.
 */
export function sessionToWorkout(
  session: ProgramSession,
  ctx: RenderContext,
): Workout {
  const blocks: Block[] = [];

  if (session.warmup.length) {
    const movements = session.warmup.map((p) => movementFor(p, ctx));
    blocks.push({
      id: `${session.id}-warmup`,
      kind: 'warmup',
      title: `Opvarmning · ${minutesOf(movements)} min`,
      format: null,
      minutes: minutesOf(movements),
      prescription: 'Ramp mod dagens arbejdsvægt. Ingen af sættene må koste noget af hovedarbejdet.',
      movements,
    });
  }

  const strengthSets = [...session.anchors, ...session.supplemental, ...session.assistance];
  if (strengthSets.length) {
    const movements = strengthSets.map((p) => movementFor(p, ctx));
    blocks.push({
      id: `${session.id}-strength`,
      kind: 'strength',
      title: 'Hovedarbejde',
      format: 'strength',
      minutes: minutesOf(movements),
      prescription: session.stimulus,
      movements,
    });
  }

  if (session.conditioning.length) {
    const movements = session.conditioning.map((c) => conditioningMovement(c, ctx));
    blocks.push({
      id: `${session.id}-cond`,
      kind: 'conditioning',
      title: session.conditioning[0]?.intervals ? 'Intervaller' : 'Kondition',
      format: session.conditioning[0]?.intervals ? 'interval' : 'amrap',
      minutes: minutesOf(movements),
      prescription: session.conditioning.map((c) => c.targetText).join(' '),
      movements,
      ...(session.conditioning[0]?.intervals
        ? {
          rounds: session.conditioning[0].intervals.rounds,
          workSec: session.conditioning[0].intervals.work,
          restSec: session.conditioning[0].intervals.rest,
        }
        : {}),
    });
  }

  const request = normalizeRequest({
    minutes: ctx.minutes,
    men: ctx.profile === 'm' ? 1 : 0,
    women: ctx.profile === 'f' ? 1 : 0,
    neutral: ctx.profile === 'x' ? 1 : 0,
    level: ctx.level,
    equipment: ctx.equipment,
    plates: ctx.plates,
    bars: ctx.bars,
    seed: ctx.seed,
  });

  const issues: Issue[] = session.issues.map((i) => ({
    code: i.code, sev: i.severity, msg: i.message,
  }));

  const dna = computeDNA(blocks);
  const format = blocks.some((b) => b.kind === 'strength') ? 'strength' : 'interval';
  const signature = signatureOf(format, blocks);
  const match = scoreMatch(blocks, request, session.plannedMinutes, issues, dna, signature);

  return {
    id: `${session.id}_${ctx.seed}`,
    seed: ctx.seed,
    createdAt: ctx.createdAt,
    engineVersion: ENGINE_VERSION,
    rulesVersion: RULES_VERSION,
    exerciseDataVersion: EXERCISE_DATA_VERSION,
    title: session.stimulus,
    format,
    formatName: 'Programpas',
    participants: 1,
    people: request.people,
    request,
    blocks,
    estimatedMinutes: session.plannedMinutes,
    timeSplit: {
      warmup: blocks.find((b) => b.kind === 'warmup')?.minutes ?? 0,
      main: blocks.filter((b) => b.kind !== 'warmup').reduce((s, b) => s + b.minutes, 0),
      transitions: 2,
    },
    dna,
    issues,
    score: match.total,
    match,
    signature,
    mix: {
      source: 'smart',
      candidates: 1,
      valid: 1,
      note:
        'Passet er planlagt af programmotoren ud fra dine anchors, din fase og dine tal — '
        + 'ikke valgt blandt tilfældige variationer.',
    },
    explanation: session.explanation,
    partner: {
      mode: 'solo', title: 'Solo', working: 'Du træner alene.', resting: '—',
      switchOn: '—', switchUnit: 'reps', realRest: true, nextStartsImmediately: false,
      workShare: 'per_person', lines: [], logistics: [],
    },
  };
}
