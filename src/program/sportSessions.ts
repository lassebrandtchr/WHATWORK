/**
 * Sportsspecifikt sessionsindhold.
 *
 * De tre discipliner deler motor, men ikke krav. HYROX skal have løb og stationer
 * med rigtige vægte og underlag; CrossFit skal have gymnastik og vægtløftning som
 * eget arbejde frem for gemt i en metcon; strongman skal træne de events, der rent
 * faktisk står på konkurrencens program.
 */

import { BY_ID } from '../engine/data/exercises.js';
import { CONSTRAINT_CODES, issue } from '../domain/constraints.js';
import { hyroxRules } from '../domain/ruleSets.js';
import { canProgram } from '../domain/competence.js';
import { checkPain } from '../domain/safety.js';
import type { PhaseTemplate } from '../domain/sport.js';
import type {
  AthleteProfile, ConstraintIssue, Goal, PainEntry, StrongmanEvent,
} from '../domain/types.js';
import { restForPurpose } from '../domain/timeEstimator.js';
import type { ConditioningPrescription, SetPrescription } from './types.js';

export interface SportSessionContext {
  goal: Goal;
  phase: PhaseTemplate;
  profile: AthleteProfile;
  pain: PainEntry[];
  availableEquipment: string[];
  /** Ugens nummer i forløbet, 1-baseret. */
  week: number;
  totalWeeks: number;
  /** Brugerens nuværende ugentlige løbevolumen i kilometer. */
  weeklyRunKm: number;
  minutes: number;
  reduced: boolean;
  nextId: () => string;
}

export interface SportSessionPart {
  sets: SetPrescription[];
  conditioning: ConditioningPrescription[];
  issues: ConstraintIssue[];
  /** Én sætning om, hvad dagen går ud på. */
  stimulus: string | null;
}

const empty = (): SportSessionPart => ({ sets: [], conditioning: [], issues: [], stimulus: null });

const secondsPerRep = (id: string): number => BY_ID[id]?.sec ?? 3;

/* ---------- HYROX ---------- */

/**
 * Hvor langt der løbes i denne uge.
 *
 * Reglen fra specifikationen: en debutant med 0 km om ugen må ikke få en fuld
 * simulation i uge 1. Volumen bygges fra brugerens faktiske udgangspunkt med højst
 * 10 % om ugen — og et nulpunkt starter ved to korte ture, ikke ved otte kilometer.
 */
export function weeklyRunTarget(currentKm: number, week: number): number {
  const start = currentKm > 0 ? currentKm : 2;
  const grown = start * (1.1 ** (week - 1));
  // Loft på det dobbelte af udgangspunktet inden for et forløb. Mere end det er
  // ikke opbygning, det er en anden atlet.
  return Math.round(Math.min(grown, start * 2.2) * 10) / 10;
}

/** Sandt når atleten har volumen nok til at give mening at simulere hele racet. */
export function mayRunFullSimulation(currentKm: number, week: number): boolean {
  // Otte kilometer løb plus otte stationer kræver en base, der kan bære det.
  return currentKm >= 20 && week >= 6;
}

