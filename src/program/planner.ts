/**
 * Programplanlæggeren.
 *
 * Følger specifikationens rækkefølge: valider → kravprofil → anchors → kapacitet →
 * stressbudget → placér anchors → supplemental → assistance → conditioning →
 * belastninger → lint → forklar. Randomisering bruges kun mellem løsninger, der
 * allerede opfylder constraints.
 */

import { BY_ID } from '../engine/data/exercises.js';
import { mulberry32, makeSeed } from '../engine/rng.js';
import type { Rng } from '../engine/rng.js';
import { EXERCISE_DATA_VERSION, RULES_VERSION } from '../engine/version.js';
import { e1rmFor, missingBenchmarks, needsAssessmentWeek } from '../domain/benchmarks.js';
import {
  CONSTRAINT_CODES, checkDuration, checkStressBudget, dedupe, issue,
} from '../domain/constraints.js';
import { ontologyFor } from '../domain/ontology.js';
import { buildLoadRange, loadRangeText } from '../domain/rounding.js';
import { hyroxRules, ruleVersionsFor } from '../domain/ruleSets.js';
import { assessSafety, checkPain } from '../domain/safety.js';
import { planPhases, sportModel } from '../domain/sport.js';
import type { PhaseTemplate, WeeklyAnchor } from '../domain/sport.js';
import { trainingMaxFrom } from '../domain/strength.js';
import type { TrainingMax } from '../domain/strength.js';
import { restForPurpose, estimateSession, trimToFit } from '../domain/timeEstimator.js';
import type { TimedItem } from '../domain/timeEstimator.js';
import { LIFT_EXERCISE, LIFT_NAMES } from '../domain/types.js';
import type {
  AthleteProfile, Benchmark, ConstraintIssue, Goal, LiftId, TrainingHistorySummary,
} from '../domain/types.js';
import { DOMAIN_VERSION, ONTOLOGY_VERSION, PROGRAM_ENGINE_VERSION } from '../domain/versions.js';
import { chooseAssistance, defaultAssistanceFor } from './assistance.js';
import { sportContent } from './sportSessions.js';
import type { SportSessionContext } from './sportSessions.js';
import type { AssistanceContext, WeakPoint } from './assistance.js';
import type {
  AssessmentPlan, ConditioningPrescription, ProgramDayV3, ProgramSession, ProgramV3,
  ProgramWeekV3, SessionStress, SetPrescription,
} from './types.js';

export interface PlanInput {
  profile: AthleteProfile;
  goal: Goal;
  benchmarks: Benchmark[];
  history: TrainingHistorySummary;
  weakPoints: WeakPoint[];
  availableEquipment: string[];
  plates: number[];
  bars: number[];
  weeks: number;
  daysPerWeek: number;
  minutes: number;
  seed?: number;
  now?: string;
}

/* ---------- Training max ---------- */

/**
 * Bygger training max for de fire løft.
 *
 * Findes der ikke et gyldigt e1RM, sættes der ikke et gættet tal. Løftet står
 * uden TM, og planlæggeren programmerer det med RPE i stedet for procent.
 */
export function buildTrainingMaxes(
  benchmarks: Benchmark[],
  now?: string,
): Partial<Record<LiftId, TrainingMax>> {
  const out: Partial<Record<LiftId, TrainingMax>> = {};
  (['squat', 'bench', 'deadlift', 'ohp'] as LiftId[]).forEach((lift) => {
    const rolling = e1rmFor(benchmarks, lift, now);
    if (!rolling) return;
    out[lift] = trainingMaxFrom(rolling.currentKg, rolling.confidence);
  });
  return out;
}

/* ---------- Kapacitet og stressbudget ---------- */

export interface StressBudgetPlan {
  hardSetsPerWeek: number;
  axialPerWeek: number;
  impactPerWeek: number;
  hardSetsPerSession: number;
  /** Systemisk træthed, der er plads til i assistance pr. pas. */
  assistanceFatigue: number;
}

/**
 * Udleder ugens budget af det, atleten faktisk har lavet — ikke af et abstrakt ideal.
 *
 * Uden historik bruges et konservativt startbudget, og det mærkes som en antagelse.
 */
export function allocateStress(
  history: TrainingHistorySummary,
  daysPerWeek: number,
  minutes: number,
  volumeFactor: number,
): StressBudgetPlan {
  const recentHardSets = Object.values(history.hardSetsByPattern).reduce((a, b) => a + b, 0);
  const weeklyBaseline = history.sessions > 0
    ? (recentHardSets / Math.max(1, history.lookbackDays / 7))
    : daysPerWeek * 8;

  // Stigningen holdes under 30 % pr. uge, uanset hvad faseskaleringen beder om.
  const target = Math.round(Math.min(weeklyBaseline * 1.3, weeklyBaseline * volumeFactor));
  const perSession = Math.max(6, Math.round(target / Math.max(1, daysPerWeek)));

  return {
    hardSetsPerWeek: Math.max(daysPerWeek * 6, target),
    axialPerWeek: Math.round(daysPerWeek * 6 * volumeFactor),
    impactPerWeek: Math.round(Math.max(4, history.runKm) * volumeFactor),
    hardSetsPerSession: Math.min(perSession, Math.round(minutes / 4)),
    assistanceFatigue: minutes >= 60 ? 8 : minutes >= 45 ? 6 : 4,
  };
}

/* ---------- Anchor-placering ---------- */

/**
 * Fordeler ugens anchors på dagene med stresskonsolidering.
 *
 * Tunge aksiale anchors må ikke lande på to dage i træk. Reglen implementeres ved
 * at fordele dem så langt fra hinanden som muligt, før resten fyldes ud.
 */
