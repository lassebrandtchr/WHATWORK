/**
 * Rule-set registry.
 *
 * Regler, divisioner og vægte ændrer sig fra sæson til sæson. Registret her gemmer
 * hver version for sig, så et program, der er bygget på 25/26-reglerne, bliver ved
 * med at være bygget på dem — også efter at 26/27 er lagt ind. Den officielle
 * rulebook er source of truth; det her er et dateret snapshot med kildehenvisning.
 */

import type { RuleSetRef } from './types.js';

export interface HyroxStation {
  id: string;
  name: string;
  /** Rækkefølge i racet, 1-8. */
  order: number;
  unit: 'm' | 'reps' | 'kcal';
  /** Distance eller reps pr. division. */
  amount: Record<string, number>;
  /** Belastning i kg pr. division. Udeladt for stationer uden ekstern vægt. */
  loadKg?: Record<string, number>;
  /** Sandt når resultatet kun kan sammenlignes med kendt underlag/friktion. */
  surfaceSensitive?: boolean;
}

export interface HyroxRuleSet {
  ref: RuleSetRef;
  divisions: string[];
  runSegments: number;
  runDistanceM: number;
  stations: HyroxStation[];
  /**
   * Sandt når snapshottet ikke er verificeret mod den aktuelle rulebook i denne
   * sæson. Motoren skal så vise en advarsel frem for at foregive autoritet.
   */
  needsRevalidation: boolean;
}

const HYROX_SOURCE = 'https://hyrox.com/rulebook/';

/**
 * Snapshot pr. 9. august 2026, som beskrevet i researchgrundlaget.
 *
 * Værdierne er de offentligt publicerede stationsformater. De er hverken hentet
 * live eller verificeret mod en ny sæson, og `needsRevalidation` er derfor sat —
 * appen skal bede brugeren bekræfte division og loads mod rulebooken, før et
 * konkurrencespecifikt program regnes som autoritativt.
 */
const HYROX_2526: HyroxRuleSet = {
  ref: {
    organization: 'HYROX',
    version: '2026-08-09-snapshot',
    season: '25/26',
    checkedAt: '2026-08-09',
    sourceUrl: HYROX_SOURCE,
  },
  divisions: ['open_men', 'open_women', 'pro_men', 'pro_women'],
  runSegments: 8,
  runDistanceM: 1000,
  needsRevalidation: true,
  stations: [
    {
      id: 'skierg', name: 'SkiErg', order: 1, unit: 'm',
      amount: { open_men: 1000, open_women: 1000, pro_men: 1000, pro_women: 1000 },
    },
    {
      id: 'sled_push', name: 'Sled Push', order: 2, unit: 'm',
      amount: { open_men: 50, open_women: 50, pro_men: 50, pro_women: 50 },
      loadKg: { open_men: 152, open_women: 102, pro_men: 202, pro_women: 152 },
      surfaceSensitive: true,
    },
    {
      id: 'sled_pull', name: 'Sled Pull', order: 3, unit: 'm',
      amount: { open_men: 50, open_women: 50, pro_men: 50, pro_women: 50 },
      loadKg: { open_men: 103, open_women: 78, pro_men: 153, pro_women: 103 },
      surfaceSensitive: true,
    },
    {
      id: 'burpee_broad_jump', name: 'Burpee Broad Jumps', order: 4, unit: 'm',
      amount: { open_men: 80, open_women: 80, pro_men: 80, pro_women: 80 },
    },
    {
      id: 'row', name: 'Romaskine', order: 5, unit: 'm',
      amount: { open_men: 1000, open_women: 1000, pro_men: 1000, pro_women: 1000 },
    },
    {
      id: 'farmers_carry', name: 'Farmers Carry', order: 6, unit: 'm',
      amount: { open_men: 200, open_women: 200, pro_men: 200, pro_women: 200 },
      loadKg: { open_men: 2 * 24, open_women: 2 * 16, pro_men: 2 * 32, pro_women: 2 * 24 },
    },
    {
      id: 'sandbag_lunges', name: 'Sandbag Lunges', order: 7, unit: 'm',
      amount: { open_men: 100, open_women: 100, pro_men: 100, pro_women: 100 },
      loadKg: { open_men: 20, open_women: 10, pro_men: 30, pro_women: 20 },
    },
    {
      id: 'wall_balls', name: 'Wall Balls', order: 8, unit: 'reps',
      amount: { open_men: 100, open_women: 100, pro_men: 100, pro_women: 100 },
      loadKg: { open_men: 6, open_women: 4, pro_men: 9, pro_women: 6 },
    },
  ],
};

