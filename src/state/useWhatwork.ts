import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as eng from '../engine/index.js';
import type { Program, TimerPlan, TimerSegment, Workout, WorkoutRequest } from '../engine/index.js';
import * as prog from '../program/index.js';
import { emptyScreening } from '../domain/safety.js';
import { createSession } from '../domain/history.js';
import type { SessionState } from '../domain/history.js';
import { DOMAIN_VERSION, ONTOLOGY_VERSION } from '../domain/versions.js';
import { CURRENT_HYROX_VERSION } from '../domain/ruleSets.js';
import { weakPoint } from '../program/assistance.js';
import { LIFT_EXERCISE } from '../domain/types.js';
import type { Goal, LiftId, SportId, TrainingHistorySummary } from '../domain/types.js';
import { benchmarkFromSet } from '../domain/benchmarks.js';
import { requestAiPlan } from '../lib/aiMix.js';
import { fmtTime } from '../lib/format.js';
import { useHashRouter } from '../lib/router.js';
import * as sound from '../lib/sound.js';
import type { ArrivalKind } from '../lib/sound.js';
import { clearState, loadState, saveState, STATE_VERSION, downloadJson } from '../lib/storage.js';
import { applyTheme, readTheme } from '../lib/theme.js';
import { buildExport, parseImport } from '../lib/transfer.js';
import type { ImportPreview } from '../lib/transfer.js';
import type {
  Completion, GenDraft, GenStep, HistoryEntry, HistoryStatus, PersistedState,
  LoggedSet, ProgramDraft, ProgramRef, Screen, Settings, ThemeId, TimerState, TimerView, UserProfile,
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
  sandbags: eng.DEFAULT_SANDBAGS.slice(),
  onboarded: false,
  age: null,
  benchmarks: [],
  screening: emptyScreening(),
  competence: [],
  weakPoints: [],
};

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark', aiMix: false, sound: true, haptics: true, keepAwake: true,
};

const DEFAULT_PROGRAM_DRAFT: ProgramDraft = {
  goal: 'functional', weeks: 8, days: 3, minutes: 45,
  baseline: 'known', eventDate: '', division: 'open_men',
};

/** Referencevægt for de profiler, brugeren ikke selv har. */
const PEER_BODYWEIGHT = { m: 88, f: 66, x: 77 } as const;

/**
 * Loading-animationens varighed.
 *
 * Tidligere var den sat til 7 og 15 sekunder for at få motoren til at virke
 * arbejdsom. Det var en kunstig ventetid uden reelt indhold, og den er skruet ned
 * til det, der faktisk skal til for at faserne kan læses. Selve genereringen tager
 * få millisekunder.
 */
const LOADING_MS = 1400;
const PROGRAM_LOADING_MS = 2200;

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
  };
}

export const participantsOf = (g: GenDraft): number => g.men + g.women + g.neutral;

/**
 * Oversætter et øvelses-id til det måltal, styrken gemmes under.
 *
 * Back squat og squat er samme måltal; alt andet gemmes under sit eget id, så
 * conventional og axle dødløft aldrig ender i samme kurve.
 */
export function subjectIdFor(exerciseId: string): string {
  const lift = (Object.keys(LIFT_EXERCISE) as LiftId[])
    .find((l) => LIFT_EXERCISE[l] === exerciseId);
  return lift ?? exerciseId;
}

/**
 * De sæt, planen indeholdt — udfyldt på forhånd, så logning bliver en bekræftelse
 * frem for en indtastning.
 *
 * Kun belastede bevægelser tages med. Der er ingen værdi i at bede brugeren
 * bekræfte, hvor mange kalorier hun tog på romaskinen, når timeren allerede ved det.
 */
export function plannedSets(workout: Workout): LoggedSet[] {
  return workout.blocks
    .filter((b) => b.kind !== 'warmup')
    .flatMap((b) => b.movements)
    .filter((m) => m.targets[0]?.load)
    .map((m) => ({
      exerciseId: m.exerciseId,
      name: m.name,
      loadKg: m.targets[0]?.load?.eachKg ?? null,
      reps: m.reps,
      rpe: null,
      asPlanned: true,
    }));
}

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

