import { useCursorRepel } from '../lib/useCursorRepel.js';

/**
 * Stjernestøvet på "Overrask mig" — samme tre korn og takter som før (se
 * .ww-star-dot--a/b/c i index.css), men som enkeltstående noder i stedet for
 * tre flade baggrundslag, så hvert korn kan vige for musen uden at forstyrre
 * de to andre lags egen takt. Positioner, størrelser og opaciteter er hentet
 * direkte fra de tidligere radial-gradient-stop, så udseendet er uændret.
 */
interface StarSpec { x: number; y: number; size: number; opacity: number; layer: 'a' | 'b' | 'c'; tier: 1 | 2 | 3 }

const STARS: StarSpec[] = [
  // Lag a — 2,9 s
  { x: 7, y: 24, size: 3, opacity: 0.95, layer: 'a', tier: 1 },
  { x: 19, y: 70, size: 2.2, opacity: 0.9, layer: 'a', tier: 2 },
  { x: 32, y: 15, size: 3.4, opacity: 0.95, layer: 'a', tier: 1 },
  { x: 45, y: 83, size: 2.4, opacity: 0.88, layer: 'a', tier: 3 },
  { x: 58, y: 33, size: 3.2, opacity: 0.95, layer: 'a', tier: 2 },
  { x: 72, y: 75, size: 2.2, opacity: 0.88, layer: 'a', tier: 3 },
  { x: 87, y: 26, size: 3.6, opacity: 0.95, layer: 'a', tier: 1 },
  { x: 95, y: 63, size: 2.4, opacity: 0.9, layer: 'a', tier: 3 },
  // Lag b — 4,3 s
  { x: 12, y: 80, size: 2.6, opacity: 0.92, layer: 'b', tier: 2 },
  { x: 27, y: 41, size: 4, opacity: 0.98, layer: 'b', tier: 1 },
  { x: 40, y: 21, size: 2.4, opacity: 0.88, layer: 'b', tier: 3 },
  { x: 53, y: 68, size: 3.2, opacity: 0.95, layer: 'b', tier: 1 },
  { x: 67, y: 17, size: 2.2, opacity: 0.88, layer: 'b', tier: 3 },
  { x: 80, y: 54, size: 3.8, opacity: 0.96, layer: 'b', tier: 2 },
  { x: 92, y: 86, size: 2.6, opacity: 0.9, layer: 'b', tier: 3 },
  // Lag c — 6,1 s
  { x: 9, y: 50, size: 4.4, opacity: 1, layer: 'c', tier: 1 },
  { x: 36, y: 59, size: 2.8, opacity: 0.92, layer: 'c', tier: 2 },
  { x: 63, y: 88, size: 3.4, opacity: 0.95, layer: 'c', tier: 3 },
  { x: 77, y: 31, size: 4.8, opacity: 1, layer: 'c', tier: 1 },
  { x: 89, y: 47, size: 2.6, opacity: 0.9, layer: 'c', tier: 2 },
];

export function StarField() {
  const { containerRef, itemRefs } = useCursorRepel<HTMLSpanElement>(STARS, { radius: 46, strength: 10 });

  return (
    <span className="ww-star-field" ref={containerRef} aria-hidden="true">
      {STARS.map((s, i) => (
        <span
          key={i}
          className="ww-star-anchor"
          data-tier={s.tier}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          ref={(el) => { itemRefs.current[i] = el; }}
        >
          <span
            className={`ww-star-dot ww-star-dot--${s.layer}`}
            style={{ width: s.size, height: s.size, opacity: s.opacity }}
          />
        </span>
      ))}
    </span>
  );
}
