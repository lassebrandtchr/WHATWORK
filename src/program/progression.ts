/**
 * Progression, deload og den ugentlige beslutning.
 *
 * Volumen må ikke bare "stige lidt". Motoren ændrer normalt én hovedvariabel ad
 * gangen, og beslutningen skal kunne forklares med præcis de actuals, der udløste
 * den. Adherence behandles adskilt fra fysiologisk respons: gennemfører brugeren
 * to ud af fire pas, er svaret som regel en mindre plan — ikke mere progression.
 */

import type { ConstraintIssue } from '../domain/types.js';
import { CONSTRAINT_CODES, issue } from '../domain/constraints.js';

export type WeeklyDecision = 'progress' | 'hold' | 'regress' | 'deload' | 'rescope';

/** Den ene variabel, ugen ændrer. Flere ad gangen gør resultatet uforklarligt. */
export type ProgressionVariable = 'load' | 'reps' | 'sets' | 'frequency' | 'pace' | 'rest' | 'none';

export interface WeeklyActuals {
  /** Planlagte pas i ugen. */
  plannedSessions: number;
  /** Gennemførte pas. Flyttede pas tæller ikke som missede. */
  completedSessions: number;
  rescheduledSessions: number;
  /** Antal sæt, hvor faktisk RPE lå mindst 1 over målet. */
  rpeOvershoots: number;
  /** Antal sæt, hvor de planlagte reps ikke blev nået. */
  missedReps: number;
  /** Højeste registrerede smertescore i ugen. */
  maxPain: number;
  /** Ændring i rullende e1RM siden sidste uge, i procent. */
  e1rmChangePct: number | null;
  /** Vedvarende ømhed eller dårlig søvn markeret af brugeren. */
  persistentSoreness: boolean;
  poorSleepOrStress: boolean;
  /** Sandt i sidste uge af en blok. */
  blockEnd: boolean;
  /** Sandt når mindst én øvelse er ny i denne uge. */
  hasNewExercise: boolean;
}

export interface ProgressionOutcome {
  decision: WeeklyDecision;
  variable: ProgressionVariable;
  /** Multiplikator til belastning i næste uge. */
  loadFactor: number;
  /** Multiplikator til volumen i næste uge. */
  volumeFactor: number;
  /** Foreslået antal pas i næste uge. Kun sat ved `rescope`. */
  suggestedSessions: number | null;
  /** De actuals, der udløste beslutningen — ét punkt pr. signal. */
  triggers: string[];
  explanation: string;
  issues: ConstraintIssue[];
}

/** Mindst så mange signaler skal være til stede, før der deloades. */
export const DELOAD_SIGNAL_THRESHOLD = 2;

/** Under denne adherence giver det ikke mening at lægge mere progression på. */
export const RESCOPE_ADHERENCE = 0.6;

/**
 * Tæller de signaler, der tilsammen udgør et deload-behov.
 *
 * En kalender-deload hver fjerde uge kan være en skabelon, men den er ikke den
 * eneste regel — derfor tælles blokslut kun som ét signal blandt flere.
 */
export function deloadSignals(a: WeeklyActuals): string[] {
  const out: string[] = [];
  if (a.rpeOvershoots >= 3) out.push(`${a.rpeOvershoots} sæt lå over den planlagte RPE.`);
  if (a.missedReps >= 2) out.push(`${a.missedReps} sæt nåede ikke de planlagte reps.`);
  if (a.e1rmChangePct !== null && a.e1rmChangePct <= -3) {
    out.push(`Dit rullende e1RM er faldet ${Math.abs(Math.round(a.e1rmChangePct))} %.`);
  }
  if (a.persistentSoreness) out.push('Du har markeret vedvarende ømhed.');
  if (a.poorSleepOrStress) out.push('Du har markeret dårlig søvn eller høj belastning uden for træningen.');
  if (a.maxPain >= 3) out.push(`Højeste registrerede smerte i ugen var ${a.maxPain} ud af 10.`);
  if (a.blockEnd) out.push('Ugen er sidste uge i blokken.');
  return out;
}

export const adherence = (a: WeeklyActuals): number => {
  // Flyttede pas er ikke missede pas — de tæller ikke med i nævneren.
  const eligible = Math.max(0, a.plannedSessions - a.rescheduledSessions);
  return eligible === 0 ? 1 : a.completedSessions / eligible;
};

/**
 * Ugens beslutning.
 *
 * Rækkefølgen er bevidst: smerte og adherence først, fordi de ikke skal drukne i
 * en fysiologisk vurdering af en plan, brugeren ikke har fulgt.
 */
