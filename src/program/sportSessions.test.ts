import { describe, expect, it } from 'vitest';
import { mayRunFullSimulation, sportContent, weeklyRunTarget } from './sportSessions.js';
import type { SportSessionContext } from './sportSessions.js';
import { planProgram } from './planner.js';
import type { PlanInput } from './planner.js';
import { setCompetence } from '../domain/competence.js';
import { emptyScreening } from '../domain/safety.js';
import { CURRENT_HYROX_VERSION } from '../domain/ruleSets.js';
import { sportModel } from '../domain/sport.js';
import type { AthleteProfile, Goal, StrongmanEvent, TrainingHistorySummary } from '../domain/types.js';
import type { ProgramSession } from './types.js';

const NOW = '2026-08-09T00:00:00.000Z';

const EQUIPMENT = [
  'barbell', 'dumbbell', 'kettlebell', 'box', 'bench', 'rings', 'pullupbar',
  'rower', 'skierg', 'bikeerg', 'wallball', 'band', 'sled', 'sandbag', 'run', 'jumprope',
];

const profile = (over: Partial<AthleteProfile> = {}): AthleteProfile => ({
  id: 'a1', age: 32, bodyMassKg: 82, sex: 'm', level: 3,
  generalTrainingYears: 4, sportTrainingYears: 2,
  availability: { days: 4, minutes: 60 },
  screening: { ...emptyScreening(), status: 'cleared', answeredAt: NOW },
  competence: [], care: [], excludedExerciseIds: [], updatedAt: NOW, ...over,
});

const goal = (over: Partial<Goal> = {}): Goal => ({
  sport: 'hyrox', primary: '', secondary: [], eventDate: null,
  baselineStrategy: 'known', division: 'open_men',
  ruleSet: {
    organization: 'HYROX', version: CURRENT_HYROX_VERSION,
    checkedAt: '2026-08-09', sourceUrl: 'https://hyrox.com/rulebook/',
  },
  ...over,
});

const history = (over: Partial<TrainingHistorySummary> = {}): TrainingHistorySummary => ({
  lookbackDays: 28, sessions: 12,
  hardSetsByPattern: { squat: 16, hinge: 12, press: 12, pull: 12 },
  runKm: 0, highIntensityMinutes: 40, completedPerWeek: 3, ...over,
});

let counter = 0;
const ctx = (over: Partial<SportSessionContext> = {}): SportSessionContext => ({
  goal: goal(),
  phase: sportModel('hyrox').phases[0] as SportSessionContext['phase'],
  profile: profile(),
  pain: [],
  availableEquipment: EQUIPMENT,
  week: 1,
  totalWeeks: 12,
  weeklyRunKm: 0,
  minutes: 60,
  reduced: false,
  nextId: () => { counter += 1; return `t${counter}`; },
  ...over,
});

const plan = (over: Partial<PlanInput> = {}): PlanInput => ({
  profile: profile(),
  goal: goal(),
  benchmarks: [],
  history: history(),
  weakPoints: [],
  availableEquipment: EQUIPMENT,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  bars: [20, 15],
  weeks: 12, daysPerWeek: 4, minutes: 60,
  seed: 4242, now: NOW,
  ...over,
});

const sessions = (p: ReturnType<typeof planProgram>): ProgramSession[] =>
  p.weeks.flatMap((w) => w.days.map((d) => d.session).filter((s): s is ProgramSession => Boolean(s)));

describe('HYROX: løbevolumen bygges fra brugerens udgangspunkt', () => {
  it('starter en debutant med 0 km lavt — ikke ved racedistancen', () => {
    const week1 = weeklyRunTarget(0, 1);
    expect(week1).toBeLessThan(4);
    expect(week1).toBeGreaterThan(0);
  });

  it('stiger omkring 10 % om ugen', () => {
    expect(weeklyRunTarget(20, 2) / weeklyRunTarget(20, 1)).toBeCloseTo(1.1, 2);
  });

  it('lægger et loft, så volumen ikke løber løbsk over et langt forløb', () => {
    expect(weeklyRunTarget(20, 40)).toBeLessThanOrEqual(20 * 2.2);
  });

  it('respekterer et højt udgangspunkt', () => {
    expect(weeklyRunTarget(40, 1)).toBeGreaterThan(weeklyRunTarget(10, 1));
  });

  it('tillader ikke fuld racesimulation for en debutant i uge 1', () => {
    expect(mayRunFullSimulation(0, 1)).toBe(false);
    expect(mayRunFullSimulation(0, 8)).toBe(false);
    expect(mayRunFullSimulation(25, 8)).toBe(true);
  });
});