export function placeAnchors(anchors: WeeklyAnchor[], daysPerWeek: number): WeeklyAnchor[][] {
  const days: WeeklyAnchor[][] = Array.from({ length: daysPerWeek }, () => []);
  const required = anchors.filter((a) => a.minPerWeek > 0);

  const heavy = required.filter((a) => a.kind === 'strength');
  const rest = required.filter((a) => a.kind !== 'strength');

  // Tunge anchors spredes først, med størst mulig afstand.
  heavy.forEach((anchor, i) => {
    const target = daysPerWeek <= 1
      ? 0
      : Math.round((i * (daysPerWeek - 1)) / Math.max(1, heavy.length - 1)) % daysPerWeek;
    let day = target;
    // Er dagen allerede taget af et tungt anchor, rykkes der én frem.
    let guard = 0;
    while ((days[day] as WeeklyAnchor[]).some((a) => a.kind === 'strength') && guard < daysPerWeek) {
      day = (day + 1) % daysPerWeek;
      guard += 1;
    }
    (days[day] as WeeklyAnchor[]).push(anchor);
  });

  // Resten lægges på de dage, der har mindst i forvejen.
  rest.forEach((anchor) => {
    const lightest = days
      .map((d, i) => ({ i, n: d.length }))
      .sort((a, b) => a.n - b.n)[0];
    (days[lightest?.i ?? 0] as WeeklyAnchor[]).push(anchor);
  });

  return days;
}

/* ---------- Sætopbygning ---------- */

const secondsPerRepFor = (exerciseId: string): number => BY_ID[exerciseId]?.sec ?? 3;

let setCounter = 0;
const setId = (): string => { setCounter += 1; return `s${setCounter.toString(36)}`; };

/**
 * Bygger top-sæt og backoff for ét hovedløft.
 *
 * Arkitekturen er workbookens: et kalibrerende top-sæt, og derefter et procentvist
 * fald til arbejdssættene, så dagens form styrer resten af passet.
 */
