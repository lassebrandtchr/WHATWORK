/**
 * Substitutionsregler.
 *
 * En substitution skal komme fra samme stimulusgruppe og forklares. Det er den
 * regel, der forhindrer, at "Gør lettere" bytter en EMOM med push press ud med en
 * AMRAP med burpee pull-ups og kalder det en lettere version af samme workout.
 */

import { BY_ID } from '../engine/data/exercises.js';
import type { CareId } from '../engine/types.js';
import { canProgram } from './competence.js';
import { exerciseName, inGroup, ontologyFor } from './ontology.js';
import type { OntologyEntry } from './ontology.js';
import type { AthleteProfile } from './types.js';

export type SubstitutionReason =
  | 'pain'
  | 'equipment'
  | 'competence'
  | 'excluded'
  | 'scaling'
  | 'progression';

export interface SubstitutionRequest {
  exerciseId: string;
  reason: SubstitutionReason;
  profile: Pick<AthleteProfile, 'competence' | 'level' | 'care' | 'excludedExerciseIds'>;
  /** Udstyr, der faktisk er til rådighed. `bodyweight` regnes altid som til rådighed. */
  availableEquipment: string[];
  /** Sandt når erstatningen skal være lettere/mindre kompleks. */
  easier?: boolean;
  underFatigue?: boolean;
}

export interface Substitution {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  reason: SubstitutionReason;
  /** Sandt når erstatningen bevarer bevægelsesmønster og stimulusgruppe. */
  preservesStimulus: boolean;
  explanation: string;
}

const REASON_TEXT: Record<SubstitutionReason, string> = {
  pain: 'dit skånehensyn',
  equipment: 'manglende udstyr',
  competence: 'kravet til teknik',
  excluded: 'at du har fravalgt øvelsen',
  scaling: 'skalering',
  progression: 'progression',
};

function hasEquipment(exerciseId: string, available: string[]): boolean {
  const ex = BY_ID[exerciseId];
  if (!ex) return false;
  return ex.eq.every((e) => e === 'bodyweight' || available.includes(e));
}

function conflictsWithCare(exerciseId: string, care: CareId[]): boolean {
  const ex = BY_ID[exerciseId];
  if (!ex) return false;
  return ex.avoid.some((a) => care.includes(a));
}

/**
 * Finder den bedste erstatning inden for samme stimulusgruppe.
 *
 * Kandidaterne rangeres efter, hvor tæt de ligger på originalens tekniske krav —
 * ved skalering foretrækkes den nærmeste lettere, ellers den nærmeste overhovedet.
 * Findes ingen i gruppen, falder den tilbage på katalogets egne `sub`-forslag og
 * markerer, at stimulus ikke er bevaret.
 */
export function findSubstitution(req: SubstitutionRequest): Substitution | null {
  const origin = ontologyFor(req.exerciseId);
  if (!origin) return null;

  const usable = (o: OntologyEntry): boolean => {
    if (o.exerciseId === req.exerciseId) return false;
    if (req.profile.excludedExerciseIds.includes(o.exerciseId)) return false;
    if (!hasEquipment(o.exerciseId, req.availableEquipment)) return false;
    if (conflictsWithCare(o.exerciseId, req.profile.care)) return false;
    const verdict = canProgram(req.profile, o.exerciseId, {
      ...(req.underFatigue !== undefined ? { underFatigue: req.underFatigue } : {}),
    });
    return verdict.allowed;
  };

  const inSameGroup = inGroup(origin.group).filter(usable);
  const pool = req.easier
    ? inSameGroup.filter((o) => o.skill <= origin.skill)
    : inSameGroup;

  const ranked = (pool.length ? pool : inSameGroup).sort((a, b) => {
    const da = Math.abs(a.skill - origin.skill);
    const db = Math.abs(b.skill - origin.skill);
    if (da !== db) return da - db;
    return req.easier ? a.skill - b.skill : b.skill - a.skill;
  });

  const chosen = ranked[0];
  if (chosen) {
    return {
      fromId: req.exerciseId,
      toId: chosen.exerciseId,
      fromName: exerciseName(req.exerciseId),
      toName: exerciseName(chosen.exerciseId),
      reason: req.reason,
      preservesStimulus: true,
      explanation:
        `${exerciseName(req.exerciseId)} er byttet til ${exerciseName(chosen.exerciseId)} på grund af `
        + `${REASON_TEXT[req.reason]}. Samme bevægelsesmønster, så stimulus er den samme.`,
    };
  }

  // Sidste udvej: katalogets egne forslag. Stimulus kan afvige, og det siges højt.
  const fallback = (BY_ID[req.exerciseId]?.sub ?? []).find((id) => {
    const o = ontologyFor(id);
    return Boolean(o) && usable(o as OntologyEntry);
  });
  if (!fallback) return null;

  return {
    fromId: req.exerciseId,
    toId: fallback,
    fromName: exerciseName(req.exerciseId),
    toName: exerciseName(fallback),
    reason: req.reason,
    preservesStimulus: false,
    explanation:
      `${exerciseName(req.exerciseId)} er byttet til ${exerciseName(fallback)} på grund af `
      + `${REASON_TEXT[req.reason]}. Der var ingen erstatning i samme bevægelsesgruppe, `
      + 'så stimulus kan afvige lidt.',
  };
}

/**
 * Kontrollerer en påtænkt substitution i stedet for at finde en.
 * Bruges af lint, når en plan allerede indeholder et bytte.
 */
export function validateSubstitution(fromId: string, toId: string): {
  ok: boolean;
  preservesStimulus: boolean;
  message: string;
} {
  const a = ontologyFor(fromId);
  const b = ontologyFor(toId);
  if (!a || !b) {
    return { ok: false, preservesStimulus: false, message: 'Ukendt øvelse i substitutionen.' };
  }
  const preserves = a.group === b.group;
  return {
    ok: true,
    preservesStimulus: preserves,
    message: preserves
      ? `${exerciseName(fromId)} og ${exerciseName(toId)} er i samme bevægelsesgruppe.`
      : `${exerciseName(toId)} er i en anden bevægelsesgruppe end ${exerciseName(fromId)}. `
        + 'Skift af stimulus skal være bevidst.',
  };
}
