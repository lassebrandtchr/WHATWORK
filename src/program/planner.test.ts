import { describe, expect, it } from 'vitest';
import { allocateStress, placeAnchors, planProgram } from './planner.js';
import type { PlanInput } from './planner.js';
import { sessionToWorkout } from './session.js';
import { adaptProgram, applyTopSetResult } from './adapter.js';
import { adherence, decideWeek, advanceDoubleProgression } from './progression.js';
import type { WeeklyActuals } from './progression.js';
import { chooseAssistance, defaultAssistanceFor, weakPoint } from './assistance.js';
import { benchmarkFromSet } from '../domain/benchmarks.js';
import { setCompetence } from '../domain/competence.js';
import { emptyScreening } from '../domain/safety.js';
import { CURRENT_HYROX_VERSION } from '../domain/ruleSets.js';
import type { AthleteProfile, Benchmark, Goal, TrainingHistorySummary } from '../domain/types.js';
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

const history = (over: Partial<TrainingHistorySummary> = {}): TrainingHistorySummary => ({
  lookbackDays: 28, sessions: 14,
  hardSetsByPattern: { squat: 20, hinge: 16, press: 18, pull: 18 },
  runKm: 12, highIntensityMinutes: 60, completedPerWeek: 3.5, ...over,
});

const goal = (over: Partial<Goal> = {}): Goal => ({
  sport: 'strength4', primary: 'Blive stærkere', secondary: [], eventDate: null,
  ruleSet: null, baselineStrategy: 'known', ...over,
});

function fullBenchmarks(): Benchmark[] {
  return [
    benchmarkFromSet({ subjectId: 'squat', protocol: 'topSetRpe', loadKg: 150, reps: 3, rpe: 8, date: NOW }),
    benchmarkFromSet({ subjectId: 'bench', protocol: 'topSetRpe', loadKg: 100, reps: 3, rpe: 8, date: NOW }),
    benchmarkFromSet({ subjectId: 'deadlift', protocol: 'topSetRpe', loadKg: 180, reps: 3, rpe: 8, date: NOW }),
    benchmarkFromSet({ subjectId: 'ohp', protocol: 'topSetRpe', loadKg: 60, reps: 3, rpe: 8, date: NOW }),
  ];
}

const plan = (over: Partial<PlanInput> = {}): PlanInput => ({
  profile: profile(),
  goal: goal(),
  benchmarks: fullBenchmarks(),
  history: history(),
  weakPoints: [],
  availableEquipment: EQUIPMENT,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  bars: [20, 15],
  weeks: 8, daysPerWeek: 4, minutes: 60,
  seed: 12345, now: NOW,
  ...over,
});

const allSessions = (p: ReturnType<typeof planProgram>): ProgramSession[] =>
  p.weeks.flatMap((w) => w.days.map((d) => d.session).filter((s): s is ProgramSession => Boolean(s)));

describe('planProgram — grundstruktur', () => {
  it('bygger det ønskede antal uger og dage', () => {
    const p = planProgram(plan());
    expect(p.weeks).toHaveLength(8);
    p.weeks.forEach((w) => expect(w.days).toHaveLength(4));
  });

  it('gemmer provenance med seed og alle versioner', () => {
    const p = planProgram(plan());
    expect(p.provenance.seed).toBe(12345);
    expect(p.provenance.generatorVersion).toBeTruthy();
    expect(p.provenance.domainVersion).toBeTruthy();
    expect(p.provenance.ontologyVersion).toBeTruthy();
    expect(p.provenance.exerciseLibraryVersion).toBeTruthy();
  });

  it('går gennem navngivne faser', () => {
    const names = [...new Set(planProgram(plan()).weeks.map((w) => w.phaseName))];
    expect(names.length).toBeGreaterThan(1);
  });
});

/* ---------- Acceptancetests fra specifikationen ---------- */

