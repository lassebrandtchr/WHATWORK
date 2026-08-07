import { afterEach, describe, expect, it, vi } from 'vitest';
import * as eng from '../engine/index.js';
import { requestAiPlan } from './aiMix.js';

const request = { minutes: 30, men: 1, level: 3, seed: 5 } as const;

afterEach(() => { vi.unstubAllGlobals(); });

describe('AI Mix-fallback', () => {
  it('giver ingen plan, når serveren ikke har en nøgle', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(
      JSON.stringify({ ok: false, reason: 'not_configured', message: 'AI Mix er ikke sat op på serveren.' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )));
    const outcome = await requestAiPlan(request, []);
    expect(outcome.plan).toBeNull();
  });

  it('giver ingen plan, når der ikke er netværk', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const outcome = await requestAiPlan(request, []);
    expect(outcome.plan).toBeNull();
    if (!outcome.plan) expect(outcome.reason).toContain('kunne ikke kontaktes');
  });

  it('afviser en plan med ukendt format eller ukendte øvelser', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(
      JSON.stringify({ ok: true, plan: { format: 'tabata', exerciseIds: ['findes_ikke'], rationale: '', signature: '' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const outcome = await requestAiPlan(request, []);
    expect(outcome.plan).toBeNull();
  });

  it('accepterer en plan, der holder sig til kataloget', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(
      JSON.stringify({
        ok: true,
        plan: {
          format: 'amrap',
          exerciseIds: ['wall_ball', 'row', 'burpee'],
          rationale: 'Bred engine med tre kendte bevægelser.',
          signature: 'amrap|wall_ball',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const outcome = await requestAiPlan(request, []);
    expect(outcome.plan?.format).toBe('amrap');
    expect(outcome.plan?.exerciseIds).toEqual(['wall_ball', 'row', 'burpee']);
  });
});

describe('den lokale generator uden AI', () => {
  it('bygger en fuld workout uden AI-lag overhovedet', () => {
    const res = eng.generateWorkout(request);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.workout.mix.source).toBe('smart');
      expect(res.workout.blocks.length).toBeGreaterThan(1);
      expect(res.workout.score).toBeGreaterThan(0);
    }
  });

  it('bygger stadig en workout, når en AI-plan ikke kan bruges', () => {
    const res = eng.generateWorkout(request, {
      aiPlan: { format: 'amrap', exerciseIds: ['findes_heller_ikke'], rationale: '', signature: '' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.workout.blocks.length).toBeGreaterThan(1);
  });

  it('markerer workouten som AI-mikset, når planen holder', () => {
    const res = eng.generateWorkout(request, {
      aiPlan: {
        format: 'amrap',
        exerciseIds: ['wall_ball', 'row', 'burpee', 'kb_swing'],
        rationale: 'Bred engine.',
        signature: 'amrap|wall_ball',
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.workout.mix.source).toBe('ai');
      expect(res.workout.mix.rationale).toBe('Bred engine.');
      // Regelmotoren ejer stadig kilo, mål og validering.
      expect(res.workout.issues.filter((i) => i.sev === 'error')).toHaveLength(0);
      res.workout.blocks.flatMap((b) => b.movements).forEach((m) => {
        expect(m.targets.length).toBe(res.workout.people.length);
      });
    }
  });
});