function buildAnchorSets(
  lift: LiftId,
  phase: PhaseTemplate,
  tm: TrainingMax | undefined,
  ctx: { plates: number[]; hasEquipment: boolean; painBlocked: boolean; isAssessment: boolean },
): { sets: SetPrescription[]; issues: ConstraintIssue[] } {
  const exerciseId = LIFT_EXERCISE[lift];
  const name = LIFT_NAMES[lift];
  const issues: ConstraintIssue[] = [];

  if (!ctx.hasEquipment) {
    issues.push(issue(
      CONSTRAINT_CODES.EQUIPMENT_INSUFFICIENT,
      `${name} kræver udstyr, du ikke har markeret som tilgængeligt.`,
      { fix: 'Tilføj stang og vægtskiver under Udstyr, eller vælg et andet mål.', scope: lift },
    ));
    return { sets: [], issues };
  }
  if (ctx.painBlocked) {
    issues.push(issue(
      CONSTRAINT_CODES.PAIN_CONFLICT,
      `${name} rammer et område, du har markeret smerte i.`,
      { fix: 'Vælg en godkendt substitution, eller opdater smerteniveauet i profilen.', scope: lift },
    ));
    return { sets: [], issues };
  }

  /*
   * Indkøringsugen har sin egen protokol.
   *
   * Formålet er ikke at træne, men at finde et tal. Brugeren arbejder sig op med
   * lette sæt og slutter med ét tungt sæt på tre gentagelser, hvor der stoppes med
   * to tilbage i tanken. Det sæt registreres, og derfra kan alt andet regnes.
   *
   * Der sættes bevidst ingen kilo på trinnene: appen kender jo ikke tallene endnu.
   * Brugeren vælger selv vægten efter, hvordan det føles — det er hele øvelsen.
   */
  if (ctx.isAssessment) {
    const rest = restForPurpose('strength');
    const rampSteps: { reps: number; cue: string }[] = [
      { reps: 5, cue: 'Start med noget, der føles let. Du skal kunne tage mange flere.' },
      { reps: 3, cue: 'Læg lidt på. Stadig komfortabelt.' },
      { reps: 2, cue: 'Læg på igen. Nu begynder det at føles som noget.' },
    ];

    return {
      sets: [
        ...rampSteps.map((step) => ({
          id: setId(), type: 'warmup' as const, exerciseId, name,
          sets: 1, reps: step.reps, targetRpe: null, targetRir: null,
          percentBasis: 'none' as const, percent: null, load: null,
          restSeconds: [90, 150] as [number, number], stopRules: [],
          secondsPerRep: secondsPerRepFor(exerciseId),
          rationale: `Optrapning mod dagens sæt. ${step.cue}`,
        })),
        {
          id: setId(), type: 'top', exerciseId, name,
          sets: 1, reps: 3, targetRpe: 8, targetRir: 2,
          percentBasis: 'none', percent: null, load: null,
          restSeconds: rest,
          stopRules: [
            'Stop, hvis teknikken skrider — så er vægten for tung til at måle på.',
            'Stop ved smerte på 4 eller derover.',
          ],
          secondsPerRep: secondsPerRepFor(exerciseId),
          rationale:
            `Dagens måling: 3 gentagelser i ${name.toLowerCase()}, hvor du stopper med `
            + 'cirka to gentagelser tilbage i tanken. Registrér vægten bagefter — så '
            + 'regner appen dine kilo og procenter for resten af forløbet.',
        },
      ],
      issues: [],
    };
  }

  const [repLo, repHi] = phase.repRange;
  const topReps = repLo;
  const backoffReps = Math.min(repHi, repLo + 2);
  const topPercent = phase.intensity[1];
  // Backoff falder mere, jo tættere top-sættet ligger på failure, og jo mere
  // teknisk krævende løftet er. Tallene er coach-defaults, ikke konstanter.
  const skill = ontologyFor(exerciseId)?.skill ?? 3;
  const drop = 0.1 + (phase.targetRir[0] <= 1 ? 0.03 : 0) + (skill >= 4 ? 0.02 : 0);
  const backoffPercent = Math.max(0.55, topPercent - drop);

  const rest = restForPurpose(phase.id === 'intensification' || phase.id === 'peak' ? 'intensification' : 'strength');
  const targetRir = phase.targetRir[0];
  const targetRpe = 10 - targetRir;

  const stopRules = [
    'Stop sættet ved smerte på 4 eller derover.',
    'Stop ved teknikbrud — en dårlig rep tæller ikke.',
    `Stop, hvis RPE overstiger ${Math.min(10, targetRpe + 1.5)}.`,
  ];

  if (!tm) {
    // Uden et gyldigt training max programmeres der med RPE i stedet for procent.
    // Der opfindes ikke et kilotal.
    return {
      sets: [{
        id: setId(), type: 'top', exerciseId, name,
        sets: 1, reps: topReps, targetRpe, targetRir,
        percentBasis: 'none', percent: null, load: null,
        restSeconds: rest, stopRules,
        secondsPerRep: secondsPerRepFor(exerciseId),
        rationale:
          `Du har ikke et gyldigt tal for ${name.toLowerCase()} endnu, så sættet styres af `
          + `RPE ${targetRpe} i stedet for en procent. Log sættet, så beregnes kiloene næste gang.`,
      }, {
        id: setId(), type: 'backoff', exerciseId, name,
        sets: 3, reps: backoffReps, targetRpe: targetRpe - 1, targetRir: targetRir + 1,
        percentBasis: 'none', percent: null, load: null,
        restSeconds: rest, stopRules,
        secondsPerRep: secondsPerRepFor(exerciseId),
        rationale: 'Backoff køres én RPE lettere end top-sættet.',
      }],
      issues: [issue(
        CONSTRAINT_CODES.LOW_CONFIDENCE,
        `${name} programmeres efter RPE, fordi der ikke er et gyldigt e1RM.`,
        { fix: 'Log et top-sæt, så kan kiloene beregnes.', scope: lift },
      )],
    };
  }

  const topLoad = buildLoadRange({
    referenceKg: tm.kg, basis: 'trainingMax', percent: topPercent,
    confidence: tm.confidence, benchmarkIds: [], referenceLabel: 'training max',
    stepKg: 2.5,
  });
  const backoffLoad = buildLoadRange({
    referenceKg: tm.kg, basis: 'trainingMax', percent: backoffPercent,
    confidence: tm.confidence, benchmarkIds: [], referenceLabel: 'training max',
    stepKg: 2.5,
  });

  return {
    sets: [{
      id: setId(), type: 'top', exerciseId, name,
      sets: 1, reps: topReps, targetRpe, targetRir,
      percentBasis: 'trainingMax', percent: topPercent, load: topLoad,
      restSeconds: rest, stopRules,
      secondsPerRep: secondsPerRepFor(exerciseId),
      rationale:
        `Dagens kalibrerende top-sæt. ${topLoad.provenance.explanation} `
        + `Ramte du RPE ${targetRpe}, står backoff rigtigt; ellers justeres den efter sættet.`,
    }, {
      id: setId(), type: 'backoff', exerciseId, name,
      sets: phase.id === 'peak' ? 2 : 3,
      reps: backoffReps,
      targetRpe: targetRpe - 1, targetRir: targetRir + 1,
      percentBasis: 'trainingMax', percent: backoffPercent, load: backoffLoad,
      restSeconds: rest, stopRules,
      secondsPerRep: secondsPerRepFor(exerciseId),
      rationale:
        `Backoff ligger ${Math.round(drop * 100)} % under top-sættet. `
        + `Faldet er større, fordi ${skill >= 4 ? 'løftet er teknisk krævende' : 'top-sættet ligger tæt på failure'}.`,
    }],
    issues,
  };
}

/* ---------- Conditioning ---------- */

const CARDIO_BY_EQUIPMENT: { id: string; eq: string }[] = [
  { id: 'row', eq: 'rower' },
  { id: 'ski', eq: 'skierg' },
  { id: 'bike', eq: 'bikeerg' },
  { id: 'assault', eq: 'assaultbike' },
  { id: 'air_run', eq: 'airrunner' },
  { id: 'run_dist', eq: 'run' },
];