export const HYROX_DIVISION_LABELS: Record<string, string> = {
  open_men: 'Open, herrer',
  open_women: 'Open, kvinder',
  pro_men: 'Pro, herrer',
  pro_women: 'Pro, kvinder',
};

/* ---------- IPF ---------- */

export interface PowerliftingRuleSet {
  ref: RuleSetRef;
  /** De officielle konkurrenceløft. Overhead press er bevidst ikke med. */
  competitionLifts: ('squat' | 'bench' | 'deadlift')[];
  attemptsPerLift: number;
  equipmentClasses: string[];
  needsRevalidation: boolean;
}

const IPF_SNAPSHOT: PowerliftingRuleSet = {
  ref: {
    organization: 'IPF',
    version: '2026-08-09-snapshot',
    checkedAt: '2026-08-09',
    sourceUrl: 'https://www.powerlifting.sport/rules/codes/info/technical-rules',
  },
  competitionLifts: ['squat', 'bench', 'deadlift'],
  attemptsPerLift: 3,
  equipmentClasses: ['classic', 'equipped'],
  needsRevalidation: true,
};

/* ---------- CrossFit ---------- */

export interface CrossfitRuleSet {
  ref: RuleSetRef;
  /** Den officielle implementeringsrækkefølge. */
  progression: ['mechanics', 'consistency', 'intensity'];
  needsRevalidation: boolean;
}

const CROSSFIT_SNAPSHOT: CrossfitRuleSet = {
  ref: {
    organization: 'CrossFit',
    version: 'level1-guide',
    checkedAt: '2026-08-09',
    sourceUrl: 'https://library.crossfit.com/free/pdf/CFJ_English_Level1_TrainingGuide.pdf',
  },
  progression: ['mechanics', 'consistency', 'intensity'],
  needsRevalidation: false,
};

/* ---------- Registry ---------- */

const HYROX_VERSIONS: Record<string, HyroxRuleSet> = {
  [HYROX_2526.ref.version]: HYROX_2526,
};

export const CURRENT_HYROX_VERSION = HYROX_2526.ref.version;

/**
 * Henter en HYROX-regelversion.
 *
 * Bemærk at der bevidst ikke er nogen fallback til "nyeste": et program, der er
 * bygget på en version, appen ikke længere kender, skal fejle synligt frem for at
 * blive stiltiende omregnet til nye loads.
 */
export function hyroxRules(version: string = CURRENT_HYROX_VERSION): HyroxRuleSet | null {
  return HYROX_VERSIONS[version] ?? null;
}

export function powerliftingRules(): PowerliftingRuleSet {
  return IPF_SNAPSHOT;
}

export function crossfitRules(): CrossfitRuleSet {
  return CROSSFIT_SNAPSHOT;
}

/** Stationsbelastning for en division i en bestemt regelversion. */
export function stationLoad(
  stationId: string,
  division: string,
  version: string = CURRENT_HYROX_VERSION,
): { loadKg: number | null; amount: number | null; ref: RuleSetRef } | null {
  const rules = hyroxRules(version);
  if (!rules) return null;
  const station = rules.stations.find((s) => s.id === stationId);
  if (!station) return null;
  return {
    loadKg: station.loadKg?.[division] ?? null,
    amount: station.amount[division] ?? null,
    ref: rules.ref,
  };
}

/** Samler de regelversioner, en session eller et program faktisk brugte. */
export function ruleVersionsFor(refs: (RuleSetRef | null | undefined)[]): Record<string, string> {
  const out: Record<string, string> = {};
  refs.forEach((r) => {
    if (r) out[r.organization] = r.version;
  });
  return out;
}
