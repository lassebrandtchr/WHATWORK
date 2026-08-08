import type { ReactElement } from 'react';

/**
 * Egne udstyrssymboler. Hvert ikon tegner det konkrete redskab — en håndvægt ligner
 * en håndvægt, en romaskine ligner en romaskine — så udstyrsvælgeren kan læses uden
 * at læse teksten. Der bruges hverken emoji eller et eksternt ikonbibliotek.
 *
 * Alle er tegnet i et 24×24-grid med samme streg, så de står som ét sæt.
 */

const S = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const GLYPHS: Record<string, ReactElement> = {
  /* Håndvægt: to plader i hver ende af et kort greb. */
  dumbbell: (
    <g {...S}>
      <path d="M3 9v6M6 7v10M18 7v10M21 9v6" />
      <path d="M6 12h12" />
    </g>
  ),
  /* Kettlebell: bøjle over en rund klokke. */
  kettlebell: (
    <g {...S}>
      <path d="M9.4 11.4V8.9a2.6 2.6 0 0 1 5.2 0v2.5" />
      <path d="M9 11.4h6" />
      <circle cx="12" cy="15.4" r="4.6" />
    </g>
  ),
  /* Vægtstang med skiver i begge ender. */
  barbell: (
    <g {...S}>
      <path d="M2 10v4M4.6 7.5v9M19.4 7.5v9M22 10v4" />
      <path d="M4.6 12h14.8" />
      <path d="M7.4 9.5v5M16.6 9.5v5" />
    </g>
  ),
  /* Romaskine: skinne, sæde og håndtag i kæde. */
  rower: (
    <g {...S}>
      <path d="M3 18h18" />
      <path d="M5 18v-2.4h13V18" />
      <rect x="8.4" y="12" width="4.4" height="2.6" rx="0.8" />
      <path d="M4.6 15.6 4.6 9.6a1.6 1.6 0 0 1 1.6-1.6h1.6" />
      <path d="M7.8 8v3.4M6 8h3.6" />
    </g>
  ),
  /* SkiERG: søjle med to håndtag i snore. */
  skierg: (
    <g {...S}>
      <path d="M8 20h8" />
      <path d="M12 20V6" />
      <rect x="8.6" y="3.4" width="6.8" height="3.2" rx="1" />
      <path d="M10.2 6.6v5.2M13.8 6.6v5.2" />
      <path d="M8.8 11.8h2.8M12.4 11.8h2.8" />
    </g>
  ),
  /* BikeERG: siddecykel med kranke. */
  bikeerg: (
    <g {...S}>
      <circle cx="6" cy="16.4" r="3.4" />
      <circle cx="18" cy="16.4" r="3.4" />
      <path d="M6 16.4 10 9h4.6" />
      <path d="m10 9 5.4 7.4" />
      <path d="M13.4 5.4h3.2M15 5.4V9" />
    </g>
  ),
  /* Fan bike: hjul med vinger plus styr. */
  assaultbike: (
    <g {...S}>
      <circle cx="9" cy="13.6" r="5" />
      <path d="M9 8.6v10M4 13.6h10M5.6 10.2l6.8 6.8M12.4 10.2l-6.8 6.8" />
      <path d="M17 19.4V9.6M15 4.6h4M17 4.6v5M14.6 19.4h4.8" />
    </g>
  ),
  /* Slæde: mede med lodret stolpe og skive. */
  sled: (
    <g {...S}>
      <path d="M3 18.6h13.4a3 3 0 0 0 3-3" />
      <path d="M5.4 18.6V13h8v5.6" />
      <path d="M9.4 13V6.4M6.6 6.4h5.6" />
      <path d="M11.4 8.2h4.2M13.5 6.6v3.2" />
    </g>
  ),
  /* Plyobox: kasse i perspektiv. */
  box: (
    <g {...S}>
      <path d="M4 9.4 12 6l8 3.4-8 3.4z" />
      <path d="M4 9.4v5.2L12 18l8-3.4V9.4" />
      <path d="M12 12.8V18" />
    </g>
  ),
  /* Justerbar bænk: skrå flade på ben, med hævet ryglæn. */
  bench: (
    <g {...S}>
      <path d="M3 16 11 12.4" />
      <path d="M11 12.4V8l6-2.6" />
      <path d="M5 16v4M9.4 13.7v4M17 5.9v4" />
    </g>
  ),
  /* Pull-up-stang: stativ med tværstang. */
  pullupbar: (
    <g {...S}>
      <path d="M3 6.4h18" />
      <path d="M5.4 6.4V19M18.6 6.4V19" />
      <path d="M3.4 19h4M16.6 19h4" />
      <path d="M9.6 6.4v3.2M14.4 6.4v3.2" />
    </g>
  ),
  /* Wall ball: bold på vej mod et mål på væggen. */
  wallball: (
    <g {...S}>
      <rect x="13" y="3.4" width="7.6" height="4.6" rx="0.8" />
      <circle cx="8.2" cy="15.4" r="4.6" />
      {/* Sømmene gør bolden til en bold og ikke et hjul. */}
      <path d="M4.6 12.4c2.2 1 5 1 7.2 0M4.6 18.4c2.2-1 5-1 7.2 0" />
      <path d="m11.8 11.6 2.6-2.8" />
    </g>
  ),
  /* Sandbag: sæk med håndtag og syninger. */
  sandbag: (
    <g {...S}>
      <path d="M5 9.6h14l-1.2 8.2a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4z" />
      <path d="M7.4 9.6V6.8a1.4 1.4 0 0 1 1.4-1.4h6.4a1.4 1.4 0 0 1 1.4 1.4v2.8" />
      <path d="M9.6 12.6h4.8M9.2 15.6h5.6" />
    </g>
  ),
  /* Gymnastikringe. */
  rings: (
    <g {...S}>
      <path d="M8 3.6v6.2M16 3.6v6.2" />
      <circle cx="8" cy="14.4" r="4.4" />
      <circle cx="16" cy="14.4" r="4.4" />
    </g>
  ),
  /* Sjippetov. */
  jumprope: (
    <g {...S}>
      <path d="M6 6.4v3.2M18 6.4v3.2" />
      <path d="M6 9.6c-3 3-3 8.4 6 8.4s6-5.4 6-8.4" />
    </g>
  ),
  /* Elastik. */
  band: (
    <g {...S}>
      <path d="M4.6 12a3 3 0 0 1 3-3h8.8a3 3 0 0 1 0 6H7.6a3 3 0 0 1-3-3z" />
      <path d="M8.6 9.2v5.6M15.4 9.2v5.6" />
    </g>
  ),
  /* Kurvet løbebånd. */
  airrunner: (
    <g {...S}>
      <path d="M4 17.4c1.6-5.6 5-8.4 8-8.4s5 1.6 6.4 3.6" />
      <path d="M4 17.4h14.6" />
      <path d="M5.6 19.6h13" />
      <path d="M18.4 12.6V6.4h2.2" />
    </g>
  ),
  /* Løb udenfor. */
  run: (
    <g {...S}>
      <circle cx="15.4" cy="5" r="1.8" />
      <path d="m8 20 2.6-4.6 3-1.6-1-4.2-3.4 2-1.4 3" />
      <path d="m13.6 13.8 3 2.2 1 4" />
    </g>
  ),
  /* Kropsvægt. */
  bodyweight: (
    <g {...S}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7.4V14M7 10h10M9.4 20l2.6-6 2.6 6" />
    </g>
  ),
};

export function EquipmentIcon({ id, size = 28 }: { id: string; size?: number }) {
  const glyph = GLYPHS[id] ?? GLYPHS.bodyweight;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {glyph}
    </svg>
  );
}

export const hasEquipmentIcon = (id: string): boolean => id in GLYPHS;