function hyroxSession(ctx: SportSessionContext, kind: 'easyRun' | 'qualityRun' | 'station'): SportSessionPart {
  const part = empty();
  const rules = hyroxRules(ctx.goal.ruleSet?.version);
  const division = ctx.goal.division ?? 'open_men';
  const targetKm = weeklyRunTarget(ctx.weeklyRunKm, ctx.week);

  if (kind === 'easyRun') {
    const minutes = Math.max(20, Math.round(targetKm * 6));
    part.conditioning.push({
      id: ctx.nextId(),
      exerciseId: ctx.availableEquipment.includes('run') ? 'run_dist' : 'air_run',
      name: 'Roligt løb',
      zone: 'low',
      modality: 'Løb',
      minutes: Math.min(minutes, Math.round(ctx.minutes * 0.8)),
      intervals: null,
      targetText: 'Et tempo, hvor du kan tale i hele sætninger hele vejen.',
      rationale:
        `Ugens rolige løb. Du er startet på ${ctx.weeklyRunKm} km om ugen, og volumen `
        + `bygges op mod ${targetKm} km — omkring 10 % mere ad gangen, fordi det er `
        + 'benene og senerne, der sætter grænsen, ikke pusten.',
    });
    part.stimulus = 'Roligt løb — grundformen, resten hviler på.';
    return part;
  }

  if (kind === 'qualityRun') {
    // Race pace-arbejde introduceres først, når der er en base at lægge det oven på.
    const useRacePace = ctx.phase.id === 'specific' || ctx.phase.id === 'taper';
    const rounds = ctx.reduced ? 3 : Math.min(6, 3 + Math.floor(ctx.week / 3));
    part.conditioning.push({
      id: ctx.nextId(),
      exerciseId: ctx.availableEquipment.includes('run') ? 'run_dist' : 'air_run',
      name: useRacePace ? '1 km i racefart' : 'Tærskelløb',
      zone: useRacePace ? 'high' : 'moderate',
      modality: 'Løb',
      minutes: Math.round(ctx.minutes * 0.6),
      intervals: { work: 300, rest: 120, rounds },
      targetText: useRacePace
        ? 'Den fart, du vil holde på løbeturene i racet. Ens fra første til sidste tur.'
        : 'Anstrengende, men kontrolleret. Du skal kunne gentage det på sidste interval.',
      rationale: useRacePace
        ? `${rounds} gange 1 km i den fart, racet kræver. Formålet er at kunne gentage `
          + 'farten, ikke at sætte rekord på den første.'
        : 'Tærskelarbejde flytter det tempo, du kan holde længe. Det er den fart, '
          + 'stationerne skal afvikles imellem.',
    });
    part.stimulus = useRacePace ? 'Løb i racefart.' : 'Tærskelløb.';
    return part;
  }

  /* Stationsarbejde. */
  if (!rules) {
    part.issues.push(issue(
      CONSTRAINT_CODES.INVALID_RULESET,
      'Stationerne kan ikke programmeres uden et gyldigt regelsæt.',
      { fix: 'Vælg en HYROX-sæson under målet.', scope: 'session' },
    ));
    return part;
  }

  // Stationerne roteres, så alle otte dækkes over et forløb frem for at køre de
  // samme to hver uge.
  const rotation = rules.stations.filter((s) => {
    const exercise = STATION_EXERCISE[s.id];
    if (!exercise) return false;
    const ex = BY_ID[exercise];
    if (!ex) return false;
    // Et fravalg gælder også for en konkurrencestation. Har brugeren sagt nej til en
    // bevægelse, skal den ikke snige sig ind, fordi den står i et regelsæt.
    if (ctx.profile.excludedExerciseIds.includes(exercise)) return false;
    if (checkPain(exercise, ctx.pain).blocked) return false;
    return ex.eq.every((e) => e === 'bodyweight' || ctx.availableEquipment.includes(e));
  });

  if (!rotation.length) {
    part.issues.push(issue(
      CONSTRAINT_CODES.EQUIPMENT_INSUFFICIENT,
      'Ingen af HYROX-stationerne kan sættes op med det udstyr, du har markeret.',
      { fix: 'Tilføj slæde, sandbag, wall ball eller ergometre under Udstyr.', scope: 'session' },
    ));
    return part;
  }

  const picked = [
    rotation[(ctx.week - 1) % rotation.length],
    rotation[(ctx.week + 1) % rotation.length],
  ].filter((s, i, arr): s is NonNullable<typeof s> => Boolean(s) && arr.indexOf(s) === i);

  picked.forEach((station) => {
    const exerciseId = STATION_EXERCISE[station.id] as string;
    const amount = station.amount[division] ?? 0;
    const loadKg = station.loadKg?.[division] ?? null;
    // Stationerne køres på en andel af racedistancen, indtil der er base til hele.
    const share = ctx.phase.id === 'base' ? 0.5 : ctx.phase.id === 'build' ? 0.75 : 1;
    const dose = Math.max(1, Math.round(amount * share));

    part.sets.push({
      id: ctx.nextId(),
      type: 'interval',
      exerciseId,
      name: station.name,
      sets: ctx.reduced ? 2 : 3,
      reps: dose,
      targetRpe: 7,
      targetRir: 3,
      percentBasis: 'none',
      percent: null,
      load: null,
      restSeconds: [90, 180],
      stopRules: [
        'Stop ved smerte på 4 eller derover.',
        'Stop, hvis teknikken skrider — standarderne tæller til racet.',
      ],
      secondsPerRep: secondsPerRep(exerciseId),
      rationale:
        `${station.name} på ${dose} ${station.unit === 'reps' ? 'gentagelser' : 'meter'}`
        + `${loadKg ? ` med ${String(loadKg).replace('.', ',')} kg` : ''}`
        + ` — ${Math.round(share * 100)} % af racedistancen i denne blok. `
        + (station.surfaceSensitive
          ? 'Underlaget ændrer kravet markant, så noter hvilket gulv du trænede på.'
          : 'Vægten kommer fra det gemte regelsæt for din division.'),
    });
  });

  // Compromised running: løb på trætte ben. Introduceres først efter basen.
  if (ctx.phase.id !== 'base' && !ctx.reduced) {
    part.conditioning.push({
      id: ctx.nextId(),
      exerciseId: ctx.availableEquipment.includes('run') ? 'run_dist' : 'air_run',
      name: 'Løb efter station',
      zone: 'moderate',
      modality: 'Løb',
      minutes: Math.round(ctx.minutes * 0.25),
      intervals: { work: 240, rest: 60, rounds: picked.length },
      targetText: 'Løb direkte videre fra stationen. Farten falder — det er meningen.',
      rationale:
        'Løb på trætte ben er det, der afgør sluttiden i et race. Din tid på friske '
        + 'ben siger ikke ret meget om, hvad du kan efter en slæde.',
    });
  }

  part.stimulus = ctx.phase.id === 'base'
    ? `Stationsteknik: ${picked.map((s) => s.name).join(' og ')}.`
    : `${picked.map((s) => s.name).join(' og ')} med løb imellem.`;

  return part;
}

