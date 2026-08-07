import { describe, expect, it } from 'vitest';
import * as eng from '../engine/index.js';
import type { TimerPlan, Workout } from '../engine/index.js';
import { timerView } from './useWhatwork.js';
import type { TimerState } from '../types.js';

function workoutFor(seed = 42, patch: Record<string, unknown> = {}): Workout {
  const res = eng.generateWorkout({ minutes: 30, men: 1, level: 3, seed, ...patch });
  if (!res.ok) throw new Error(`kunne ikke bygge testworkout: ${res.error}`);
  return res.workout;
}

const T0 = 1_700_000_000_000;

const timer = (patch: Partial<TimerState> = {}): TimerState => ({
  workoutId: 'w_test',
  mode: 'amrap',
  index: 0,
  running: true,
  startedAt: T0,
  acc: 0,
  totalAcc: 0,
  rounds: 0,
  sessionStartedAt: T0,
  ...patch,
});

describe('timeren følger den genererede workout', () => {
  it('starter på forberedelsessegmentet', () => {
    const w = workoutFor();
    const plan = eng.buildTimerPlan(w);
    const view = timerView(timer(), plan, T0);
    expect(view.segment.kind).toBe('prep');
    expect(view.display).toBe('0:10');
    expect(view.index).toBe(0);
    expect(view.total).toBe(plan.segments.length);
  });

  it('tæller ned på segmenter med fast varighed', () => {
    const w = workoutFor();
    const plan = eng.buildTimerPlan(w);
    const view = timerView(timer(), plan, T0 + 4000);
    expect(view.remaining).toBe(6);
    expect(view.display).toBe('0:06');
  });

  it('bliver aldrig negativ', () => {
    const w = workoutFor();
    const plan = eng.buildTimerPlan(w);
    expect(timerView(timer(), plan, T0 + 60_000).display).toBe('0:00');
  });

  it('advarer på farve de sidste ti sekunder — men farven står ikke alene', () => {
    const w = workoutFor();
    const plan = eng.buildTimerPlan(w);
    const workIndex = plan.segments.findIndex((s) => (s.seconds ?? 0) > 60);
    if (workIndex === -1) return;
    const seconds = plan.segments[workIndex]?.seconds ?? 0;
    const late = timerView(timer({ index: workIndex }), plan, T0 + (seconds - 5) * 1000);
    expect(late.tone).toBe('over');
    // Tallet i sig selv fortæller også, hvor lidt der er tilbage.
    expect(late.remaining).toBeLessThanOrEqual(10);
  });

  it('tæller op på åbne segmenter', () => {
    const w = workoutFor(8, { men: 1, women: 1, minutes: 35 });
    const plan = eng.buildTimerPlan(w);
    const openIndex = plan.segments.findIndex((s) => s.seconds === null && s.kind === 'work');
    expect(openIndex).toBeGreaterThan(-1);
    const view = timerView(timer({ index: openIndex }), plan, T0 + 125_000);
    expect(view.remaining).toBeNull();
    expect(view.display).toBe('2:05');
  });

  it('viser hvem der arbejder ved partnerworkout', () => {
    const w = workoutFor(8, { men: 1, women: 1, minutes: 35 });
    const plan = eng.buildTimerPlan(w);
    const idx = plan.segments.findIndex((s) => s.worker);
    expect(idx).toBeGreaterThan(-1);
    const view = timerView(timer({ index: idx }), plan, T0);
    expect(view.segment.worker).toBeTruthy();
    expect(view.segment.resting).toBeTruthy();
  });

  it('viser næste segment', () => {
    const w = workoutFor();
    const plan = eng.buildTimerPlan(w);
    expect(timerView(timer(), plan, T0).next?.id).toBe(plan.segments[1]?.id);
    expect(timerView(timer({ index: plan.segments.length - 1 }), plan, T0).next).toBeNull();
  });
});

describe('pause, genoptagelse og reload', () => {
  const setup = (): { plan: TimerPlan } => ({ plan: eng.buildTimerPlan(workoutFor()) });

  it('fryser tiden, når timeren er sat på pause', () => {
    const { plan } = setup();
    const paused = timer({ running: false, acc: 4000 });
    // Uret går videre i verden, men ikke i timeren.
    expect(timerView(paused, plan, T0 + 60_000).elapsed).toBe(4);
    expect(timerView(paused, plan, T0 + 600_000).elapsed).toBe(4);
  });

  it('tæller videre fra det akkumulerede, når den genoptages', () => {
    const { plan } = setup();
    const resumed = timer({ running: true, acc: 4000, startedAt: T0 + 60_000 });
    expect(timerView(resumed, plan, T0 + 63_000).elapsed).toBe(7);
  });

  it('regner tiden korrekt efter en reload, fordi den bygger på urets tidspunkter', () => {
    const { plan } = setup();
    // Tilstanden som den ville ligge i den lokale database: startet for 90 sekunder siden.
    const restored = timer({ index: 2, running: true, acc: 0, startedAt: T0, totalAcc: 45_000 });
    const now = T0 + 90_000;
    const view = timerView(restored, plan, now);
    expect(view.elapsed).toBe(90);
    expect(view.sessionElapsed).toBe(135);
    // Ingen decrementerende tæller: samme tilstand giver samme resultat hver gang.
    expect(timerView(restored, plan, now).sessionElapsed).toBe(135);
  });

  it('holder den samlede sessionstid på tværs af segmenter', () => {
    const { plan } = setup();
    const view = timerView(timer({ index: 3, totalAcc: 120_000, acc: 5000, running: false }), plan, T0 + 999_999);
    expect(view.sessionElapsed).toBe(125);
  });

  it('gemmer workout-ID, tilstand, fase, runde og tidsstempler', () => {
    const state = timer({ index: 4, rounds: 3 });
    expect(Object.keys(state).sort()).toEqual([
      'acc', 'index', 'mode', 'rounds', 'running', 'sessionStartedAt', 'startedAt', 'totalAcc', 'workoutId',
    ]);
  });
});
