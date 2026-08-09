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
/** Formatikonerne på Hjælp vises småt og skal aldrig hente en bannerbredde. */
const THUMB = [200, 400, 640];

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
    widths: PORTRAIT, position: '50% 45%',
    alt: 'En svævende iPhone i holdsalen viser programmets mål på skærmen',
  },
  'program-info': {
    widths: PORTRAIT, position: '50% 55%',
    alt: 'Vægtstænger med stigende antal skiver i holdsalen, som illustrerer et program der bygger volumen op uge for uge',
  },
  'program-wide': {
    widths: LANDSCAPE, position: '55% 50%',
    alt: 'Færdigt træningsprogram gennemgået på telefonen i holdsalen',
  },
  'equipment-collage': {
    widths: LANDSCAPE, position: '50% 50%',
    alt: 'Redskaberne lagt frem side om side: kettlebells, vægtstang, håndvægte, sandbag, wall ball, sjippetov, ringe, skiver og plyoboks',
  },
  'moments-collage': {
    widths: LANDSCAPE, position: '50% 50%',
    alt: 'Seks træningsøjeblikke i holdsalen: wall ball, sled push, kettlebell swing, ski erg, box jump og sandbag-lunge',
  },
  'workout-anatomy': {
    widths: LANDSCAPE, position: '50% 50%',
    alt: 'Sessionen som en tidslinje: opvarmning på 10-12 minutter, derefter styrke som del 1 og conditioning som del 2',
  },

  /* Ét motiv pr. workoutformat. Navnet er formatets id, så Hjælp kan slå det op direkte. */
  'format-amrap': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner kaster sig videre til næste station midt i en runde',
  },
  'format-emom': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner står over vægtstangen og venter på, at næste minut begynder',
  },
  'format-e2mom': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner griber vægtstangen i front rack midt i et power clean',
  },
  'format-e3mom': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner hviler på ét knæ ved en air bike mellem to intervaller',
  },
  'format-e4mom': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner går væk fra roergometeret og ryster armene løs',
  },
  'format-e5mom': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner sidder på en plyoboks og henter sig helt igen',
  },
  'format-fortime': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner springer op fra en burpee på vej mod de sidste gentagelser',
  },
  'format-chipper': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner arbejder sig ned ad en lang række stationer med en sandbag',
  },
  'format-ladder': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner svinger en kettlebell med resten stillet op i stigende størrelse',
  },
  'format-interval': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner kører for fuld kraft på en air bike inde i et arbejdsinterval',
  },
  'format-strength': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner sidder i bunden af en tung back squat i stativet',
  },
  'format-strength-cond': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner går fra vægtstangen over mod roergometeret',
  },
  'format-you-go-i-go': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner arbejder på gulvet, mens makkeren venter på sin tur',
  },
  'format-partner-shared': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner deler én wall ball med sin makker',
  },
  'format-team-rotation': {
    widths: THUMB, position: '50% 45%',
    alt: 'Træner svinger kettlebell på én station, mens makkeren ror på den næste',
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

/**
 * Motivet, der hører til et workoutformat. Formaternes id'er bruger `_`, filnavnene `-`.
 * Et format uden motiv giver `null`, så et nyt format i motoren ikke vælter Hjælp.
 */
export function formatPhoto(formatId: string): PhotoName | null {
  const name = `format-${formatId.replace(/_/g, '-')}`;
  return name in SPECS ? (name as PhotoName) : null;
}

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
