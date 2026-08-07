import { ENGINE_VERSION, EXERCISE_DATA_VERSION, RULES_VERSION } from '../engine/index.js';
import { STATE_VERSION } from './storage.js';
import type { PersistedState } from '../types.js';

export const EXPORT_SCHEMA = 'whatwork.export.v2';

export interface ExportPayload {
  schema: string;
  stateVersion: number;
  engineVersion: string;
  rulesVersion: string;
  exerciseDataVersion: string;
  exportedAt: string;
  data: Pick<PersistedState, 'profile' | 'settings' | 'history' | 'favorites' | 'program'>;
}

export function buildExport(state: PersistedState): ExportPayload {
  return {
    schema: EXPORT_SCHEMA,
    stateVersion: STATE_VERSION,
    engineVersion: ENGINE_VERSION,
    rulesVersion: RULES_VERSION,
    exerciseDataVersion: EXERCISE_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      profile: state.profile,
      settings: state.settings,
      history: state.history,
      favorites: state.favorites,
      program: state.program,
    },
  };
}

export interface ImportPreview {
  exportedAt: string;
  schema: string;
  engineVersion: string;
  workouts: number;
  favorites: number;
  hasProgram: boolean;
  profileName: string;
  /** Advarsler, der ikke gør filen ugyldig. */
  warnings: string[];
}

export type ImportResult =
  | { ok: true; preview: ImportPreview; payload: ExportPayload }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Validerer en importfil, før noget røres.
 *
 * Filen afvises som helhed, hvis bare én del ikke holder — der bliver ikke skrevet
 * halve datasæt ind over eksisterende data, og der overskrives aldrig i det stille:
 * brugeren ser altid en preview og skal bekræfte.
 */
export function parseImport(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Filen er ikke gyldig JSON. Der er ikke ændret noget.' };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: 'Filen indeholder ikke et WHATWORK-datasæt.' };
  }
  const schema = typeof parsed.schema === 'string' ? parsed.schema : '';
  if (!schema.startsWith('whatwork.export.')) {
    return { ok: false, error: 'Filen er ikke en WHATWORK-eksport. Der er ikke ændret noget.' };
  }

  const warnings: string[] = [];

  // v1 lagde profil, historik og program direkte i roden.
  const data = isRecord(parsed.data) ? parsed.data : parsed;
  const history = Array.isArray(data.history) ? data.history : null;
  const favorites = Array.isArray(data.favorites) ? data.favorites : [];
  const profile = isRecord(data.profile) ? data.profile : null;

  if (!profile) return { ok: false, error: 'Filen mangler en profil. Der er ikke ændret noget.' };
  if (history === null) return { ok: false, error: 'Filen mangler en historik. Der er ikke ændret noget.' };

  const badEntry = history.find((h) => !isRecord(h) || typeof h.id !== 'string' || !isRecord(h.workout));
  if (badEntry) {
    return { ok: false, error: 'En eller flere poster i historikken er ufuldstændige. Hele filen er afvist.' };
  }

  if (schema !== EXPORT_SCHEMA) {
    warnings.push(`Filen er fra en ældre version (${schema}). Den bliver opgraderet ved import.`);
  }
  const engineVersion = typeof parsed.engineVersion === 'string' ? parsed.engineVersion : 'ukendt';
  if (engineVersion !== ENGINE_VERSION) {
    warnings.push(
      `Workoutsene er bygget med motorversion ${engineVersion}, appen kører ${ENGINE_VERSION}. `
      + 'De kan åbnes og køres, men er ikke bygget efter de nuværende regler.',
    );
  }

  const payload: ExportPayload = {
    schema,
    stateVersion: typeof parsed.stateVersion === 'number' ? parsed.stateVersion : 1,
    engineVersion,
    rulesVersion: typeof parsed.rulesVersion === 'string' ? parsed.rulesVersion : 'ukendt',
    exerciseDataVersion: typeof parsed.exerciseDataVersion === 'string' ? parsed.exerciseDataVersion : 'ukendt',
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    data: {
      profile: profile as unknown as PersistedState['profile'],
      settings: (isRecord(data.settings) ? data.settings : undefined) as unknown as PersistedState['settings'],
      history: history,
      favorites: favorites,
      program: (isRecord(data.program) ? data.program : null) as unknown as PersistedState['program'],
    },
  };

  return {
    ok: true,
    payload,
    preview: {
      exportedAt: payload.exportedAt,
      schema,
      engineVersion,
      workouts: history.length,
      favorites: favorites.length,
      hasProgram: Boolean(payload.data.program),
      profileName: typeof profile.name === 'string' ? profile.name : 'Gæst',
      warnings,
    },
  };
}