describe('HYROX-sessioner', () => {
  it('bygger et roligt løb med brugerens egen volumen i forklaringen', () => {
    const part = sportContent('hx-easy-run', ctx({ weeklyRunKm: 0 }));
    expect(part.conditioning).toHaveLength(1);
    expect(part.conditioning[0]?.zone).toBe('low');
    expect(part.conditioning[0]?.rationale).toContain('0 km om ugen');
  });

  it('bruger stationsvægte fra det gemte regelsæt', () => {
    const part = sportContent('hx-station', ctx({ week: 2 }));
    expect(part.sets.length).toBeGreaterThan(0);
    const text = part.sets.map((s) => s.rationale).join(' ');
    expect(text).toMatch(/kg|meter|gentagelser/);
  });

  it('kører kun en andel af racedistancen i basisfasen', () => {
    const base = sportContent('hx-station', ctx({ week: 2 }));
    expect(base.sets.some((s) => s.rationale.includes('50 % af racedistancen'))).toBe(true);
  });

  it('nævner underlaget på slæden, fordi det ændrer kravet', () => {
    // Slæden ligger på plads 2 og 3 i rotationen, så en af de første uger rammer den.
    const weeks = [1, 2, 3, 4].map((week) => sportContent('hx-station', ctx({ week })));
    const sledText = weeks.flatMap((w) => w.sets).map((s) => s.rationale).join(' ');
    expect(sledText).toContain('Underlaget');
  });

  it('lægger ikke løb på trætte ben ind i basisfasen', () => {
    const base = sportContent('hx-station', ctx({ week: 1 }));
    expect(base.conditioning).toHaveLength(0);
  });

  it('tilføjer løb på trætte ben, når basen er lagt', () => {
    const build = sportContent('hx-station', ctx({
      week: 6,
      phase: sportModel('hyrox').phases[1] as SportSessionContext['phase'],
    }));
    expect(build.conditioning.some((c) => c.name.includes('efter station'))).toBe(true);
  });

  it('falder tilbage på de stationer, der ikke kræver udstyr', () => {
    const part = sportContent('hx-station', ctx({ availableEquipment: ['bodyweight'] }));
    // Burpee broad jumps kræver ingenting; slæde og wall ball gør.
    expect(part.sets.map((s) => s.exerciseId)).toEqual(['burpee_broad_jump']);
    expect(part.issues).toHaveLength(0);
  });

  it('siger fra, hvis ingen station overhovedet kan sættes op', () => {
    const part = sportContent('hx-station', ctx({
      availableEquipment: ['bodyweight'],
      profile: profile({ excludedExerciseIds: ['burpee_broad_jump'] }),
      pain: [{ region: 'knee', score: 6, aggravators: [], updatedAt: NOW }],
    }));
    expect(part.issues.some((i) => i.code === 'EQUIPMENT_INSUFFICIENT')).toBe(true);
    expect(part.sets).toHaveLength(0);
  });

  it('udelader en station, brugeren har smerte i', () => {
    const part = sportContent('hx-station', ctx({
      week: 8,
      pain: [{ region: 'back', score: 6, aggravators: [], updatedAt: NOW }],
    }));
    expect(part.sets.map((s) => s.exerciseId)).not.toContain('sled_pull');
  });
});

describe('HYROX-program ende til ende', () => {
  it('giver en debutant løb hver uge uden en fuld simulation i uge 1', () => {
    const p = planProgram(plan({ history: history({ runKm: 0 }) }));
    const week1 = p.weeks[0]?.days.flatMap((d) => d.session?.conditioning ?? []) ?? [];
    const runMinutes = week1.reduce((s, c) => s + c.minutes, 0);
    // Otte kilometer løb ville tage langt over en time.
    expect(runMinutes).toBeLessThan(60);
    expect(week1.length).toBeGreaterThan(0);
  });

  it('bygger løbevolumen op over forløbet', () => {
    const p = planProgram(plan({ history: history({ runKm: 10 }) }));
    const minutesIn = (week: number): number => (p.weeks[week - 1]?.days ?? [])
      .flatMap((d) => d.session?.conditioning ?? [])
      .filter((c) => c.zone === 'low')
      .reduce((s, c) => s + c.minutes, 0);
    expect(minutesIn(8)).toBeGreaterThanOrEqual(minutesIn(1));
  });

  it('dækker stationer og løb som obligatoriske eksponeringer', () => {
    const p = planProgram(plan());
    p.weeks.filter((w) => !w.assessment).forEach((week) => {
      const covers = week.days.flatMap((d) => d.session?.coversAnchors ?? []);
      expect(covers, `uge ${week.index}`).toContain('hx-station');
      expect(covers, `uge ${week.index}`).toContain('hx-easy-run');
    });
  });
});

