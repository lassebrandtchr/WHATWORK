/**
 * Sportsmodeller: kravprofil og målspecifikke eksponeringer pr. disciplin.
 *
 * De fem sportsgrene deler motor, men ikke demand model. Filen her definerer, hvad
 * en uge *skal* indeholde for at være et program for netop den sport — det er de
 * anchors, program-lint holder planen op imod.
 */

import type { MovementPattern } from '../engine/types.js';
import { LIFT_NAMES, STRENGTH4_LIFTS, COMPETITION_LIFTS } from './types.js';
import type { Goal, LiftId, SportId } from './types.js';

export type AnchorKind = 'strength' | 'conditioning' | 'skill' | 'event' | 'run';

export interface WeeklyAnchor {
  id: string;
  label: string;
  kind: AnchorKind;
  /** Hovedløftet, eksponeringen skal dække. */
  liftId?: LiftId;
  /** Bevægelsesmønstre, der kan opfylde anchoret. */
  patterns?: MovementPattern[];
  /** Konkrete øvelses-id'er, der tæller. */
  exerciseIds?: string[];
  minPerWeek: number;
  /** Obligatorisk: mangler den, er programmet en hard error. */
  mandatory: boolean;
  rationale: string;
}

export type PhaseId =
  | 'assessment' | 'base' | 'build' | 'strength' | 'intensification'
  | 'specific' | 'realisation' | 'peak' | 'taper' | 'deload';

export interface PhaseTemplate {
  id: PhaseId;
  name: string;
  /** Andel af forløbet, fasen typisk fylder. Summen normaliseres. */
  share: number;
  /** Typiske hovedsæt i fasen. */
  repRange: [number, number];
  /** Procent af training max. */
  intensity: [number, number];
  targetRir: [number, number];
  /** Relativ volumen, 1,0 = normal. */
  volumeFactor: number;
  description: string;
}

export interface SportDemandModel {
  sport: SportId;
  name: string;
  /** Kort dansk beskrivelse af kravprofilen. */
  demands: string;
  phases: PhaseTemplate[];
  /** Anchors for en given uge. `daysPerWeek` styrer, hvor mange der er plads til. */
  anchors: (ctx: AnchorContext) => WeeklyAnchor[];
  /** Fordeling af conditioning på lav/moderat/høj intensitet. */
  conditioningSplit: { low: number; moderate: number; high: number };
  /** Sportsspecifikke spørgsmål, intake skal stille. Vises kun for denne sport. */
  intakeFields: IntakeField[];
}

export interface AnchorContext {
  daysPerWeek: number;
  goal: Goal;
  /** Sandt i uger, hvor der køres deload eller taper. */
  reduced: boolean;
}

export interface IntakeField {
  id: string;
  question: string;
  /** Hvorfor svaret ændrer outputtet. Vises kun, hvis brugeren spørger. */
  why: string;
  required: boolean;
  /** Hvad appen gør, hvis brugeren svarer "ved ikke". */
  fallback: string;
}

/* ---------- Faseskabeloner ---------- */

const STRENGTH_PHASES: PhaseTemplate[] = [
  {
    id: 'base', name: 'Base og teknik', share: 0.3, repRange: [4, 8], intensity: [0.6, 0.75],
    targetRir: [2, 4], volumeFactor: 1.1,
    description: 'Flere reps og flere variationer. Teknikken skal sidde, før vægten stiger.',
  },
  {
    id: 'strength', name: 'Styrke', share: 0.3, repRange: [2, 6], intensity: [0.7, 0.88],
    targetRir: [1, 3], volumeFactor: 1.0,
    description: 'Mere specifikke variationer og moderate reps. Her bygges den tunge kapacitet.',
  },
  {
    id: 'intensification', name: 'Intensivering', share: 0.25, repRange: [1, 3], intensity: [0.82, 0.94],
    targetRir: [1, 3], volumeFactor: 0.8,
    description: 'Singles og triples med lavere volumen. Assistancen trimmes ned.',
  },
  {
    id: 'peak', name: 'Peak og taper', share: 0.15, repRange: [1, 3], intensity: [0.85, 0.95],
    targetRir: [1, 2], volumeFactor: 0.55,
    description: 'Konkurrenceløft og kommandoer. Markant mindre assistance og volumen.',
  },
];

