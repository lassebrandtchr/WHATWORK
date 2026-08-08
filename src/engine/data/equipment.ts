import type { CareArea, EquipmentItem, FocusTag, Level } from '../types.js';

/**
 * Udstyrslisten. `onByDefault` betyder, at typen er slået til, når brugeren åbner
 * generatoren — brugeren fravælger det, salen ikke har, i stedet for at tilvælge alt.
 */
export const EQUIPMENT: EquipmentItem[] = [
  { id: 'bodyweight', name: 'Kropsvægt', always: true, onByDefault: true },
  { id: 'dumbbell', name: 'Håndvægte', countable: true, def: 20, onByDefault: true, hint: 'Par eller enkelt' },
  { id: 'kettlebell', name: 'Kettlebells', countable: true, def: 20, onByDefault: true, hint: 'Svinger og bærer' },
  { id: 'barbell', name: 'Vægtstang', countable: true, def: 8, onByDefault: true, hint: 'Med skiver' },
  { id: 'rower', name: 'RowERG', machine: true, countable: true, def: 2, onByDefault: true, hint: 'Romaskine' },
  { id: 'skierg', name: 'SkiERG', machine: true, countable: true, def: 2, onByDefault: true, hint: 'Skimaskine' },
  { id: 'bikeerg', name: 'BikeERG', machine: true, countable: true, def: 2, onByDefault: true, hint: 'Cykelergometer' },
  { id: 'assaultbike', name: 'Assault Bike', machine: true, countable: true, def: 1, onByDefault: true, hint: 'Fan bike' },
  { id: 'sled', name: 'Slæde', countable: true, def: 1, onByDefault: true, hint: 'Skub og træk' },
  { id: 'box', name: 'Box', countable: true, def: 5, onByDefault: true, hint: 'Plyobox' },
  { id: 'bench', name: 'Justerbar bænk', countable: true, def: 2, onByDefault: true, hint: 'Fladt til skrå, 0–70°' },
  { id: 'pullupbar', name: 'Pull-up bar', countable: true, def: 6, onByDefault: true, hint: 'Stang at hænge i' },
  { id: 'wallball', name: 'Wall ball', countable: true, def: 10, onByDefault: true, hint: 'Bold og mål' },
  { id: 'sandbag', name: 'Sandbag', countable: true, def: 8, onByDefault: true, hint: 'Træningssæk' },
  { id: 'rings', name: 'Ringe', countable: true, def: 4, onByDefault: true, hint: 'Gymnastikringe' },
  { id: 'jumprope', name: 'Sjippetov', countable: true, def: 2, onByDefault: false, hint: 'Single og double unders' },
  { id: 'band', name: 'Elastikker', countable: true, def: 6, onByDefault: true, hint: 'Assistance og mobilitet' },
  { id: 'airrunner', name: 'Air Runner', machine: true, countable: true, def: 1, onByDefault: true, hint: 'Kurvet løbebånd' },
  { id: 'run', name: 'Løb udenfor', countable: false, onByDefault: true, hint: 'Plads til at løbe ude' },
];

/** Alt med `onByDefault` — det brugeren møder som forvalgt. */
export const DEFAULT_EQUIPMENT: string[] = EQUIPMENT
  .filter((e) => e.onByDefault)
  .map((e) => e.id);

export const EQUIPMENT_BY_ID: Record<string, EquipmentItem | undefined> =
  Object.fromEntries(EQUIPMENT.map((e) => [e.id, e]));

/** Skivestørrelser i kg. Brugeren kan fravælge dem, salen ikke har. */
export const PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Stænger i kg. 20 kg er standard, 15 kg findes i de fleste sale. */
export const BAR_SIZES = [20, 15, 10];
export const DEFAULT_BARS = [20, 15];

/** Sandbags i kg — faste vægte, som findes i de fleste sale. */
export const SANDBAG_SIZES = [10, 20, 30];
export const DEFAULT_SANDBAGS = [10, 20, 30];

export const CARE_AREAS: CareArea[] = [
  { id: 'shoulder', name: 'Skuldre' },
  { id: 'back', name: 'Lænd' },
  { id: 'knee', name: 'Knæ' },
  { id: 'wrist', name: 'Håndled' },
  { id: 'hip', name: 'Hofte' },
];

export const FOCUS_TAGS: FocusTag[] = [
  { id: 'allround', name: 'Allround', desc: 'Bredt — lidt af det hele' },
  { id: 'pulse', name: 'Puls', desc: 'Høj puls hele vejen' },
  { id: 'heavy', name: 'Tung', desc: 'Færre reps, mere vægt' },
  { id: 'legs', name: 'Ben', desc: 'Squat, lunges og hinge' },
  { id: 'upper', name: 'Overkrop', desc: 'Pres og træk' },
  { id: 'engine', name: 'Engine', desc: 'Maskiner og jævnt tempo' },
  { id: 'fast', name: 'Hurtig & brutal', desc: 'Kort, tæt og hård' },
  { id: 'long', name: 'Lang & sej', desc: 'Længere arbejde, lavere intensitet' },
];

export const LEVELS: Level[] = [
  { id: 1, name: 'Begynder', desc: 'Sikre varianter, tydelige pauser' },
  { id: 2, name: 'Let øvet', desc: 'Grundlæggende vægtstang og kondition' },
  { id: 3, name: 'Øvet', desc: 'Bredere bibliotek, mere tæthed' },
  { id: 4, name: 'Avanceret', desc: 'Høj volumen og komplekse løft' },
  { id: 5, name: 'Elite', desc: 'Egne benchmarks styrer skaleringen' },
];
