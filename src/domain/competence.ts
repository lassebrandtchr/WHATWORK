/**
 * Movement competence.
 *
 * Specifikationens hårde regel: high-skill-øvelser må ikke vælges alene ud fra et
 * generelt niveau som "Elite". Der skal være et dokumenteret movement benchmark
 * eller en kompetencemarkering. Det er porten her, der håndhæver det.
 */

import type { LevelId } from '../engine/types.js';
import { isHighSkill, ontologyFor } from './ontology.js';
import { COMPETENCE_LABELS, COMPETENCE_ORDER } from './types.js';
import type { AthleteProfile, CompetenceEntry, CompetenceLevel } from './types.js';

export const competenceRank = (level: CompetenceLevel): number =>
  Math.max(0, COMPETENCE_ORDER.indexOf(level));

export const atLeast = (have: CompetenceLevel, need: CompetenceLevel): boolean =>
  competenceRank(have) >= competenceRank(need);

/**
 * Det kompetenceniveau, appen må antage uden en registrering.
 *
 * Et generelt niveau kan bære lav-skill-bevægelser — det er ikke rimeligt at
 * spørge en øvet atlet, om hun kan tage en air squat. Men det stopper ved
 * `introduced`: intet generelt niveau kan dokumentere en muscle-up.
 */
export function impliedCompetence(exerciseId: string, level: LevelId): CompetenceLevel {
  if (isHighSkill(exerciseId)) return 'unknown';
  const o = ontologyFor(exerciseId);
  if (!o) return 'unknown';
  if (o.skill <= 1) return level >= 2 ? 'stable_fatigued' : 'stable_fresh';
  if (o.skill === 2) return level >= 3 ? 'stable_fatigued' : level >= 2 ? 'stable_fresh' : 'introduced';
  if (o.skill === 3) return level >= 4 ? 'stable_fresh' : level >= 3 ? 'introduced' : 'unknown';
  return 'unknown';
}

export function competenceOf(
  profile: Pick<AthleteProfile, 'competence' | 'level'>,
  exerciseId: string,
): CompetenceLevel {
  const recorded = profile.competence.find((c) => c.exerciseId === exerciseId);
  if (recorded) return recorded.level;
  return impliedCompetence(exerciseId, profile.level);
}

export interface CompetenceVerdict {
  allowed: boolean;
  have: CompetenceLevel;
  need: CompetenceLevel;
  /** Sandt når afgørelsen bygger på en registrering frem for et generelt niveau. */
  documented: boolean;
  reason: string;
}

/**
 * Må øvelsen programmeres i den givne kontekst?
 *
 * `underFatigue` hæver kravet ét trin: en bevægelse, der er stabil frisk, er ikke
 * automatisk stabil i tiende runde af en AMRAP.
 */
export function canProgram(
  profile: Pick<AthleteProfile, 'competence' | 'level'>,
  exerciseId: string,
  opts: { underFatigue?: boolean; heavyLoad?: boolean } = {},
): CompetenceVerdict {
  const o = ontologyFor(exerciseId);
  const documented = profile.competence.some((c) => c.exerciseId === exerciseId);
  const have = competenceOf(profile, exerciseId);

  if (!o) {
    return { allowed: true, have, need: 'unknown', documented, reason: 'Øvelsen har ingen kompetencekrav.' };
  }

  let need = o.requiresCompetence;
  // Under fatigue hæves kravet til netop "stabil under træthed" — det er præcis det,
  // niveauet betyder. Der er ingen grund til at kræve konkurrenceklar for en metcon.
  if (opts.underFatigue && competenceRank(need) > 0 && competenceRank(need) < competenceRank('stable_fatigued')) {
    need = 'stable_fatigued';
  }
  if (opts.heavyLoad && o.skill >= 4 && competenceRank(need) < competenceRank('stable_fresh')) {
    need = 'stable_fresh';
  }

  if (competenceRank(need) === 0) {
    return { allowed: true, have, need, documented, reason: 'Lav teknisk tærskel.' };
  }

  const allowed = atLeast(have, need);
  return {
    allowed,
    have,
    need,
    documented,
    reason: allowed
      ? `${COMPETENCE_LABELS[have]} dækker kravet om ${COMPETENCE_LABELS[need].toLowerCase()}.`
      : `Kræver ${COMPETENCE_LABELS[need].toLowerCase()}. Du står som ${COMPETENCE_LABELS[have].toLowerCase()}.`
        + (documented ? '' : ' Et generelt niveau kan ikke dokumentere teknik i denne bevægelse.'),
  };
}

export function setCompetence(
  entries: CompetenceEntry[],
  exerciseId: string,
  level: CompetenceLevel,
  at: string = new Date().toISOString(),
): CompetenceEntry[] {
  const rest = entries.filter((c) => c.exerciseId !== exerciseId);
  if (level === 'unknown') return rest;
  return [...rest, { exerciseId, level, updatedAt: at }];
}
