import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as eng from '../engine/index.js';
import type { Program, TimerPlan, TimerSegment, Workout, WorkoutRequest } from '../engine/index.js';
import { requestAiPlan } from '../lib/aiMix.js';
import { fmtTime } from '../lib/format.js';
import { useHashRouter } from '../lib/router.js';
import { clearState, loadState, saveState, STATE_VERSION, downloadJson } from '../lib/storage.js';
import { applyTheme, readTheme } from '../lib/theme.js';
import { buildExport, parseImport } from '../lib/transfer.js';
import type { ImportPreview } from '../lib/transfer.js';
import type {
  Completion, GenDraft, GenStep, HistoryEntry, HistoryStatus, PersistedState,
  ProgramDraft, ProgramRef, Screen, Settings, ThemeId, TimerState, TimerView, UserProfile,
} from '../types.js';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Gæst',
  level: 2,
  sex: 'm',
  bodyweight: 82,
  equipment: null,
  counts: {},
  plates: eng.DEFAULT_PLATES.slice(),
  bars: eng.DEFAULT_BARS.slice(),
  onboarded: false,
};

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark', aiMix: false, sound: true, haptics: true, keepAwake: true,
};

const DEFAULT_PROGRAM_DRAFT: ProgramDraft = { goal: 'allround', weeks: 4, days: 3, minutes: 45 };

/** Referencevægt for de profiler, brugeren ikke selv har. */
const PEER_BODYWEIGHT = { m: 88, f: 66, x: 77 } as const;

/** Samlet varighed af loading-animationen. Motoren er faktisk færdig på millisekunder —
 * det her er bevidst langsommere, så det ligner, at den tænker sig om. */
const LOADING_MS = 7000;

export const ONB_STEPS = 4;

/** Et frisk generatorudkast med brugerens profil som udgangspunkt. */
export function freshGen(profile: UserProfile): GenDraft {
  const sex = profile.sex;
  return {
    minutes: 30,
    men: sex === 'm' ? 1 : 0,
    women: sex === 'f' ? 1 : 0,
    neutral: sex === 'x' ? 1 : 0,
    bwM: sex === 'm' ? profile.bodyweight : PEER_BODYWEIGHT.m,
    bwF: sex === 'f' ? profile.bodyweight : PEER_BODYWEIGHT.f,
    bwX: sex === 'x' ? profile.bodyweight : PEER_BODYWEIGHT.x,
    individualWeights: false,
    weightsM: [],
    weightsF: [],
    weightsX: [],
    level: profile.level,
    condition: 6,
    strength: 5,
    focus: 'allround',
    care: [],
    included: [],
    excluded: [],
    // Alt relevant udstyr er slået til som standard — brugeren fravælger det, salen mangler.
    equipment: (profile.equipment ?? eng.DEFAULT_EQUIPMENT).slice(),
    counts: { ...profile.counts },
    plates: (profile.plates ?? eng.DEFAULT_PLATES).slice(),
    warmup: true,
    cooldown: true,
  };
}

export const participantsOf = (g: GenDraft): number => g.men + g.women + g.neutral;

export type WeightGroupKey = 'M' | 'F' | 'X';

/** Den vægt, deltager `index` i sin kønsgruppe reelt bruger — egen værdi, hvis den er
 * individuelt justeret, ellers gruppens gennemsnit. */
export function personWeight(g: GenDraft, key: WeightGroupKey, index: number): number {
  const arr = key === 'M' ? g.weightsM : key === 'F' ? g.weightsF : g.weightsX;
  const fallback = key === 'M' ? g.bwM : key === 'F' ? g.bwF : g.bwX;
  return arr[index] ?? fallback;
}

/** Bygger den eksplicitte deltagerliste til motoren, når individuel-tilstand er aktiv.
 * Samme rækkefølge og labelkonvention som `peopleFromMix` i `engine/request.ts`. */
