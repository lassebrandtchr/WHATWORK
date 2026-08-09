import { describe, expect, it } from 'vitest';
import {
  MIN_EMOM_REST_SEC, checkInterval, completionProbability, cycleTime,
  estimateFeasibility, slowestFits,
} from './feasibility.js';
import type { AthleteSplit } from './feasibility.js';
import { benchmarkFromValue } from './benchmarks.js';

const NOW = '2026-08-09T00:00:00.000Z';

const split = (over: Partial<AthleteSplit> = {}): AthleteSplit => ({
  exerciseId: 'push_press', amount: 12, workSeconds: 36, loadKg: 65,
  date: '2026-08-01T00:00:00.000Z', ...over,
});

describe('cycleTime — prioriteret datakilde', () => {
  it('foretrækker atletens egne splits', () => {
    const c = cycleTime({
      exerciseId: 'push_press', amount: 12, rounds: 6, loadKg: 65, splits: [split()],
    }, NOW);
    expect(c.basis).toBe('athlete-history');
    expect(c.secondsPerUnit).toBeCloseTo(3, 1);
    expect(c.confidence).toBeGreaterThan(0.5);
  });

  it('afviser splits med for stor forskel i belastning', () => {
    const c = cycleTime({
      exerciseId: 'push_press', amount: 12, rounds: 6, loadKg: 100,
      splits: [split({ loadKg: 40 })],
    }, NOW);
    expect(c.basis).not.toBe('athlete-history');
  });

  it('bruger et cadence-benchmark, når der ikke er splits', () => {
    const bm = benchmarkFromValue({
      subjectId: 'wall_ball', kind: 'cadence', protocol: 'maxUnbroken',
      value: 20, unit: 'reps', date: NOW,
    });
    const c = cycleTime({ exerciseId: 'wall_ball', amount: 20, rounds: 5, benchmarks: [bm] }, NOW);
    expect(c.basis).toBe('movement-benchmark');
    expect(c.secondsPerUnit).toBeCloseTo(3, 1);
  });

  it('falder tilbage til en beslægtet variation med usikkerhedsstraf', () => {
    const c = cycleTime({
      exerciseId: 'push_press', amount: 10, rounds: 4,
      splits: [split({ exerciseId: 'strict_press', amount: 10, workSeconds: 40 })],
    }, NOW);
    expect(c.basis).toBe('related-variation');
    expect(c.secondsPerUnit).toBeGreaterThan(4);
  });

  it('bruger en konservativ populationsprior som sidste udvej', () => {
    const c = cycleTime({ exerciseId: 'push_press', amount: 10, rounds: 4 }, NOW);
    expect(c.basis).toBe('population-prior');
    expect(c.confidence).toBeLessThan(0.45);
    expect(c.explanation).toContain('Konservativt');
  });
});

describe('estimateFeasibility', () => {
  it('lægger vendinger til shuttle run', () => {
    const flat = estimateFeasibility({ exerciseId: 'shuttle_run', amount: 125, rounds: 18 }, NOW);
    const withTurns = estimateFeasibility(
      { exerciseId: 'shuttle_run', amount: 125, rounds: 18, turns: 12 }, NOW,
    );
    expect(withTurns.predictedWorkSeconds.p50).toBeGreaterThan(flat.predictedWorkSeconds.p50);
  });

  it('gør compromised running langsommere', () => {
    const fresh = estimateFeasibility({ exerciseId: 'run_dist', amount: 1000, rounds: 8 }, NOW);
    const tired = estimateFeasibility(
      { exerciseId: 'run_dist', amount: 1000, rounds: 8, compromised: true }, NOW,
    );
    expect(tired.predictedWorkSeconds.p50).toBeGreaterThan(fresh.predictedWorkSeconds.p50);
  });

  it('modellerer breaks ud fra frisk max-unbroken', () => {
    const easy = estimateFeasibility(
      { exerciseId: 'diamond_push_up', amount: 17, rounds: 9, maxUnbroken: 40 }, NOW,
    );
    const hard = estimateFeasibility(
      { exerciseId: 'diamond_push_up', amount: 17, rounds: 9, maxUnbroken: 18 }, NOW,
    );
    expect(hard.expectedBreakSeconds).toBeGreaterThan(easy.expectedBreakSeconds);
  });

  it('øger decay med antal runder', () => {
    const few = estimateFeasibility({ exerciseId: 'pull_up', amount: 8, rounds: 2 }, NOW);
    const many = estimateFeasibility({ exerciseId: 'pull_up', amount: 8, rounds: 12 }, NOW);
    expect(many.fatigueDecay).toBeGreaterThan(few.fatigueDecay);
  });

  it('giver et bredere p90 ved lav confidence', () => {
    const unsure = estimateFeasibility({ exerciseId: 'push_press', amount: 12, rounds: 6 }, NOW);
    const sure = estimateFeasibility({
      exerciseId: 'push_press', amount: 12, rounds: 6, loadKg: 65, splits: [split()],
    }, NOW);
    const spreadUnsure = unsure.predictedWorkSeconds.p90 / unsure.predictedWorkSeconds.p50;
    const spreadSure = sure.predictedWorkSeconds.p90 / sure.predictedWorkSeconds.p50;
    expect(spreadUnsure).toBeGreaterThan(spreadSure);
  });

  it('har altid p90 mindst lige så stor som p50', () => {
    ['pull_up', 'row', 'deadlift', 'wall_ball', 'run_dist'].forEach((id) => {
      const r = estimateFeasibility({ exerciseId: id, amount: 12, rounds: 5 }, NOW);
      expect(r.predictedWorkSeconds.p90).toBeGreaterThanOrEqual(r.predictedWorkSeconds.p50);
    });
  });
});

