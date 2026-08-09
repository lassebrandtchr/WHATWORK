/**
 * Assistance-regelmotoren.
 *
 * Assistance vælges efter hovedløftene, ikke ved siden af dem. Hvert valg skal
 * kunne spores til et weak point, et bevægelsesmønster, et teknikbehov eller et
 * hul i ugens dækning — aldrig til et muskelnavn alene.
 */

import { BY_ID } from '../engine/data/exercises.js';
import { canProgram } from '../domain/competence.js';
import { ontologyFor, transferTo } from '../domain/ontology.js';
import { checkPain } from '../domain/safety.js';
import type { AthleteProfile, LiftId, PainEntry } from '../domain/types.js';
import { LIFT_NAMES } from '../domain/types.js';

export type WeakPointId =
  | 'squat_bottom' | 'squat_lockout'
  | 'bench_chest' | 'bench_lockout'
  | 'deadlift_floor' | 'deadlift_lockout'
  | 'ohp_start' | 'ohp_lockout'
  | 'grip' | 'trunk' | 'none';

export interface WeakPoint {
  id: WeakPointId;
  lift: LiftId | null;
  label: string;
  /** 0-1. Lav confidence giver brede, lavrisiko-varianter og ny vurdering efter en blok. */
  confidence: number;
  /** Kontrolspørgsmålet fra specifikationens weak-point-tabel. */
  controlQuestion: string;
}

/** Weak-point-mapping. Kandidaterne står i prioriteret rækkefølge. */
const MAPPING: Record<WeakPointId, { candidates: string[]; question: string; label: string; lift: LiftId | null }> = {
  squat_bottom: {
    label: 'Squat ud af bunden',
    lift: 'squat',
    candidates: ['front_squat', 'goblet_squat', 'bulgarian_split_squat', 'air_squat'],
    question: 'Er problemet styrke, position eller kommandoen?',
  },
  squat_lockout: {
    label: 'Squat — overkroppen falder frem',
    lift: 'squat',
    candidates: ['good_morning', 'rdl', 'barbell_row', 'plank'],
    question: 'Er den aksiale træthed allerede høj?',
  },
  bench_chest: {
    label: 'Bænkpres fra brystet',
    lift: 'bench',
    candidates: ['incline_bench_press', 'db_bench', 'push_up', 'barbell_row'],
    question: 'Er touch point og pause stabil?',
  },
  bench_lockout: {
    label: 'Bænkpres lockout',
    lift: 'bench',
    candidates: ['diamond_push_up', 'dip', 'db_bench'],
    question: 'Er problemet reelt lockout, eller er positionen tabt?',
  },
  deadlift_floor: {
    label: 'Dødløft fra gulvet',
    lift: 'deadlift',
    candidates: ['front_squat', 'barbell_row', 'db_row'],
    question: 'Passer et deficit til atletens stil og bygning?',
  },
  deadlift_lockout: {
    label: 'Dødløft lockout',
    lift: 'deadlift',
    candidates: ['rdl', 'hip_thrust', 'barbell_row', 'glute_bridge'],
    question: 'Undgå blot at lægge mere tung aksial belastning oveni.',
  },
  ohp_start: {
    label: 'Overhead press fra start',
    lift: 'ohp',
    candidates: ['incline_bench_press', 'db_shoulder_press', 'barbell_row'],
    question: 'Har atleten et stabilt rack og en stabil bracing?',
  },
  ohp_lockout: {
    label: 'Overhead press lockout',
    lift: 'ohp',
    candidates: ['push_press', 'diamond_push_up', 'db_shoulder_press'],
    question: 'Er der smertefri bevægelighed over hovedet?',
  },
  grip: {
    label: 'Greb',
    lift: null,
    candidates: ['farmer_carry', 'farmer_hold', 'front_rack_carry', 'db_row'],
    question: 'Er det grebet, der slipper, eller ryggen der giver op?',
  },
  trunk: {
    label: 'Bracing og midterkrop',
    lift: null,
    candidates: ['front_rack_carry', 'plank', 'hollow_hold', 'dead_bug', 'side_plank'],
    question: 'Kan positionen holdes friskt, men ikke under træthed?',
  },
  none: { label: 'Intet registreret weak point', lift: null, candidates: [], question: '' },
};

