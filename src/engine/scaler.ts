/**
 * "Gør lettere" og "Gør hårdere".
 *
 * Knapperne skalerer den workout, brugeren har foran sig. De genererer ikke en ny.
 * Format, bevægelsesfamilie, tidsdomæne og primært stimulus bevares, og ændringen
 * vises som en konkret diff — "12 → 9 reps", ikke "her er noget andet".
 *
 * Rækkefølgen følger specifikationen: kompleksitet, derefter reps/distance, derefter
 * belastning, derefter intervalantal og til sidst work:rest.
 */

import { BY_ID } from './data/exercises.js';
import { fmtKg, stepLoad } from './loads.js';
import { unitLabel } from './movements.js';
import { isEmomFamily } from './data/formats.js';
import type { Block, Movement, PersonTarget, Workout } from './types.js';

export type ScaleDirection = 'easier' | 'harder';

/** Én konkret ændring, som kan vises for brugeren. */
export interface ScaleChange {
  /** Hvad der blev ændret. */
  kind: 'reps' | 'load' | 'distance' | 'calories' | 'rounds' | 'duration' | 'movement' | 'workRest';
  /** Hvilken øvelse eller blok ændringen gælder. */
  subject: string;
  from: string;
  to: string;
  /** Færdig dansk sætning: "Wall Balls: 21 → 16 reps". */
  text: string;
}

export interface ScaleResult {
  workout: Workout;
  changes: ScaleChange[];
  /** Sandt når intet kunne skaleres yderligere. */
  atLimit: boolean;
  /** Dansk forklaring af, hvad der blev bevaret. */
  preserved: string;
}

/** Hvor meget reps flyttes pr. trin. */
const REP_STEP = 0.78;
const REP_STEP_HARDER = 1.18;

const round5 = (v: number): number => Math.max(5, Math.round(v / 5) * 5);

function scaleAmount(unit: Movement['unit'], amount: number, factor: number): number {
  if (unit === 'm') return round5(amount * factor);
  if (unit === 'sec') return Math.max(10, Math.round((amount * factor) / 5) * 5);
  return Math.max(1, Math.round(amount * factor));
}

/**
 * Skalerer én deltagers mål på én øvelse.
 *
 * Belastningen flyttes ét udstyrstrin ad gangen frem for med en procentsats, så
 * resultatet altid svarer til en vægt, der faktisk findes i salen.
 */
function scaleTarget(
  target: PersonTarget,
  exerciseId: string,
  direction: ScaleDirection,
  ctx: { plates: number[]; bars: number[]; sandbags: number[] },
  changes: ScaleChange[],
  name: string,
  changeLoad: boolean,
): PersonTarget {
  const factor = direction === 'easier' ? REP_STEP : REP_STEP_HARDER;
  const nextAmount = scaleAmount(target.unit, target.amount, factor);

  let load = target.load;
  if (changeLoad && target.load) {
    const ex = BY_ID[exerciseId];
    if (ex) {
      const stepped = stepLoad(ex, target.load.kind, target.load.eachKg, direction === 'easier' ? -1 : 1, ctx);
      if (Math.abs(stepped.eachKg - target.load.eachKg) > 0.01) {
        changes.push({
          kind: 'load',
          subject: name,
          from: fmtKg(target.load.eachKg),
          to: fmtKg(stepped.eachKg),
          text: `${name}: ${fmtKg(target.load.eachKg)} → ${fmtKg(stepped.eachKg)}`,
        });
        load = stepped;
      }
    }
  }

  if (nextAmount !== target.amount) {
    const unitWord = target.unit === 'm' ? 'meter' : target.unit === 'cal' ? 'kalorier' : target.unit === 'sec' ? 'sekunder' : 'reps';
    changes.push({
      kind: target.unit === 'm' ? 'distance' : target.unit === 'cal' ? 'calories' : 'reps',
      subject: name,
      from: String(target.amount),
      to: String(nextAmount),
      text: `${name}: ${target.amount} → ${nextAmount} ${unitWord}`,
    });
  }

  return {
    ...target,
    amount: nextAmount,
    amountText: unitLabel(target.unit, nextAmount),
    load,
  };
}

function scaleMovement(
  movement: Movement,
  direction: ScaleDirection,
  ctx: { plates: number[]; bars: number[]; sandbags: number[] },
  changes: ScaleChange[],
  changeLoad: boolean,
): Movement {
  const before = changes.length;
  const targets = movement.targets.map((t) => scaleTarget(
    t, movement.exerciseId, direction, ctx, changes, movement.name, changeLoad,
  ));
  // Flere deltagere med samme ændring skal ikke give fem identiske diff-linjer.
  const added = changes.splice(before, changes.length - before);
  const unique = added.filter(
    (c, i) => added.findIndex((o) => o.kind === c.kind && o.subject === c.subject && o.to === c.to) === i,
  );
  changes.push(...unique);

  const first = targets[0];
  const reps = first?.amount ?? movement.reps;
  const ex = BY_ID[movement.exerciseId];
  const perRep = ex?.sec ?? 3;

  return {
    ...movement,
    reps,
    display: movement.individualTargets
      ? movement.display
      : `${unitLabel(movement.unit, reps)} ${movement.name}`,
    workSec: Math.round(reps * perRep),
    targets,
  };
}

