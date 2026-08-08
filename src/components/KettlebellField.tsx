import { useCursorRepel } from '../lib/useCursorRepel.js';

/**
 * Det levende mønster bag "Generér workout" — kettlebells spredt ud over hele
 * knappen i stedet for ét lyn i venstre side. Hver kettlebell er to indlejrede
 * lag: det yderste driver den langsomme, uafhængige idle-svæven (ren CSS,
 * forskudt takt pr. øvelse), det inderste flytter sig, når musen kommer tæt på
 * (JS sætter --rx/--ry, CSS'en jævner selv overgangen ud). De to lag rører
 * aldrig samme transform, så de aldrig kan modarbejde hinanden.
 *
 * Tier'et styrer, hvor mange der vises — via container queries, ikke JS-måling —
 * så den samme liste ser rigtig ud på en lille empty-state-knap og på den store
 * hero-CTA uden at komponenten skal kende sin egen størrelse.
 */
interface KbSpec { x: number; y: number; size: number; opacity: number; duration: number; delay: number; tier: 1 | 2 | 3 }

const KETTLEBELLS: KbSpec[] = [
  { x: 10, y: 26, size: 15, opacity: 0.4, duration: 7.4, delay: 0, tier: 1 },
  { x: 27, y: 72, size: 22, opacity: 0.5, duration: 8.8, delay: 0.5, tier: 1 },
  { x: 50, y: 20, size: 17, opacity: 0.34, duration: 6.6, delay: 1.1, tier: 1 },
  { x: 68, y: 66, size: 24, opacity: 0.5, duration: 9.4, delay: 0.2, tier: 2 },
  { x: 40, y: 78, size: 14, opacity: 0.3, duration: 6.9, delay: 1.6, tier: 2 },
  { x: 85, y: 30, size: 19, opacity: 0.4, duration: 8.1, delay: 0.8, tier: 3 },
  { x: 92, y: 68, size: 15, opacity: 0.32, duration: 7.1, delay: 1.3, tier: 3 },
];

/* En kuglerund krop med en tydelig, adskilt løkke-håndtag ovenpå — silhuetten,
   der gør en kettlebell til en kettlebell og ikke en hængelås. */
function KettlebellIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="15.4" r="6.4" fill="currentColor" />
      <rect x="8.4" y="4.4" width="7.2" height="7.4" rx="3.6" stroke="currentColor" strokeWidth="2.1" />
    </svg>
  );
}

export function KettlebellField() {
  const { containerRef, itemRefs } = useCursorRepel<HTMLSpanElement>(KETTLEBELLS);

  return (
    <span className="ww-kb-field" ref={containerRef} aria-hidden="true">
      {KETTLEBELLS.map((k, i) => (
        <span
          key={i}
          className="ww-kb-anchor"
          data-tier={k.tier}
          style={{ left: `${k.x}%`, top: `${k.y}%` }}
          ref={(el) => { itemRefs.current[i] = el; }}
        >
          <span
            className="ww-kb-idle"
            style={{ animationDuration: `${k.duration}s`, animationDelay: `${k.delay}s`, opacity: k.opacity }}
          >
            <KettlebellIcon size={k.size} />
          </span>
        </span>
      ))}
    </span>
  );
}