export function weakPoint(id: WeakPointId, confidence = 0.5): WeakPoint {
  const m = MAPPING[id];
  return {
    id, lift: m.lift, label: m.label, confidence, controlQuestion: m.question,
  };
}

export const WEAK_POINT_LIST: WeakPoint[] = (Object.keys(MAPPING) as WeakPointId[])
  .filter((id) => id !== 'none')
  .map((id) => weakPoint(id));

export interface AssistanceContext {
  profile: Pick<AthleteProfile, 'competence' | 'level' | 'care' | 'excludedExerciseIds'>;
  pain: PainEntry[];
  availableEquipment: string[];
  /** Øvelser, der allerede ligger i passet — assistance må ikke dublere dem. */
  usedExerciseIds: string[];
  /** Bevægelsesgrupper, ugen allerede har dækket rigeligt. */
  saturatedGroups: string[];
  /** Hvor meget systemisk træthed der er tilbage i budgettet, 0-10. */
  fatigueBudget: number;
  /** Assistance fra sidste uge. Holdes stabil i mindst tre uger. */
  previous: string[];
  weeksOnPrevious: number;
}

export interface AssistanceChoice {
  exerciseId: string;
  name: string;
  weakPoint: WeakPointId;
  /** Hele sporet fra behov til valg. */
  rationale: string;
  fatigueCost: number;
  /** Sandt når valget er beholdt fra sidste uge frem for skiftet. */
  kept: boolean;
}

/** Assistance skal ligge fast i mindst så mange uger, før den må skiftes. */
export const MIN_ASSISTANCE_WEEKS = 3;

/**
 * Er øvelsen overhovedet lovlig som assistance her?
 *
 * `taken` holdes uden for konteksten, så den kan opdateres undervejs uden at
 * kopiere hele objektet for hvert kandidatopslag.
 */
function eligible(exerciseId: string, ctx: AssistanceContext, taken: Set<string>): boolean {
  const ex = BY_ID[exerciseId];
  if (!ex) return false;
  if (taken.has(exerciseId)) return false;
  if (ctx.profile.excludedExerciseIds.includes(exerciseId)) return false;
  if (!ex.eq.every((e) => e === 'bodyweight' || ctx.availableEquipment.includes(e))) return false;
  if (ex.avoid.some((a) => ctx.profile.care.includes(a))) return false;
  if (checkPain(exerciseId, ctx.pain).blocked) return false;
  if (!canProgram(ctx.profile, exerciseId).allowed) return false;
  const o = ontologyFor(exerciseId);
  if (o && ctx.saturatedGroups.includes(o.group)) return false;
  return true;
}

const systemicCost = (exerciseId: string): number => {
  const o = ontologyFor(exerciseId);
  if (!o) return 2;
  return o.fatigue.systemic + o.fatigue.axial * 0.5 + o.fatigue.local * 0.5;
};

/**
 * Vælger assistance til ét pas.
 *
 * Rækkefølgen følger specifikationen: dæk weak point først, vælg den laveste
 * nødvendige fatigue cost, match udstyr og smerte, undgå dubletter — og behold
 * sidste uges valg, medmindre der er en grund til at skifte.
 */