function buildConditioning(
  zone: 'low' | 'moderate' | 'high',
  minutes: number,
  equipment: string[],
  rnd: Rng,
  preferRun: boolean,
): ConditioningPrescription | null {
  const pool = CARDIO_BY_EQUIPMENT.filter((c) => equipment.includes(c.eq));
  if (!pool.length) return null;
  const runFirst = preferRun ? pool.filter((c) => c.id === 'run_dist' || c.id === 'air_run') : [];
  const chosen = (runFirst.length ? runFirst : pool)[Math.floor(rnd() * (runFirst.length || pool.length))]
    ?? pool[0];
  if (!chosen) return null;
  const name = BY_ID[chosen.id]?.name ?? chosen.id;

  if (zone === 'low') {
    return {
      id: setId(), exerciseId: chosen.id, name, zone, modality: name,
      minutes, intervals: null,
      targetText: 'Roligt tempo, hvor du kan tale i hele sætninger.',
      rationale:
        'Lav intensitet bygger volumen og restitutionstolerance uden at koste noget '
        + 'af det tunge arbejde. Talkketesten er styringen — ikke en pulsformel.',
    };
  }
  if (zone === 'moderate') {
    const rounds = Math.max(3, Math.round(minutes / 5));
    return {
      id: setId(), exerciseId: chosen.id, name, zone, modality: name,
      minutes, intervals: { work: 180, rest: 60, rounds },
      targetText: 'Tempo du kan holde i cirka en time — anstrengt, men kontrolleret.',
      rationale: 'Threshold-arbejde flytter det tempo, du kan holde over lang tid.',
    };
  }
  const rounds = Math.max(4, Math.round(minutes / 3));
  return {
    id: setId(), exerciseId: chosen.id, name, zone, modality: name,
    minutes, intervals: { work: 60, rest: 120, rounds },
    targetText: 'Hårdt, men gennemførligt på alle intervaller. Stop, hvis tempoet falder markant.',
    rationale:
      'Korte intervaller med rigelig pause. Stopkriteriet er tempofald, ikke et fast antal.',
  };
}

/* ---------- Session ---------- */

function stressOf(sets: SetPrescription[]): SessionStress {
  return sets.reduce<SessionStress>((acc, s) => {
    const o = ontologyFor(s.exerciseId);
    const hard = s.type === 'top' || s.type === 'backoff' || s.type === 'supplemental'
      || s.type === 'assistance';
    return {
      hardSets: acc.hardSets + (hard ? s.sets : 0),
      axial: acc.axial + (o?.fatigue.axial ?? 0) * s.sets,
      impact: acc.impact + (o?.fatigue.impact ?? 0) * s.sets,
      highSkillFatigue: acc.highSkillFatigue + ((o?.skill ?? 0) >= 4 ? s.sets : 0),
    };
  }, { hardSets: 0, axial: 0, impact: 0, highSkillFatigue: 0 });
}

function toTimedItems(session: Omit<ProgramSession, 'plannedMinutes' | 'stress' | 'issues' | 'explanation'>): TimedItem[] {
  const fromSet = (s: SetPrescription, priority: TimedItem['priority']): TimedItem => ({
    id: s.id, label: s.name, exerciseId: s.exerciseId, priority,
    sets: s.sets, reps: s.reps, secondsPerRep: s.secondsPerRep,
    restSeconds: Math.round((s.restSeconds[0] + s.restSeconds[1]) / 2),
  });
  return [
    ...session.warmup.map((s) => fromSet(s, 'warmup')),
    ...session.anchors.map((s) => fromSet(s, 'anchor')),
    ...session.supplemental.map((s) => fromSet(s, 'supplemental')),
    ...session.assistance.map((s) => fromSet(s, 'assistance')),
    ...session.conditioning.map((c) => ({
      id: c.id, label: c.name, exerciseId: c.exerciseId, priority: 'conditioning' as const,
      sets: c.intervals?.rounds ?? 1,
      reps: 1,
      secondsPerRep: c.intervals ? c.intervals.work : c.minutes * 60,
      restSeconds: c.intervals?.rest ?? 0,
    })),
  ];
}

/**
 * RAMP-opvarmning til et programpas.
 *
 * Hvert hovedløft får sin egen ramp mod dagens belastning — aldrig et spring fra
 * tom stang direkte til arbejdsvægten.
 */
function buildProgramWarmup(anchors: SetPrescription[]): SetPrescription[] {
  const out: SetPrescription[] = [];
  anchors.filter((a) => a.type === 'top').forEach((anchor) => {
    const steps: { pct: number; reps: number }[] = [
      { pct: 0.4, reps: 5 },
      { pct: 0.6, reps: 3 },
      { pct: 0.8, reps: 2 },
    ];
    steps.forEach((step) => {
      const load = anchor.load
        ? buildLoadRange({
          referenceKg: anchor.load.targetKg, basis: 'trainingMax', percent: step.pct,
          confidence: anchor.load.provenance.confidence, benchmarkIds: [],
          referenceLabel: 'dagens arbejdsvægt', stepKg: 2.5, spread: 0,
        })
        : null;
      out.push({
        id: setId(), type: 'warmup', exerciseId: anchor.exerciseId, name: anchor.name,
        sets: 1, reps: step.reps, targetRpe: null, targetRir: null,
        percentBasis: anchor.load ? 'trainingMax' : 'none',
        percent: step.pct, load,
        restSeconds: [45, 90], stopRules: [],
        secondsPerRep: secondsPerRepFor(anchor.exerciseId),
        rationale:
          `Ramp mod dagens ${anchor.name.toLowerCase()}: ${Math.round(step.pct * 100)} % af `
          + 'arbejdsvægten. Opvarmningen må ikke koste noget af hovedarbejdet.',
      });
    });
  });
  return out;
}

/* ---------- Hovedfunktion ---------- */