describe('CrossFit-sessioner', () => {
  it('vælger den letteste gymnastik uden registreret teknik', () => {
    const part = sportContent('cf-gymnastics', ctx({
      goal: goal({ sport: 'crossfit' }),
      phase: sportModel('crossfit').phases[0] as SportSessionContext['phase'],
    }));
    const ids = part.sets.map((s) => s.exerciseId);
    expect(ids).not.toContain('chest_to_bar');
    expect(ids).not.toContain('hspu');
  });

  it('åbner for sværere gymnastik, når teknikken er registreret', () => {
    const competence = setCompetence(setCompetence([], 'pull_up', 'stable_fatigued'), 'chest_to_bar', 'stable_fatigued');
    const part = sportContent('cf-gymnastics', ctx({
      goal: goal({ sport: 'crossfit' }),
      profile: profile({ competence }),
      phase: sportModel('crossfit').phases[0] as SportSessionContext['phase'],
    }));
    expect(part.sets.map((s) => s.exerciseId)).toContain('chest_to_bar');
  });

  it('kræver registreret teknik for vægtløftning', () => {
    const part = sportContent('cf-weightlifting', ctx({
      goal: goal({ sport: 'crossfit' }),
      phase: sportModel('crossfit').phases[0] as SportSessionContext['phase'],
    }));
    expect(part.issues.some((i) => i.code === 'COMPETENCE_CONFLICT')).toBe(true);
    expect(part.sets).toHaveLength(0);
  });

  it('stopper vægtløftning på hastighed, ikke på udmattelse', () => {
    const competence = setCompetence([], 'hang_power_clean', 'stable_fresh');
    const part = sportContent('cf-weightlifting', ctx({
      goal: goal({ sport: 'crossfit' }),
      profile: profile({ competence }),
      phase: sportModel('crossfit').phases[0] as SportSessionContext['phase'],
    }));
    expect(part.sets[0]?.stopRules.join(' ')).toContain('hastighed');
  });
});

describe('Strongman-sessioner', () => {
  const event = (over: Partial<StrongmanEvent> = {}): StrongmanEvent => ({
    id: 'e1', name: 'Log press', category: 'maxStrength', implement: 'log',
    loadKg: 100, distanceM: null, timeCapSec: 60, reps: 3, ...over,
  });

  it('bygger ingenting uden en eventliste', () => {
    const part = sportContent('sm-event', ctx({ goal: goal({ sport: 'strongman' }) }));
    expect(part.sets).toHaveLength(0);
  });

  it('træner konkurrencens eget event med dens egen vægt', () => {
    const part = sportContent('sm-event', ctx({
      goal: goal({ sport: 'strongman', events: [event()] }),
      phase: sportModel('strongman').phases[0] as SportSessionContext['phase'],
    }));
    expect(part.sets).toHaveLength(1);
    expect(part.sets[0]?.name).toBe('Log press');
    expect(part.sets[0]?.rationale).toContain('log');
    expect(part.sets[0]?.rationale).toContain('100 kg');
  });

  it('nærmer sig konkurrencevægten hen mod realiseringen', () => {
    const base = sportContent('sm-event', ctx({
      goal: goal({ sport: 'strongman', events: [event()] }),
      phase: sportModel('strongman').phases[0] as SportSessionContext['phase'],
    }));
    const real = sportContent('sm-event', ctx({
      goal: goal({ sport: 'strongman', events: [event()] }),
      phase: sportModel('strongman').phases[3] as SportSessionContext['phase'],
    }));
    expect(base.sets[0]?.rationale).toContain('75 %');
    expect(real.sets[0]?.rationale).toContain('100 %');
  });

  it('roterer mellem konkurrencens events over ugerne', () => {
    const events = [event(), event({ id: 'e2', name: 'Yoke walk', category: 'movingLoad', implement: 'yoke' })];
    const w1 = sportContent('sm-event', ctx({ goal: goal({ sport: 'strongman', events }), week: 1 }));
    const w2 = sportContent('sm-event', ctx({ goal: goal({ sport: 'strongman', events }), week: 2 }));
    expect(w1.sets[0]?.name).not.toBe(w2.sets[0]?.name);
  });

  it('minder om, at træningsredskabet kan afvige fra konkurrencens', () => {
    const part = sportContent('sm-event', ctx({
      goal: goal({ sport: 'strongman', events: [event()] }),
    }));
    expect(part.sets[0]?.rationale).toContain('ikke det samme som konkurrencens');
  });
});

describe('sportsindholdet er dansk og forklaret', () => {
  it('bruger æ, ø og å og aldrig translittereringer', () => {
    const p = planProgram(plan());
    const text = JSON.stringify(sessions(p));
    ['doedloeft', 'baenkpres', 'oevelser', 'kropsvaegt', 'loeb', 'staerk']
      .forEach((bad) => expect(text.toLowerCase()).not.toContain(bad));
  });

  it('forklarer hvert sportsspecifikt sæt', () => {
    const p = planProgram(plan());
    sessions(p).flatMap((s) => s.anchors).forEach((set) => {
      expect(set.rationale.length, set.name).toBeGreaterThan(20);
    });
  });
});
