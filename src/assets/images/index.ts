/**
 * Fotokataloget.
 *
 * Hvert motiv ligger i tre bredder. Skærmene refererer kun til navnet — browseren
 * vælger selv bredden ud fra `sizes`, så en telefon aldrig henter en desktop-banner.
 * Filerne skrives af `npm run photos`; de rå originaler hører ikke i repoet.
 *
 * `position` er billedets fokuspunkt. Rammen skifter højde-bredde-forhold mellem
 * telefon, tablet og desktop, og fokuspunktet er det, der holder motivet i billedet,
 * når rammen beskærer.
 */

const files = import.meta.glob('./*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Liggende motiver kan fylde en desktop-banner. Stående skal kun dække en telefon. */
const LANDSCAPE = [640, 1024, 1600];
const PORTRAIT = [500, 800, 1200];

interface PhotoSpec {
  widths: number[];
  alt: string;
  /** `object-position` — hvor motivet skal holdes fast, når rammen beskærer. */
  position: string;
}

const SPECS = {
  'gen-phone-solo': {
    widths: PORTRAIT, position: '50% 42%',
    alt: 'Træner ser sin workout blive bygget på telefonen i holdsalen',
  },
  'gen-phone-duo': {
    widths: LANDSCAPE, position: '50% 38%',
    alt: 'To trænende griner over den workout, appen netop har bygget',
  },
  'gen-phone-par': {
    widths: PORTRAIT, position: '50% 40%',
    alt: 'To trænende ser sammen på den workout, appen er ved at bygge',
  },
  'wall-ball': {
    widths: LANDSCAPE, position: '45% 50%',
    alt: 'Wall ball i bunden af squatten med bolden i front rack',
  },
  'sled-push': {
    widths: LANDSCAPE, position: '50% 55%',
    alt: 'Sled push hen over gulvet med kroppen i én lige linje',
  },
  'ski-erg': {
    widths: PORTRAIT, position: '50% 45%',
    alt: 'Ski erg midt i trækket med hoften bøjet og albuerne ind til kroppen',
  },
  'kb-swing': {
    widths: LANDSCAPE, position: '50% 45%',
    alt: 'Kettlebell swing i toppen af hoftestrækket med strakte arme',
  },
  'sandbag-lunge': {
    widths: LANDSCAPE, position: '50% 55%',
    alt: 'Walking lunge med sandbag på skuldrene og bagerste knæ lige over gulvet',
  },
  'row-erg': {
    widths: LANDSCAPE, position: '50% 50%',
    alt: 'Roergometer i afslutningen af trækket med strakte ben og håndtaget inde ved ribbenene',
  },
  'box-jump-over': {
    widths: PORTRAIT, position: '50% 45%',
    alt: 'Box jump over med begge fødder fladt på plyoboksen',
  },
  thruster: {
    widths: PORTRAIT, position: '50% 42%',
    alt: 'Thruster låst helt ud med vægtstangen lodret over hovedet',
  },
  'high-five': {
    widths: LANDSCAPE, position: '50% 42%',
    alt: 'To trænende giver næve efter en gennemført workout',
  },
  'login-portrait': {
    widths: [600, 900, 1400], position: '50% 42%',
    alt: 'Holdsalen set på langs med sled push og box jumps under de sekskantede lyspaneler',
  },
  'login-landscape': {
    widths: [900, 1400, 2000], position: '50% 45%',
    alt: 'Holdsalen med sled push og box jumps under de sekskantede lyspaneler',
  },
  'chalk-barbell': {
    widths: PORTRAIT, position: '50% 45%',
    alt: 'Atlet med kridt på hænderne over vægtstangen lige før første løft',
  },
  'program-phone': {
    widths: PORTRAIT, position: '50% 40%',
    alt: 'Færdigt træningsprogram vist på telefonen med uger og pas',
  },
  'program-wide': {
    widths: LANDSCAPE, position: '55% 50%',
    alt: 'Færdigt træningsprogram gennemgået på telefonen i holdsalen',
  },
} satisfies Record<string, PhotoSpec>;

export type PhotoName = keyof typeof SPECS;

export interface PhotoAsset {
  /** Bredeste variant — fallback for browsere uden srcset. */
  src: string;
  srcSet: string;
  alt: string;
  position: string;
}

function url(name: string, width: number): string {
  const file = files[`./${name}-${width}.webp`];
  // Et manglende motiv er en byggefejl, ikke noget der først skal opdages i browseren.
  if (!file) throw new Error(`Foto mangler: ${name}-${width}.webp — kør \`npm run photos\``);
  return file;
}

const CACHE = new Map<PhotoName, PhotoAsset>();

export function photo(name: PhotoName): PhotoAsset {
  const cached = CACHE.get(name);
  if (cached) return cached;

  const spec: PhotoSpec = SPECS[name];
  const widest = spec.widths[spec.widths.length - 1] as number;
  const asset: PhotoAsset = {
    src: url(name, widest),
    srcSet: spec.widths.map((w) => `${url(name, w)} ${w}w`).join(', '),
    alt: spec.alt,
    position: spec.position,
  };
  CACHE.set(name, asset);
  return asset;
}
