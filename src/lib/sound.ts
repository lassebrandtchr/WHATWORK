import type { SegmentKind } from '../engine/index.js';

export type ArrivalKind = 'start' | 'switch' | 'rest_start' | 'rest_end' | 'complete';

/**
 * Hvilken ankomst-type der skal varsles, når et segment går fra `current` til `next`.
 * Ren funktion — ingen afhængighed af Web Audio, så den kan testes uden en browser.
 */
export function kindFor(current: SegmentKind, next: SegmentKind): ArrivalKind | null {
  if (next === 'rest') return 'rest_start';
  if (next === 'work' || next === 'prep') {
    if (current === 'prep') return 'start';
    if (current === 'rest') return 'rest_end';
    if (current === 'work' || current === 'transition') return 'switch';
    return null;
  }
  if (next === 'transition') {
    if (current === 'work' || current === 'rest') return 'switch';
    return null;
  }
  // 'done' varsles ikke via en nedtælling — den håndteres separat, når segmentet nås.
  return null;
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Én kort, blød tone. `startAt`/`durationSec` er i sekunder fra nu. */
function tone(freq: number, startAt: number, durationSec: number, gainPeak = 0.2): void {
  const audio = getCtx();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = audio.currentTime + startAt;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + durationSec);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.02);
}

/** Tick ved 3, 2 og 1 sekund før et segment skifter — stigende tonehøjde jo tættere på 0. */
export function playTick(stepsLeft: 1 | 2 | 3): void {
  const freq = stepsLeft === 3 ? 440 : stepsLeft === 2 ? 523 : 659;
  tone(freq, 0, 0.12, 0.18);
}

const ARRIVAL_TONES: Record<ArrivalKind, number[]> = {
  start: [523, 784],
  rest_end: [523, 784],
  rest_start: [392],
  switch: [587, 587],
  complete: [523, 659, 784],
};

/** Distinkt ankomst-lyd ved segmentskift — én til tre toner afhængig af type. */
export function playArrival(kind: ArrivalKind): void {
  ARRIVAL_TONES[kind].forEach((freq, i) => tone(freq, i * 0.14, 0.22, 0.22));
}
