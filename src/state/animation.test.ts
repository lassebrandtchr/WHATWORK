import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPhaseAnimation } from './useWhatwork.js';

/**
 * Loading-animationen må aldrig kunne holde et færdigt resultat tilbage.
 *
 * Testene her dækker den fejl, der blev fundet i browseren: animationen var bygget
 * som en kæde af timeouts, og browsere strupper timere i faner, der ikke er synlige.
 * Skiftede brugeren væk midt i genereringen, gik kæden i stå — og workouten dukkede
 * aldrig op, heller ikke når hun kom tilbage.
 */

const PHASES = [
  { to: 50, text: 'Første halvdel' },
  { to: 100, text: 'Anden halvdel' },
];

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', {
    value: hidden ? 'hidden' : 'visible',
    configurable: true,
  });
}

afterEach(() => {
  setHidden(false);
  vi.useRealTimers();
});

describe('runPhaseAnimation', () => {
  it('leverer resultatet med det samme, når siden ikke er synlig', async () => {
    setHidden(true);
    const done = vi.fn();

    runPhaseAnimation({
      phases: PHASES,
      durationMs: 60_000,
      work: Promise.resolve('færdig'),
      onProgress: () => {},
      onPhase: () => {},
      onDone: done,
    });

    // Ingen ventetid: animationen springes over, når der ikke er nogen at vise den for.
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toHaveBeenCalledWith('færdig');
  });

  it('venter på animationen, når siden er synlig', async () => {
    vi.useFakeTimers();
    const done = vi.fn();

    runPhaseAnimation({
      phases: PHASES,
      durationMs: 1000,
      work: Promise.resolve('færdig'),
      onProgress: () => {},
      onPhase: () => {},
      onDone: done,
    });

    await vi.advanceTimersByTimeAsync(200);
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1200);
    expect(done).toHaveBeenCalledWith('færdig');
  });

  it('går fra 0 til 100 og ender på 100', async () => {
    vi.useFakeTimers();
    const values: number[] = [];

    runPhaseAnimation({
      phases: PHASES,
      durationMs: 500,
      work: Promise.resolve(1),
      onProgress: (v) => values.push(v),
      onPhase: () => {},
      onDone: () => {},
    });

    await vi.advanceTimersByTimeAsync(800);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(100);
    // Fremdriften må aldrig gå baglæns.
    values.forEach((v, i) => {
      if (i > 0) expect(v).toBeGreaterThanOrEqual(values[i - 1] as number);
    });
  });

  it('skifter fasetekst undervejs', async () => {
    vi.useFakeTimers();
    const texts: string[] = [];

    runPhaseAnimation({
      phases: PHASES,
      durationMs: 500,
      work: Promise.resolve(1),
      onProgress: () => {},
      onPhase: (t) => texts.push(t),
      onDone: () => {},
    });

    await vi.advanceTimersByTimeAsync(800);
    expect(new Set(texts)).toContain('Anden halvdel');
  });

  it('afbrydes uden at kalde tilbage, når den annulleres', async () => {
    vi.useFakeTimers();
    const done = vi.fn();

    const cancel = runPhaseAnimation({
      phases: PHASES,
      durationMs: 300,
      work: Promise.resolve('færdig'),
      onProgress: () => {},
      onPhase: () => {},
      onDone: done,
    });

    cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).not.toHaveBeenCalled();
  });

  it('kalder kun tilbage én gang', async () => {
    vi.useFakeTimers();
    const done = vi.fn();

    runPhaseAnimation({
      phases: PHASES,
      durationMs: 200,
      work: Promise.resolve('færdig'),
      onProgress: () => {},
      onPhase: () => {},
      onDone: done,
    });

    await vi.advanceTimersByTimeAsync(2000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('venter på arbejdet, selv når animationen er hurtigere', async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    // Holderen er et objekt, så TypeScript ikke indsnævrer feltet til `never`
    // ud fra en tildeling, den ikke kan se sker inde i promise-konstruktøren.
    const holder: { resolve: (v: string) => void } = { resolve: () => {} };
    const work = new Promise<string>((r) => { holder.resolve = r; });

    runPhaseAnimation({
      phases: PHASES,
      durationMs: 100,
      work,
      onProgress: () => {},
      onPhase: () => {},
      onDone: done,
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(done).not.toHaveBeenCalled();

    holder.resolve('sent svar');
    await vi.advanceTimersByTimeAsync(10);
    expect(done).toHaveBeenCalledWith('sent svar');
  });
});