function individualPeople(g: GenDraft): eng.Person[] {
  const people: eng.Person[] = [];
  for (let i = 0; i < g.men; i++) {
    people.push({ label: `Mand ${i + 1}`, profile: 'm', bodyweight: personWeight(g, 'M', i), level: g.level });
  }
  for (let i = 0; i < g.women; i++) {
    people.push({ label: `Kvinde ${i + 1}`, profile: 'f', bodyweight: personWeight(g, 'F', i), level: g.level });
  }
  for (let i = 0; i < g.neutral; i++) {
    people.push({
      label: `Deltager ${g.men + g.women + i + 1}`,
      profile: 'x',
      bodyweight: personWeight(g, 'X', i),
      level: g.level,
    });
  }
  return people;
}

export const GEN_STEPS: GenStep[] = ['time', 'people', 'weight', 'level', 'direction', 'equip', 'summary'];

export const DESKTOP_QUERY = '(min-width: 1024px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (): void => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    // Enkelte miljøer (emulerede viewports, visse WebViews) udsender ikke
    // MediaQueryList-change. resize fanger dem, og setState no-op'er ved uændret værdi.
    window.addEventListener('resize', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);
  return isDesktop;
}

export interface CompleteContext {
  secs: number;
  rounds: number;
  workout: Workout;
}

/** Oversætter timerens rå tilstand til det, skærmen viser. */
export function timerView(timer: TimerState, plan: TimerPlan, now: number): TimerView {
  const index = Math.min(timer.index, plan.segments.length - 1);
  const segment = plan.segments[index] as TimerSegment;
  const running = timer.running ? now - timer.startedAt : 0;
  const elapsed = Math.max(0, Math.floor((timer.acc + running) / 1000));
  const sessionElapsed = Math.max(0, Math.floor((timer.totalAcc + timer.acc + running) / 1000));

  const remaining = segment.seconds === null ? null : segment.seconds - elapsed;
  const capLeft = segment.capSeconds === undefined ? null : segment.capSeconds - sessionElapsed;

  let tone: TimerView['tone'] = 'normal';
  if (remaining !== null) {
    if (remaining <= 10) tone = 'over';
    else if (remaining <= 30) tone = 'warn';
  } else if (capLeft !== null && capLeft <= 0) {
    tone = 'over';
  }

  return {
    segment,
    index,
    total: plan.segments.length,
    elapsed,
    remaining,
    display: remaining === null ? fmtTime(elapsed) : fmtTime(Math.max(0, remaining)),
    tone,
    sessionElapsed,
    next: plan.segments[index + 1] ?? null,
  };
}

