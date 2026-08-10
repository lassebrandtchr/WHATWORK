import type {
  CareId, FocusId, LevelId, Profile, Program, TimerSegment, Workout, WorkoutSignature,
} from './engine/index.js';
import type { Benchmark, CompetenceEntry, Screening } from './domain/types.js';
import type { SessionRecord } from './domain/history.js';
import type { WeakPointId } from './program/assistance.js';

/** Alle ruter i appen. Hver har en egen sti og kan åbnes direkte. */
export type Screen =
  | 'welcome' | 'onboard' | 'home' | 'gen' | 'loading' | 'result' | 'timer'
  | 'program' | 'programLoading' | 'history' | 'stats' | 'profile' | 'favorites' | 'equipment'
  | 'settings' | 'help' | 'transfer' | 'about' | 'complete' | 'baseline';

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
  /** Sandbag-vægte brugeren faktisk har. */
  sandbags: number[];
  onboarded: boolean;
  /** null = ikke oplyst. Appen skal kunne skelne "ved ikke" fra 0. */
  age: number | null;
  /**
   * Målte tal om brugerens formåen. Alt, der bestemmer kilo eller tempo, skal kunne
   * spores tilbage hertil — eller til et tydeligt markeret forsigtigt standardbud.
   */
  benchmarks: Benchmark[];
  /** Helbredsscreening og registreret smerte. */
  screening: Screening;
  /** Teknisk niveau pr. øvelse. Et generelt niveau kan ikke stå i stedet. */
  competence: CompetenceEntry[];
  /** De steder i et løft, hvor det typisk går galt. Styrer valg af hjælpeøvelser. */
  weakPoints: WeakPointId[];
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
  /**
   * Den planlagte workout. Den overskrives aldrig — retter man noget, lægges det i
   * `session.actual` med en revision ved siden af.
   */
  workout: Workout;
  /**
   * Sessionsposten med planlagt-vs-faktisk, motorversioner og revisionsspor.
   * Valgfri, så poster gemt af en tidligere version stadig kan vises.
   */
  session?: SessionRecord;
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

/**
 * Ét faktisk udført sæt, som brugeren kan bekræfte eller rette.
 *
 * Feltet `asPlanned` er det, der gør hurtig logning mulig: er alt gået som
 * planlagt, skal brugeren ikke skrive noget som helst.
 */
export interface LoggedSet {
  exerciseId: string;
  name: string;
  /** null for øvelser uden ekstern belastning. */
  loadKg: number | null;
  reps: number;
  /** Hvor hårdt sættet føltes, 1-10. null betyder "ikke oplyst" — ikke 0. */
  rpe: number | null;
  asPlanned: boolean;
}

export interface Completion {
  status: HistoryStatus;
  rpe: Rpe;
  note: string;
  /** Automatisk udregnet, når man afslutter før tid — hvor langt man nåede. */
  progressPct?: number;
  /** Automatisk udregnet, når man afslutter før tid — øvelsen man var i gang med. */
  lastExercise?: string;
  /** De faktisk udførte sæt. Udfyldes på forhånd fra planen. */
  sets: LoggedSet[];
  /** Smerte efter passet, 0-10. null betyder "ikke oplyst". */
  painAfter: number | null;
}

/** Hvilken programdag den viste workout kom fra, så status kan skrives tilbage. */
export interface ProgramRef { w: number; d: number }

/**
 * Programbyggerens valg.
 *
 * Specifikationen sætter budgettet til omkring seks kernebeslutninger plus de
 * sportsspecifikke spørgsmål, der først vises, når sporten er valgt. `goal` bærer
 * sportens id, så den eksisterende målvælger kan genbruges uvisuelt ændret.
 */
export interface ProgramDraft {
  /** Sportens id: strength4, powerlifting, crossfit, hyrox, strongman eller functional. */
  goal: string;
  weeks: number;
  days: number;
  minutes: number;
  /**
   * Hvordan udgangspunktet findes: brug tal du kender, mål dem i en indkøringsuge,
   * eller start forsigtigt. "Ved ikke" er et gyldigt svar og fører til indkøring.
   */
  baseline: 'known' | 'assessment' | 'conservative';
  /** ISO-dato for konkurrence eller race. Tom streng betyder ingen. */
  eventDate: string;
  /** Kun HYROX: hvilken division der stilles op i. */
  division: string;
}

/** Det, der gemmes lokalt. `version` styrer migrering. */
export interface PersistedState {
  version: number;
  profile: UserProfile;
  settings: Settings;
  history: HistoryEntry[];
  favorites: HistoryEntry[];
  program: Program | null;
  /** Gemmes, så programbyggeren ikke spørger om det samme igen ved næste besøg. */
  programDraft?: ProgramDraft;
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