const HYROX_PHASES: PhaseTemplate[] = [
  {
    id: 'base', name: 'Base', share: 0.35, repRange: [6, 12], intensity: [0.6, 0.75],
    targetRir: [2, 4], volumeFactor: 1.0,
    description: 'Gradvis løbevolumen, roligt aerobt arbejde, fundamental styrke og stationsteknik.',
  },
  {
    id: 'build', name: 'Build', share: 0.3, repRange: [4, 10], intensity: [0.68, 0.85],
    targetRir: [1, 3], volumeFactor: 1.05,
    description: 'Threshold og VO2-arbejde, slæde- og carrystyrke, muskulær udholdenhed.',
  },
  {
    id: 'specific', name: 'Specifik', share: 0.22, repRange: [3, 8], intensity: [0.7, 0.85],
    targetRir: [1, 3], volumeFactor: 0.95,
    description: '1 km-repeats, compromised running, transitions og stationsrækkefølge.',
  },
  {
    id: 'taper', name: 'Taper', share: 0.13, repRange: [3, 6], intensity: [0.7, 0.82],
    targetRir: [2, 3], volumeFactor: 0.55,
    description: 'Volumen ned, race pace og teknik bevares. Undgå unødvendig muskelømhed.',
  },
];

const STRONGMAN_PHASES: PhaseTemplate[] = [
  {
    id: 'base', name: 'GPP og hypertrofi', share: 0.25, repRange: [6, 12], intensity: [0.55, 0.75],
    targetRir: [2, 4], volumeFactor: 1.15,
    description: 'Muskelmasse, basisstyrke og aerob base. Events køres som teknik.',
  },
  {
    id: 'strength', name: 'Basisstyrke og power', share: 0.25, repRange: [3, 6], intensity: [0.72, 0.88],
    targetRir: [1, 3], volumeFactor: 1.0,
    description: 'Squat, dødløft, overhead, cleans og carries bærer ugen.',
  },
  {
    id: 'specific', name: 'Eventspecifik opbygning', share: 0.25, repRange: [1, 6], intensity: [0.78, 0.92],
    targetRir: [1, 3], volumeFactor: 0.95,
    description: 'Konkurrencevarianter, eventloads, rep- og tidsstrategi samt medleys.',
  },
  {
    id: 'realisation', name: 'Realisering', share: 0.15, repRange: [1, 3], intensity: [0.85, 0.97],
    targetRir: [0, 2], volumeFactor: 0.75,
    description: 'Nære konkurrenceloads med fulde standarder og lavere volumen.',
  },
  {
    id: 'taper', name: 'Taper', share: 0.1, repRange: [1, 3], intensity: [0.8, 0.9],
    targetRir: [2, 3], volumeFactor: 0.5,
    description: 'Event- og assistancefatigue reduceres. Korte specifikke touches bevares.',
  },
];

const CROSSFIT_PHASES: PhaseTemplate[] = [
  {
    id: 'base', name: 'Mechanics', share: 0.35, repRange: [5, 12], intensity: [0.6, 0.75],
    targetRir: [2, 4], volumeFactor: 1.0,
    description: 'Bevægelseskvalitet først. Lavere skill under fatigue, flere tekniske reps.',
  },
  {
    id: 'build', name: 'Consistency', share: 0.4, repRange: [3, 10], intensity: [0.68, 0.85],
    targetRir: [1, 3], volumeFactor: 1.05,
    description: 'Samme kvalitet gentaget. Bredere tidsdomæner og flere skill-eksponeringer.',
  },
  {
    id: 'intensification', name: 'Intensity', share: 0.25, repRange: [1, 8], intensity: [0.75, 0.92],
    targetRir: [1, 2], volumeFactor: 0.9,
    description: 'Intensiteten skrues op, når mechanics og consistency er dokumenteret.',
  },
];

const FUNCTIONAL_PHASES: PhaseTemplate[] = [
  {
    id: 'base', name: 'Grundform', share: 0.5, repRange: [5, 12], intensity: [0.6, 0.78],
    targetRir: [2, 4], volumeFactor: 1.0,
    description: 'Få stabile styrkeøvelser, gradvis aerob volumen og en lille mængde høj intensitet.',
  },
  {
    id: 'build', name: 'Opbygning', share: 0.5, repRange: [4, 10], intensity: [0.68, 0.85],
    targetRir: [1, 3], volumeFactor: 1.05,
    description: 'Samme øvelser, mere belastning eller flere reps. Variation bruges til dækning.',
  },
];

/* ---------- Anchors ---------- */

function strengthAnchors(lifts: LiftId[], ctx: AnchorContext): WeeklyAnchor[] {
  return lifts.map((lift) => ({
    id: `lift-${lift}`,
    label: LIFT_NAMES[lift],
    kind: 'strength' as const,
    liftId: lift,
    minPerWeek: 1,
    mandatory: true,
    rationale:
      `${LIFT_NAMES[lift]} er et prioriteret hovedløft og skal have mindst én specifik `
      + 'eksponering om ugen. Uden den er der ingen målrettet progression.',
  })).slice(0, Math.max(2, Math.min(lifts.length, ctx.daysPerWeek * 2)));
}