export function planProgram(input: PlanInput): ProgramV3 {
  const now = input.now ?? new Date().toISOString();
  const seed = input.seed ?? makeSeed();
  const rnd = mulberry32(seed);
  const model = sportModel(input.goal.sport);
  const issues: ConstraintIssue[] = [];
  setCounter = 0;

  /* 1. Valider profil og risiko. */
  const safety = assessSafety(input.profile.screening, now);
  issues.push(...safety.issues);

  const missing = missingBenchmarks(input.goal.sport, input.benchmarks, undefined, now);
  const wantsAssessment = needsAssessmentWeek(missing)
    || input.goal.baselineStrategy === 'assessment';

  /* Strongman uden eventliste er en hard error, ikke en anledning til at gætte. */
  if (input.goal.sport === 'strongman' && !(input.goal.events?.length)) {
    issues.push(issue(
      CONSTRAINT_CODES.MISSING_ANCHOR,
      'Der er ikke angivet en eventliste for konkurrencen.',
      {
        fix: 'Tilføj events, redskaber, loads, distancer og tidsgrænser. '
          + 'Uden dem bygges der et generelt styrkeforløb, ikke en contest prep.',
        scope: 'goal',
      },
    ));
  }

  /* HYROX kræver en gyldig regelversion. */
  const hyrox = input.goal.sport === 'hyrox'
    ? hyroxRules(input.goal.ruleSet?.version)
    : null;
  if (input.goal.sport === 'hyrox') {
    if (!hyrox) {
      issues.push(issue(
        CONSTRAINT_CODES.INVALID_RULESET,
        'Den valgte HYROX-regelversion findes ikke i appen.',
        { fix: 'Vælg den aktuelle sæson under målet.', scope: 'ruleSet' },
      ));
    } else if (hyrox.needsRevalidation) {
      issues.push(issue(
        CONSTRAINT_CODES.RULESET_UNVERIFIED,
        `Stationsloads bygger på et snapshot fra ${hyrox.ref.checkedAt} og er ikke bekræftet `
        + 'mod den aktuelle rulebook.',
        { fix: 'Kontrollér division og vægte på hyrox.com/rulebook, før du regner dem som endelige.', scope: 'ruleSet' },
      ));
    }
  }

  const trainingMaxes = buildTrainingMaxes(input.benchmarks, now);
  const phases = planPhases(input.goal.sport, input.weeks, Boolean(input.goal.eventDate));

  const assessment: AssessmentPlan | null = wantsAssessment
    ? {
      missing: missing.map((m) => ({ label: m.label, suggestion: m.suggestion })),
      weeks: 1,
      explanation:
        'Der mangler tal, som programmet ikke kan regne uden. Første uge er derfor en '
        + 'indkøringsuge med tekniske top-sæt og lav volumen. Det er hurtigere end at '
        + 'gætte kilo — og resultatet bliver dit eget.',
    }
    : null;

  /* Alarmsymptom: der bygges ikke et program. */
  if (!safety.mayTrain) {
    return {
      id: `p_${seed}`, seed, sport: input.goal.sport, goalName: model.name,
      createdAt: now, weeks: [], minutes: input.minutes, daysPerWeek: input.daysPerWeek,
      trainingMaxes, assessment: null, issues: dedupe(issues), version: 1,
      provenance: provenanceOf(seed, input),
      explanation: [
        'Der er ikke bygget et program, fordi du har markeret et alarmsymptom. '
        + 'WHATWORK vurderer ikke symptomer og programmerer ikke oven på dem.',
      ],
    };
  }

  const weeks: ProgramWeekV3[] = [];
  let previousAssistance: string[] = [];
  let weeksOnAssistance = 0;

  for (let w = 0; w < input.weeks; w++) {
    const entry = phases[w];
    const phase = entry?.phase ?? (model.phases[0] as PhaseTemplate);
    const isAssessment = Boolean(assessment) && w === 0;
    // Deload lægges ved blokskift i længere forløb, ikke blindt hver fjerde uge.
    const nextPhase = phases[w + 1]?.phase.id;
    const deload = !isAssessment && input.weeks >= 6
      && Boolean(nextPhase) && nextPhase !== phase.id
      && phase.id !== 'taper' && phase.id !== 'peak';
    // Styrkeforløb slutter i fasen "Peak og taper"; HYROX og strongman har en egen
    // taper-fase. Begge tælles som taper, så volumen og assistance skæres ens ned.
    const taper = phase.id === 'taper' || phase.id === 'peak';
    const reduced = deload || taper || isAssessment;

    const volumeFactor = isAssessment ? 0.55 : deload ? 0.6 : phase.volumeFactor;
    const budget = allocateStress(input.history, input.daysPerWeek, input.minutes, volumeFactor);

    const anchors = model.anchors({ daysPerWeek: input.daysPerWeek, goal: input.goal, reduced });
    const perDay = placeAnchors(anchors, input.daysPerWeek);

    const weekIssues: ConstraintIssue[] = [];
    const days: ProgramDayV3[] = [];
    const assistanceThisWeek: string[] = [];

    for (let d = 0; d < input.daysPerWeek; d++) {
      const dayAnchors = perDay[d] ?? [];
      const built = buildSession({
        input, phase, dayAnchors, trainingMaxes, budget, rnd,
        isAssessment, deload, taper,
        assistanceContext: {
          profile: input.profile,
          pain: input.profile.screening.pain,
          availableEquipment: input.availableEquipment,
          usedExerciseIds: [],
          saturatedGroups: [],
          fatigueBudget: budget.assistanceFatigue,
          previous: previousAssistance,
          weeksOnPrevious: weeksOnAssistance,
        },
        weakPoints: input.weakPoints,
        week: w + 1,
      });
      built.session.assistance.forEach((a) => assistanceThisWeek.push(a.exerciseId));
      weekIssues.push(...built.session.issues);
      days.push({ day: d + 1, status: 'planned', session: built.session, error: null });
    }

    /* Lint: er alle obligatoriske anchors dækket i ugen? */
    const covered = new Set(days.flatMap((d) => d.session?.coversAnchors ?? []));
    anchors.filter((a) => a.mandatory && a.minPerWeek > 0).forEach((a) => {
      if (covered.has(a.id)) return;
      weekIssues.push(issue(
        CONSTRAINT_CODES.MISSING_ANCHOR,
        `Uge ${w + 1} mangler en planlagt eksponering for ${a.label.toLowerCase()}.`,
        { fix: a.rationale, scope: `week-${w + 1}` },
      ));
    });

    const weekStress = days.reduce<SessionStress>((acc, d) => ({
      hardSets: acc.hardSets + (d.session?.stress.hardSets ?? 0),
      axial: acc.axial + (d.session?.stress.axial ?? 0),
      impact: acc.impact + (d.session?.stress.impact ?? 0),
      highSkillFatigue: acc.highSkillFatigue + (d.session?.stress.highSkillFatigue ?? 0),
    }), { hardSets: 0, axial: 0, impact: 0, highSkillFatigue: 0 });

    const previousWeekStress = weeks[weeks.length - 1]?.stress;
    if (previousWeekStress) {
      weekIssues.push(...checkStressBudget(weekStress, previousWeekStress, `week-${w + 1}`));
    }

    weeks.push({
      index: w + 1,
      phase: phase.id,
      phaseName: isAssessment ? 'Indkøringsuge' : phase.name,
      deload,
      taper,
      assessment: isAssessment,
      rationale: weekRationale({ w, phase, isAssessment, deload, taper, total: input.weeks }),
      days,
      stress: weekStress,
      issues: dedupe(weekIssues),
    });

    // Assistance holdes stabil i mindst tre uger, før den må skiftes.
    const changed = assistanceThisWeek.some((id) => !previousAssistance.includes(id));
    weeksOnAssistance = changed ? 1 : weeksOnAssistance + 1;
    previousAssistance = [...new Set(assistanceThisWeek)];
  }

  /* Lint på hele forløbet. */
  if (input.weeks >= 6 && !weeks.some((x) => x.deload || x.taper)) {
    issues.push(issue(
      CONSTRAINT_CODES.NO_DELOAD,
      `Et forløb på ${input.weeks} uger uden en roligere uge eller taper.`,
      { fix: 'Læg en deload ind ved blokskiftet.', scope: 'program' },
    ));
  }

  return {
    id: `p_${seed}`,
    seed,
    sport: input.goal.sport,
    goalName: model.name,
    createdAt: now,
    weeks,
    minutes: input.minutes,
    daysPerWeek: input.daysPerWeek,
    trainingMaxes,
    assessment,
    issues: dedupe(issues),
    version: 1,
    provenance: provenanceOf(seed, input),
    explanation: explainProgram(input, model.name, phases, trainingMaxes, assessment),
  };
}

