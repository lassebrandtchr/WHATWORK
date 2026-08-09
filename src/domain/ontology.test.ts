import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../engine/data/exercises.js';
import {
  HIGH_SKILL_IDS, ONTOLOGY, inGroup, isHighSkill, ontologyFor, overlaps, sumFatigue, transferTo,
} from './ontology.js';
import { canProgram, competenceOf, impliedCompetence, setCompetence } from './competence.js';
import { findSubstitution, validateSubstitution } from './substitution.js';
import type { AthleteProfile } from './types.js';

const profile = (over: Partial<AthleteProfile> = {}): Pick<AthleteProfile, 'competence' | 'level' | 'care' | 'excludedExerciseIds'> => ({
  competence: [], level: 3, care: [], excludedExerciseIds: [], ...over,
});

describe('ontologien', () => {
  it('dækker hele øvelseskataloget', () => {
    EXERCISES.forEach((e) => {
      expect(ONTOLOGY[e.id], `mangler ontologi for ${e.id}`).toBeDefined();
    });
  });

  it('giver hovedløftene deres egen substitutionsgruppe', () => {
    expect(ontologyFor('back_squat')?.group).toBe('squat-specific');
    expect(ontologyFor('deadlift')?.group).toBe('hinge-specific');
    expect(ontologyFor('bench_press')?.group).toBe('press-horizontal');
    expect(ontologyFor('strict_press')?.group).toBe('press-vertical');
  });

  it('forbyder failure på tunge stangløft', () => {
    ['back_squat', 'deadlift', 'bench_press', 'strict_press'].forEach((id) => {
      expect(ontologyFor(id)?.failureAllowed).toBe(false);
    });
  });

  it('giver stangløft med hinge en aksial belastning', () => {
    expect((ontologyFor('deadlift') as { fatigue: { axial: number } }).fatigue.axial).toBeGreaterThan(0);
    expect((ontologyFor('back_squat') as { fatigue: { axial: number } }).fatigue.axial).toBeGreaterThan(0);
    expect((ontologyFor('row') as { fatigue: { axial: number } }).fatigue.axial).toBe(0);
  });

  it('giver hop og løb impact', () => {
    expect((ontologyFor('box_jump_over') as { fatigue: { impact: number } }).fatigue.impact).toBeGreaterThan(0);
    expect((ontologyFor('bench_press') as { fatigue: { impact: number } }).fatigue.impact).toBe(0);
  });

  it('kender overførsel til hovedløft', () => {
    const toSquat = transferTo('squat').map((o) => o.exerciseId);
    expect(toSquat).toContain('front_squat');
    expect(toSquat).toContain('back_squat');
    expect(toSquat).not.toContain('bench_press');
  });

  it('summerer fatigue over flere øvelser', () => {
    const one = sumFatigue(['deadlift']);
    const two = sumFatigue(['deadlift', 'back_squat']);
    expect(two.axial).toBeGreaterThan(one.axial);
  });

  it('finder overlap i samme gruppe', () => {
    expect(overlaps('strict_press', 'push_press')).toBe(true);
    expect(overlaps('strict_press', 'back_squat')).toBe(false);
  });

  it('sorterer en gruppe efter stigende teknisk krav', () => {
    const g = inGroup('press-vertical').map((o) => o.skill);
    expect(g).toEqual([...g].sort((a, b) => a - b));
  });

  it('markerer high-skill-bevægelserne', () => {
    HIGH_SKILL_IDS.forEach((id) => expect(isHighSkill(id)).toBe(true));
    expect(isHighSkill('air_squat')).toBe(false);
  });
});