export function chooseAssistance(
  weakPoints: WeakPoint[],
  slots: number,
  ctx: AssistanceContext,
): AssistanceChoice[] {
  const out: AssistanceChoice[] = [];
  const taken = new Set<string>(ctx.usedExerciseIds);
  let budget = ctx.fatigueBudget;

  const push = (exerciseId: string, wp: WeakPointId, rationale: string, kept: boolean): void => {
    const cost = systemicCost(exerciseId);
    out.push({
      exerciseId,
      name: BY_ID[exerciseId]?.name ?? exerciseId,
      weakPoint: wp,
      rationale,
      fatigueCost: Math.round(cost * 10) / 10,
      kept,
    });
    taken.add(exerciseId);
    budget -= cost;
  };

  // 1. Behold sidste uges assistance, hvis den stadig er lovlig og ikke er udtjent.
  if (ctx.weeksOnPrevious < MIN_ASSISTANCE_WEEKS) {
    ctx.previous.forEach((id) => {
      if (out.length >= slots) return;
      if (!eligible(id, ctx, taken)) return;
      push(
        id, 'none',
        `Beholdt fra sidste uge. Assistance skal ligge fast i mindst ${MIN_ASSISTANCE_WEEKS} uger, `
        + 'før den siger noget om, hvorvidt den virker.',
        true,
      );
    });
  }

  // 2. Dæk de dokumenterede weak points, stærkeste evidens først.
  const sorted = [...weakPoints].sort((a, b) => b.confidence - a.confidence);
  for (const wp of sorted) {
    if (out.length >= slots) break;
    const candidates = MAPPING[wp.id].candidates
      .filter((id) => eligible(id, ctx, taken))
      // Ved lav confidence vælges den bredeste, mest lavrisiko-variant.
      .sort((a, b) => (wp.confidence < 0.5 ? systemicCost(a) - systemicCost(b) : 0));

    const affordable = candidates.find((id) => systemicCost(id) <= budget) ?? candidates[0];
    if (!affordable) continue;

    push(
      affordable, wp.id,
      `Valgt til ${wp.label.toLowerCase()}`
      + (wp.lift ? ` med overførsel til ${LIFT_NAMES[wp.lift].toLowerCase()}` : '')
      + `. ${wp.confidence < 0.5
        ? 'Vurderingen er usikker, så der er valgt en bred lavrisiko-variant, og den revurderes efter blokken.'
        : 'Vurderingen bygger på dine egne registreringer.'}`,
      false,
    );
  }

  // 3. Fyld resten med bevægelsesfunktioner, ugen mangler.
  const gaps = ['trunk', 'grip'] as WeakPointId[];
  for (const gap of gaps) {
    if (out.length >= slots) break;
    const pick = MAPPING[gap].candidates.find((id) => eligible(id, ctx, taken));
    if (!pick) continue;
    push(
      pick, gap,
      `Dækker ${MAPPING[gap].label.toLowerCase()}, som ugen ellers ikke rammer.`,
      false,
    );
  }

  return out.slice(0, slots);
}

/**
 * Foreslår assistance ud fra hovedløftet, når der ikke er registrerede weak points.
 *
 * Der gættes ikke på en svaghed. I stedet vælges den bredeste variant med
 * dokumenteret overførsel — og det siges eksplicit, at valget er generelt.
 */
export function defaultAssistanceFor(lift: LiftId, ctx: AssistanceContext, slots = 2): AssistanceChoice[] {
  const taken = new Set(ctx.usedExerciseIds);
  const candidates = transferTo(lift)
    .map((o) => o.exerciseId)
    .filter((id) => eligible(id, ctx, taken))
    .sort((a, b) => systemicCost(a) - systemicCost(b));

  return candidates.slice(0, slots).map((exerciseId) => ({
    exerciseId,
    name: BY_ID[exerciseId]?.name ?? exerciseId,
    weakPoint: 'none' as WeakPointId,
    rationale:
      `Bredt valg med dokumenteret overførsel til ${LIFT_NAMES[lift].toLowerCase()}. `
      + 'Du har ikke registreret et weak point, så der gættes ikke på en svaghed.',
    fatigueCost: Math.round(systemicCost(exerciseId) * 10) / 10,
    kept: false,
  }));
}