/** Hvilken øvelse i kataloget der svarer til hver HYROX-station. */
const STATION_EXERCISE: Record<string, string | undefined> = {
  skierg: 'ski',
  sled_push: 'sled_push',
  sled_pull: 'sled_pull',
  burpee_broad_jump: 'burpee_broad_jump',
  row: 'row',
  farmers_carry: 'farmer_carry',
  sandbag_lunges: 'sandbag_carry',
  wall_balls: 'wall_ball',
};

/* ---------- CrossFit ---------- */

/** Gymnastikarbejde med streng teknik før fart. */
const GYMNASTICS_LADDER = ['ring_row', 'band_pull_up', 'pull_up', 'chest_to_bar'];
const PRESS_LADDER = ['push_up', 'db_shoulder_press', 'dip', 'hspu'];
const OLY_LADDER = ['hang_power_clean', 'power_clean', 'push_jerk', 'power_snatch'];

/**
 * Vælger den sværeste bevægelse i en stige, atleten har dokumenteret teknik til.
 *
 * Rækkefølgen mechanics → consistency → intensity betyder, at kompleksiteten kun
 * stiger, når teknikken er registreret — ikke når niveauet er sat højt.
 */
function hardestAllowed(
  ladder: string[],
  ctx: SportSessionContext,
  underFatigue: boolean,
): string | null {
  const usable = ladder.filter((id) => {
    const ex = BY_ID[id];
    if (!ex) return false;
    if (ctx.profile.excludedExerciseIds.includes(id)) return false;
    if (checkPain(id, ctx.pain).blocked) return false;
    if (!ex.eq.every((e) => e === 'bodyweight' || ctx.availableEquipment.includes(e))) return false;
    return canProgram(ctx.profile, id, { underFatigue }).allowed;
  });
  return usable[usable.length - 1] ?? null;
}

