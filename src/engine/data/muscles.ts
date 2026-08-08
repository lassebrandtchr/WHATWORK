import type { MuscleGroup, MuscleRegion } from '../types.js';

/**
 * Muskelgrupperne, øvelsesvælgeren filtrerer på.
 *
 * Listen er bevidst kort. Den skal kunne læses af en, der står i salen med en
 * telefon i hånden — ikke af en anatomibog. Derfor "Balder og baglår" frem for
 * glutes/hamstrings, og derfor ligger greb og kondition med, selvom de ikke er
 * muskelgrupper i streng forstand: det er dem, folk faktisk søger efter.
 */
export const MUSCLE_REGIONS: { id: MuscleRegion; name: string; allName: string }[] = [
  { id: 'upper', name: 'Overkrop', allName: 'Hele overkroppen' },
  { id: 'lower', name: 'Underkrop', allName: 'Hele underkroppen' },
  { id: 'whole', name: 'Krop og kondition', allName: 'Krop og kondition i alt' },
];

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { id: 'chest', name: 'Bryst', region: 'upper' },
  { id: 'back', name: 'Ryg', region: 'upper' },
  { id: 'shoulders', name: 'Skuldre', region: 'upper' },
  { id: 'arms', name: 'Arme', region: 'upper' },
  { id: 'legs', name: 'Ben', region: 'lower' },
  { id: 'glutes', name: 'Balder og baglår', region: 'lower' },
  { id: 'core', name: 'Mave og core', region: 'whole' },
  { id: 'cardio', name: 'Kondition', region: 'whole' },
  { id: 'grip', name: 'Greb', region: 'whole' },
  { id: 'fullbody', name: 'Hele kroppen', region: 'whole' },
];

export const MUSCLE_BY_ID: Record<string, MuscleGroup | undefined> =
  Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, m]));

export const MUSCLES_IN_REGION = (region: MuscleRegion): MuscleGroup[] =>
  MUSCLE_GROUPS.filter((m) => m.region === region);