export function decideWeek(a: WeeklyActuals): ProgressionOutcome {
  const triggers = deloadSignals(a);
  const rate = adherence(a);
  const issues: ConstraintIssue[] = [];

  if (a.maxPain >= 4) {
    return {
      decision: 'regress',
      variable: 'load',
      loadFactor: 0.9,
      volumeFactor: 0.85,
      suggestedSessions: null,
      triggers: [`Smerte på ${a.maxPain} ud af 10 blev registreret.`],
      explanation:
        'Smerten er over grænsen for at køre videre som planlagt. Belastning og volumen '
        + 'sættes ned, og de berørte bevægelser erstattes eller stoppes. '
        + 'Bliver den ved, hører den hjemme hos en fysioterapeut — ikke i en app.',
      issues: [issue(
        CONSTRAINT_CODES.PAIN_CONFLICT,
        `Der er registreret smerte på ${a.maxPain} ud af 10 i ugen.`,
        { fix: 'Marker, hvilke bevægelser der forværrer, så de kan tages ud.', scope: 'week' },
      )],
    };
  }

  if (rate < RESCOPE_ADHERENCE && a.plannedSessions >= 3) {
    const suggested = Math.max(2, a.completedSessions);
    return {
      decision: 'rescope',
      variable: 'frequency',
      loadFactor: 1,
      volumeFactor: 1,
      suggestedSessions: suggested,
      triggers: [`Du gennemførte ${a.completedSessions} af ${a.plannedSessions} planlagte pas.`],
      explanation:
        `Planen er skrevet til ${a.plannedSessions} pas, men der bliver gennemført `
        + `${a.completedSessions}. Der lægges ikke mere progression oven på en plan, der ikke `
        + `passer til din uge — i stedet foreslås ${suggested} pas, som du reelt kan nå.`,
      issues,
    };
  }

  if (triggers.length >= DELOAD_SIGNAL_THRESHOLD) {
    return {
      decision: 'deload',
      variable: 'sets',
      loadFactor: 0.95,
      volumeFactor: 0.6,
      suggestedSessions: null,
      triggers,
      explanation:
        `Der er ${triggers.length} samtidige signaler om akkumuleret træthed. Volumen sættes `
        + 'markant ned, mens noget teknisk specifik intensitet bevares. '
        + 'Assistance med høj træthed og failure fjernes i ugen.',
      issues,
    };
  }

  if (a.rpeOvershoots >= 2 || a.missedReps >= 1) {
    return {
      decision: 'hold',
      variable: 'none',
      loadFactor: 1,
      volumeFactor: 1,
      suggestedSessions: null,
      triggers: triggers.length ? triggers : ['Blandet signal i ugens sæt.'],
      explanation:
        'Signalerne er blandede. Planen holdes uændret en uge mere, så der kommer et '
        + 'rent sammenligningsgrundlag, før noget ændres.',
      issues,
    };
  }

  if (a.hasNewExercise) {
    return {
      decision: 'hold',
      variable: 'none',
      loadFactor: 1,
      volumeFactor: 1,
      suggestedSessions: null,
      triggers: ['Der er en ny øvelse i ugen.'],
      explanation:
        'En ny øvelse har ikke et sammenligningsgrundlag endnu. Den holdes uændret, '
        + 'til der er to uger at måle på.',
      issues,
    };
  }

  return {
    decision: 'progress',
    variable: 'load',
    loadFactor: 1.025,
    volumeFactor: 1,
    suggestedSessions: null,
    triggers: [
      `Du gennemførte ${a.completedSessions} af ${a.plannedSessions} pas.`,
      'RPE lå inden for målet, og der var ingen missede reps.',
    ],
    explanation:
      'Målene blev ramt med stabil teknik og passende anstrengelse. Belastningen går '
      + '2,5 % op — kun én variabel ændres, så effekten kan aflæses næste uge.',
    issues,
  };
}

/* ---------- Double progression ---------- */

export interface DoubleProgressionState {
  reps: number;
  /** Øvre grænse. Rammes den på alle sæt, går belastningen op i stedet. */
  repCeiling: number;
  loadFactor: number;
}

/**
 * Double progression: reps op til loftet, derefter belastning op og reps tilbage.
 *
 * Det er den progression, der passer til assistance og til begyndere, fordi den
 * ikke kræver et præcist e1RM for at virke.
 */
export function advanceDoubleProgression(
  state: DoubleProgressionState,
  allRepsCompleted: boolean,
  repFloor: number,
): DoubleProgressionState & { explanation: string } {
  if (!allRepsCompleted) {
    return {
      ...state,
      explanation: 'Alle reps blev ikke nået. Samme reps og samme belastning en gang til.',
    };
  }
  if (state.reps < state.repCeiling) {
    return {
      ...state,
      reps: state.reps + 1,
      explanation: `Alle reps blev nået. Én rep mere pr. sæt (${state.reps} → ${state.reps + 1}).`,
    };
  }
  return {
    reps: repFloor,
    repCeiling: state.repCeiling,
    loadFactor: Math.round(state.loadFactor * 1.025 * 1000) / 1000,
    explanation:
      `Reploftet på ${state.repCeiling} er ramt. Belastningen går 2,5 % op, `
      + `og reps starter forfra på ${repFloor}.`,
  };
}
