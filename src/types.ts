import type {
  CareId, FocusId, LevelId, Profile, Program, TimerSegment, Workout, WorkoutSignature,
} from './engine/index.js';

/** Alle ruter i appen. Hver har en egen sti og kan åbnes direkte. */
export type Screen =
  | 'welcome' | 'onboard' | 'home' | 'gen' | 'loading' | 'result' | 'timer'
  | 'program' | 'history' | 'stats' | 'profile' | 'favorites' | 'equipment'
  | 'settings' | 'help' | 'transfer' | 'about' | 'complete';

/**
 * Generatorens trin. Deltagerantallet er ikke sit eget trin — det beregnes af
 * fordelingen på `people`-trinnet.
 */
export type GenStep =
  | 'time' | 'people' | 'weight' | 'level' | 'direction' | 'equip' | 'summary';

export type ThemeId = 'dark' | 'light';

export interface UserProfile {
  name: string;
  level: LevelId;
  sex: Profile;
  bodyweight: number;
  /** null indtil motoren har leveret sit standardudstyr. */
  equipment: string[] | null;
  counts: Record<string, number>;
  /** Skivestørrelser brugeren faktisk har. */
  plates: number[];
  bars: number[];
  onboarded: boolean;
}

export interface Settings {
  theme: ThemeId;
  /** Slår det valgfrie AI Mix-lag til. Kræver en nøgle på serveren. */
  aiMix: boolean;
  sound: boolean;
  haptics: boolean;
  keepAwake: boolean;
}

/** Brugerens valg i generatoren, før de oversættes til en motoranmodning. */
export interface GenDraft {
  minutes: number;
  men: number;
  women: number;
  neutral: number;
  /** Gennemsnitlig kropsvægt pr. profil — bruges i gennemsnit-tilstand og som fallback
   * for enhver deltager, der endnu ikke har fået sin egen vægt i individuel-tilstand. */
  bwM: number;
  bwF: number;
  bwX: number;
  /** Tændt: hver deltager har sin egen kropsvægt i stedet for gruppens gennemsnit. */
  individualWeights: boolean;
  /** Pr. person, indeks-justeret til "Mand 1, Mand 2, …" osv. Kan være kortere end
   * `men`/`women`/`neutral` — manglende indeks falder tilbage til bw-feltet. */
  weightsM: number[];
  weightsF: number[];
  weightsX: number[];
  level: LevelId;
  condition: number;
  strength: number;
  focus: FocusId;
  care: CareId[];
  included: string[];
  excluded: string[];
  equipment: string[];
  counts: Record<string, number>;
  plates: number[];
  warmup: boolean;
}

export type HistoryStatus = 'saved' | 'done' | 'partial' | 'stopped';
export type Rpe = 'easy' | 'ok' | 'hard';

export interface HistoryEntry {
  id: string;
  title: string;
  format: string;
  minutes: number;
  /** ISO-tidsstempel. */
  date: string;
  status: HistoryStatus;
  rpe: Rpe | '';
  result: string;
  /** Kun sat, når workouten blev afbrudt før tid — hvor langt du nåede. */
  progressPct?: number;
  /** Kun sat, når workouten blev afbrudt før tid — øvelsen du var i gang med. */
  lastExercise?: string;
  /** Bevægelseskategorier, så motoren kan undgå gentagelser. */
  patterns: string[];
  signature: WorkoutSignature;
  workout: Workout;
}

/** Timeren gemmer, hvor den er, ikke hvor lang tid der er tilbage. */
export interface TimerState {
  workoutId: string;
  /** Formatet, planen blev bygget til. */
  mode: string;
  /** Indeks i timerplanens segmenter. */
  index: number;
  running: boolean;
  /** Epoch-ms for seneste start af det aktuelle segment. */
  startedAt: number;
  /** Akkumulerede millisekunder i det aktuelle segment. */
  acc: number;
  /** Akkumulerede millisekunder i hele sessionen, før det aktuelle segment. */
  totalAcc: number;
  rounds: number;
  /** Epoch-ms for hvornår hele sessionen startede. */
  sessionStartedAt: number;
}

export interface Completion {
  status: HistoryStatus;
  rpe: Rpe;
  note: string;
  /** Automatisk udregnet, når man afslutter før tid — hvor langt man nåede. */
  progressPct?: number;
  /** Automatisk udregnet, når man afslutter før tid — øvelsen man var i gang med. */
  lastExercise?: string;
}

/** Hvilken programdag den viste workout kom fra, så status kan skrives tilbage. */
export interface ProgramRef { w: number; d: number }

export interface ProgramDraft {
  goal: string;
  weeks: number;
  days: number;
  minutes: number;
}

/** Det, der gemmes lokalt. `version` styrer migrering. */
export interface PersistedState {
  version: number;
  profile: UserProfile;
  settings: Settings;
  history: HistoryEntry[];
  favorites: HistoryEntry[];
  program: Program | null;
  timer: TimerState | null;
  /** Workouten der hører til en afbrudt timer, så den kan genoptages. */
  timerWorkout: Workout | null;
  engineVersion: string;
  rulesVersion: string;
  exerciseDataVersion: string;
}

/** Det aktive segment plus den beregnede tid — det timerskærmen faktisk viser. */
export interface TimerView {
  segment: TimerSegment;
  index: number;
  total: number;
  /** Sekunder gået i det aktuelle segment. */
  elapsed: number;
  /** Sekunder tilbage, eller null for åbne segmenter. */
  remaining: number | null;
  /** Det tal, der vises stort. */
  display: string;
  tone: 'normal' | 'warn' | 'over';
  /** Sekunder gået i hele sessionen. */
  sessionElapsed: number;
  next: TimerSegment | null;
}