function provenanceOf(seed: number, input: PlanInput) {
  return {
    generatorVersion: PROGRAM_ENGINE_VERSION,
    domainVersion: DOMAIN_VERSION,
    ontologyVersion: ONTOLOGY_VERSION,
    exerciseLibraryVersion: EXERCISE_DATA_VERSION,
    rulesVersion: RULES_VERSION,
    ruleVersions: ruleVersionsFor([input.goal.ruleSet]),
    seed,
  };
}

function weekRationale(o: {
  w: number; phase: PhaseTemplate; isAssessment: boolean; deload: boolean; taper: boolean; total: number;
}): string {
  if (o.isAssessment) {
    return 'Indkøringsuge. Der køres tekniske top-sæt med lav volumen, så programmet får '
      + 'rigtige tal at regne på i stedet for gæt.';
  }
  if (o.taper) {
    return `${o.phase.name}. ${o.phase.description} Taper er ikke det samme som en deload — `
      + 'intensiteten bevares, mens volumen falder.';
  }
  if (o.deload) {
    return 'Roligere uge ved blokskiftet. Volumen ned, noget teknisk specifik intensitet '
      + 'bevares, og assistance med høj træthed er fjernet.';
  }
  return `${o.phase.name}. ${o.phase.description}`;
}

function explainProgram(
  input: PlanInput,
  goalName: string,
  phases: { phase: PhaseTemplate; week: number }[],
  trainingMaxes: Partial<Record<LiftId, TrainingMax>>,
  assessment: AssessmentPlan | null,
): string[] {
  const out: string[] = [];
  const blocks = [...new Set(phases.map((p) => p.phase.name))];
  out.push(
    `${goalName} over ${input.weeks} uger med ${input.daysPerWeek} pas om ugen `
    + `à ${input.minutes} minutter.`,
  );
  if (blocks.length) out.push(`Forløbet går gennem ${blocks.join(' → ')}.`);
  if (assessment) {
    out.push(assessment.explanation);
  }
  const withTm = (Object.keys(trainingMaxes) as LiftId[]);
  if (withTm.length) {
    out.push(
      'Belastninger regnes af training max: '
      + withTm.map((l) => `${LIFT_NAMES[l]} ${trainingMaxes[l]?.kg} kg`).join(', ')
      + '. Training max er en konservativ anchor, ikke din 1RM.',
    );
  }
  if (input.goal.eventDate) {
    out.push(`Forløbet peger mod ${new Date(input.goal.eventDate).toLocaleDateString('da-DK')}.`);
  }
  return out;
}

/* ---------- Sessionsbygning ---------- */

interface SessionInput {
  input: PlanInput;
  phase: PhaseTemplate;
  dayAnchors: WeeklyAnchor[];
  trainingMaxes: Partial<Record<LiftId, TrainingMax>>;
  budget: StressBudgetPlan;
  rnd: Rng;
  isAssessment: boolean;
  deload: boolean;
  taper: boolean;
  assistanceContext: AssistanceContext;
  weakPoints: WeakPoint[];
  /** Ugens nummer i forløbet, 1-baseret. Sportsindholdet bruger det til opbygning. */
  week: number;
}