describe('checkInterval', () => {
  it('godkender et vindue med reel pause tilbage', () => {
    const r = estimateFeasibility({
      exerciseId: 'row', amount: 10, rounds: 10,
      splits: [split({ exerciseId: 'row', amount: 10, workSeconds: 30, loadKg: undefined as never })],
    }, NOW);
    const v = checkInterval(r, 60);
    expect(v.ok).toBe(true);
    expect(v.restSeconds).toBeGreaterThanOrEqual(MIN_EMOM_REST_SEC);
  });

  it('er strammere uden data end med dokumenterede splits', () => {
    const withData = estimateFeasibility({
      exerciseId: 'row', amount: 12, rounds: 10,
      splits: [split({ exerciseId: 'row', amount: 12, workSeconds: 36, loadKg: undefined as never })],
    }, NOW);
    const without = estimateFeasibility({ exerciseId: 'row', amount: 12, rounds: 10 }, NOW);
    expect(checkInterval(withData, 60).restSeconds)
      .toBeGreaterThan(checkInterval(without, 60).restSeconds);
  });

  it('afviser 17 diamond push-ups i et minut uden benchmark', () => {
    const r = estimateFeasibility(
      { exerciseId: 'diamond_push_up', amount: 17, rounds: 9, maxUnbroken: 18 }, NOW,
    );
    const v = checkInterval(r, 60);
    expect(v.ok).toBe(false);
    expect(v.suggestedRepFactor).toBeLessThan(1);
    expect(v.message).toContain('reel pause');
  });

  it('foreslår en reduktion, der faktisk får vinduet til at holde', () => {
    const r = estimateFeasibility({ exerciseId: 'burpee', amount: 20, rounds: 10 }, NOW);
    const v = checkInterval(r, 60);
    if (!v.ok) {
      const reduced = estimateFeasibility(
        { exerciseId: 'burpee', amount: Math.floor(20 * v.suggestedRepFactor), rounds: 10 }, NOW,
      );
      expect(checkInterval(reduced, 60).ok).toBe(true);
    }
  });

  it('giver lavere completion probability ved lav confidence', () => {
    const r = estimateFeasibility({ exerciseId: 'row', amount: 10, rounds: 10 }, NOW);
    const v = checkInterval(r, 60);
    expect(v.completionProbability).toBeLessThan(1);
    expect(v.completionProbability).toBeGreaterThan(0);
  });
});

describe('completionProbability', () => {
  it('falder når arbejdet nærmer sig og overskrider cappen', () => {
    const under = completionProbability(600, 1080, 0.8);
    const over = completionProbability(1300, 1080, 0.8);
    expect(under).toBeGreaterThan(over);
    expect(over).toBeLessThan(0.5);
  });

  it('returnerer nul ved ugyldig cap', () => {
    expect(completionProbability(100, 0, 0.8)).toBe(0);
  });
});

describe('slowestFits', () => {
  it('bruger den langsomste deltager, ikke gennemsnittet', () => {
    const fast = estimateFeasibility({ exerciseId: 'row', amount: 10, rounds: 6 }, NOW);
    const slow = estimateFeasibility({ exerciseId: 'row', amount: 30, rounds: 6 }, NOW);
    const v = slowestFits([fast, slow], 60);
    expect(v.slowestSeconds).toBe(slow.predictedWorkSeconds.p90);
    expect(v.ok).toBe(false);
    expect(v.message).toContain('Skalér den enkelte deltager');
  });

  it('godkender når alle når rotationen', () => {
    const a = estimateFeasibility({ exerciseId: 'row', amount: 8, rounds: 6 }, NOW);
    expect(slowestFits([a, a], 120).ok).toBe(true);
  });
});