/**
 * Kører en faseanimation og afslutter, når arbejdet er færdigt.
 *
 * Animationen drives af uret gennem ét interval frem for af en kæde af timeouts.
 * Forskellen betyder noget: browsere strupper timere i faner, der ikke er synlige,
 * og en kædet animation kan derfor gå helt i stå, hvis brugeren skifter væk midt i
 * genereringen — så ville workouten aldrig dukke op, når hun kom tilbage.
 *
 * Er siden slet ikke synlig, springes animationen over. Der er ingen at vise den for.
 *
 * Returnerer en funktion, der afbryder animationen.
 */
export function runPhaseAnimation<T>(input: {
  phases: { to: number; text: string }[];
  durationMs: number;
  work: Promise<T>;
  onProgress: (value: number) => void;
  onPhase: (text: string) => void;
  onDone: (result: T) => void;
}): () => void {
  let cancelled = false;
  const startedAt = Date.now();
  const total = Math.max(1, input.durationMs);

  input.onPhase(input.phases[0]?.text ?? '');
  input.onProgress(0);

  let settled = false;
  const finish = (result: T): void => {
    if (settled || cancelled) return;
    settled = true;
    input.onProgress(100);
    input.onDone(result);
  };

  const id = window.setInterval(() => {
    if (cancelled) return;
    const elapsed = Date.now() - startedAt;
    const ratio = Math.min(1, elapsed / total);
    const value = Math.round(ratio * 100);
    input.onProgress(value);

    const phase = input.phases.find((p) => value <= p.to) ?? input.phases[input.phases.length - 1];
    if (phase) input.onPhase(phase.text);

    // Animationen må aldrig holde resultatet tilbage længere end sin egen varighed.
    if (ratio >= 1) {
      window.clearInterval(id);
      void input.work.then(finish);
    }
  }, 80);

  // Er siden skjult, er animationen uden formål — og timerne bliver alligevel strupet.
  if (typeof document !== 'undefined' && document.hidden) {
    window.clearInterval(id);
    void input.work.then(finish);
  }

  return () => {
    cancelled = true;
    window.clearInterval(id);
  };
}

export const GEN_STEPS: GenStep[] = ['time', 'people', 'weight', 'level', 'direction', 'equip', 'summary'];

/**
 * De trin, generatoren faktisk viser.
 *
 * Reglen fra specifikationen: spørg kun om det, der kan ændre resultatet, og genbrug
 * det, brugeren allerede har svaret på. En tilbagevendende bruger skal kunne
 * generere med omkring tre aktive valg — tid, hvem der træner, og dagens retning.
 *
 * Trinnene forsvinder ikke: alt kan stadig åbnes fra opsummeringen. De er bare ikke
 * i vejen for den, der bare vil i gang.
 */