/* ---------- Modellerne ---------- */

export const SPORT_MODELS: Record<SportId, SportDemandModel> = {
  strength4: {
    sport: 'strength4',
    name: 'Styrke — fire løft',
    demands:
      'Squat, bænkpres, dødløft og overhead press. Overhead press er WHATWORKs fjerde '
      + 'hovedløft og er ikke et officielt IPF-konkurrenceløft.',
    phases: STRENGTH_PHASES,
    conditioningSplit: { low: 0.7, moderate: 0.2, high: 0.1 },
    anchors: (ctx) => [
      ...strengthAnchors(STRENGTH4_LIFTS, ctx),
      {
        id: 'aerobic-base', label: 'Rolig kondition', kind: 'conditioning',
        minPerWeek: ctx.reduced ? 1 : 1, mandatory: false,
        rationale: 'Lav intensitet bygger restitutionstolerance uden at forstyrre styrkearbejdet.',
      },
    ],
    intakeFields: [
      {
        id: 'lifts.priority',
        question: 'Hvilket løft betyder mest lige nu?',
        why: 'Styrer, hvilket løft der får den bedste dag og den højeste frekvens.',
        required: true,
        fallback: 'Alle fire løft vægtes lige.',
      },
      {
        id: 'benchmarks.strength',
        question: 'Kender du dine tal for de fire løft?',
        why: 'Uden tal kan kilo ikke beregnes, og programmet starter med en testuge.',
        required: true,
        fallback: 'Der bygges en assessment-uge med tekniske top-sæt.',
      },
    ],
  },

  powerlifting: {
    sport: 'powerlifting',
    name: 'Powerlifting',
    demands:
      'Officiel powerlifting er squat, bænkpres og dødløft efter tekniske kommandoer. '
      + 'Overhead press indgår kun som assistance.',
    phases: STRENGTH_PHASES,
    conditioningSplit: { low: 0.8, moderate: 0.15, high: 0.05 },
    anchors: (ctx) => strengthAnchors(COMPETITION_LIFTS, ctx),
    intakeFields: [
      {
        id: 'meet.date',
        question: 'Hvornår er stævnet?',
        why: 'Bestemmer blokkenes længde og hvornår taperen lægges.',
        required: false,
        fallback: 'Der bygges et blokforløb uden fast peak-dato.',
      },
      {
        id: 'meet.federation',
        question: 'Hvilken føderation og udstyrsklasse?',
        why: 'Kommandoer og tekniske standarder afhænger af regelsættet.',
        required: false,
        fallback: 'IPF classic-standarder bruges som udgangspunkt.',
      },
    ],
  },

  crossfit: {
    sport: 'crossfit',
    name: 'CrossFit',
    demands:
      'Konstant varierede funktionelle bevægelser med høj intensitet — men i rækkefølgen '
      + 'mechanics, consistency, intensity. Variationen er planlagt, ikke tilfældig.',
    phases: CROSSFIT_PHASES,
    conditioningSplit: { low: 0.45, moderate: 0.3, high: 0.25 },
    anchors: (ctx) => [
      {
        id: 'cf-squat', label: 'Squat-styrke', kind: 'strength',
        patterns: ['squat'], minPerWeek: 1, mandatory: true,
        rationale: 'Squat er den bærende styrkeeksponering og skal holdes som en progression.',
      },
      {
        id: 'cf-gymnastics', label: 'Gymnastik', kind: 'skill',
        patterns: ['pull', 'press'], minPerWeek: 1, mandatory: true,
        rationale: 'Strict-kapacitet og teknik skal trænes for sig, ikke kun i metcons.',
      },
      {
        id: 'cf-weightlifting', label: 'Vægtløftning', kind: 'skill',
        patterns: ['oly'], minPerWeek: ctx.daysPerWeek >= 4 ? 1 : 0, mandatory: false,
        rationale: 'Teknisk løftearbejde kræver friske sæt og hører ikke hjemme sidst i en metcon.',
      },
      {
        id: 'cf-monostructural', label: 'Monostrukturelt arbejde', kind: 'conditioning',
        patterns: ['cardio'], minPerWeek: 1, mandatory: true,
        rationale: 'M/G/W-dækning kræver, at det monostrukturelle arbejde faktisk planlægges.',
      },
    ],
    intakeFields: [
      {
        id: 'crossfit.competence',
        question: 'Hvilke high-skill-bevægelser er stabile for dig?',
        why: 'Uden en markering programmeres der ikke muscle-ups, HSPU eller snatch under fatigue.',
        required: false,
        fallback: 'High-skill-bevægelser holdes ude, og der skaleres uden at ændre stimulus.',
      },
    ],
  },

  hyrox: {
    sport: 'hyrox',
    name: 'HYROX',
    demands:
      'Otte gange 1 km løb, hver efterfulgt af én station. Løb er den gennemgående '
      + 'disciplin, og compromised running er det, der afgør sluttiden.',
    phases: HYROX_PHASES,
    conditioningSplit: { low: 0.65, moderate: 0.25, high: 0.1 },
    anchors: (ctx) => [
      {
        id: 'hx-easy-run', label: 'Roligt løb', kind: 'run',
        exerciseIds: ['run_dist', 'air_run'], minPerWeek: 1, mandatory: true,
        rationale: 'Løbevolumen er hele forudsætningen. Den bygges roligt, ikke hurtigt.',
      },
      {
        id: 'hx-quality-run', label: 'Løb med kvalitet', kind: 'run',
        exerciseIds: ['run_dist', 'air_run'], minPerWeek: ctx.daysPerWeek >= 4 && !ctx.reduced ? 1 : 0,
        mandatory: false,
        rationale: 'Threshold og race pace udvikler den fart, stationerne skal afvikles imellem.',
      },
      {
        id: 'hx-station', label: 'Stationsarbejde', kind: 'event',
        exerciseIds: ['sled_push', 'sled_pull', 'farmer_carry', 'sandbag_carry', 'wall_ball', 'ski', 'row', 'burpee_broad_jump'],
        minPerWeek: 1, mandatory: true,
        rationale: 'Stationerne har egne tekniske standarder og skal trænes med kendt load og underlag.',
      },
      {
        id: 'hx-lower-strength', label: 'Underkropsstyrke', kind: 'strength',
        patterns: ['squat', 'hinge'], minPerWeek: 1, mandatory: true,
        rationale: 'Slæde, lunges og wall balls hviler på squat- og hinge-styrke.',
      },
    ],
    intakeFields: [
      {
        id: 'hyrox.division',
        question: 'Hvilken division stiller du op i?',
        why: 'Stationsloads og standarder er divisionsafhængige.',
        required: true,
        fallback: 'Open bruges som udgangspunkt, og loads mærkes som ubekræftede.',
      },
      {
        id: 'hyrox.weeklyRunKm',
        question: 'Hvor mange kilometer løber du om ugen lige nu?',
        why: 'Bestemmer, hvor hurtigt løbevolumen må stige — og om uge 1 kan indeholde simulation.',
        required: true,
        fallback: 'Der antages 0 km, og løbet bygges op fra bunden.',
      },
      {
        id: 'hyrox.raceDate',
        question: 'Hvornår er dit race?',
        why: 'Bestemmer blokkene og hvornår taperen lægges.',
        required: false,
        fallback: 'Der bygges et base- og build-forløb uden peak-dato.',
      },
    ],
  },

  strongman: {
    sport: 'strongman',
    name: 'Strongman',
    demands:
      'Der findes ikke ét fast konkurrenceformat. Eventlisten er selve specifikationen: '
      + 'redskaber, loads, distancer, tidsgrænser og regler bestemmer programmet.',
    phases: STRONGMAN_PHASES,
    conditioningSplit: { low: 0.75, moderate: 0.2, high: 0.05 },
    anchors: (ctx) => {
      const base: WeeklyAnchor[] = [
        {
          id: 'sm-deadlift', label: 'Dødløft eller variant', kind: 'strength',
          liftId: 'deadlift', minPerWeek: 1, mandatory: true,
          rationale: 'Dødløftsstyrke bærer både max-events og loading.',
        },
        {
          id: 'sm-overhead', label: 'Overhead', kind: 'strength',
          liftId: 'ohp', minPerWeek: 1, mandatory: true,
          rationale: 'Log og axle press hviler på overhead-styrke.',
        },
        {
          id: 'sm-carry', label: 'Carry og greb', kind: 'event',
          patterns: ['carry'], minPerWeek: 1, mandatory: true,
          rationale: 'Moving events og greb skal have deres egen eksponering.',
        },
      ];
      const events = ctx.goal.events ?? [];
      if (events.length) {
        base.push({
          id: 'sm-event', label: 'Eventtræning', kind: 'event',
          minPerWeek: ctx.reduced ? 0 : 1, mandatory: true,
          rationale:
            'Konkurrencens egne events skal trænes med de rigtige redskaber, loads og standarder.',
        });
      }
      return base;
    },
    intakeFields: [
      {
        id: 'strongman.events',
        question: 'Hvilke events er på programmet?',
        why: 'Uden eventlisten kan der ikke bygges et konkurrenceprogram — kun generel styrke.',
        required: true,
        fallback: 'Der bygges et generelt styrke- og kapacitetsforløb, ikke en contest prep.',
      },
      {
        id: 'strongman.implements',
        question: 'Hvilke redskaber har du adgang til i træningen?',
        why: 'Forskellen mellem trænings- og konkurrenceudstyr ændrer, hvad der kan programmeres.',
        required: false,
        fallback: 'Der bruges nærmeste tilgængelige variant med en tydelig note.',
      },
    ],
  },

  functional: {
    sport: 'functional',
    name: 'Funktionel fitness',
    demands:
      '"Funktionel" er ikke et mål i sig selv. Funktionen skal defineres: sundhed, '
      + 'arbejdskapacitet, sportspræstation eller styrke og kondition uden konkurrence.',
    phases: FUNCTIONAL_PHASES,
    conditioningSplit: { low: 0.65, moderate: 0.25, high: 0.1 },
    anchors: (ctx) => [
      {
        id: 'fn-squat', label: 'Squat-mønster', kind: 'strength',
        patterns: ['squat'], minPerWeek: 1, mandatory: true,
        rationale: 'Et squat-mønster er grundlaget for al underkropsstyrke.',
      },
      {
        id: 'fn-hinge', label: 'Hinge-mønster', kind: 'strength',
        patterns: ['hinge'], minPerWeek: 1, mandatory: true,
        rationale: 'Hinge dækker baglår, balder og ryg — det mønster hverdagen belaster mest.',
      },
      {
        id: 'fn-push-pull', label: 'Pres og træk', kind: 'strength',
        patterns: ['press', 'pull'], minPerWeek: ctx.daysPerWeek >= 3 ? 2 : 1, mandatory: true,
        rationale: 'Overkroppen skal dækkes fra begge sider, ikke kun med pres.',
      },
      {
        id: 'fn-aerobic', label: 'Aerob base', kind: 'conditioning',
        patterns: ['cardio'], minPerWeek: 1, mandatory: true,
        rationale: 'Rolig aerob volumen er den del, der bærer alt det andet.',
      },
    ],
    intakeFields: [
      {
        id: 'functional.purpose',
        question: 'Hvad skal funktionen forbedre?',
        why: 'Sundhed, arbejdskapacitet og sportspræstation giver forskellige programmer.',
        required: true,
        fallback: 'Der bygges et bredt program med styrke, kondition og bevægelseskvalitet.',
      },
    ],
  },
};