export function useWhatwork() {
  const isDesktop = useIsDesktop();
  const router = useHashRouter('welcome');
  const { screen, go: navigate } = router;

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [onbStep, setOnbStep] = useState(0);
  const [gen, setGen] = useState<GenDraft>(() => freshGen(DEFAULT_PROFILE));
  const [genStep, setGenStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phaseText, setPhaseText] = useState('');
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** Sandt kun lige efter en ny workout er bygget — ikke når en gammel åbnes igen. */
  const [celebrate, setCelebrate] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<HistoryEntry[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(DEFAULT_PROGRAM_DRAFT);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmDialog, setConfirmDialog] = useState<'exit' | 'reset' | null>(null);
  const [completion, setCompletion] = useState<Completion>({ status: 'done', rpe: 'ok', note: '' });
  const [completeFor, setCompleteFor] = useState<CompleteContext | null>(null);
  const [wipeArmed, setWipeArmed] = useState(false);
  const [fromProgram, setFromProgram] = useState<ProgramRef | null>(null);
  const [importPreview, setImportPreview] = useState<
    { preview: ImportPreview; apply: () => void } | null
  >(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryStatus | 'all'>('all');

  const go = useCallback((next: Screen) => {
    navigate(next);
    setWipeArmed(false);
  }, [navigate]);

  /* ---------- indlæsning ---------- */

  useEffect(() => {
    applyTheme(readTheme());
    let cancelled = false;
    void (async () => {
      const savedState = await loadState();
      if (cancelled) return;
      const loadedProfile: UserProfile = { ...DEFAULT_PROFILE, ...savedState.profile };
      if (!loadedProfile.equipment) loadedProfile.equipment = eng.DEFAULT_EQUIPMENT.slice();
      if (!loadedProfile.plates?.length) loadedProfile.plates = eng.DEFAULT_PLATES.slice();
      if (!loadedProfile.bars?.length) loadedProfile.bars = eng.DEFAULT_BARS.slice();

      const loadedSettings: Settings = { ...DEFAULT_SETTINGS, ...savedState.settings, theme: readTheme() };
      const restoredTimer = savedState.timer ?? null;

      setProfile(loadedProfile);
      setSettings(loadedSettings);
      setHistory(savedState.history ?? []);
      setFavorites(savedState.favorites ?? []);
      setProgram(savedState.program ?? null);
      setTimer(restoredTimer);
      setGen(freshGen(loadedProfile));
      // En afbrudt session skal kunne genoptages, hvor den slap.
      setWorkout(restoredTimer ? savedState.timerWorkout ?? null : null);

      const fromUrl = window.location.hash.length > 1;
      if (!fromUrl) {
        navigate(loadedProfile.onboarded ? (restoredTimer ? 'timer' : 'home') : 'welcome', { replace: true });
      } else if (!loadedProfile.onboarded && screen !== 'welcome' && screen !== 'onboard') {
        navigate('welcome', { replace: true });
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
    // Kører bevidst kun ved montering — resten af appen skriver videre på den læste tilstand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- persistering ---------- */

  useEffect(() => {
    if (!ready) return; // Skriv aldrig defaults hen over rigtige data før indlæsning.
    const state: PersistedState = {
      version: STATE_VERSION,
      profile, settings, history, favorites, program, timer,
      timerWorkout: timer ? workout : null,
      engineVersion: eng.ENGINE_VERSION,
      rulesVersion: eng.RULES_VERSION,
      exerciseDataVersion: eng.EXERCISE_DATA_VERSION,
    };
    void saveState(state);
  }, [ready, profile, settings, history, favorites, program, timer, workout]);

  /* ---------- tema ---------- */

  const setTheme = useCallback((theme: ThemeId) => {
    applyTheme(theme);
    setSettings((s) => ({ ...s, theme }));
  }, []);

  /* ---------- timer ---------- */

  const plan = useMemo<TimerPlan | null>(
    () => (workout ? eng.buildTimerPlan(workout) : null),
    [workout],
  );

  useEffect(() => {
    if (!timer?.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer?.running]);

  const view = useMemo<TimerView | null>(
    () => (timer && plan ? timerView(timer, plan, now) : null),
    [timer, plan, now],
  );

  const advance = useCallback((delta: 1 | -1) => {
    setTimer((t) => {
      if (!t || !plan) return t;
      const spent = t.acc + (t.running ? Date.now() - t.startedAt : 0);
      const index = Math.min(Math.max(0, t.index + delta), plan.segments.length - 1);
      if (index === t.index) return t;
      return {
        ...t,
        index,
        acc: 0,
        startedAt: Date.now(),
        totalAcc: Math.max(0, t.totalAcc + (delta === 1 ? spent : -spent)),
      };
    });
    setNow(Date.now());
  }, [plan]);

  /*
   * Segmenter med fast varighed skifter selv; åbne segmenter venter på Næste.
   * Skiftet planlægges som en timeout til præcis det tidspunkt, segmentet udløber,
   * i stedet for at blive udløst under render. Det holder skiftet præcist, uanset
   * hvor tit komponenten gentegnes, og undgår kaskaderende renders.
   */
  const remaining = view?.remaining ?? null;
  const atLastSegment = plan ? (view?.index ?? 0) >= plan.segments.length - 1 : true;
  useEffect(() => {
    if (!timer?.running || remaining === null || atLastSegment) return;
    const id = window.setTimeout(() => advance(1), Math.max(0, remaining * 1000));
    return () => window.clearTimeout(id);
  }, [timer?.running, remaining, atLastSegment, advance]);

  const startTimer = useCallback(() => {
    if (!workout) return;
    const start = Date.now();
    setTimer({
      workoutId: workout.id,
      mode: workout.format,
      index: 0,
      running: true,
      startedAt: start,
      acc: 0,
      totalAcc: 0,
      rounds: 0,
      sessionStartedAt: start,
    });
    setNow(start);
    setConfirmDialog(null);
    go('timer');
  }, [workout, go]);

  const toggleTimer = useCallback(() => {
    setTimer((t) => {
      if (!t) return t;
      return t.running
        ? { ...t, running: false, acc: t.acc + (Date.now() - t.startedAt) }
        : { ...t, running: true, startedAt: Date.now() };
    });
    setNow(Date.now());
  }, []);

  const resetTimer = useCallback(() => {
    const start = Date.now();
    setTimer((t) => (t ? {
      ...t, index: 0, acc: 0, totalAcc: 0, running: false, startedAt: start, sessionStartedAt: start, rounds: 0,
    } : t));
    setConfirmDialog(null);
    setNow(start);
  }, []);

  const addRound = useCallback((delta: number) => {
    setTimer((t) => (t ? { ...t, rounds: Math.max(0, t.rounds + delta) } : t));
  }, []);

  /* ---------- generator ---------- */

  const patchProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
  }, []);

  const patchGen = useCallback((patch: Partial<GenDraft>) => {
    setGen((g) => ({ ...g, ...patch }));
  }, []);

  const currentStep: GenStep = GEN_STEPS[Math.min(genStep, GEN_STEPS.length - 1)] ?? 'time';

  const openGenerator = useCallback(() => {
    // Valgene bevares, hvis brugeren lige har været i generatoren; ellers bygges et
    // frisk udkast ud fra profilen.
    setGenStep(0);
    go('gen');
  }, [go]);

  const resetGenerator = useCallback(() => {
    setGen(freshGen(profile));
    setGenStep(0);
    go('gen');
  }, [profile, go]);

  const genBack = useCallback(() => {
    if (genStep === 0) go('home');
    else setGenStep((s) => s - 1);
  }, [genStep, go]);

  const recentSignatures = useMemo(
    () => history.slice(0, 8).map((h) => h.signature).filter(Boolean),
    [history],
  );

  const buildRequest = useCallback(
    (draft: GenDraft, extra?: Partial<WorkoutRequest>): WorkoutRequest => ({
      minutes: draft.minutes,
      men: draft.men,
      women: draft.women,
      neutral: draft.neutral,
      bodyweightM: draft.bwM,
      bodyweightF: draft.bwF,
      bodyweightX: draft.bwX,
      ...(draft.individualWeights && participantsOf(draft) > 1
        ? { people: individualPeople(draft) }
        : {}),
      level: draft.level,
      condition: draft.condition,
      strength: draft.strength,
      focus: draft.focus,
      care: draft.care,
      included: draft.included,
      excluded: draft.excluded,
      warmup: draft.warmup,
      cooldown: draft.cooldown,
      equipment: draft.equipment,
      counts: draft.counts,
      plates: draft.plates,
      bars: profile.bars,
      profile: profile.sex,
      recentSignatures,
      recentPatterns: history.slice(0, 3).flatMap((h) => h.patterns ?? []),
      ...extra,
    }),
    [profile.sex, profile.bars, history, recentSignatures],
  );

  const animation = useRef<number | null>(null);
  useEffect(() => () => {
    if (animation.current !== null) window.clearTimeout(animation.current);
  }, []);

  const runGenerate = useCallback(
    (draft: GenDraft = gen, extra?: Partial<WorkoutRequest>) => {
      const request = buildRequest(draft, extra);

      if (animation.current !== null) window.clearTimeout(animation.current);
      setSaved(false);
      setCelebrate(false);
      setProgress(0);
      setAiNotice(null);
      setPhaseText(eng.PHASES[0]?.text ?? '');
      go('loading');

      let phase = 0;
      let value = 0;
      let settled = false;

      const settle = (result: eng.GenerateResult): void => {
        if (settled) return;
        settled = true;
        if (result.ok) {
          setWorkout(result.workout);
          setGenError(null);
          setFromProgram(null);
          setCelebrate(true);
        } else {
          setWorkout(null);
          setGenError(result.error);
        }
        go('result');
      };

      // AI Mix er et lag ovenpå. Svarer det ikke, eller er der ingen nøgle, bygges
      // workouten alene af den lokale Smart Mix-generator.
      const compute = async (): Promise<eng.GenerateResult> => {
        if (!settings.aiMix) return eng.generateWorkout(request);
        const outcome = await requestAiPlan(request, recentSignatures);
        if (!outcome.plan) {
          setAiNotice(`${outcome.reason} Smart Mix byggede workouten lokalt.`);
          return eng.generateWorkout(request);
        }
        return eng.generateWorkout(request, { aiPlan: outcome.plan });
      };

      const pending = compute();

      const step = (): void => {
        const ph = eng.PHASES[phase];
        if (!ph) {
          void pending.then((result) => {
            animation.current = window.setTimeout(() => settle(result), 200);
          });
          return;
        }
        setPhaseText(ph.text);
        // Genereringen er lokal og tager få millisekunder — uden animation ville skærmen
        // blinke forbi på et øjeblik. Faserne strækkes derfor ud over ca. LOADING_MS,
        // proportionalt med hver fases andel af fremdriftsbjælken, så det ligner, at
        // motoren reelt bruger tid på at bygge netop denne workout.
        const from = value;
        const span = ph.to - from;
        const phaseDurationMs = Math.max(400, Math.round((span / 100) * LOADING_MS));
        const startedAt = Date.now();
        const tick = (): void => {
          const t = Math.min(1, (Date.now() - startedAt) / phaseDurationMs);
          value = Math.round(from + span * t);
          setProgress(value);
          if (t < 1) {
            animation.current = window.setTimeout(tick, 60);
          } else {
            value = ph.to;
            setProgress(value);
            phase += 1;
            animation.current = window.setTimeout(step, 40);
          }
        };
        tick();
      };

      animation.current = window.setTimeout(step, 30);
    },
    [gen, buildRequest, go, settings.aiMix, recentSignatures],
  );

  const genNext = useCallback(() => {
    if (genStep >= GEN_STEPS.length - 1) runGenerate();
    else setGenStep((s) => s + 1);
  }, [genStep, runGenerate]);

  const surpriseMe = useCallback(() => {
    const draft: GenDraft = { ...freshGen(profile), minutes: 30, condition: 7, strength: 5 };
    setGen(draft);
    runGenerate(draft, { surprise: true, seed: eng.makeSeed() });
  }, [profile, runGenerate]);

  /** Ny seed, samme constraints. */
  const regenerate = useCallback(() => {
    runGenerate(gen, { seed: eng.makeSeed() });
  }, [gen, runGenerate]);

  /** Skruer kondition og styrke ned/op og bygger forfra på det samme grundlag. */
  const nudge = useCallback(
    (direction: 'easier' | 'harder') => {
      const draft: GenDraft = direction === 'easier'
        ? { ...gen, condition: Math.max(1, gen.condition - 2), strength: Math.max(1, gen.strength - 2) }
        : { ...gen, condition: Math.min(10, gen.condition + 2), strength: Math.min(10, gen.strength + 1) };
      setGen(draft);
      runGenerate(draft, { seed: eng.makeSeed() });
    },
    [gen, runGenerate],
  );

  /* ---------- resultat, historik og favoritter ---------- */

  const entryFor = useCallback(
    (w: Workout, status: HistoryStatus, result = '', rpe: HistoryEntry['rpe'] = ''): HistoryEntry => ({
      id: `${w.id}_${Date.now()}`,
      title: w.title,
      format: w.formatName,
      minutes: w.estimatedMinutes,
      date: new Date().toISOString(),
      status,
      rpe,
      result,
      patterns: w.blocks.flatMap((b) => b.movements.map((m) => eng.BY_ID[m.exerciseId]?.cat ?? 'ukendt')),
      signature: w.signature,
      workout: w,
    }),
    [],
  );

  const saveWorkout = useCallback(() => {
    if (saved || !workout) return;
    setHistory((h) => [entryFor(workout, 'saved'), ...h]);
    setSaved(true);
  }, [saved, workout, entryFor]);

  const isFavorite = useCallback(
    (w: Workout | null): boolean => Boolean(w && favorites.some((f) => f.workout.id === w.id)),
    [favorites],
  );

  const toggleFavorite = useCallback((w: Workout | null) => {
    if (!w) return;
    setFavorites((list) => (
      list.some((f) => f.workout.id === w.id)
        ? list.filter((f) => f.workout.id !== w.id)
        : [entryFor(w, 'saved'), ...list]
    ));
  }, [entryFor]);

  const openWorkout = useCallback((w: Workout, ref: ProgramRef | null = null) => {
    setWorkout(w);
    setGenError(null);
    setSaved(true);
    setFromProgram(ref);
    go('result');
  }, [go]);

  const removeHistory = useCallback((id: string) => {
    setHistory((h) => h.filter((e) => e.id !== id));
  }, []);

  /* ---------- afslutning ---------- */

  const openCompletion = useCallback(
    (status: HistoryStatus) => {
      if (!workout) return;
      setCompleteFor({ secs: view?.sessionElapsed ?? 0, rounds: timer?.rounds ?? 0, workout });
      setCompletion({ status, rpe: 'ok', note: '' });
      setTimer(null);
      setConfirmDialog(null);
      go('complete');
    },
    [workout, view, timer, go],
  );

  const saveCompletion = useCallback(() => {
    if (!completeFor) return;
    const { workout: w, secs, rounds } = completeFor;
    const mins = Math.floor(secs / 60);
    const rest = secs % 60;
    const result = completion.note
      || (rounds ? `${rounds} runder` : `${mins}:${String(rest).padStart(2, '0')}`);
    setHistory((h) => [entryFor(w, completion.status, result, completion.rpe), ...h]);

    // Kom workouten fra en programdag, skal dagen have status med — og resten af
    // programmet kan bruge den til at justere sig.
    if (fromProgram && program) {
      const next = structuredClone(program);
      const day = next.weeks[fromProgram.w]?.days[fromProgram.d];
      if (day) day.status = completion.status === 'done' ? 'done' : 'partial';
      setProgram(next);
    }

    setCompleteFor(null);
    go('history');
  }, [completeFor, completion, fromProgram, program, entryFor, go]);

  /* ---------- program ---------- */

  const buildProgram = useCallback(() => {
    setProgram(eng.generateProgram({
      goal: programDraft.goal,
      weeks: programDraft.weeks,
      daysPerWeek: programDraft.days,
      minutes: programDraft.minutes,
      level: profile.level,
      profile: profile.sex,
      bodyweight: profile.bodyweight,
      equipment: profile.equipment ?? eng.DEFAULT_EQUIPMENT,
      counts: profile.counts,
      plates: profile.plates,
      care: [],
    }));
  }, [programDraft, profile]);

  const patchProgramDay = useCallback((ref: ProgramRef, patch: Partial<Program['weeks'][number]['days'][number]>) => {
    setProgram((p) => {
      if (!p) return p;
      const next = structuredClone(p);
      const day = next.weeks[ref.w]?.days[ref.d];
      if (day) Object.assign(day, patch);
      return next;
    });
  }, []);

  const regenerateDay = useCallback((ref: ProgramRef) => {
    setProgram((p) => {
      if (!p) return p;
      const next = structuredClone(p);
      const day = next.weeks[ref.w]?.days[ref.d];
      if (!day) return next;
      const res = eng.generateWorkout({
        minutes: p.minutes,
        level: p.level,
        equipment: p.equipment,
        men: profile.sex === 'f' || profile.sex === 'x' ? 0 : 1,
        women: profile.sex === 'f' ? 1 : 0,
        neutral: profile.sex === 'x' ? 1 : 0,
        seed: eng.makeSeed(),
        recentSignatures,
      }, { maxCandidates: 16 });
      day.workout = res.ok ? res.workout : null;
      day.error = res.ok ? null : res.error;
      day.status = 'planned';
      return next;
    });
  }, [profile.sex, recentSignatures]);

  const moveProgramDay = useCallback((ref: ProgramRef, delta: number) => {
    setProgram((p) => {
      if (!p) return p;
      const next = structuredClone(p);
      const week = next.weeks[ref.w];
      if (!week) return next;
      const target = ref.d + delta;
      if (target < 0 || target >= week.days.length) return next;
      const days = week.days;
      const a = days[ref.d];
      const b = days[target];
      if (!a || !b) return next;
      days[ref.d] = b;
      days[target] = a;
      days.forEach((d, i) => { d.day = i + 1; });
      return next;
    });
  }, []);

  /* ---------- data ---------- */

  const stateSnapshot = useCallback((): PersistedState => ({
    version: STATE_VERSION,
    profile, settings, history, favorites, program, timer: null, timerWorkout: null,
    engineVersion: eng.ENGINE_VERSION,
    rulesVersion: eng.RULES_VERSION,
    exerciseDataVersion: eng.EXERCISE_DATA_VERSION,
  }), [profile, settings, history, favorites, program]);

  const exportData = useCallback(() => {
    downloadJson(buildExport(stateSnapshot()), 'whatwork-data.json');
  }, [stateSnapshot]);

  /** Filen valideres fuldt ud, før noget skrives. Brugeren ser en preview først. */
  const stageImport = useCallback((text: string) => {
    setImportError(null);
    setImportPreview(null);
    const parsed = parseImport(text);
    if (!parsed.ok) { setImportError(parsed.error); return; }
    setImportPreview({
      preview: parsed.preview,
      apply: () => {
        const d = parsed.payload.data;
        setProfile((p) => ({ ...p, ...d.profile, onboarded: true }));
        if (d.settings) {
          setSettings((s) => ({ ...s, ...d.settings }));
          if (d.settings.theme) applyTheme(d.settings.theme);
        }
        setHistory(d.history ?? []);
        setFavorites(d.favorites ?? []);
        setProgram(d.program ?? null);
        setImportPreview(null);
      },
    });
  }, []);

  /** Første tryk bevæbner, andet tryk sletter — sletning skal koste to bevidste valg. */
  const wipeData = useCallback(() => {
    if (!wipeArmed) { setWipeArmed(true); return; }
    setHistory([]);
    setFavorites([]);
    setProgram(null);
    setTimer(null);
    setWipeArmed(false);
    void clearState();
  }, [wipeArmed]);

  /* ---------- onboarding ---------- */

  const onbNext = useCallback(() => {
    if (onbStep >= ONB_STEPS - 1) {
      const next: UserProfile = { ...profile, onboarded: true };
      setProfile(next);
      setGen(freshGen(next));
      go('home');
    } else {
      setOnbStep((s) => s + 1);
    }
  }, [onbStep, profile, go]);

  const onbBack = useCallback(() => {
    if (onbStep === 0) go('welcome');
    else setOnbStep((s) => s - 1);
  }, [onbStep, go]);

  const startOnboarding = useCallback(() => {
    setOnbStep(0);
    go('onboard');
  }, [go]);

  const filteredHistory = useMemo(
    () => (historyFilter === 'all' ? history : history.filter((h) => h.status === historyFilter)),
    [history, historyFilter],
  );

  return {
    ready, screen, go, isDesktop,
    profile, patchProfile,
    settings, setSettings, setTheme,
    onbStep, onbNext, onbBack, startOnboarding, setOnbStep,
    gen, patchGen, setGen, openGenerator, resetGenerator,
    genStep, setGenStep, steps: GEN_STEPS, currentStep, genBack, genNext,
    participants: participantsOf(gen),
    progress, phaseText,
    workout, genError, aiNotice, saved,
    celebrate, setCelebrate,
    runGenerate, surpriseMe, regenerate, nudge,
    saveWorkout, openWorkout, isFavorite, toggleFavorite,
    history, filteredHistory, historyFilter, setHistoryFilter, removeHistory, favorites,
    program, programDraft, setProgramDraft, buildProgram,
    dropProgram: () => setProgram(null), patchProgramDay, regenerateDay, moveProgramDay,
    timer, plan, view, startTimer, toggleTimer, resetTimer, addRound, advance,
    confirmDialog, setConfirmDialog, openCompletion,
    completion, setCompletion, completeFor, saveCompletion,
    fromProgram,
    wipeArmed, wipeData, exportData, stageImport, importPreview, importError, setImportPreview,
  };
}

export type Whatwork = ReturnType<typeof useWhatwork>;
