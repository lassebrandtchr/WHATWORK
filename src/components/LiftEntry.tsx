import { useState } from 'react';
import { Term } from './Term.js';
import { Chip } from './ui.js';
import { e1rmFor } from '../domain/benchmarks.js';
import { fmt, trainingMaxFrom } from '../domain/strength.js';
import { LIFT_NAMES } from '../domain/types.js';
import type { Benchmark, LiftId } from '../domain/types.js';

/**
 * Indtastning af ét hovedløft.
 *
 * Bruges både på "Mine tal" og direkte i programbyggeren, fordi det er præcis der,
 * spørgsmålet opstår: vælger man "jeg kender mine tal", skal man kunne skrive dem
 * med det samme frem for at lede efter en anden skærm.
 *
 * Der bedes bevidst ikke om en maksimal test. Brugeren skriver et sæt, hun faktisk
 * har lavet — 1 til 5 gentagelser — og hvor hårdt det føltes. Resten regner appen.
 */

/** Hvor hårdt sættet føltes, oversat til den skala, beregningen bruger. */
export const EFFORT_OPTIONS: { id: number; label: string; hint: string }[] = [
  { id: 10, label: 'Kunne ikke tage flere', hint: 'Den sidste gentagelse var alt, du havde.' },
  { id: 9, label: 'Havde 1 tilbage', hint: 'Du kunne lige have klemt én mere ud.' },
  { id: 8, label: 'Havde 2 tilbage', hint: 'Der var to gentagelser tilbage i tanken.' },
  { id: 7, label: 'Havde 3 tilbage', hint: 'Hårdt, men der var stadig luft.' },
  { id: 6, label: 'Havde 4 eller flere', hint: 'Kontrolleret. Bruges som et forsigtigt udgangspunkt.' },
];

export function LiftEntry({
  lift, benchmarks, onLog, compact = false,
}: {
  lift: LiftId;
  benchmarks: Benchmark[];
  onLog: (lift: LiftId, loadKg: number, reps: number, rpe: number) => void;
  /** Kortere udgave uden den lange forklaring — til programbyggeren. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loadKg, setLoadKg] = useState('');
  const [reps, setReps] = useState('3');
  const [rpe, setRpe] = useState(8);

  const rolling = e1rmFor(benchmarks, lift);
  const tm = rolling ? trainingMaxFrom(rolling.currentKg, rolling.confidence) : null;
  const canSave = Number(loadKg) > 0 && Number(reps) > 0 && Number(reps) <= 10;

  const save = (): void => {
    if (!canSave) return;
    onLog(lift, Number(loadKg), Number(reps), rpe);
    setLoadKg('');
    setOpen(false);
  };

  return (
    <div style={{ borderBottom: '1px solid var(--ww-line)', padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{LIFT_NAMES[lift]}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ww-text-3)', marginTop: 4, lineHeight: 1.55 }}>
            {rolling && tm
              ? `Kan løfte omkring ${fmt(rolling.currentKg)} kg én gang. `
                + `Programmet regner ud fra ${fmt(tm.kg)} kg.`
              : 'Mangler. Uden et tal styres løftet af, hvor hårdt det føles — ikke af kilo.'}
          </div>
        </div>
        <button type="button" className={`ww-btn${rolling ? '' : ' ww-btn--primary'}`} onClick={() => setOpen((o) => !o)}>
          {rolling ? 'Ret' : 'Indtast'}
        </button>
      </div>

      {open ? (
        <div className="ww-card" style={{ padding: 18, marginTop: 14 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ww-body)', lineHeight: 1.6 }}>
            Skriv et sæt, du <strong>har lavet</strong> — helst mellem 1 og 5 gentagelser.
            Jo færre gentagelser, jo mere præcist bliver programmets kilo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 16 }}>
            <div>
              <label htmlFor={`ww-load-${lift}`} style={{ display: 'block', fontSize: 13, color: 'var(--ww-text-2)', marginBottom: 6 }}>
                Hvor mange kilo?
              </label>
              <input
                id={`ww-load-${lift}`}
                className="ww-input"
                type="number"
                inputMode="decimal"
                min={1}
                step={2.5}
                value={loadKg}
                onChange={(e) => setLoadKg(e.target.value)}
                placeholder="fx 100"
              />
            </div>
            <div>
              <label htmlFor={`ww-reps-${lift}`} style={{ display: 'block', fontSize: 13, color: 'var(--ww-text-2)', marginBottom: 6 }}>
                Hvor mange gentagelser?
              </label>
              <input
                id={`ww-reps-${lift}`}
                className="ww-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ww-text-2)' }}>
            Hvor hårdt føltes sættet?
          </div>
          <div className="ww-wrap" style={{ gap: 6, marginBottom: 8 }}>
            {EFFORT_OPTIONS.map((o) => (
              <Chip key={o.id} on={rpe === o.id} onClick={() => setRpe(o.id)}>{o.label}</Chip>
            ))}
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.55 }}>
            {EFFORT_OPTIONS.find((o) => o.id === rpe)?.hint}
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ww-btn ww-btn--primary" onClick={save} disabled={!canSave}>
              Gem
            </button>
            <button type="button" className="ww-btn" onClick={() => setOpen(false)}>Fortryd</button>
          </div>

          {compact ? null : (
            <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
              Du behøver ikke teste din <Term id="1rm" />. Ud fra vægt, gentagelser og hvor hårdt
              det føltes, regner appen et bud på din maksimale styrke — og bruger et bevidst
              lavere tal, når den sætter dine vægte.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
