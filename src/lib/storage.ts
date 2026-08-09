import type { PersistedState } from '../types.js';

/**
 * Local-first lagring.
 *
 * Data ligger i IndexedDB, fordi historik med hele workouts hurtigt bliver for stort
 * til localStorage's kvote. Findes IndexedDB ikke (jsdom, private mode i visse
 * browsere), falder laget tilbage til localStorage med samme grænseflade — kerneflowet
 * skal virke uden netværk, uden login og uden at være afhængigt af én browser-API.
 */

export const STORAGE_KEY = 'whatwork.v1';
export const DB_NAME = 'whatwork';
export const STORE = 'state';
export const RECORD_KEY = 'root';
export const STATE_VERSION = 3;

/** Temaet ligger for sig selv i localStorage, så det kan læses synkront før første paint. */
export const THEME_KEY = 'whatwork.theme';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, STATE_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function idbGet(db: IDBDatabase): Promise<unknown> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(RECORD_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

function idbPut(db: IDBDatabase, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, RECORD_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch { resolve(false); }
  });
}

function readLocal(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * v1 gav hver workout et opfundet navn ("Skarp Mile"). Titlen skal være workoutens
 * faktiske format overalt — også på det, brugeren allerede har gemt. Derfor skrives
 * de gamle titler om ved migreringen i stedet for kun at blive skjult i visningen.
 */
function retitleToFormat(entries: unknown): unknown {
  if (!Array.isArray(entries)) return entries;
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const e = entry as { title?: unknown; format?: unknown; workout?: { formatName?: unknown; title?: unknown } };
    const format = typeof e.workout?.formatName === 'string'
      ? e.workout.formatName
      : typeof e.format === 'string' ? e.format : null;
    if (!format) return entry;
    return {
      ...e,
      title: format,
      ...(e.workout ? { workout: { ...e.workout, title: format } } : {}),
    };
  });
}

/**
 * Ældre versioner gemte alt under `whatwork.v1` i localStorage uden versionsfelt.
 * Den data skal overleve opdateringen — brugeren har ikke bedt om at miste sin historik.
 */
export function migrate(raw: Partial<PersistedState> | null): Partial<PersistedState> {
  if (!raw) return {};
  if (raw.version === STATE_VERSION) return raw;

  const next: Partial<PersistedState> = { ...raw, version: STATE_VERSION };
  // v1 havde hverken indstillinger, favoritter eller skiver på profilen.
  if (!next.settings) {
    next.settings = { theme: 'dark', aiMix: false, sound: true, haptics: true, keepAwake: true };
  }
  if (!Array.isArray(next.favorites)) next.favorites = [];
  if (!Array.isArray(next.history)) next.history = [];
  next.history = retitleToFormat(next.history) as PersistedState['history'];
  next.favorites = retitleToFormat(next.favorites) as PersistedState['favorites'];
  // v1-timeren havde en helt anden form og kan ikke genoptages meningsfuldt.
  if (next.timer && typeof (next.timer as { index?: unknown }).index !== 'number') {
    next.timer = null;
    next.timerWorkout = null;
  }

  // v3 tilføjede måltal, helbredsscreening og teknisk niveau pr. øvelse på profilen.
  // Felterne oprettes tomme frem for udfyldte: et manglende tal er en reel tilstand,
  // og appen må ikke opfinde et udgangspunkt, brugeren aldrig har oplyst.
  if (next.profile) {
    const p = next.profile as unknown as Record<string, unknown>;
    if (!Array.isArray(p.benchmarks)) p.benchmarks = [];
    if (!Array.isArray(p.competence)) p.competence = [];
    if (!Array.isArray(p.weakPoints)) p.weakPoints = [];
    if (p.age === undefined) p.age = null;
    if (!p.screening || typeof p.screening !== 'object') {
      p.screening = { status: 'unknown', flags: [], pain: [], answeredAt: null };
    }
  }

  // Programudkastet fik tre nye felter. Gamle udkast pegede på de tidligere måltyper,
  // som ikke længere findes som sportsgrene — de falder tilbage til funktionel fitness.
  if (next.programDraft) {
    const d = next.programDraft as unknown as Record<string, unknown>;
    if (typeof d.baseline !== 'string') d.baseline = 'known';
    if (typeof d.eventDate !== 'string') d.eventDate = '';
    if (typeof d.division !== 'string') d.division = 'open_men';
    const sports = ['strength4', 'powerlifting', 'crossfit', 'hyrox', 'strongman', 'functional'];
    if (typeof d.goal !== 'string' || !sports.includes(d.goal)) d.goal = 'functional';
  }

  return next;
}

export async function loadState(): Promise<Partial<PersistedState>> {
  const db = await openDb();
  if (db) {
    const fromDb = await idbGet(db);
    if (fromDb && typeof fromDb === 'object') return migrate(fromDb);
    // Første kørsel efter opgraderingen: løft det gamle localStorage-indhold med over.
    const legacy = readLocal();
    if (legacy) {
      const migrated = migrate(legacy);
      await idbPut(db, migrated);
      return migrated;
    }
    return {};
  }
  return migrate(readLocal());
}

export async function saveState(state: PersistedState): Promise<void> {
  const db = await openDb();
  if (db && await idbPut(db, state)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Fx private mode eller fuld kvote. Sessionen kører videre i hukommelsen,
    // og eksisterende gemt data røres ikke.
  }
}

export async function clearState(): Promise<void> {
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch { resolve(); }
    });
  }
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignoreres bevidst */ }
}

/** Kun til test: glemmer den åbne forbindelse, så næste kald åbner forfra. */
export function resetConnection(): void {
  dbPromise = null;
}

/** Henter alle brugerens data som en fil, brugeren selv ejer. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
