import { describe, expect, it } from 'vitest';
import {
  COUNTS_AS_TRAINING, SESSION_STATE_LABELS, comparabilityKey, countsAsTraining,
  createSession, emptyActual, isComparable, repeatSession, reviseSession,
} from './history.js';
import type { SessionRecord, SessionState } from './history.js';
import {
  adherenceMetric, dataQuality, effortAccuracy, groupByComparability,
  hardSetsMetric, strengthTrend, summarise,
} from './stats.js';
import { METRIC_VERSION } from './versions.js';

const provenance = {
  generatorVersion: 'v3', domainVersion: 'v3', ontologyVersion: 'v3',
  exerciseLibraryVersion: 'v3', rulesVersion: 'v3', ruleVersions: {}, seed: 1,
};

const session = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  ...createSession({ sourceMode: 'quick-wod', state: 'completed', provenance }),
  ...over,
});

describe('sessionsmodellen', () => {
  it('regner kun gennemførte pas som træning', () => {
    expect(countsAsTraining('completed')).toBe(true);
    (['generated', 'saved', 'scheduled', 'aborted', 'skipped'] as SessionState[])
      .forEach((s) => expect(countsAsTraining(s), s).toBe(false));
  });

  it('har en dansk etiket til hver tilstand', () => {
    Object.values(SESSION_STATE_LABELS).forEach((label) => {
      expect(label.length).toBeGreaterThan(2);
    });
    expect(COUNTS_AS_TRAINING).toEqual(['completed']);
  });

  it('giver hver session sit eget id', () => {
    const a = createSession({ sourceMode: 'quick-wod', state: 'saved', provenance });
    const b = createSession({ sourceMode: 'quick-wod', state: 'saved', provenance });
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  it('gemmer motorversion og seed, så et pas kan genskabes', () => {
    const s = createSession({ sourceMode: 'program', state: 'saved', provenance });
    expect(s.provenance.seed).toBe(1);
    expect(s.provenance.generatorVersion).toBe('v3');
  });
});

describe('revisioner', () => {
  it('overskriver ikke, men lægger en revision på', () => {
    const original = session({ feedback: { sessionRpe: 6, painBefore: null, painAfter: null, notes: '' } });
    const revised = reviseSession(
      original,
      { feedback: { ...original.feedback, sessionRpe: 8 } },
      'Rettet anstrengelse',
    );
    expect(revised.revisions).toHaveLength(1);
    expect(revised.revisions[0]?.reason).toBe('Rettet anstrengelse');
    // Den oprindelige post er urørt.
    expect(original.feedback.sessionRpe).toBe(6);
    expect(original.revisions).toHaveLength(0);
  });

  it('tæller revisioner op', () => {
    let s = session();
    s = reviseSession(s, {}, 'en');
    s = reviseSession(s, {}, 'to');
    expect(s.revisions.map((r) => r.revision)).toEqual([1, 2]);
  });
});

describe('kør igen', () => {
  it('opretter en ny session og bevarer originalen', () => {
    const original = session({
      actual: { ...emptyActual(), score: '12 runder', completionPct: 100 },
    });
    const copy = repeatSession(original);

    expect(copy.sessionId).not.toBe(original.sessionId);
    expect(copy.state).toBe('generated');
    expect(copy.actual.score).toBe('');
    // Originalen er uændret.
    expect(original.actual.score).toBe('12 runder');
    expect(original.state).toBe('completed');
  });
});

describe('sammenlignelighed', () => {
  it('giver kun standardiserede workouts en nøgle', () => {
    const movements = [{ exerciseId: 'thruster', reps: 21, loadKg: 43 }];
    expect(comparabilityKey({ format: 'fortime', movements, minutes: 12, standardised: true })).toBeTruthy();
    expect(comparabilityKey({ format: 'fortime', movements, minutes: 12, standardised: false })).toBeNull();
  });

  it('giver samme nøgle uanset rækkefølgen af øvelser', () => {
    const a = comparabilityKey({
      format: 'fortime', minutes: 12, standardised: true,
      movements: [{ exerciseId: 'a', reps: 1, loadKg: null }, { exerciseId: 'b', reps: 2, loadKg: null }],
    });
    const b = comparabilityKey({
      format: 'fortime', minutes: 12, standardised: true,
      movements: [{ exerciseId: 'b', reps: 2, loadKg: null }, { exerciseId: 'a', reps: 1, loadKg: null }],
    });
    expect(a).toBe(b);
  });

  it('sammenligner ikke to tilfældige workouts uden nøgle', () => {
    const a = session({ wodRef: { stimulus: 'x', format: 'amrap', comparabilityKey: null } });
    const b = session({ wodRef: { stimulus: 'y', format: 'amrap', comparabilityKey: null } });
    expect(isComparable(a, b)).toBe(false);
  });

  it('sammenligner ikke på tværs af regelversioner', () => {
    const key = 'fortime|12|thruster:21:43';
    const a = session({ wodRef: { stimulus: 'x', format: 'fortime', comparabilityKey: key } });
    const b = session({
      wodRef: { stimulus: 'x', format: 'fortime', comparabilityKey: key },
      provenance: { ...provenance, ruleVersions: { HYROX: '26/27' } },
    });
    expect(isComparable(a, b)).toBe(false);
  });

  it('sammenligner to ens workouts på samme regelversion', () => {
    const key = 'fortime|12|thruster:21:43';
    const a = session({ wodRef: { stimulus: 'x', format: 'fortime', comparabilityKey: key } });
    const b = session({ wodRef: { stimulus: 'x', format: 'fortime', comparabilityKey: key } });
    expect(isComparable(a, b)).toBe(true);
  });
});

/* ---------- Statistik ---------- */

describe('statistik: gennemførelse', () => {
  it('tæller ikke en gemt, men ikke gennemført workout som træning', () => {
    const m = adherenceMetric([
      session({ state: 'completed' }),
      session({ state: 'saved' }),
    ]);
    expect(m.value).toBe(0.5);
  });

  it('regner ikke planlagte og byggede pas med i nævneren', () => {
    const m = adherenceMetric([
      session({ state: 'completed' }),
      session({ state: 'scheduled' }),
      session({ state: 'generated' }),
    ]);
    expect(m.value).toBe(1);
    expect(m.sampleSize).toBe(1);
  });

  it('gemmer et afbrudt pas, men tæller det ikke som gennemført', () => {
    const m = adherenceMetric([session({ state: 'completed' }), session({ state: 'aborted' })]);
    expect(m.value).toBe(0.5);
  });

  it('siger til, når planen er for stor til ugen', () => {
    const m = adherenceMetric([
      session({ state: 'completed' }),
      session({ state: 'skipped' }),
      session({ state: 'skipped' }),
    ]);
    expect(m.observation).toContain('tyder på');
  });

  it('formulerer sig som observation, ikke som årsag', () => {
    const m = adherenceMetric([session()]);
    expect(m.observation).not.toMatch(/fordi|derfor|skyldes/i);
  });
});

describe('statistik: hårde sæt', () => {
  const withSets = (sets: { rpe: number | null; rir: number | null }[]): SessionRecord => session({
    actual: {
      ...emptyActual(),
      sets: sets.map((s, i) => ({
        exerciseId: 'back_squat', setIndex: i, loadKg: 100, reps: 5, rpe: s.rpe, rir: s.rir,
      })),
    },
  });

  it('tæller kun sæt, der faktisk var hårde', () => {
    const m = hardSetsMetric([withSets([
      { rpe: 8, rir: null }, { rpe: 9, rir: null }, { rpe: 5, rir: null },
    ])]);
    expect(m.value).toBe(2);
  });

  it('tæller ikke sæt uden en vurdering med', () => {
    const m = hardSetsMetric([withSets([{ rpe: null, rir: null }, { rpe: 8, rir: null }])]);
    expect(m.value).toBe(1);
    expect(m.observation).toContain('mangler en vurdering');
    expect(m.confidence).toBeLessThan(1);
  });

  it('accepterer både anstrengelse og gentagelser tilbage', () => {
    const m = hardSetsMetric([withSets([{ rpe: null, rir: 2 }])]);
    expect(m.value).toBe(1);
  });

  it('har en definition, der forklarer hvad der tælles', () => {
    expect(hardSetsMetric([]).definition).toContain('gentagelser tilbage');
  });
});

describe('statistik: styrkeudvikling', () => {
  const setSession = (date: string, loadKg: number, over: Record<string, unknown> = {}): SessionRecord =>
    session({
      endedAt: date,
      actual: {
        ...emptyActual(),
        sets: [{
          exerciseId: 'deadlift', variantId: 'deadlift_conventional', setIndex: 0,
          loadKg, reps: 3, rpe: 8, rir: 2, ...over,
        }],
      },
    });

  it('holder forskellige varianter adskilt', () => {
    const sessions = [
      setSession('2026-07-01T00:00:00.000Z', 180),
      session({
        endedAt: '2026-07-08T00:00:00.000Z',
        actual: {
          ...emptyActual(),
          sets: [{
            exerciseId: 'deadlift', variantId: 'deadlift_axle', setIndex: 0,
            loadKg: 140, reps: 3, rpe: 8, rir: 2,
          }],
        },
      }),
    ];
    expect(strengthTrend(sessions, 'deadlift_conventional').points).toHaveLength(1);
    expect(strengthTrend(sessions, 'deadlift_axle').points).toHaveLength(1);
  });

  it('ignorerer sæt med teknikbrud', () => {
    const sessions = [setSession('2026-07-01T00:00:00.000Z', 180, { technicalFailure: true })];
    expect(strengthTrend(sessions, 'deadlift_conventional').points).toHaveLength(0);
  });

  it('ignorerer sæt med smerte', () => {
    const sessions = [setSession('2026-07-01T00:00:00.000Z', 180, { painScore: 5 })];
    expect(strengthTrend(sessions, 'deadlift_conventional').points).toHaveLength(0);
  });

  it('ignorerer sæt uden en vurdering af anstrengelsen', () => {
    const sessions = [setSession('2026-07-01T00:00:00.000Z', 180, { rpe: null })];
    expect(strengthTrend(sessions, 'deadlift_conventional').points).toHaveLength(0);
  });

  it('ignorerer sæt med for mange gentagelser til at styre tunge vægte', () => {
    const sessions = [setSession('2026-07-01T00:00:00.000Z', 100, { reps: 20 })];
    expect(strengthTrend(sessions, 'deadlift_conventional').points).toHaveLength(0);
  });

  it('siger fra ved for lidt data i stedet for at vise en kurve', () => {
    const r = strengthTrend([setSession('2026-07-01T00:00:00.000Z', 180)], 'deadlift_conventional');
    expect(r.metric.display).toBe('For lidt data');
    expect(r.metric.observation).toContain('for få');
  });

  it('sorterer datapunkterne kronologisk', () => {
    const sessions = [
      setSession('2026-07-20T00:00:00.000Z', 190),
      setSession('2026-07-01T00:00:00.000Z', 180),
    ];
    const points = strengthTrend(sessions, 'deadlift_conventional').points;
    expect(new Date(points[0]?.date as string).getTime())
      .toBeLessThan(new Date(points[1]?.date as string).getTime());
  });
});

describe('statistik: gruppering efter sammenlignelighed', () => {
  it('samler workouts uden nøgle som træningsmængde, ikke som præstation', () => {
    const groups = groupByComparability([
      session({ wodRef: { stimulus: 'a', format: 'amrap', comparabilityKey: null } }),
      session({ wodRef: { stimulus: 'b', format: 'amrap', comparabilityKey: null } }),
    ]);
    const group = groups.find((g) => g.key === 'uncomparable');
    expect(group?.comparable).toBe(false);
    expect(group?.note).toContain('ikke som en præstationskurve');
  });

  it('markerer en gruppe som sammenlignelig ved to ens gennemførelser', () => {
    const key = 'fortime|12|thruster:21:43';
    const groups = groupByComparability([
      session({ wodRef: { stimulus: 'x', format: 'fortime', comparabilityKey: key } }),
      session({ wodRef: { stimulus: 'x', format: 'fortime', comparabilityKey: key } }),
    ]);
    expect(groups.find((g) => g.key === key)?.comparable).toBe(true);
  });

  it('venter med at kalde noget en udvikling, til der er to resultater', () => {
    const key = 'fortime|12|thruster:21:43';
    const groups = groupByComparability([
      session({ wodRef: { stimulus: 'x', format: 'fortime', comparabilityKey: key } }),
    ]);
    const group = groups.find((g) => g.key === key);
    expect(group?.comparable).toBe(false);
    expect(group?.note).toContain('kun ét resultat');
  });
});

describe('statistik: datakvalitet og versionering', () => {
  it('viser, hvor stor en del af statistikken der hviler på registrerede tal', () => {
    const m = dataQuality([
      session({ feedback: { sessionRpe: 8, painBefore: null, painAfter: null, notes: '' } }),
      session(),
    ]);
    expect(m.value).toBe(0.5);
    expect(m.observation).toContain('tyndt grundlag');
  });

  it('mærker hver metric med en beregningsversion', () => {
    const s = summarise([session()]);
    expect(s.metricVersion).toBe(METRIC_VERSION);
    s.metrics.forEach((m) => {
      expect(m.metricVersion).toBe(METRIC_VERSION);
      expect(m.definition.length, `${m.id} mangler definition`).toBeGreaterThan(20);
    });
  });

  it('viser en sikkerhed på hver metric', () => {
    summarise([session()]).metrics.forEach((m) => {
      expect(['low', 'medium', 'high']).toContain(m.band);
    });
  });

  it('klarer en tom historik uden at finde på tal', () => {
    const s = summarise([]);
    expect(s.trainedSessions).toBe(0);
    s.metrics.forEach((m) => {
      if (m.value === null) expect(m.display).toMatch(/Ingen data|For lidt data/);
    });
  });
});

describe('statistik: anstrengelse', () => {
  it('måler hvor mange sæt der lå over det planlagte', () => {
    const s = session({
      actual: {
        ...emptyActual(),
        sets: [
          { exerciseId: 'a', setIndex: 0, loadKg: 100, reps: 5, rpe: 9.5, rir: null },
          { exerciseId: 'a', setIndex: 1, loadKg: 100, reps: 5, rpe: 8, rir: null },
        ],
      },
    });
    const m = effortAccuracy([s], 8);
    expect(m.value).toBe(0.5);
  });

  it('finder ikke på et tal uden data', () => {
    expect(effortAccuracy([session()], 8).value).toBeNull();
  });
});