/**
 * Skalerer hele workouten.
 *
 * Kun hoveddelen og styrkedelen røres — opvarmningen skal fortsat forberede de
 * samme bevægelser, og den bliver ikke lettere af, at hoveddelen gør.
 */
export function scaleWorkout(
  workout: Workout,
  direction: ScaleDirection,
): ScaleResult {
  const changes: ScaleChange[] = [];
  const ctx = {
    plates: workout.request.plates,
    bars: workout.request.bars,
    sandbags: workout.request.sandbags,
  };

  const blocks: Block[] = workout.blocks.map((block) => {
    if (block.kind === 'warmup') return block;

    // Belastning flyttes kun på styrkedele og på tunge hoveddele. På et højreps-metcon
    // er reps den rigtige knap, ikke kiloene.
    const changeLoad = block.kind === 'strength'
      || block.movements.some((m) => (BY_ID[m.exerciseId]?.tech ?? 1) >= 3);

    const movements = block.movements.map(
      (m) => scaleMovement(m, direction, ctx, changes, changeLoad),
    );

    let next: Block = { ...block, movements };

    // Intervalantal justeres kun, hvis reps og load ikke rakte.
    if (changes.length === 0 && block.rounds && block.rounds > 2) {
      const rounds = direction === 'easier' ? block.rounds - 1 : block.rounds + 1;
      changes.push({
        kind: 'rounds',
        subject: block.title,
        from: String(block.rounds),
        to: String(rounds),
        text: `${block.title}: ${block.rounds} → ${rounds} runder`,
      });
      next = { ...next, rounds };
    }

    return next;
  });

  const atLimit = changes.length === 0;

  return {
    workout: {
      ...workout,
      blocks,
      // Identiteten er uændret: samme id-stamme, samme format, samme signatur.
      explanation: [
        ...workout.explanation,
        atLimit
          ? 'Workouten kunne ikke skaleres yderligere uden at blive en anden workout.'
          : `${direction === 'easier' ? 'Gjort lettere' : 'Gjort hårdere'}: ${changes.map((c) => c.text).join(' · ')}.`,
      ],
    },
    changes,
    atLimit,
    preserved:
      `Samme ${workout.formatName}, samme bevægelser og samme tidsramme på `
      + `${workout.estimatedMinutes} minutter. Kun ${describeChanged(changes)} er ændret.`,
  };
}

function describeChanged(changes: ScaleChange[]): string {
  const kinds = new Set(changes.map((c) => c.kind));
  const words: string[] = [];
  if (kinds.has('reps')) words.push('reps');
  if (kinds.has('distance')) words.push('distance');
  if (kinds.has('calories')) words.push('kalorier');
  if (kinds.has('load')) words.push('belastning');
  if (kinds.has('rounds')) words.push('antal runder');
  if (!words.length) return 'ingenting';
  if (words.length === 1) return words[0] as string;
  // Dansk opremsning: komma mellem alle på nær de to sidste, som bindes med "og".
  return `${words.slice(0, -1).join(', ')} og ${words[words.length - 1]}`;
}

/**
 * Sandt når to workouts stadig er den samme workout.
 *
 * Bruges af testene og af lint: "Gør lettere" må ikke kunne slippe af sted med at
 * skifte format eller bevægelser ud.
 */
export function sameIdentity(a: Workout, b: Workout): boolean {
  if (a.format !== b.format) return false;
  const ids = (w: Workout): string => w.blocks
    .filter((x) => x.kind !== 'warmup')
    .flatMap((x) => x.movements.map((m) => m.exerciseId))
    .sort()
    .join(',');
  if (ids(a) !== ids(b)) return false;
  const domain = (w: Workout): number => w.blocks
    .filter((x) => x.kind !== 'warmup')
    .reduce((s, x) => s + x.minutes, 0);
  // Tidsdomænet må afvige med højst ét minut — ellers er det et andet stimulus.
  return Math.abs(domain(a) - domain(b)) <= 1;
}

/** Dansk beskrivelse af det reelle hvileforhold i et EMOM-lignende format. */
export function restDescription(block: Block): string {
  if (!block.format || !isEmomFamily(block.format)) return '';
  const every = block.everySec ?? 60;
  const work = block.movements.reduce((s, m) => s + m.workSec, 0) / Math.max(1, block.movements.length);
  const rest = Math.round(every - work);
  if (rest <= 5) {
    return 'Arbejdet fylder stort set hele intervallet. Der er ikke en reel pause — '
      + 'gå direkte videre, når klokken skifter.';
  }
  return `Pausen er resten af intervallet, cirka ${rest} sekunder, når arbejdet er klaret til tiden.`;
}