function buildSession(o: SessionInput): { session: ProgramSession } {
  const { input, phase, dayAnchors, trainingMaxes } = o;
  const issues: ConstraintIssue[] = [];
  const anchorSets: SetPrescription[] = [];
  const covers: string[] = [];
  const used: string[] = [];

  const hasBar = input.availableEquipment.includes('barbell');

  const sportCtx: SportSessionContext = {
    goal: input.goal,
    phase,
    profile: input.profile,
    pain: input.profile.screening.pain,
    availableEquipment: input.availableEquipment,
    week: o.week,
    totalWeeks: input.weeks,
    weeklyRunKm: input.history.runKm,
    minutes: input.minutes,
    reduced: o.deload || o.taper || o.isAssessment,
    nextId: setId,
  };

  const sportConditioning: ConditioningPrescription[] = [];
  const sportStimulus: string[] = [];

  dayAnchors.forEach((anchor) => {
    /*
     * Sportsspecifikt indhold får første ret.
     *
     * HYROX-stationer, CrossFit-gymnastik og strongman-events kan ikke udtrykkes som
     * et bevægelsesmønster — de har egne standarder, vægte og formål. Kun når sporten
     * ikke har noget særligt for anchoret, falder vi tilbage til mønstervalget.
     */
    const sport = sportContent(anchor.id, sportCtx);
    if (sport.sets.length || sport.conditioning.length || sport.issues.length) {
      issues.push(...sport.issues);
      if (sport.sets.length || sport.conditioning.length) {
        anchorSets.push(...sport.sets);
        sportConditioning.push(...sport.conditioning);
        sport.sets.forEach((s) => used.push(s.exerciseId));
        covers.push(anchor.id);
        if (sport.stimulus) sportStimulus.push(sport.stimulus);
      }
      return;
    }

    if (anchor.liftId) {
      const exerciseId = LIFT_EXERCISE[anchor.liftId];
      const painBlocked = checkPain(exerciseId, input.profile.screening.pain).blocked;
      const built = buildAnchorSets(anchor.liftId, phase, trainingMaxes[anchor.liftId], {
        plates: input.plates, hasEquipment: hasBar, painBlocked, isAssessment: o.isAssessment,
      });
      issues.push(...built.issues);
      if (built.sets.length) {
        anchorSets.push(...built.sets);
        covers.push(anchor.id);
        used.push(exerciseId);
      }
      return;
    }

    // Mønsterbaserede anchors: vælg den bedst egnede tilgængelige øvelse.
    const patterns = anchor.patterns ?? [];
    const ids = anchor.exerciseIds ?? [];
    const candidate = [...ids, ...Object.values(BY_ID)
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .filter((e) => patterns.includes(e.cat) && !e.accessory)
      .map((e) => e.id)]
      .find((id) => {
        const ex = BY_ID[id];
        if (!ex) return false;
        if (input.profile.excludedExerciseIds.includes(id)) return false;
        if (!ex.eq.every((e) => e === 'bodyweight' || input.availableEquipment.includes(e))) return false;
        if (checkPain(id, input.profile.screening.pain).blocked) return false;
        return !used.includes(id);
      });

    if (!candidate) return;
    const ex = BY_ID[candidate];
    if (!ex) return;
    const [lo, hi] = phase.repRange;
    anchorSets.push({
      id: setId(), type: 'supplemental', exerciseId: candidate, name: ex.name,
      sets: o.deload ? 2 : 3, reps: Math.round((lo + hi) / 2),
      targetRpe: 10 - phase.targetRir[1], targetRir: phase.targetRir[1],
      percentBasis: 'none', percent: null, load: null,
      restSeconds: restForPurpose('strength'),
      stopRules: ['Stop ved smerte på 4 eller derover.', 'Stop ved teknikbrud.'],
      secondsPerRep: secondsPerRepFor(candidate),
      rationale:
        `Dækker ugens obligatoriske eksponering for ${anchor.label.toLowerCase()}. ${anchor.rationale}`,
    });
    covers.push(anchor.id);
    used.push(candidate);
  });

  /* Assistance — kun når der er tid og budget til den. */
  const assistanceSlots = o.taper || o.isAssessment ? 0 : input.minutes >= 60 ? 3 : input.minutes >= 45 ? 2 : 1;
  const mainLift = dayAnchors.find((a) => a.liftId)?.liftId ?? null;
  const choices = assistanceSlots === 0
    ? []
    : (o.weakPoints.length
      ? chooseAssistance(o.weakPoints, assistanceSlots, { ...o.assistanceContext, usedExerciseIds: used })
      : mainLift
        ? defaultAssistanceFor(mainLift, { ...o.assistanceContext, usedExerciseIds: used }, assistanceSlots)
        : []);

  const assistance: SetPrescription[] = choices.map((c) => ({
    id: setId(), type: 'assistance', exerciseId: c.exerciseId, name: c.name,
    sets: o.deload ? 2 : 3,
    reps: Math.min(15, Math.max(8, (BY_ID[c.exerciseId]?.rep?.[0] ?? 10))),
    targetRpe: 8, targetRir: 2,
    percentBasis: 'none', percent: null, load: null,
    restSeconds: restForPurpose('hypertrophy'),
    stopRules: ['Stop ved smerte på 4 eller derover.'],
    secondsPerRep: secondsPerRepFor(c.exerciseId),
    rationale: c.rationale,
  }));

  /* Conditioning efter sportens fordeling — aldrig før det prioriterede styrkearbejde. */
  // Sportens eget konditionsarbejde vinder over det generelle. Et HYROX-løb med
  // opbygget volumen skal ikke erstattes af en tilfældig maskinintervalserie.
  const conditioning: ConditioningPrescription[] = [...sportConditioning];
  const wantsConditioning = dayAnchors.some((a) => a.kind === 'conditioning' || a.kind === 'run');
  if (wantsConditioning && !o.isAssessment && !conditioning.length) {
    const isRun = dayAnchors.some((a) => a.kind === 'run');
    const zone = o.taper || o.deload ? 'low' : pickZone(input.goal.sport, o.rnd);
    const minutes = Math.max(8, Math.round(input.minutes * (anchorSets.length ? 0.25 : 0.6)));
    const c = buildConditioning(zone, minutes, input.availableEquipment, o.rnd, isRun);
    if (c) {
      conditioning.push(c);
      dayAnchors.filter((a) => a.kind === 'conditioning' || a.kind === 'run')
        .forEach((a) => covers.push(a.id));
    }
  }

  const warmup = buildProgramWarmup(anchorSets);

  const draft = {
    id: setId(),
    stimulus: sportStimulus.length
      ? sportStimulus.join(' ')
      : stimulusOf(anchorSets, conditioning, o),
    warmup, anchors: anchorSets, supplemental: [], assistance, conditioning,
    coversAnchors: [...new Set(covers)],
  };

  /*
   * Passer passet ikke i tiden, fjernes den lavest prioriterede assistance — og
   * derefter kondition. Hovedløftene og deres pauser røres aldrig: et styrkepas med
   * for korte pauser er ikke et kortere styrkepas, men et andet pas.
   */
  const trimmed = trimToFit(toTimedItems(draft), input.minutes);
  const removedIds = new Set(trimmed.removed.map((r) => r.id));
  if (removedIds.size) {
    draft.assistance = draft.assistance.filter((a) => !removedIds.has(a.id));
    draft.conditioning = draft.conditioning.filter((c) => !removedIds.has(c.id));
    trimmed.removed.forEach((r) => issues.push(issue(
      CONSTRAINT_CODES.NEAR_TIME_LIMIT,
      `${r.label} er taget ud, så passet kan være inden for ${input.minutes} minutter.`,
      { fix: r.reason, scope: 'session' },
    )));
  }

  const estimate = estimateSession(toTimedItems(draft));
  if (trimmed.stillTooLong) {
    issues.push(...checkDuration(estimate.totalMinutes, input.minutes, 'session'));
  }

  const allSets = [...anchorSets, ...assistance];
  const stress = stressOf(allSets);
  if (stress.hardSets > o.budget.hardSetsPerSession * 1.4) {
    issues.push(issue(
      CONSTRAINT_CODES.HIGH_TOTAL_STRESS,
      `Passet har ${stress.hardSets} hårde sæt mod et budget på ${o.budget.hardSetsPerSession}.`,
      { scope: 'session' },
    ));
  }

  return {
    session: {
      ...draft,
      plannedMinutes: estimate.totalMinutes,
      stress,
      issues: dedupe(issues),
      explanation: explainSession(draft, estimate.totalMinutes, o),
    },
  };
}