export const sportModel = (sport: SportId): SportDemandModel => SPORT_MODELS[sport];

export const SPORT_LIST: { id: SportId; name: string; desc: string }[] =
  (Object.keys(SPORT_MODELS) as SportId[]).map((id) => ({
    id,
    name: SPORT_MODELS[id].name,
    desc: SPORT_MODELS[id].demands,
  }));

/**
 * Fordeler faserne over det valgte antal uger.
 *
 * Uden en eventdato droppes peak/taper — der er ingen grund til at tapere mod
 * ingenting. Det er også derfor, at faserne er andele frem for faste uger.
 */
export function planPhases(
  sport: SportId,
  weeks: number,
  hasEvent: boolean,
): { phase: PhaseTemplate; week: number }[] {
  const model = sportModel(sport);
  const phases = hasEvent
    ? model.phases
    : model.phases.filter((p) => p.id !== 'peak' && p.id !== 'taper' && p.id !== 'realisation');

  const totalShare = phases.reduce((s, p) => s + p.share, 0) || 1;
  const out: { phase: PhaseTemplate; week: number }[] = [];

  // Hver fase får mindst én uge, resten fordeles efter andel.
  const raw = phases.map((p) => Math.max(1, Math.round((p.share / totalShare) * weeks)));
  let total = raw.reduce((a, b) => a + b, 0);
  let i = raw.length - 1;
  while (total > weeks && i >= 0) {
    if ((raw[i] as number) > 1) { raw[i] = (raw[i] as number) - 1; total -= 1; } else { i -= 1; }
  }
  let j = 0;
  while (total < weeks) {
    raw[j % raw.length] = (raw[j % raw.length] as number) + 1;
    total += 1;
    j += 1;
  }

  let week = 1;
  phases.forEach((phase, idx) => {
    for (let k = 0; k < (raw[idx] as number); k++) {
      if (week > weeks) return;
      out.push({ phase, week });
      week += 1;
    }
  });
  return out;
}
