import { useEffect, useRef, useState } from 'react';
import { StarField } from './StarField.js';
import { Glyph } from './ui.js';

/**
 * "Overrask mig" — genvejen uden om generatoren.
 *
 * Knappen bygger på ét vilkår: der skal være en tid. Uden minutter ved motoren
 * ikke, hvor stor en session den skal skrue sammen, så knappen folder selv
 * tidsvalget ud i stedet for at generere på en gætning. Er tiden allerede kendt
 * — som inde i generatoren — springes valget over, og ét tryk er nok.
 */

/** Samme liste som generatorens tidstrin. Knappen må ikke tilbyde en tid, generatoren ikke kender. */
const TIMES = [10, 15, 20, 25, 30, 40, 45, 60, 75, 90];

export function SurpriseButton({
  onSurprise, minutes, compact = false,
}: {
  onSurprise: (minutes: number) => void;
  /** Kendt tid. Er den sat, genererer knappen med det samme. */
  minutes?: number;
  /** Lav udgave til faste handlingsområder, hvor der ikke er plads til underteksten. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const needsTime = minutes === undefined;

  // Tidsvalget er en lille popover: den lukker på Escape og på klik udenfor, så
  // den ikke bliver stående og spærrer for resten af siden.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    const onDown = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const label = compact && !needsTime ? `Overrask mig · ${minutes} min` : 'Overrask mig';
  const sub = needsTime
    ? (open ? 'Hvor lang tid har I?' : 'Vælg en tid, så bygger vi resten')
    : `${minutes} min · ét tryk, dine standardvalg`;

  return (
    <div ref={box} className="ww-sparkle-wrap">
      <button
        type="button"
        className={`ww-sparkle${compact ? ' ww-sparkle--sm' : ''}${open ? ' is-open' : ''}`}
        aria-expanded={needsTime ? open : undefined}
        onClick={() => (needsTime ? setOpen((v) => !v) : onSurprise(minutes))}
      >
        <StarField />
        <span className="ww-sparkle__icon">
          <Glyph name="sparkle" size={compact ? 20 : 32} />
        </span>
        <span className="ww-sparkle__text">
          <span className="ww-sparkle__label">{label}</span>
          <span className="ww-sparkle__sub">{sub}</span>
        </span>
      </button>

      {open ? (
        <div className="ww-sparkle-times" role="group" aria-label="Vælg tid til Overrask mig">
          <p className="ww-sparkle-times__hint">Vælg længden — så genererer vi med det samme.</p>
          <div className="ww-wrap">
            {TIMES.map((m) => (
              <button
                key={m}
                type="button"
                className="ww-chip"
                style={{ minWidth: 74 }}
                onClick={() => { setOpen(false); onSurprise(m); }}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