describe('acceptance: strength4-anchors', () => {
  it('planlægger squat, bænkpres, dødløft og overhead press hver uge', () => {
    const p = planProgram(plan());
    p.weeks.forEach((week) => {
      const ids = week.days.flatMap((d) => d.session?.anchors.map((a) => a.exerciseId) ?? []);
      ['back_squat', 'bench_press', 'deadlift', 'strict_press'].forEach((lift) => {
        expect(ids, `uge ${week.index} mangler ${lift}`).toContain(lift);
      });
    });
  });

  it('rejser ingen MISSING_ANCHOR-fejl, når alle fire løft er dækket', () => {
    const p = planProgram(plan());
    const codes = p.weeks.flatMap((w) => w.issues.map((i) => i.code));
    expect(codes).not.toContain('MISSING_ANCHOR');
  });

  it('lægger aldrig to tunge løft på samme dag, når der er dage nok', () => {
    const p = planProgram(plan({ daysPerWeek: 4 }));
    p.weeks.forEach((week) => {
      week.days.forEach((day) => {
        const tops = day.session?.anchors.filter((a) => a.type === 'top') ?? [];
        expect(tops.length).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('acceptance: begynder uden RM', () => {
  it('opretter en indkøringsuge og opfinder ikke kilo', () => {
    const p = planProgram(plan({ benchmarks: [], weeks: 6 }));
    expect(p.assessment).not.toBeNull();
    expect(p.weeks[0]?.assessment).toBe(true);
    // Ingen belastning må være sat uden grundlag.
    allSessions(p).forEach((s) => {
      [...s.anchors, ...s.assistance].forEach((set) => {
        if (set.load) expect(set.load.provenance.basis).not.toBe('userSet');
      });
    });
  });

  it('styres af anstrengelse i stedet for procent uden training max', () => {
    const p = planProgram(plan({ benchmarks: [] }));
    const tops = allSessions(p).flatMap((s) => s.anchors.filter((a) => a.type === 'top'));
    expect(tops.length).toBeGreaterThan(0);
    tops.forEach((t) => {
      // Ingen kilo uden grundlag, men et mål for hvor hårdt sættet skal føles.
      expect(t.load).toBeNull();
      expect(t.percentBasis).toBe('none');
      expect(t.targetRpe).not.toBeNull();
    });
  });

  it('giver en konkret optrapning i indkøringsugen frem for et vagt "find dine tal"', () => {
    const p = planProgram(plan({ benchmarks: [] }));
    const week1 = p.weeks[0];
    expect(week1?.assessment).toBe(true);

    const session = week1?.days.find((d) => d.session?.anchors.some((a) => a.type === 'top'))?.session;
    expect(session).toBeDefined();

    // Optrapningen: tre lettere sæt før dagens måling.
    const ramp = session?.anchors.filter((a) => a.type === 'warmup') ?? [];
    expect(ramp.map((r) => r.reps)).toEqual([5, 3, 2]);

    const top = session?.anchors.find((a) => a.type === 'top');
    expect(top?.reps).toBe(3);
    expect(top?.targetRir).toBe(2);
    // Instruktionen skal kunne følges i træningscenteret uden at slå noget op.
    expect(top?.rationale).toContain('3 gentagelser');
    expect(top?.rationale).toContain('to gentagelser tilbage');
    expect(top?.rationale).toContain('Registrér');
  });
});

describe('acceptance: eliteprofil uden benchmarks', () => {
  it('får stadig en indkøringsuge — etiketten "elite" er ikke data', () => {
    const p = planProgram(plan({ profile: profile({ level: 5 }), benchmarks: [] }));
    expect(p.assessment).not.toBeNull();
    expect(p.assessment?.missing.length).toBeGreaterThan(0);
  });
});

describe('acceptance: alle belastninger har et grundlag', () => {
  it('har provenance og afrunding på hver eneste vægt', () => {
    const p = planProgram(plan());
    allSessions(p).forEach((s) => {
      [...s.warmup, ...s.anchors, ...s.assistance].forEach((set) => {
        if (!set.load) return;
        expect(set.load.provenance.basis).toBeTruthy();
        expect(set.load.provenance.explanation.length).toBeGreaterThan(10);
        expect(set.load.provenance.roundingKg).toBeGreaterThan(0);
      });
    });
  });

  it('runder til hele 2,5 kg', () => {
    const p = planProgram(plan());
    allSessions(p).forEach((s) => {
      s.anchors.forEach((set) => {
        if (!set.load) return;
        expect(Math.round(set.load.targetKg * 10) % 25).toBe(0);
      });
    });
  });

  it('regner procenter af training max, ikke af 1RM', () => {
    const p = planProgram(plan());
    const withLoad = allSessions(p).flatMap((s) => s.anchors).filter((a) => a.load);
    expect(withLoad.length).toBeGreaterThan(0);
    withLoad.forEach((a) => {
      expect(a.percentBasis).toBe('trainingMax');
      expect(a.load?.provenance.explanation).toContain('training max');
    });
  });
});

describe('acceptance: 45-minutters styrkepas', () => {
  it('bevarer realistiske pauser og trimmer assistance i stedet', () => {
    const short = planProgram(plan({ minutes: 45 }));
    const long = planProgram(plan({ minutes: 75 }));
    const assistCount = (p: ReturnType<typeof planProgram>): number =>
      allSessions(p).reduce((s, x) => s + x.assistance.length, 0);

    expect(assistCount(short)).toBeLessThan(assistCount(long));
    allSessions(short).forEach((s) => {
      s.anchors.filter((a) => a.type === 'top').forEach((a) => {
        expect(a.restSeconds[0]).toBeGreaterThanOrEqual(180);
      });
    });
  });
});

describe('acceptance: skuldersmerte med dips ekskluderet', () => {
  it('programmerer hverken dips eller en højrisiko-erstatning', () => {
    const p = planProgram(plan({
      profile: profile({
        excludedExerciseIds: ['dip'],
        care: ['shoulder'],
        screening: {
          ...emptyScreening(), status: 'cleared', answeredAt: NOW,
          pain: [{ region: 'shoulder', score: 3, aggravators: ['dip'], updatedAt: NOW }],
        },
      }),
    }));
    const ids = allSessions(p).flatMap((s) => [...s.anchors, ...s.assistance].map((x) => x.exerciseId));
    expect(ids).not.toContain('dip');
    expect(ids).not.toContain('hspu');
  });

  it('forklarer, hvorfor bænkpres bliver berørt af skuldersmerte', () => {
    const p = planProgram(plan({
      profile: profile({
        care: ['shoulder'],
        screening: {
          ...emptyScreening(), status: 'cleared', answeredAt: NOW,
          pain: [{ region: 'shoulder', score: 5, aggravators: [], updatedAt: NOW }],
        },
      }),
    }));
    const codes = p.weeks.flatMap((w) => w.issues.map((i) => i.code));
    expect(codes).toContain('PAIN_CONFLICT');
  });
});

describe('acceptance: HYROX', () => {
  it('gør løb obligatorisk hver uge', () => {
    const p = planProgram(plan({
      goal: goal({ sport: 'hyrox', division: 'open_men' }),
      benchmarks: [],
    }));
    p.weeks.filter((w) => !w.assessment).forEach((week) => {
      const covers = week.days.flatMap((d) => d.session?.coversAnchors ?? []);
      expect(covers.some((c) => c.startsWith('hx-'))).toBe(true);
    });
  });

  it('advarer om et ubekræftet regelsnapshot i stedet for at foregive autoritet', () => {
    const p = planProgram(plan({
      goal: goal({
        sport: 'hyrox',
        ruleSet: {
          organization: 'HYROX', version: CURRENT_HYROX_VERSION,
          checkedAt: '2026-08-09', sourceUrl: 'https://hyrox.com/rulebook/',
        },
      }),
    }));
    expect(p.issues.some((i) => i.code === 'RULESET_UNVERIFIED')).toBe(true);
  });

  it('afviser en ukendt regelversion i stedet for at falde tilbage', () => {
    const p = planProgram(plan({
      goal: goal({
        sport: 'hyrox',
        ruleSet: {
          organization: 'HYROX', version: '2099-findes-ikke',
          checkedAt: '2099-01-01', sourceUrl: 'x',
        },
      }),
    }));
    expect(p.issues.some((i) => i.code === 'INVALID_RULESET')).toBe(true);
  });

  it('bygger to identiske programmer på samme regelversion, uanset hvornår de bygges', () => {
    const a = planProgram(plan({ goal: goal({ sport: 'hyrox' }), seed: 42 }));
    const b = planProgram(plan({ goal: goal({ sport: 'hyrox' }), seed: 42 }));
    expect(JSON.stringify(a.weeks)).toBe(JSON.stringify(b.weeks));
  });
});

describe('acceptance: strongman uden eventliste', () => {
  it('opfinder ikke en generisk contest prep', () => {
    const p = planProgram(plan({ goal: goal({ sport: 'strongman' }), weeks: 12 }));
    const anchorIssue = p.issues.find((i) => i.code === 'MISSING_ANCHOR');
    expect(anchorIssue).toBeDefined();
    expect(anchorIssue?.fix).toContain('events');
  });

  it('tilføjer eventarbejde, når listen findes', () => {
    const p = planProgram(plan({
      goal: goal({
        sport: 'strongman',
        events: [{
          id: 'e1', name: 'Log press', category: 'maxStrength', implement: 'log',
          loadKg: 100, distanceM: null, timeCapSec: 60, reps: null,
        }],
      }),
      weeks: 12,
    }));
    expect(p.issues.some((i) => i.code === 'MISSING_ANCHOR' && i.scope === 'goal')).toBe(false);
  });
});

describe('acceptance: deterministisk seed', () => {
  it('giver samme program og samme forklaring ved samme seed og version', () => {
    const a = planProgram(plan({ seed: 777 }));
    const b = planProgram(plan({ seed: 777 }));
    expect(JSON.stringify(a.weeks)).toBe(JSON.stringify(b.weeks));
    expect(a.explanation).toEqual(b.explanation);
  });

  it('giver forskellige programmer ved forskellig seed', () => {
    const a = planProgram(plan({ seed: 1, goal: goal({ sport: 'functional' }) }));
    const b = planProgram(plan({ seed: 999999, goal: goal({ sport: 'functional' }) }));
    expect(JSON.stringify(a.weeks)).not.toBe(JSON.stringify(b.weeks));
  });
});

describe('acceptance: alarmsymptom', () => {
  it('bygger intet program og henviser videre', () => {
    const p = planProgram(plan({
      profile: profile({
        screening: { ...emptyScreening(), status: 'refer', flags: ['chest_pain'], answeredAt: NOW },
      }),
    }));
    expect(p.weeks).toHaveLength(0);
    expect(p.explanation[0]).toContain('alarmsymptom');
  });
});

describe('deload og taper', () => {
  it('lægger en roligere uge ind i et længere forløb', () => {
    const p = planProgram(plan({ weeks: 12 }));
    expect(p.weeks.some((w) => w.deload)).toBe(true);
  });

  it('lægger taper til sidst, når der er en eventdato', () => {
    const p = planProgram(plan({ weeks: 12, goal: goal({ eventDate: '2026-11-15' }) }));
    expect(p.weeks[p.weeks.length - 1]?.taper).toBe(true);
  });

  it('sænker volumen i den roligere uge', () => {
    const p = planProgram(plan({ weeks: 12 }));
    const deload = p.weeks.find((w) => w.deload);
    const normal = p.weeks.find((w) => !w.deload && !w.assessment && !w.taper);
    expect(deload?.stress.hardSets).toBeLessThan(normal?.stress.hardSets ?? 0);
  });
});

describe('stressbudget og anchor-placering', () => {
  it('udleder budgettet af den faktiske historik', () => {
    const low = allocateStress(history({ hardSetsByPattern: { squat: 8 } }), 4, 60, 1);
    const high = allocateStress(history({ hardSetsByPattern: { squat: 80, press: 80 } }), 4, 60, 1);
    expect(high.hardSetsPerWeek).toBeGreaterThan(low.hardSetsPerWeek);
  });

  it('holder stigningen under 30 % uanset fasens ønske', () => {
    const h = history({ hardSetsByPattern: { squat: 40 } });
    const base = allocateStress(h, 4, 60, 1);
    const aggressive = allocateStress(h, 4, 60, 2);
    expect(aggressive.hardSetsPerWeek).toBeLessThanOrEqual(Math.round(base.hardSetsPerWeek * 1.31));
  });

  it('spreder tunge anchors ud over ugen', () => {
    const anchors = [
      { id: 'a', label: 'A', kind: 'strength' as const, minPerWeek: 1, mandatory: true, rationale: '' },
      { id: 'b', label: 'B', kind: 'strength' as const, minPerWeek: 1, mandatory: true, rationale: '' },
      { id: 'c', label: 'C', kind: 'conditioning' as const, minPerWeek: 1, mandatory: false, rationale: '' },
    ];
    const days = placeAnchors(anchors, 4);
    days.forEach((d) => {
      expect(d.filter((a) => a.kind === 'strength').length).toBeLessThanOrEqual(1);
    });
  });
});

describe('assistance-regelmotoren', () => {
  const ctx = {
    profile: profile(),
    pain: [],
    availableEquipment: EQUIPMENT,
    usedExerciseIds: [] as string[],
    saturatedGroups: [] as string[],
    fatigueBudget: 8,
    previous: [] as string[],
    weeksOnPrevious: 0,
  };

  it('sporer hvert valg til et weak point', () => {
    const choices = chooseAssistance([weakPoint('bench_lockout', 0.8)], 2, ctx);
    expect(choices.length).toBeGreaterThan(0);
    choices.forEach((c) => expect(c.rationale.length).toBeGreaterThan(20));
    expect(choices[0]?.weakPoint).toBe('bench_lockout');
  });

  it('vælger en bred lavrisiko-variant ved lav confidence', () => {
    const low = chooseAssistance([weakPoint('squat_bottom', 0.2)], 1, ctx);
    expect(low[0]?.rationale).toContain('usikker');
  });

  it('gætter ikke på en svaghed uden registrering', () => {
    const d = defaultAssistanceFor('squat', ctx, 2);
    expect(d.length).toBeGreaterThan(0);
    d.forEach((c) => {
      expect(c.weakPoint).toBe('none');
      expect(c.rationale).toContain('gættes ikke');
    });
  });

  it('beholder sidste uges assistance i mindst tre uger', () => {
    const kept = chooseAssistance([], 2, { ...ctx, previous: ['plank'], weeksOnPrevious: 1 });
    expect(kept.find((c) => c.exerciseId === 'plank')?.kept).toBe(true);
  });

  it('vælger aldrig en øvelse, der allerede er i passet', () => {
    const choices = chooseAssistance([weakPoint('trunk', 0.8)], 3, {
      ...ctx, usedExerciseIds: ['plank', 'hollow_hold'],
    });
    expect(choices.map((c) => c.exerciseId)).not.toContain('plank');
  });

  it('respekterer smerte', () => {
    const choices = chooseAssistance([weakPoint('bench_lockout', 0.9)], 3, {
      ...ctx,
      pain: [{ region: 'shoulder' as const, score: 5, aggravators: [], updatedAt: NOW }],
    });
    expect(choices.map((c) => c.exerciseId)).not.toContain('dip');
  });

  it('vælger ikke high-skill uden dokumenteret kompetence', () => {
    const choices = chooseAssistance([weakPoint('ohp_lockout', 0.9)], 3, ctx);
    expect(choices.map((c) => c.exerciseId)).not.toContain('hspu');
  });

  it('åbner for high-skill, når kompetencen er registreret', () => {
    // Diamond push-up er førstevalget for lockout; uden den falder valget på dips,
    // men kun hvis kompetencen faktisk er registreret.
    const base = { ...ctx, profile: profile({ excludedExerciseIds: ['diamond_push_up'] }) };
    expect(chooseAssistance([weakPoint('bench_lockout', 0.9)], 1, base)
      .map((c) => c.exerciseId)).not.toContain('dip');

    const withComp = {
      ...base,
      profile: profile({
        excludedExerciseIds: ['diamond_push_up'],
        competence: setCompetence([], 'dip', 'stable_fresh'),
      }),
    };
    expect(chooseAssistance([weakPoint('bench_lockout', 0.9)], 1, withComp)
      .map((c) => c.exerciseId)).toContain('dip');
  });
});

describe('ugentlig beslutning', () => {
  const actuals = (over: Partial<WeeklyActuals> = {}): WeeklyActuals => ({
    plannedSessions: 4, completedSessions: 4, rescheduledSessions: 0,
    rpeOvershoots: 0, missedReps: 0, maxPain: 0, e1rmChangePct: 1,
    persistentSoreness: false, poorSleepOrStress: false, blockEnd: false,
    hasNewExercise: false, ...over,
  });

  it('progresserer, når målene blev ramt', () => {
    const o = decideWeek(actuals());
    expect(o.decision).toBe('progress');
    expect(o.loadFactor).toBeGreaterThan(1);
    expect(o.triggers.length).toBeGreaterThan(0);
  });

  it('ændrer kun én variabel ad gangen', () => {
    const o = decideWeek(actuals());
    expect(o.variable).toBe('load');
    expect(o.volumeFactor).toBe(1);
  });

  it('holder ved blandet signal', () => {
    expect(decideWeek(actuals({ rpeOvershoots: 2 })).decision).toBe('hold');
  });

  it('holder en ny øvelse uændret, til der er noget at måle på', () => {
    expect(decideWeek(actuals({ hasNewExercise: true })).decision).toBe('hold');
  });

  it('deloader ved to eller flere samtidige signaler', () => {
    const o = decideWeek(actuals({ persistentSoreness: true, poorSleepOrStress: true }));
    expect(o.decision).toBe('deload');
    expect(o.volumeFactor).toBeLessThan(1);
    expect(o.triggers.length).toBeGreaterThanOrEqual(2);
  });

  it('regresserer ved smerte på 4 eller derover', () => {
    const o = decideWeek(actuals({ maxPain: 5 }));
    expect(o.decision).toBe('regress');
    expect(o.issues.some((i) => i.code === 'PAIN_CONFLICT')).toBe(true);
  });

  it('skriver planen om i stedet for at lægge mere progression på ved lav adherence', () => {
    const o = decideWeek(actuals({ plannedSessions: 4, completedSessions: 2 }));
    expect(o.decision).toBe('rescope');
    expect(o.suggestedSessions).toBe(2);
    expect(o.loadFactor).toBe(1);
  });

  it('tæller flyttede pas som gennemførbare, ikke som missede', () => {
    expect(adherence(actuals({ plannedSessions: 4, completedSessions: 3, rescheduledSessions: 1 }))).toBe(1);
  });

  it('forklarer altid hvilke actuals der udløste beslutningen', () => {
    [actuals(), actuals({ maxPain: 5 }), actuals({ persistentSoreness: true, poorSleepOrStress: true })]
      .forEach((a) => {
        const o = decideWeek(a);
        expect(o.triggers.length).toBeGreaterThan(0);
        expect(o.explanation.length).toBeGreaterThan(20);
      });
  });
});

describe('double progression', () => {
  it('øger reps før belastning', () => {
    const s = advanceDoubleProgression({ reps: 8, repCeiling: 12, loadFactor: 1 }, true, 8);
    expect(s.reps).toBe(9);
    expect(s.loadFactor).toBe(1);
  });

  it('øger belastning og nulstiller reps ved loftet', () => {
    const s = advanceDoubleProgression({ reps: 12, repCeiling: 12, loadFactor: 1 }, true, 8);
    expect(s.reps).toBe(8);
    expect(s.loadFactor).toBeGreaterThan(1);
  });

  it('gentager uændret, når reps ikke blev nået', () => {
    const s = advanceDoubleProgression({ reps: 10, repCeiling: 12, loadFactor: 1 }, false, 8);
    expect(s.reps).toBe(10);
    expect(s.loadFactor).toBe(1);
  });
});

describe('adaptation', () => {
  const actuals = (over: Partial<WeeklyActuals> = {}): WeeklyActuals => ({
    plannedSessions: 4, completedSessions: 4, rescheduledSessions: 0,
    rpeOvershoots: 0, missedReps: 0, maxPain: 0, e1rmChangePct: 1,
    persistentSoreness: false, poorSleepOrStress: false, blockEnd: false,
    hasNewExercise: false, ...over,
  });

  it('rører ikke gennemførte uger', () => {
    const p = planProgram(plan());
    const before = JSON.stringify(p.weeks[0]);
    const r = adaptProgram(p, 1, actuals({ persistentSoreness: true, poorSleepOrStress: true }));
    expect(JSON.stringify(r.program.weeks[0])).toBe(before);
  });

  it('justerer kun den førstkommende uge', () => {
    const p = planProgram(plan());
    const before = JSON.stringify(p.weeks[3]);
    const r = adaptProgram(p, 1, actuals());
    expect(JSON.stringify(r.program.weeks[3])).toBe(before);
    expect(JSON.stringify(r.program.weeks[1])).not.toBe(JSON.stringify(p.weeks[1]));
  });

  it('øger programversionen, så en tilpasning kan spores', () => {
    const p = planProgram(plan());
    expect(adaptProgram(p, 1, actuals()).program.version).toBe(p.version + 1);
  });

  it('skriver ugen om til færre pas ved lav adherence', () => {
    const p = planProgram(plan());
    const r = adaptProgram(p, 1, actuals({ completedSessions: 2 }));
    expect(r.program.weeks[1]?.days).toHaveLength(2);
    expect(r.changes.join(' ')).toContain('2 pas');
  });

  it('markerer ugen som deload og forklarer hvorfor', () => {
    const p = planProgram(plan());
    const r = adaptProgram(p, 1, actuals({ persistentSoreness: true, poorSleepOrStress: true }));
    expect(r.program.weeks[1]?.deload).toBe(true);
    expect(r.program.weeks[1]?.rationale).toContain('ømhed');
  });
});

describe('top-sæt kalibrerer backoff', () => {
  it('sænker backoff-belastningen ved overshoot', () => {
    const p = planProgram(plan());
    const session = allSessions(p).find((s) => s.anchors.some((a) => a.type === 'top' && a.load));
    const top = session?.anchors.find((a) => a.type === 'top');
    const backoffBefore = session?.anchors.find((a) => a.type === 'backoff');
    expect(top).toBeDefined();

    const r = applyTopSetResult(session?.anchors ?? [], top?.id as string, { actualRpe: (top?.targetRpe ?? 8) + 2 });
    const backoffAfter = r.sets.find((s) => s.type === 'backoff');
    expect(backoffAfter?.load?.targetKg).toBeLessThan(backoffBefore?.load?.targetKg ?? 0);
    expect(backoffAfter?.sets).toBeLessThan(backoffBefore?.sets ?? 0);
  });

  it('stopper bevægelsen ved smerte', () => {
    const p = planProgram(plan());
    const session = allSessions(p).find((s) => s.anchors.some((a) => a.type === 'top'));
    const top = session?.anchors.find((a) => a.type === 'top');
    const r = applyTopSetResult(session?.anchors ?? [], top?.id as string, { actualRpe: 8, painScore: 6 });
    expect(r.sets.filter((s) => s.type === 'backoff' && s.exerciseId === top?.exerciseId)).toHaveLength(0);
    expect(r.explanation).toContain('Smerte');
  });

  it('holder planen, når RPE ramte målet', () => {
    const p = planProgram(plan());
    const session = allSessions(p).find((s) => s.anchors.some((a) => a.type === 'top' && a.load));
    const top = session?.anchors.find((a) => a.type === 'top');
    const before = session?.anchors.find((a) => a.type === 'backoff')?.load?.targetKg;
    const r = applyTopSetResult(session?.anchors ?? [], top?.id as string, { actualRpe: top?.targetRpe ?? 8 });
    expect(r.sets.find((s) => s.type === 'backoff')?.load?.targetKg).toBe(before);
  });
});

describe('sessionToWorkout', () => {
  const ctx = {
    seed: 1, profile: 'm' as const, bodyweight: 82, level: 3,
    equipment: EQUIPMENT, plates: [25, 20, 15, 10, 5, 2.5, 1.25], bars: [20, 15],
    minutes: 60, createdAt: NOW,
  };

  it('bygger en workout, skærmene kan vise', () => {
    const p = planProgram(plan());
    const session = allSessions(p)[0];
    const w = sessionToWorkout(session as ProgramSession, ctx);
    expect(w.blocks.length).toBeGreaterThan(0);
    expect(w.estimatedMinutes).toBeGreaterThan(0);
    expect(w.explanation.length).toBeGreaterThan(0);
    expect(w.participants).toBe(1);
  });

  it('viser belastning med interval og skiveplan', () => {
    const p = planProgram(plan());
    const session = allSessions(p).find((s) => s.anchors.some((a) => a.load));
    const w = sessionToWorkout(session as ProgramSession, ctx);
    const loaded = w.blocks
      .flatMap((b) => b.movements)
      .find((m) => m.targets[0]?.load);
    expect(loaded?.targets[0]?.load?.text).toContain('kg');
    expect(loaded?.targets[0]?.load?.plates).toBeDefined();
  });

  it('bruger komma som decimaltegn i danske vægte', () => {
    const p = planProgram(plan());
    const w = sessionToWorkout(allSessions(p)[0] as ProgramSession, ctx);
    const text = w.blocks.flatMap((b) => b.movements).map((m) => m.targets[0]?.load?.text ?? '').join(' ');
    expect(text).not.toMatch(/\d\.\d/);
  });

  it('siger eksplicit, at passet er planlagt frem for tilfældigt valgt', () => {
    const p = planProgram(plan());
    const w = sessionToWorkout(allSessions(p)[0] as ProgramSession, ctx);
    expect(w.mix.note).toContain('ikke valgt blandt tilfældige');
  });
});

describe('dansk sprog', () => {
  it('bruger æ, ø og å og aldrig translittereringer', () => {
    const p = planProgram(plan({ weeks: 4 }));
    const text = JSON.stringify({
      explanation: p.explanation,
      weeks: p.weeks.map((w) => ({ r: w.rationale, i: w.issues })),
      sessions: allSessions(p).map((s) => ({
        stimulus: s.stimulus,
        explanation: s.explanation,
        sets: [...s.anchors, ...s.assistance].map((x) => ({ n: x.name, r: x.rationale, s: x.stopRules })),
      })),
    });
    ['doedloeft', 'baenkpres', 'oevelser', 'kropsvaegt', 'maal', 'styrkeloeft', 'traening']
      .forEach((bad) => expect(text.toLowerCase()).not.toContain(bad));
  });
});