function pickZone(sport: PlanInput['goal']['sport'], rnd: Rng): 'low' | 'moderate' | 'high' {
  const split = sportModel(sport).conditioningSplit;
  const r = rnd();
  if (r < split.low) return 'low';
  if (r < split.low + split.moderate) return 'moderate';
  return 'high';
}

function stimulusOf(
  anchors: SetPrescription[],
  conditioning: ConditioningPrescription[],
  o: SessionInput,
): string {
  const lifts = [...new Set(anchors.filter((a) => a.type !== 'warmup').map((a) => a.name))];
  if (o.isAssessment) return 'Indkøring: teknisk top-sæt og lav volumen.';
  if (!lifts.length && conditioning.length) return `${conditioning[0]?.name} i ${zoneName(conditioning[0]?.zone)}.`;
  const head = lifts.slice(0, 2).join(' og ');
  return conditioning.length
    ? `${head} som hovedarbejde, derefter ${zoneName(conditioning[0]?.zone)} kondition.`
    : `${head} som hovedarbejde.`;
}

const zoneName = (zone?: 'low' | 'moderate' | 'high'): string =>
  (zone === 'high' ? 'høj intensitet' : zone === 'moderate' ? 'moderat intensitet' : 'lav intensitet');

function explainSession(
  draft: { anchors: SetPrescription[]; assistance: SetPrescription[]; conditioning: ConditioningPrescription[] },
  minutes: number,
  o: SessionInput,
): string[] {
  const out: string[] = [];
  out.push(`${o.phase.name}: ${o.phase.description}`);
  out.push(`Passet er beregnet til ${minutes} minutter inklusive pauser, opsætning og skift.`);
  draft.anchors.filter((a) => a.type === 'top').forEach((a) => {
    out.push(`${a.name}: ${a.load ? loadRangeText(a.load) : `RPE ${a.targetRpe}`}. ${a.rationale}`);
  });
  if (draft.assistance.length) {
    out.push(`Assistance: ${draft.assistance.map((a) => a.name).join(', ')}. `
      + 'Valgt efter hovedløftene, ikke ved siden af dem.');
  }
  if (draft.conditioning.length) {
    out.push(`${draft.conditioning[0]?.rationale}`);
  }
  return out;
}