export function genStepsFor(profile: UserProfile, draft: GenDraft, historyCount: number): GenStep[] {
  const steps: GenStep[] = ['time', 'people'];

  // Deltagernes vægt betyder kun noget, når der er nogen at skalere imellem.
  if (participantsOf(draft) > 1) steps.push('weight');

  // Niveau og udstyr er gemt på profilen. De spørges kun, første gang der genereres.
  const returning = historyCount > 0 && profile.onboarded;
  if (!returning) steps.push('level', 'equip');

  steps.push('direction', 'summary');
  return steps;
}

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
  /** Tidspunktet for appens start. Bruges hvor en beregning skal være stabil på tværs af renders. */
  const [mountedAt] = useState(() => Date.now());
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
  /** Diffen fra seneste skalering — vises på resultatskærmen, så ændringen er konkret. */
  const [scaleResult, setScaleResult] = useState<{
    changes: eng.ScaleChange[];
    atLimit: boolean;
    preserved: string;
    direction: 'easier' | 'harder';
  } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<HistoryEntry[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(DEFAULT_PROGRAM_DRAFT);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmDialog, setConfirmDialog] = useState<'exit' | 'reset' | null>(null);
  const [timerCallout, setTimerCallout] = useState<{ kind: ArrivalKind; ts: number } | null>(null);
  const [completion, setCompletion] = useState<Completion>({
    status: 'done', rpe: 'ok', note: '', sets: [], painAfter: null,
  });
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
      if (!loadedProfile.sandbags?.length) loadedProfile.sandbags = eng.DEFAULT_SANDBAGS.slice();

      const loadedSettings: Settings = { ...DEFAULT_SETTINGS, ...savedState.settings, theme: readTheme() };
      const restoredTimer = savedState.timer ?? null;

      setProfile(loadedProfile);
      setSettings(loadedSettings);
      setHistory(savedState.history ?? []);
      setFavorites(savedState.favorites ?? []);
      setProgram(savedState.program ?? null);
      setProgramDraft({ ...DEFAULT_PROGRAM_DRAFT, ...savedState.programDraft });
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
      profile, settings, history, favorites, program, programDraft, timer,
      timerWorkout: timer ? workout : null,
      engineVersion: eng.ENGINE_VERSION,
      rulesVersion: eng.RULES_VERSION,
      exerciseDataVersion: eng.EXERCISE_DATA_VERSION,
    };
    void saveState(state);
  }, [ready, profile, settings, history, favorites, program, programDraft, timer, workout]);

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

  /*
   * Nedtælling (3-2-1) og ankomst-lyd/-tekst ved segmentskift. Genbruger samme
   * "planlæg en præcis timeout, lad effekten selv genberegne den ved hver render"-
   * mønster som auto-advance ovenfor — for åbne, men tidscappede segmenter (For
   * Time/Chipper/Ladder/You go, I go) bruges tiden til cappen i stedet for `remaining`.
   */
  const capLeft = view && view.segment.capSeconds !== undefined
    ? view.segment.capSeconds - view.sessionElapsed
    : null;
  const soundRemaining = remaining !== null ? remaining : capLeft;

  useEffect(() => {
    if (!timer?.running || !settings.sound || soundRemaining === null || !view?.next) return;
    const arrivalKind = sound.kindFor(view.segment.kind, view.next.kind);
    const timeouts: number[] = [];
    ([3, 2, 1] as const).forEach((stepsLeft) => {
      const at = soundRemaining - stepsLeft;
      if (at > 0) timeouts.push(window.setTimeout(() => sound.playTick(stepsLeft), at * 1000));
    });
    if (arrivalKind && soundRemaining > 0) {
      timeouts.push(window.setTimeout(() => {
        sound.playArrival(arrivalKind);
        setTimerCallout({ kind: arrivalKind, ts: Date.now() });
      }, soundRemaining * 1000));
    }
    return () => timeouts.forEach((id) => window.clearTimeout(id));
  }, [timer?.running, settings.sound, soundRemaining, view?.segment.kind, view?.next]);

  const prevSegmentKind = useRef<string | null>(null);
  useEffect(() => {
    const kind = view?.segment.kind;
    if (!kind) return;
    if (kind === 'done' && prevSegmentKind.current !== 'done' && settings.sound) {
      sound.playArrival('complete');
      const id = window.setTimeout(() => setTimerCallout({ kind: 'complete', ts: Date.now() }), 0);
      prevSegmentKind.current = kind;
      return () => window.clearTimeout(id);
    }
    prevSegmentKind.current = kind;
  }, [view?.segment.kind, settings.sound]);

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

  /**
   * Retter profilen.
   *
   * Patchen kan gives som en funktion af den forrige profil. Det er nødvendigt for
   * alt, der lægger noget til en liste: beregnes patchen ud fra et øjebliksbillede,
   * og trykker brugeren to gange hurtigt efter hinanden, læser begge opdateringer
   * den samme gamle liste — og den første skrivning går tabt.
   */
  const patchProfile = useCallback(
    (patch: Partial<UserProfile> | ((prev: UserProfile) => Partial<UserProfile>)) => {
      setProfile((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
    },
    [],
  );

  /**
   * Registrerer et sæt for et hovedløft.
   *
   * Ét sted for hele appen, så indtastning fra programbyggeren og fra "Mine tal"
   * ender som præcis den samme slags måltal.
   */
  const logLift = useCallback(
    (lift: LiftId, loadKg: number, reps: number, rpe: number) => {
      const benchmark = benchmarkFromSet({
        subjectId: lift,
        protocol: reps === 1 ? '1rm' : reps <= 5 ? 'topSetRpe' : 'amrap',
        loadKg,
        reps,
        rpe,
      });
      setProfile((p) => ({ ...p, benchmarks: [...p.benchmarks, benchmark] }));
    },
    [],
  );

  const patchGen = useCallback((patch: Partial<GenDraft>) => {
    setGen((g) => ({ ...g, ...patch }));
  }, []);

  /* De trin, der reelt vises for netop denne bruger. */
  const steps = useMemo(
    () => genStepsFor(profile, gen, history.length),
    [profile, gen, history.length],
  );
  const currentStep: GenStep = steps[Math.min(genStep, steps.length - 1)] ?? 'time';

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
      equipment: draft.equipment,
      counts: draft.counts,
      plates: draft.plates,
      bars: profile.bars,
      sandbags: profile.sandbags,
      profile: profile.sex,
      recentSignatures,
      recentPatterns: history.slice(0, 3).flatMap((h) => h.patterns ?? []),
      ...extra,
    }),
    [profile.sex, profile.bars, profile.sandbags, history, recentSignatures],
  );

  /**
   * Løbenumre for de to loading-animationer.
   *
   * Starter brugeren en ny bygning, mens en er i gang, skal den gamle stoppe med det
   * samme — ellers skriver to løkker til den samme fremdriftsbjælke.
   */
  const generateRun = useRef(0);
  const programRun = useRef(0);
  /** Afbryder en igangværende animation, når en ny startes, eller appen lukkes. */
  const cancelGenerate = useRef<(() => void) | null>(null);
  const cancelProgram = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    cancelGenerate.current?.();
    cancelProgram.current?.();
  }, []);

  const runGenerate = useCallback(
    (draft: GenDraft = gen, extra?: Partial<WorkoutRequest>) => {
      const request = buildRequest(draft, extra);

      // Se `generateRun` ovenfor: løbenummeret lukker en igangværende animation ned,
      // så to genereringer ikke skriver til den samme fremdriftsbjælke.
      const run = generateRun.current + 1;
      generateRun.current = run;
      const owns = (): boolean => generateRun.current === run;

      setSaved(false);
      setCelebrate(false);
      // En ny workout har ingen skalering bag sig — den gamle diff må ikke hænge ved.
      setScaleResult(null);
      setProgress(0);
      setAiNotice(null);
      setPhaseText(eng.PHASES[0]?.text ?? '');
      go('loading');

      let settled = false;

      const settle = (result: eng.GenerateResult): void => {
        if (settled || !owns()) return;
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

      cancelGenerate.current?.();
      cancelGenerate.current = runPhaseAnimation({
        phases: eng.PHASES,
        durationMs: LOADING_MS,
        work: compute(),
        onProgress: (v) => { if (owns()) setProgress(v); },
        onPhase: (t) => { if (owns()) setPhaseText(t); },
        onDone: settle,
      });
    },
    [gen, buildRequest, go, settings.aiMix, recentSignatures],
  );

  const genNext = useCallback(() => {
    if (genStep >= steps.length - 1) runGenerate();
    else setGenStep((s) => s + 1);
  }, [genStep, steps.length, runGenerate]);

  /** Tiden er det eneste, overraskelsen ikke må gætte — resten sættes af profilen. */
  const surpriseMe = useCallback((minutes = 30) => {
    const draft: GenDraft = { ...freshGen(profile), minutes, condition: 7, strength: 5 };
    setGen(draft);
    runGenerate(draft, { surprise: true, seed: eng.makeSeed() });
  }, [profile, runGenerate]);

  /** Ny seed, samme constraints. */
  const regenerate = useCallback(() => {
    runGenerate(gen, { seed: eng.makeSeed() });
  }, [gen, runGenerate]);

  /**
   * "Gør lettere" og "Gør hårdere".
   *
   * Skalerer den workout, brugeren har foran sig — den bygger ikke en ny. Format,
   * bevægelser og tidsramme bevares, og de konkrete ændringer vises som en liste.
   * Vil brugeren have noget helt andet, er det "Ny workout", der gør det.
   */
  const nudge = useCallback(
    (direction: 'easier' | 'harder') => {
      if (!workout) return;
      const result = eng.scaleWorkout(workout, direction);
      setWorkout(result.workout);
      setScaleResult({
        changes: result.changes,
        atLimit: result.atLimit,
        preserved: result.preserved,
        direction,
      });
      setSaved(false);
    },
    [workout],
  );

  /* ---------- resultat, historik og favoritter ---------- */

  /**
   * Bygger en historikpost.
   *
   * Den planlagte workout gemmes som den er, og det faktisk udførte lægges ved siden
   * af i `session`. Det er den adskillelse, der gør det muligt at forklare, hvorfor
   * programmet tilpassede sig — og at finde fejl i motoren bagefter.
   */
  const entryFor = useCallback(
    (
      w: Workout, status: HistoryStatus, result = '', rpe: HistoryEntry['rpe'] = '',
      progressPct?: number, lastExercise?: string, actualMinutes?: number,
      ref: ProgramRef | null = null, sets: LoggedSet[] = [], painAfter: number | null = null,
    ): HistoryEntry => {
      const state: SessionState = status === 'done'
        ? 'completed'
        : status === 'stopped' ? 'aborted'
          : status === 'partial' ? 'aborted' : 'saved';

      const session = createSession({
        sourceMode: ref ? 'program' : 'quick-wod',
        state,
        provenance: {
          generatorVersion: w.engineVersion,
          domainVersion: DOMAIN_VERSION,
          ontologyVersion: ONTOLOGY_VERSION,
          exerciseLibraryVersion: w.exerciseDataVersion,
          rulesVersion: w.rulesVersion,
          ruleVersions: {},
          seed: w.seed,
        },
        programRef: ref && program
          ? {
            programId: program.id,
            programVersion: program.version ?? 1,
            week: ref.w + 1,
            day: ref.d + 1,
          }
          : null,
        wodRef: {
          stimulus: w.title,
          format: w.format,
          // Tilfældigt genererede workouts får ingen sammenligningsnøgle. To
          // forskellige AMRAP-scores måler ikke det samme og må ikke trendes.
          comparabilityKey: null,
        },
      });

      const minutes = actualMinutes ?? w.estimatedMinutes;

      return {
        id: `${w.id}_${Date.now()}`,
        title: w.title,
        format: w.formatName,
        minutes,
        date: new Date().toISOString(),
        status,
        rpe,
        result,
        ...(progressPct !== undefined ? { progressPct } : {}),
        ...(lastExercise ? { lastExercise } : {}),
        patterns: w.blocks.flatMap((b) => b.movements.map((m) => eng.BY_ID[m.exerciseId]?.cat ?? 'ukendt')),
        signature: w.signature,
        workout: w,
        session: {
          ...session,
          startedAt: new Date(Date.now() - minutes * 60_000).toISOString(),
          endedAt: new Date().toISOString(),
          actual: {
            ...session.actual,
            durationSeconds: minutes * 60,
            completionPct: progressPct ?? (status === 'done' ? 100 : 0),
            score: result,
            // De faktisk udførte sæt. Planen ligger uændret i `workout` ved siden af,
            // så en afvigelse kan ses som netop en afvigelse.
            sets: sets.map((s, index) => ({
              exerciseId: s.exerciseId,
              variantId: subjectIdFor(s.exerciseId),
              setIndex: index,
              loadKg: s.loadKg,
              reps: s.reps,
              rpe: s.rpe,
              rir: s.rpe === null ? null : 10 - s.rpe,
              ...(painAfter !== null && painAfter >= 4 ? { painScore: painAfter } : {}),
            })),
          },
          feedback: {
            ...session.feedback,
            // Den grove tre-trins vurdering oversættes til skalaen fra 1 til 10, så
            // statistikken kan regne på den. Præcisionen er bevidst lav.
            sessionRpe: rpe === 'easy' ? 4 : rpe === 'ok' ? 6 : rpe === 'hard' ? 9 : null,
            painAfter,
          },
        },
      };
    },
    [program],
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
    // Sletter man den post, der hører til en afbrudt, stadig-genoptagelig session, skal
    // selve den levende timer også ryddes — ellers dukker "workout i gang" bare op igen.
    const target = history.find((e) => e.id === id);
    if (target && timer && target.workout.id === timer.workoutId) {
      setTimer(null);
      setWorkout(null);
    }
    setHistory((h) => h.filter((e) => e.id !== id));
  }, [history, timer]);

  /* ---------- afslutning ---------- */

  const openCompletion = useCallback(
    (status: HistoryStatus) => {
      if (!workout) return;
      const total = plan?.segments.length ?? 0;
      const idx = view?.index ?? 0;
      const progressPct = status === 'done'
        ? 100
        : total > 0 ? Math.max(0, Math.min(99, Math.round((idx / total) * 100))) : 0;
      const lastExercise = status === 'done'
        ? ''
        : view?.segment.movement?.display ?? view?.segment.movements?.[0]?.display ?? view?.segment.label ?? '';
      setCompleteFor({ secs: view?.sessionElapsed ?? 0, rounds: timer?.rounds ?? 0, workout });
      setCompletion({
        status, rpe: 'ok', note: '', progressPct, lastExercise,
        // Sættene udfyldes på forhånd fra planen, så "Alt gik som planlagt" er ét tryk.
        sets: plannedSets(workout),
        painAfter: null,
      });
      // En afbrudt session skal kunne genoptages, hvis man kom til at afslutte ved en
      // fejl — kun en reelt fuldført session rydder timeren og gør den ugenkaldelig.
      if (status === 'done') setTimer(null);
      setConfirmDialog(null);
      go('complete');
    },
    [workout, view, plan, timer, go],
  );

  const saveCompletion = useCallback(() => {
    if (!completeFor) return;
    const { workout: w, secs, rounds } = completeFor;
    const mins = Math.floor(secs / 60);
    const rest = secs % 60;
    const timeText = rounds ? `${rounds} runder` : `${mins}:${String(rest).padStart(2, '0')}`;
    const auto = completion.status === 'stopped' && completion.progressPct !== undefined
      ? `Afbrudt ved ${completion.progressPct}%${completion.lastExercise ? ` — ${completion.lastExercise}` : ''} · ${timeText} på uret`
      : timeText;
    const result = completion.note || auto;
    setHistory((h) => [
      entryFor(
        w, completion.status, result, completion.rpe, completion.progressPct,
        completion.lastExercise, Math.max(1, mins), fromProgram, completion.sets, completion.painAfter,
      ),
      ...h,
    ]);

    // Kom workouten fra en programdag, skal dagen have status med — og resten af
    // programmet kan bruge den til at justere sig.
    if (fromProgram && program) {
      const next = structuredClone(program);
      const day = next.weeks[fromProgram.w]?.days[fromProgram.d];
      if (day) day.status = completion.status === 'done' ? 'done' : 'partial';
      setProgram(next);
    }

    /*
     * Rigtig træning er bedre data end en test.
     *
     * Et gennemført sæt på et hovedløft gemmes som måltal, så styrken opdaterer sig
     * selv over tid. Kun sæt, brugeren selv har vurderet anstrengelsen på, tæller —
     * uden den vurdering er omregningen for usikker til at styre tunge vægte.
     */
    const scoredSets = completion.sets.filter((s) => (
      s.rpe !== null && s.loadKg !== null && s.reps > 0 && s.reps <= 10
    ));
    if (scoredSets.length && completion.status !== 'stopped') {
      const painFlag = (completion.painAfter ?? 0) >= 4;
      const added = scoredSets.map((s) => benchmarkFromSet({
        subjectId: subjectIdFor(s.exerciseId),
        protocol: 'topSetRpe',
        loadKg: s.loadKg as number,
        reps: s.reps,
        rpe: s.rpe as number,
        painFlag,
        note: 'Registreret under træning',
      }));
      setProfile((p) => ({ ...p, benchmarks: [...p.benchmarks, ...added] }));
    }

    setCompleteFor(null);
    go('history');
  }, [completeFor, completion, fromProgram, program, entryFor, go]);

  /* ---------- program ---------- */

  /**
   * Programmets stressbudget udledes af det, brugeren faktisk har lavet de seneste
   * fire uger — ikke af et abstrakt ideal. Kun gennemførte pas tæller: en gemt, men
   * ikke gennemført workout er ikke træning.
   */
  const historySummary = useMemo<TrainingHistorySummary>(() => {
    // Skæringsdatoen låses ved montering. Blev den beregnet under hver render, ville
    // budgettet kunne skifte midt i en session, uden at historikken havde ændret sig.
    const cutoff = mountedAt - 28 * 86_400_000;
    const recent = history.filter((h) => (
      h.status === 'done' && new Date(h.date).getTime() >= cutoff
    ));

    const hardSetsByPattern: Record<string, number> = {};
    let runKm = 0;
    recent.forEach((entry) => {
      entry.workout.blocks
        .filter((b) => b.kind !== 'warmup')
        .forEach((b) => b.movements.forEach((m) => {
          const ex = eng.BY_ID[m.exerciseId];
          if (!ex) return;
          const sets = m.sets ?? 1;
          hardSetsByPattern[ex.cat] = (hardSetsByPattern[ex.cat] ?? 0) + sets;
          if (ex.unit === 'm' && ex.cat === 'cardio') {
            runKm += (m.targets[0]?.amount ?? 0) / 1000;
          }
        }));
    });

    return {
      lookbackDays: 28,
      sessions: recent.length,
      hardSetsByPattern,
      runKm: Math.round(runKm * 10) / 10,
      highIntensityMinutes: recent.reduce((s, h) => s + (h.rpe === 'hard' ? h.minutes : 0), 0),
      completedPerWeek: Math.round((recent.length / 4) * 10) / 10,
    };
  }, [history, mountedAt]);

  /**
   * Samler det, programmotoren skal bruge, ét sted.
   *
   * Både "Byg programmet" og "Nyt pas" går gennem den her, så en enkelt dag aldrig
   * kan komme til at blive bygget af en anden motor end resten af programmet.
   */
  const planInput = useCallback((seed?: number): prog.PlanInput => {
    const equipment = profile.equipment ?? eng.DEFAULT_EQUIPMENT;
    const sport = programDraft.goal as SportId;

    const goal: Goal = {
      sport,
      primary: '',
      secondary: [],
      eventDate: programDraft.eventDate || null,
      baselineStrategy: programDraft.baseline,
      ruleSet: sport === 'hyrox'
        ? {
          organization: 'HYROX',
          version: CURRENT_HYROX_VERSION,
          checkedAt: '2026-08-09',
          sourceUrl: 'https://hyrox.com/rulebook/',
        }
        : null,
      ...(sport === 'hyrox' ? { division: programDraft.division } : {}),
    };

    return {
      profile: {
        id: 'local',
        age: profile.age,
        bodyMassKg: profile.bodyweight,
        sex: profile.sex,
        level: profile.level,
        generalTrainingYears: null,
        sportTrainingYears: null,
        availability: { days: programDraft.days, minutes: programDraft.minutes },
        screening: profile.screening,
        competence: profile.competence,
        care: [],
        excludedExerciseIds: [],
        updatedAt: new Date().toISOString(),
      },
      goal,
      benchmarks: profile.benchmarks,
      history: historySummary,
      weakPoints: profile.weakPoints.map((id) => weakPoint(id, 0.6)),
      availableEquipment: equipment,
      plates: profile.plates,
      bars: profile.bars,
      weeks: programDraft.weeks,
      daysPerWeek: programDraft.days,
      minutes: programDraft.minutes,
      ...(seed === undefined ? {} : { seed }),
    };
  }, [profile, programDraft, historySummary]);

  const renderContext = useCallback((): prog.LegacyContext => ({
    profile: profile.sex,
    bodyweight: profile.bodyweight,
    level: profile.level,
    equipment: profile.equipment ?? eng.DEFAULT_EQUIPMENT,
    plates: profile.plates,
    bars: profile.bars,
  }), [profile]);

  /**
   * Bruges både til første bygning og til "Lav programmet om" — begge er samme
   * handling: byg et program fra det aktuelle udkast. Går altid gennem
   * program-loading-skærmen, samme mønster som runGenerate, men over PROGRAM_LOADING_MS.
   */
  const buildProgram = useCallback(() => {
    /*
     * Hver bygning får sit eget løbenummer.
     *
     * At rydde den seneste timeout er ikke nok: trykker brugeren to gange, kan den
     * gamle kæde nå at planlægge sit næste trin efter rydningen, og så kæmper to
     * løkker om fremdriften — bjælken sætter sig fast, mens teksten kører videre.
     * Løbenummeret lukker den gamle kæde ned, uanset hvor den er nået til.
     */
    const run = programRun.current + 1;
    programRun.current = run;
    const owns = (): boolean => programRun.current === run;

    setProgress(0);
    setPhaseText(prog.PROGRAM_BUILD_PHASES[0]?.text ?? '');
    go('programLoading');

    const pending = Promise.resolve().then(
      () => prog.toLegacyProgram(prog.planProgram(planInput()), renderContext()),
    );

    cancelProgram.current?.();
    cancelProgram.current = runPhaseAnimation({
      phases: prog.PROGRAM_BUILD_PHASES,
      durationMs: PROGRAM_LOADING_MS,
      work: pending,
      onProgress: (v) => { if (owns()) setProgress(v); },
      onPhase: (t) => { if (owns()) setPhaseText(t); },
      onDone: (result) => {
        if (!owns()) return;
        setProgram(result);
        go('program');
      },
    });
  }, [go, planInput, renderContext]);

  const patchProgramDay = useCallback((ref: ProgramRef, patch: Partial<Program['weeks'][number]['days'][number]>) => {
    setProgram((p) => {
      if (!p) return p;
      const next = structuredClone(p);
      const day = next.weeks[ref.w]?.days[ref.d];
      if (day) Object.assign(day, patch);
      return next;
    });
  }, []);

  /**
   * Bygger én programdag om.
   *
   * Dagen planlægges af programmotoren med en ny seed — ikke af Dagens WOD-motoren.
   * Ellers ville et enkelt tryk kunne erstatte et planlagt styrkepas med en
   * tilfældig workout og dermed bryde ugens obligatoriske eksponeringer.
   */
  const regenerateDay = useCallback((ref: ProgramRef) => {
    setProgram((p) => {
      if (!p) return p;
      const next = structuredClone(p);
      const week = next.weeks[ref.w];
      const day = week?.days[ref.d];
      if (!week || !day) return next;

      const replanned = prog.toLegacyProgram(
        prog.planProgram(planInput(eng.makeSeed())),
        renderContext(),
      );
      const fresh = replanned.weeks[ref.w]?.days[ref.d];
      if (!fresh) {
        day.error = 'Dagen kunne ikke bygges om med de nuværende data.';
        return next;
      }

      week.days[ref.d] = { ...fresh, day: day.day, status: 'planned' };
      return next;
    });
  }, [planInput, renderContext]);

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
    profile, patchProfile, logLift,
    settings, setSettings, setTheme,
    onbStep, onbNext, onbBack, startOnboarding, setOnbStep,
    gen, patchGen, setGen, openGenerator, resetGenerator,
    genStep, setGenStep, steps, currentStep, genBack, genNext,
    participants: participantsOf(gen),
    progress, phaseText,
    workout, genError, aiNotice, saved,
    celebrate, setCelebrate, scaleResult, setScaleResult,
    runGenerate, surpriseMe, regenerate, nudge,
    saveWorkout, openWorkout, isFavorite, toggleFavorite,
    history, filteredHistory, historyFilter, setHistoryFilter, removeHistory, favorites,
    program, programDraft, setProgramDraft, buildProgram,
    dropProgram: () => setProgram(null), patchProgramDay, regenerateDay, moveProgramDay,
    timer, plan, view, startTimer, toggleTimer, resetTimer, addRound, advance,
    confirmDialog, setConfirmDialog, openCompletion, timerCallout,
    completion, setCompletion, completeFor, saveCompletion,
    fromProgram,
    wipeArmed, wipeData, exportData, stageImport, importPreview, importError, setImportPreview,
  };
}

export type Whatwork = ReturnType<typeof useWhatwork>;
