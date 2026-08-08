import { beforeEach, describe, expect, it } from 'vitest';
import { STATE_VERSION, STORAGE_KEY, clearState, loadState, migrate, resetConnection, saveState } from './storage.js';
import { THEME_KEY } from './storage.js';
import { applyTheme, readTheme } from './theme.js';
import { EXPORT_SCHEMA, buildExport, parseImport } from './transfer.js';
import type { PersistedState } from '../types.js';

const base: PersistedState = {
  version: STATE_VERSION,
  profile: {
    name: 'Gæst', level: 3, sex: 'f', bodyweight: 64,
    equipment: ['bodyweight', 'kettlebell'], counts: { kettlebell: 2 },
    plates: [25, 20, 15, 10, 5], bars: [20], sandbags: [10, 20, 30], onboarded: true,
  },
  settings: { theme: 'dark', aiMix: false, sound: true, haptics: true, keepAwake: true },
  history: [],
  favorites: [],
  program: null,
  timer: null,
  timerWorkout: null,
  engineVersion: '2.0.0',
  rulesVersion: '2.0.0',
  exerciseDataVersion: '2.0.0',
};

beforeEach(() => {
  resetConnection();
  localStorage.clear();
});

describe('storage', () => {
  it('gemmer og læser tilstanden igen', async () => {
    await saveState(base);
    expect(await loadState()).toEqual(base);
  });

  it('giver et tomt objekt, når der intet er gemt', async () => {
    await clearState();
    expect(await loadState()).toEqual({});
  });

  it('overlever ødelagt JSON i stedet for at kaste', async () => {
    localStorage.setItem(STORAGE_KEY, '{ dette er ikke json');
    expect(await loadState()).toEqual({});
  });

  it('afviser gemt data, der ikke er et objekt', async () => {
    localStorage.setItem(STORAGE_KEY, '[1,2,3]');
    expect(await loadState()).toEqual({});
  });
});

describe('migrering fra v1', () => {
  it('bevarer historik og profil fra den gamle localStorage-form', () => {
    const legacy = {
      profile: { name: 'Gæst', level: 2, sex: 'm', bodyweight: 82, equipment: null, counts: {}, onboarded: true },
      history: [{ id: 'gammel', title: 'Rå Motor', workout: {} }],
      program: null,
    } as unknown as Partial<PersistedState>;

    const next = migrate(legacy);
    expect(next.version).toBe(STATE_VERSION);
    expect(next.history).toHaveLength(1);
    expect(next.profile?.name).toBe('Gæst');
    expect(next.favorites).toEqual([]);
    expect(next.settings?.theme).toBe('dark');
  });

  it('omdøber gamle, opfundne workoutnavne til deres format', () => {
    const legacy = {
      profile: base.profile,
      history: [
        { id: 'a', title: 'Skarp Mile', format: 'AMRAP', workout: { formatName: 'AMRAP', title: 'Skarp Mile' } },
        { id: 'b', title: 'Makkertryk', format: 'For Time', workout: { formatName: 'For Time', title: 'Makkertryk' } },
      ],
      favorites: [{ id: 'c', title: 'Kold Havn', format: 'EMOM', workout: { formatName: 'EMOM', title: 'Kold Havn' } }],
    } as unknown as Partial<PersistedState>;

    const next = migrate(legacy);
    expect(next.history?.map((h) => h.title)).toEqual(['AMRAP', 'For Time']);
    expect(next.history?.map((h) => h.workout.title)).toEqual(['AMRAP', 'For Time']);
    expect(next.favorites?.[0]?.title).toBe('EMOM');
    expect(JSON.stringify(next)).not.toContain('Makkertryk');
  });

  it('kasserer en v1-timer, der ikke kan genoptages i den nye form', () => {
    const legacy = {
      profile: base.profile,
      history: [],
      timer: { fmt: 'amrap', total: 900, running: true } as unknown,
    } as unknown as Partial<PersistedState>;
    expect(migrate(legacy).timer).toBeNull();
  });
});

describe('tema', () => {
  it('er Dark Mode som standard', () => {
    expect(readTheme()).toBe('dark');
  });

  it('gemmer valget lokalt og bevarer det efter en ny indlæsning', () => {
    applyTheme('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(readTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    applyTheme('dark');
    expect(readTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('falder tilbage til mørk ved en ukendt værdi', () => {
    localStorage.setItem(THEME_KEY, 'neon');
    expect(readTheme()).toBe('dark');
  });
});

describe('eksport og import', () => {
  it('skriver en eksport med skemaversion', () => {
    const payload = buildExport(base);
    expect(payload.schema).toBe(EXPORT_SCHEMA);
    expect(payload.stateVersion).toBe(STATE_VERSION);
    expect(payload.data.profile.name).toBe('Gæst');
  });

  it('kan læse sin egen eksport igen', () => {
    const res = parseImport(JSON.stringify(buildExport(base)));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.preview.profileName).toBe('Gæst');
      expect(res.preview.workouts).toBe(0);
      expect(res.preview.warnings).toEqual([]);
    }
  });

  it('afviser en fil, der ikke er JSON', () => {
    const res = parseImport('ikke json');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('ikke ændret noget');
  });

  it('afviser en fremmed fil', () => {
    const res = parseImport(JSON.stringify({ schema: 'noget.andet', data: {} }));
    expect(res.ok).toBe(false);
  });

  it('afviser hele filen, hvis bare én post i historikken er ufuldstændig', () => {
    const broken = buildExport(base);
    broken.data.history = [{ id: 'ok', workout: {} }, { title: 'mangler id' }] as never;
    const res = parseImport(JSON.stringify(broken));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('afvist');
  });

  it('advarer, men accepterer, en eksport fra en ældre motorversion', () => {
    const older = { ...buildExport(base), engineVersion: '1.0.0' };
    const res = parseImport(JSON.stringify(older));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.preview.warnings.join(' ')).toContain('motorversion 1.0.0');
  });
});