function crossfitSession(ctx: SportSessionContext, kind: 'gymnastics' | 'weightlifting'): SportSessionPart {
  const part = empty();

  if (kind === 'gymnastics') {
    const pull = hardestAllowed(GYMNASTICS_LADDER, ctx, false);
    const press = hardestAllowed(PRESS_LADDER, ctx, false);
    [pull, press].filter((id): id is string => Boolean(id)).forEach((id) => {
      const ex = BY_ID[id];
      if (!ex) return;
      part.sets.push({
        id: ctx.nextId(),
        type: 'supplemental',
        exerciseId: id,
        name: ex.name,
        sets: ctx.reduced ? 3 : 5,
        reps: Math.max(3, Math.min(8, ex.rep?.[0] ?? 5)),
        targetRpe: 8,
        targetRir: 2,
        percentBasis: 'none',
        percent: null,
        load: null,
        restSeconds: restForPurpose('technique'),
        stopRules: [
          'Stop sættet, når teknikken skrider — ikke når du ikke kan mere.',
          'Stop ved smerte på 4 eller derover.',
        ],
        secondsPerRep: secondsPerRep(id),
        rationale:
          `Strengt gymnastikarbejde med ${ex.name.toLowerCase()}. Sættene køres friske og `
          + 'med fuld kontrol — det er teknikken, der skal bygges, ikke pulsen.',
      });
    });
    part.stimulus = 'Gymnastik med streng teknik.';
    if (!pull && !press) {
      part.issues.push(issue(
        CONSTRAINT_CODES.COMPETENCE_CONFLICT,
        'Der er ingen gymnastikbevægelse, du har markeret som sikker.',
        {
          fix: 'Markér dit tekniske niveau under "Mine tal", så kan der programmeres gymnastik.',
          scope: 'session',
        },
      ));
    }
    return part;
  }

  const lift = hardestAllowed(OLY_LADDER, ctx, false);
  if (!lift) {
    part.issues.push(issue(
      CONSTRAINT_CODES.COMPETENCE_CONFLICT,
      'Vægtløftning kræver et registreret teknisk niveau.',
      {
        fix: 'Markér dit niveau i clean, jerk eller snatch under "Mine tal".',
        scope: 'session',
      },
    ));
    return part;
  }

  const ex = BY_ID[lift];
  if (!ex) return part;
  part.sets.push({
    id: ctx.nextId(),
    type: 'supplemental',
    exerciseId: lift,
    name: ex.name,
    sets: ctx.reduced ? 4 : 6,
    reps: 2,
    targetRpe: 7,
    targetRir: 3,
    percentBasis: 'none',
    percent: null,
    load: null,
    restSeconds: restForPurpose('power'),
    stopRules: [
      'Stop, når stangens hastighed falder synligt.',
      'Stop ved teknikbrud — en dårlig rep tæller ikke.',
    ],
    secondsPerRep: secondsPerRep(lift),
    rationale:
      `Tekniske dobbeltløft i ${ex.name.toLowerCase()}, kørt friske og eksplosivt. `
      + 'Stopkriteriet er hastighed, ikke udmattelse — derfor ligger arbejdet først i passet.',
  });
  part.stimulus = `Vægtløftningsteknik: ${ex.name}.`;
  return part;
}

/* ---------- Strongman ---------- */

/** Kategoriernes danske navne og hvad de kræver. */
const EVENT_CATEGORY_TEXT: Record<StrongmanEvent['category'], string> = {
  maxStrength: 'ét maksimalt løft',
  repsForTime: 'flest mulige gentagelser på tid',
  movingLoad: 'at flytte vægten over en distance',
  loading: 'at løfte redskabet op på en platform',
  pullPush: 'at trække eller skubbe vægten',
  throw: 'et kast over en bom',
  medley: 'flere redskaber i træk med skift imellem',
};

