/**
 * Time estimator.
 *
 * Paslængden beregnes ud fra opvarmning, sæt, reps, pauser, opsætning og skift —
 * ikke ud fra reps alene. Passer passet ikke i brugerens tid, fjernes den lavest
 * prioriterede assistance. Der skæres aldrig i pauserne til tunge hovedløft uden
 * samtidig at ændre stimulus, fordi det er en anden workout.
 */

import { ontologyFor } from './ontology.js';

/** Prioritet styrer, hvad der ryger først, når tiden ikke rækker. */
export type ItemPriority = 'warmup' | 'anchor' | 'supplemental' | 'assistance' | 'conditioning';

/** Lav værdi = trimmes først. */
const TRIM_ORDER: ItemPriority[] = ['assistance', 'conditioning', 'supplemental', 'warmup', 'anchor'];

export interface TimedItem {
  id: string;
  label: string;
  exerciseId?: string;
  priority: ItemPriority;
  sets: number;
  reps: number;
  /** Sekunder pr. rep ved arbejdstempo. */
  secondsPerRep: number;
  /** Planlagt pause mellem sæt i sekunder. */
  restSeconds: number;
  /** Sekunder til opsætning. Udeladt slås op i ontologien. */
  setupSeconds?: number;
}

export interface TimeEstimate {
  totalSeconds: number;
  totalMinutes: number;
  breakdown: { id: string; label: string; seconds: number; priority: ItemPriority }[];
  /** Sekunder brugt på pauser alene — det tal, brugeren oftest undervurderer. */
  restSeconds: number;
  setupSeconds: number;
  transitionSeconds: number;
}

/** Skift mellem to øvelser: hente redskab, stille om, læse næste del. */
export const TRANSITION_SECONDS = 45;
/** Kort brief før hoveddelen. */
export const BRIEF_SECONDS = 60;

export function itemSeconds(item: TimedItem): number {
  const setup = item.setupSeconds ?? ontologyFor(item.exerciseId ?? '')?.setupSeconds ?? 20;
  const work = item.sets * item.reps * item.secondsPerRep;
  // Der holdes ikke pause efter sidste sæt — der skiftes videre.
  const rest = Math.max(0, item.sets - 1) * item.restSeconds;
  return Math.round(setup + work + rest);
}

export function estimateSession(items: TimedItem[], opts: { brief?: boolean } = {}): TimeEstimate {
  const breakdown = items.map((i) => ({
    id: i.id, label: i.label, seconds: itemSeconds(i), priority: i.priority,
  }));
  const transitions = Math.max(0, items.length - 1) * TRANSITION_SECONDS
    + (opts.brief === false ? 0 : BRIEF_SECONDS);
  const restSeconds = items.reduce((s, i) => s + Math.max(0, i.sets - 1) * i.restSeconds, 0);
  const setupSeconds = items.reduce(
    (s, i) => s + (i.setupSeconds ?? ontologyFor(i.exerciseId ?? '')?.setupSeconds ?? 20),
    0,
  );
  const totalSeconds = breakdown.reduce((s, b) => s + b.seconds, 0) + transitions;

  return {
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    breakdown,
    restSeconds,
    setupSeconds,
    transitionSeconds: transitions,
  };
}

export interface TrimResult {
  items: TimedItem[];
  removed: { id: string; label: string; reason: string }[];
  estimate: TimeEstimate;
  /** Sandt når passet stadig er for langt, efter alt trimbart er fjernet. */
  stillTooLong: boolean;
}

/**
 * Trimmer et pas ned i den rækkefølge, specifikationen foreskriver.
 *
 * Anchors røres aldrig: et styrkeprogram uden squat er ikke et kortere
 * styrkeprogram, det er et andet program. Kan passet ikke komme ned i tid uden at
 * fjerne en anchor, siges det højt i stedet.
 */
export function trimToFit(items: TimedItem[], availableMinutes: number): TrimResult {
  const budget = availableMinutes * 60;
  let current = items.slice();
  const removed: TrimResult['removed'] = [];

  for (const priority of TRIM_ORDER) {
    if (priority === 'anchor' || priority === 'warmup') break;
    while (estimateSession(current).totalSeconds > budget) {
      // Fjern den dyreste af den lavest prioriterede type, så færrest øvelser ryger.
      const candidates = current
        .map((item, index) => ({ item, index, seconds: itemSeconds(item) }))
        .filter((c) => c.item.priority === priority)
        .sort((a, b) => b.seconds - a.seconds);
      const victim = candidates[0];
      if (!victim) break;
      current = current.filter((_, i) => i !== victim.index);
      removed.push({
        id: victim.item.id,
        label: victim.item.label,
        reason:
          `Fjernet for at holde passet inden for ${availableMinutes} minutter. `
          + `${priority === 'assistance' ? 'Assistance' : 'Kondition'} trimmes før hovedarbejdet.`,
      });
    }
    if (estimateSession(current).totalSeconds <= budget) break;
  }

  const estimate = estimateSession(current);
  return {
    items: current,
    removed,
    estimate,
    stillTooLong: estimate.totalSeconds > budget,
  };
}

/* ---------- Tidsbudgetter for Dagens WOD ---------- */

export interface WodTimeBudget {
  warmupMinutes: [number, number];
  mainMinutes: [number, number];
  briefMinutes: number;
  /** Motorreglen, der gælder ved denne længde. */
  rule: string;
}

/**
 * Startguardrails fra specifikationen. Tiderne er rammer — motoren skal stadig
 * beregne opsætning, brief, skift og eventuelle ramp sets oveni.
 */
export function wodBudget(totalMinutes: number): WodTimeBudget {
  if (totalMinutes <= 15) {
    return {
      warmupMinutes: [4, 6], mainMinutes: [5, 8], briefMinutes: 1,
      rule: 'Kun lav kompleksitet og minimal opsætning.',
    };
  }
  if (totalMinutes <= 30) {
    return {
      warmupMinutes: [6, 10], mainMinutes: [10, 20], briefMinutes: 2,
      rule: '2-4 bevægelser og ét tydeligt stimulus.',
    };
  }
  if (totalMinutes <= 60) {
    return {
      warmupMinutes: [10, 15], mainMinutes: [18, 35], briefMinutes: 3,
      rule: 'Der er plads til en skill- eller styrkeprimer før hoveddelen.',
    };
  }
  return {
    warmupMinutes: [12, 20], mainMinutes: [20, 40], briefMinutes: 4,
    rule: 'Resten går til skill, styrke og assistance. Generér ikke ét langt tilfældigt metcon.',
  };
}

/** Pauselængde efter formål. Tunge compounds skal have rigtige pauser. */
export function restForPurpose(purpose: 'technique' | 'hypertrophy' | 'strength' | 'intensification' | 'power' | 'endurance'): [number, number] {
  switch (purpose) {
    case 'technique': return [120, 240];
    case 'hypertrophy': return [60, 180];
    case 'strength': return [180, 300];
    case 'intensification': return [180, 360];
    case 'power': return [120, 300];
    case 'endurance': return [30, 120];
  }
}
