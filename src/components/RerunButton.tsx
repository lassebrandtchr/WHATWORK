import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Glyph } from './ui.js';

/**
 * "Kør igen" — elektrisk gul genstartsknap. Delt af Historik og Favoritter
 * (og ethvert fremtidigt sted, samme handling optræder), så gnist- og
 * stød-effekten aldrig kan drifte mellem to kopier af markup'et.
 */

const SPARKS = ['a', 'b', 'c', 'd', 'e'] as const;

const BOLTS = [
  { mod: 'nw', dur: 0.39, delay: 0.09 },
  { mod: 'n', dur: 0.36, delay: 0 },
  { mod: 'nne', dur: 0.31, delay: 0.19 },
  { mod: 'ne', dur: 0.42, delay: 0.05 },
  { mod: 'e', dur: 0.33, delay: 0.11 },
  { mod: 'ese', dur: 0.37, delay: 0.22 },
  { mod: 'se', dur: 0.45, delay: 0.02 },
  { mod: 's', dur: 0.38, delay: 0.16 },
  { mod: 'ssw', dur: 0.34, delay: 0.06 },
  { mod: 'sw', dur: 0.4, delay: 0.08 },
  { mod: 'w', dur: 0.35, delay: 0.13 },
  { mod: 'wnw', dur: 0.43, delay: 0.17 },
] as const;

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Trækker en ny tilfældig retning, afstand og rotation til ét stød og genstarter dets keyframe-loop. */
function randomizeBolt(el: HTMLSpanElement): void {
  const angle = rand(0, Math.PI * 2);
  const dist = rand(20, 42);
  const midDist = dist * rand(0.45, 0.7);
  el.style.setProperty('--ww-bolt-tx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
  el.style.setProperty('--ww-bolt-ty', `${(Math.sin(angle) * dist).toFixed(1)}px`);
  el.style.setProperty('--ww-bolt-mx', `${(Math.cos(angle) * midDist).toFixed(1)}px`);
  el.style.setProperty('--ww-bolt-my', `${(Math.sin(angle) * midDist).toFixed(1)}px`);
  el.style.setProperty('--ww-bolt-rot', `${rand(-28, 28).toFixed(1)}deg`);
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

export function RerunButton({
  onClick, style, className,
}: {
  onClick: () => void;
  /** Videreføres til <button>, så knappen kan indpasses samme steder som de øvrige ww-btn-varianter. */
  style?: CSSProperties;
  className?: string;
}) {
  const boltRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  const [charging, setCharging] = useState(false);

  const stopCharging = useCallback(() => {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
    setCharging(false);
  }, []);

  const startCharging = useCallback(() => {
    setCharging(true);
    BOLTS.forEach((b, i) => {
      const el = boltRefs.current[i];
      if (!el) return;
      randomizeBolt(el);
      timers.current.push(window.setInterval(() => randomizeBolt(el), b.dur * 1000));
    });
  }, []);

  // Timere må ikke overleve komponenten, fx hvis knappen forsvinder fra skærmen
  // mens musen stadig "hoveres" over dens gamle position.
  useEffect(() => stopCharging, [stopCharging]);

  const hoverCapable = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  return (
    <button
      type="button"
      className={`ww-btn ww-btn--rerun${charging ? ' is-charging' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      onClick={onClick}
      onPointerEnter={hoverCapable ? startCharging : undefined}
      onPointerLeave={hoverCapable ? stopCharging : undefined}
      onTouchStart={hoverCapable ? undefined : startCharging}
      onTouchEnd={hoverCapable ? undefined : stopCharging}
      onTouchCancel={hoverCapable ? undefined : stopCharging}
      onFocus={startCharging}
      onBlur={stopCharging}
    >
      {SPARKS.map((k) => (
        <span key={k} className={`ww-rerun__spark ww-rerun__spark--${k}`} aria-hidden="true">
          <Glyph name="bolt" size={11} />
        </span>
      ))}
      {BOLTS.map((b, i) => (
        <span
          key={b.mod}
          ref={(el) => { boltRefs.current[i] = el; }}
          className={`ww-rerun__bolt ww-rerun__bolt--${b.mod}`}
          aria-hidden="true"
          style={{
            ['--ww-bolt-dur' as string]: `${b.dur}s`,
            ['--ww-bolt-delay' as string]: `${b.delay}s`,
          } as CSSProperties}
        >
          <Glyph name="bolt" size={15} />
        </span>
      ))}
      <span className="ww-rerun__label">
        <Glyph name="bolt" size={16} />
        Kør igen
      </span>
    </button>
  );
}
