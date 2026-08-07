import {
  DEFAULT_BARS, DEFAULT_EQUIPMENT, DEFAULT_PLATES, EQUIPMENT_BY_ID,
} from './data/equipment.js';
import { clamp, makeSeed } from './rng.js';
import { EXERCISE_DATA_VERSION, ENGINE_VERSION, RULES_VERSION } from './version.js';
import type {
  LevelId, NormalizedRequest, ParticipantMix, Person, WorkoutRequest,
} from './types.js';

const REF_BW = { m: 88, f: 66, x: 77 } as const;

/**
 * Bygger deltagerlisten ud fra fordelingen. Det samlede antal deltagere ER summen
 * af mænd, kvinder og ikke-angivne — det er aldrig et selvstændigt felt, brugeren
 * kan sætte i konflikt med fordelingen.
 */
export function peopleFromMix(mix: ParticipantMix, level: LevelId, bw: { m: number; f: number; x: number }): Person[] {
  const total = mix.men + mix.women + mix.neutral;
  const solo = total === 1;
  const people: Person[] = [];
  for (let i = 0; i < mix.men; i++) {
    people.push({ label: solo ? 'Dig' : `Mand ${i + 1}`, profile: 'm', bodyweight: bw.m, level });
  }
  for (let i = 0; i < mix.women; i++) {
    people.push({ label: solo ? 'Dig' : `Kvinde ${i + 1}`, profile: 'f', bodyweight: bw.f, level });
  }
  for (let i = 0; i < mix.neutral; i++) {
    people.push({
      label: solo ? 'Dig' : `Deltager ${mix.men + mix.women + i + 1}`,
      profile: 'x', bodyweight: bw.x, level,
    });
  }
  return people;
}

export function normalizeRequest(raw: WorkoutRequest): NormalizedRequest {
  const level = clamp(raw.level ?? 2, 1, 5) as LevelId;

  const bw = {
    m: raw.bodyweightM ?? REF_BW.m,
    f: raw.bodyweightF ?? REF_BW.f,
    x: raw.bodyweightX ?? REF_BW.x,
  };

  let mix: ParticipantMix = {
    men: Math.max(0, Math.round(raw.men ?? 0)),
    women: Math.max(0, Math.round(raw.women ?? 0)),
    neutral: Math.max(0, Math.round(raw.neutral ?? 0)),
  };

  // Ingen fordeling angivet: fald tilbage til deltagerantallet og brugerens egen profil.
  if (mix.men + mix.women + mix.neutral === 0) {
    const n = clamp(raw.participants ?? 1, 1, 12);
    if (raw.profile === 'f') mix = { men: 0, women: n, neutral: 0 };
    else if (raw.profile === 'x') mix = { men: 0, women: 0, neutral: n };
    else mix = { men: n, women: 0, neutral: 0 };
  }

  // Loft på 12 deltagere. Overskydende skæres fra den største gruppe.
  let total = mix.men + mix.women + mix.neutral;
  while (total > 12) {
    if (mix.men >= mix.women && mix.men >= mix.neutral) mix.men--;
    else if (mix.women >= mix.neutral) mix.women--;
    else mix.neutral--;
    total--;
  }

  const people = raw.people?.length ? raw.people.slice(0, 12) : peopleFromMix(mix, level, bw);
  const participants = people.length;

  const equipment = (raw.equipment ?? DEFAULT_EQUIPMENT).slice();
  if (!equipment.includes('bodyweight')) equipment.unshift('bodyweight');

  const inventory: Record<string, number> = {};
  equipment.forEach((id) => {
    const eq = EQUIPMENT_BY_ID[id];
    inventory[id] = raw.counts?.[id] ?? eq?.def ?? 1;
  });
  inventory.bodyweight = 99;

  return {
    minutes: clamp(raw.minutes ?? 30, 8, 120),
    participants,
    mix,
    people,
    level,
    condition: clamp(raw.condition ?? 6, 1, 10),
    strength: clamp(raw.strength ?? 5, 1, 10),
    focus: raw.focus ?? 'allround',
    care: raw.care ?? [],
    included: raw.included ?? [],
    excluded: raw.excluded ?? [],
    warmup: raw.warmup !== false,
    cooldown: raw.cooldown !== false,
    inventory,
    equipment,
    plates: (raw.plates?.length ? raw.plates : DEFAULT_PLATES).slice().sort((a, b) => b - a),
    bars: (raw.bars?.length ? raw.bars : DEFAULT_BARS).slice().sort((a, b) => b - a),
    surprise: Boolean(raw.surprise),
    recentSignatures: raw.recentSignatures ?? [],
    recentPatterns: raw.recentPatterns ?? [],
    seed: raw.seed ?? makeSeed(),
    engineVersion: ENGINE_VERSION,
    rulesVersion: RULES_VERSION,
    exerciseDataVersion: EXERCISE_DATA_VERSION,
  };
}