/**
 * Bygger eventtræning ud fra konkurrencens egen liste.
 *
 * Uden listen bygges der ikke noget her. Det er hele pointen: strongman har ikke
 * ét fast format, så et "generisk strongman-event" ville være opdigtet.
 */
function strongmanSession(ctx: SportSessionContext): SportSessionPart {
  const part = empty();
  const events = ctx.goal.events ?? [];
  if (!events.length) return part;

  // Ét event ad gangen, roteret. Stones, yoke og maksimalt dødløft koster for meget
  // til at ligge tungt i samme uge.
  const event = events[(ctx.week - 1) % events.length];
  if (!event) return part;

  // Nærmeste øvelse i kataloget. Findes den ikke, beskrives eventet stadig — men
  // uden at der opfindes en belastning.
  const proxy = EVENT_PROXY[event.category] ?? 'farmer_carry';
  const ex = BY_ID[proxy];
  if (!ex) return part;

  const share = ctx.phase.id === 'realisation' || ctx.phase.id === 'taper'
    ? 1
    : ctx.phase.id === 'specific' ? 0.9 : 0.75;
  const loadText = event.loadKg
    ? `${String(Math.round(event.loadKg * share / 2.5) * 2.5).replace('.', ',')} kg `
      + `(${Math.round(share * 100)} % af konkurrencens ${String(event.loadKg).replace('.', ',')} kg)`
    : 'den vægt, du kan holde teknikken på';

  part.sets.push({
    id: ctx.nextId(),
    type: 'supplemental',
    exerciseId: proxy,
    name: event.name,
    sets: ctx.reduced ? 2 : 4,
    reps: event.reps ?? (event.distanceM ? event.distanceM : 3),
    targetRpe: ctx.phase.id === 'realisation' ? 9 : 8,
    targetRir: ctx.phase.id === 'realisation' ? 1 : 2,
    percentBasis: 'none',
    percent: null,
    load: null,
    restSeconds: restForPurpose('intensification'),
    stopRules: [
      'Stop ved smerte på 4 eller derover.',
      'Stop, når grebet svigter — et tabt redskab er ikke et sæt.',
    ],
    secondsPerRep: secondsPerRep(proxy),
    rationale:
      `${event.name} er ${EVENT_CATEGORY_TEXT[event.category]}. Træn med ${loadText} på `
      + `${event.implement}. ${event.timeCapSec ? `Tidsgrænsen til konkurrencen er ${event.timeCapSec} sekunder. ` : ''}`
      + 'Er dit redskab ikke det samme som konkurrencens, så noter forskellen — den ændrer kravet.',
  });

  part.stimulus = `Eventtræning: ${event.name}.`;
  return part;
}

const EVENT_PROXY: Record<StrongmanEvent['category'], string> = {
  maxStrength: 'deadlift',
  repsForTime: 'strict_press',
  movingLoad: 'farmer_carry',
  loading: 'sandbag_shoulder',
  pullPush: 'sled_pull',
  throw: 'kb_swing',
  medley: 'sandbag_carry',
};

/* ---------- Indgang ---------- */

/**
 * Bygger det sportsspecifikke indhold for én anchor.
 *
 * Returnerer en tom del, når sporten ikke har noget særligt for netop den anchor —
 * så falder planlæggeren tilbage til sin generelle mønsterbaserede opbygning.
 */
export function sportContent(anchorId: string, ctx: SportSessionContext): SportSessionPart {
  switch (anchorId) {
    case 'hx-easy-run': return hyroxSession(ctx, 'easyRun');
    case 'hx-quality-run': return hyroxSession(ctx, 'qualityRun');
    case 'hx-station': return hyroxSession(ctx, 'station');
    case 'cf-gymnastics': return crossfitSession(ctx, 'gymnastics');
    case 'cf-weightlifting': return crossfitSession(ctx, 'weightlifting');
    case 'sm-event': return strongmanSession(ctx);
    default: return empty();
  }
}