describe('movement competence', () => {
  it('lader ikke et generelt niveau dokumentere high-skill', () => {
    expect(impliedCompetence('hspu', 5)).toBe('unknown');
    expect(impliedCompetence('power_snatch', 5)).toBe('unknown');
  });

  it('lader et generelt niveau bære lav-skill', () => {
    expect(impliedCompetence('air_squat', 3)).toBe('stable_fatigued');
  });

  it('blokerer high-skill uden dokumenteret kompetence — også for elite', () => {
    const v = canProgram(profile({ level: 5 }), 'hspu');
    expect(v.allowed).toBe(false);
    expect(v.documented).toBe(false);
    expect(v.reason).toContain('generelt niveau');
  });

  it('tillader high-skill når kompetencen er registreret', () => {
    const competence = setCompetence([], 'hspu', 'stable_fatigued');
    const v = canProgram(profile({ competence }), 'hspu');
    expect(v.allowed).toBe(true);
    expect(v.documented).toBe(true);
  });

  it('kræver et højere niveau for de sværeste bevægelser', () => {
    const competence = setCompetence([], 'hspu', 'stable_fresh');
    expect(canProgram(profile({ competence }), 'hspu').allowed).toBe(false);
  });

  it('hæver kravet til stabil under træthed, når der køres under fatigue', () => {
    const competence = setCompetence([], 'pull_up', 'stable_fresh');
    expect(canProgram(profile({ competence }), 'pull_up').allowed).toBe(true);
    expect(canProgram(profile({ competence }), 'pull_up', { underFatigue: true }).allowed).toBe(false);
  });

  it('hæver aldrig kravet ud over stabil under træthed', () => {
    const competence = setCompetence([], 'pull_up', 'stable_fatigued');
    expect(canProgram(profile({ competence }), 'pull_up', { underFatigue: true }).allowed).toBe(true);
  });

  it('kan fjerne en registrering igen', () => {
    const set = setCompetence([], 'pull_up', 'stable_fresh');
    expect(setCompetence(set, 'pull_up', 'unknown')).toHaveLength(0);
  });

  it('læser registreret kompetence frem for det generelle niveau', () => {
    const competence = setCompetence([], 'air_squat', 'introduced');
    expect(competenceOf(profile({ competence }), 'air_squat')).toBe('introduced');
  });
});

describe('substitution', () => {
  const equipment = ['barbell', 'dumbbell', 'kettlebell', 'box', 'rings', 'pullupbar', 'bench', 'wallball', 'band'];

  it('bytter inden for samme stimulusgruppe', () => {
    const s = findSubstitution({
      exerciseId: 'back_squat', reason: 'pain',
      profile: profile({ care: ['back'] }), availableEquipment: equipment,
    });
    expect(s).not.toBeNull();
    expect(s?.preservesStimulus).toBe(true);
    expect(ontologyFor(s?.toId as string)?.group).toBe('squat-specific');
  });

  it('vælger en lettere variant når der skaleres', () => {
    const s = findSubstitution({
      exerciseId: 'hspu', reason: 'scaling', easier: true,
      profile: profile(), availableEquipment: equipment,
    });
    expect(s).not.toBeNull();
    expect((ontologyFor(s?.toId as string)?.skill ?? 9)).toBeLessThanOrEqual(5);
  });

  it('vælger aldrig en øvelse, brugeren har fravalgt', () => {
    const s = findSubstitution({
      exerciseId: 'bench_press', reason: 'excluded',
      profile: profile({ excludedExerciseIds: ['db_bench', 'push_up'] }),
      availableEquipment: equipment,
    });
    expect(['db_bench', 'push_up']).not.toContain(s?.toId);
  });

  it('vælger aldrig en øvelse, der rammer samme skånehensyn', () => {
    const s = findSubstitution({
      exerciseId: 'dip', reason: 'pain',
      profile: profile({ care: ['shoulder'] }), availableEquipment: equipment,
    });
    if (s) {
      const ex = EXERCISES.find((e) => e.id === s.toId);
      expect(ex?.avoid).not.toContain('shoulder');
    }
  });

  it('respekterer manglende udstyr', () => {
    const s = findSubstitution({
      exerciseId: 'back_squat', reason: 'equipment',
      profile: profile(), availableEquipment: [],
    });
    if (s) {
      const ex = EXERCISES.find((e) => e.id === s.toId);
      expect(ex?.eq).toEqual(['bodyweight']);
    }
  });

  it('validerer en påtænkt substitution', () => {
    expect(validateSubstitution('strict_press', 'push_press').preservesStimulus).toBe(true);
    expect(validateSubstitution('strict_press', 'back_squat').preservesStimulus).toBe(false);
  });
});
