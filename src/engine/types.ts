/**
 * Typekontrakten for regelmotoren.
 *
 * Motoren lå tidligere som en utypet `whatwork-engine.js` med en håndskrevet `.d.ts`
 * ved siden af. Efter udvidelsen med Smart Mix, skiveberegning, partnerprotokoller og
 * timerplan er overfladen så stor, at en parallel erklæringsfil ville drive fra hinanden
 * uden at det blev opdaget. Motoren er derfor flyttet til TypeScript i strict mode.
 */

export type Profile = 'm' | 'f' | 'x';
export type LevelId = 1 | 2 | 3 | 4 | 5;
export type CareId = 'shoulder' | 'back' | 'knee' | 'wrist' | 'hip';
export type FocusId =
  | 'allround' | 'pulse' | 'heavy' | 'legs' | 'upper' | 'engine' | 'fast' | 'long';

/**
 * Formaterne er samtidig workoutens titel. Der findes bevidst ingen genererede
 * fantasinavne — brugeren skal kunne læse titlen og vide, hvordan der arbejdes.
 */
export type FormatId =
  | 'amrap'
  | 'emom' | 'e2mom' | 'e3mom' | 'e4mom' | 'e5mom'
  | 'fortime' | 'chipper' | 'ladder' | 'interval'
  | 'strength' | 'strength_cond'
  | 'you_go_i_go' | 'partner_shared' | 'team_rotation';

export type BlockKind = 'warmup' | 'strength' | 'conditioning';
export type Unit = 'reps' | 'cal' | 'm' | 'sec';

export type DnaAxisId =
  | 'engine' | 'legs' | 'hinge' | 'press' | 'pull' | 'core' | 'grip' | 'cns';

/** Fatigue-akser dækker DNA-akserne plus skulderbelastning, som ikke er en egen akse. */
export type FatigueKey = DnaAxisId | 'shoulder';

export type MovementPattern =
  | 'squat' | 'hinge' | 'press' | 'pull' | 'fullbody' | 'oly'
  | 'core' | 'carry' | 'cardio' | 'warmup';

/**
 * Muskelgrupper er en anden akse end `MovementPattern`. Mønsteret siger, hvordan
 * kroppen bevæger sig (og styrer programmeringen); muskelgruppen siger, hvad der
 * bliver træt — og det er den, brugeren leder efter, når hun søger "arme" eller "ben".
 */
export type MuscleId =
  | 'legs' | 'glutes' | 'chest' | 'back' | 'shoulders' | 'arms'
  | 'core' | 'cardio' | 'grip' | 'fullbody';

/** Overkrop, underkrop eller hele kroppen — det øverste niveau i øvelsesvælgeren. */
export type MuscleRegion = 'lower' | 'upper' | 'whole';

export interface MuscleGroup { id: MuscleId; name: string; region: MuscleRegion }

export interface EquipmentItem {
  id: string;
  name: string;
  /** Altid til rådighed — vises ikke som valg i UI. */
  always?: boolean;
  /** Brugeren kan angive et antal, som styrer rotation og logistik ved flere deltagere. */
  countable?: boolean;
  machine?: boolean;
  /** Standardantal, når brugeren ikke har angivet et. */
  def?: number;
  /** Kort dansk forklaring under ikonet i udstyrsvælgeren. */
  hint?: string;
  /** Vises som standard som valgt, så brugeren fravælger frem for at tilvælge. */
  onByDefault?: boolean;
}

export interface CareArea { id: CareId; name: string }
export interface FocusTag { id: FocusId; name: string; desc: string }
export interface Level { id: LevelId; name: string; desc: string }
export interface DnaAxis { id: DnaAxisId; name: string }

export interface Exercise {
  id: string;
  name: string;
  cat: MovementPattern;
  /**
   * Muskelgrupperne øvelsen belaster, vigtigste først. Bruges til at gruppere og
   * filtrere øvelsesvælgeren — ikke til programmeringen. Opvarmningsøvelser står
   * uden; alt andet skal have mindst én (håndhævet i exercises.test.ts).
   */
  mus: MuscleId[];
  /** Dansk teknikcue, vises under øvelsen. */
  da: string;
  unit: Unit;
  eq: string[];
  /** Mindste niveau, øvelsen må programmeres på. Sammenlignes mod brugerens niveau. */
  lvl: number;
  /** 1–5. Høj teknik betyder lav rep-volumen og skarpere validering. */
  tech: number;
  avoid: CareId[];
  fat: Partial<Record<FatigueKey, number>>;
  /** Sekunder pr. rep/meter/kalorie ved arbejdstempo. */
  sec: number;
  rep?: [number, number];
  /** Referencebelastning i kg ved referencekropsvægt og niveau 4. */
  load?: { m: number; f: number };
  /** Sandt når `load` er summen for to redskaber (fx et par håndvægte). */
  pair?: boolean;
  sub: string[];
  elig: 'default' | 'advanced' | 'coach-only' | 'disabled';
  machine?: boolean;
  /**
   * Øvelser markeret som `accessory` er skaleringer, rehabvenlige substitutioner
   * eller coach-alternativer. De må ikke bære en hoveddel.
   */
  accessory?: boolean;
  /** Hvor gerne generatoren vælger øvelsen i en hoveddel. Højere = oftere. */
  weight?: number;
  /** Kort dansk opvarmningsinstruktion — kun på opvarmningsøvelser. */
  warmupCue?: string;
  /** Bevægelsesmønstre denne opvarmningsøvelse forbereder. */
  primes?: MovementPattern[];
  /** Hvor muskulært krævende/langsom øvelsen er ved intervalarbejde — styrer både
   * hvor stor en del af arbejdstiden der reelt bruges på reps, og minimumspausen.
   * Udeladt betyder 'low' (cyklisk kondition, tempoet holder hele vinduet). */
  grind?: 'low' | 'medium' | 'high';
}

export interface FormatInfo {
  id: FormatId;
  /** Det internationale navn, som også er workoutens titel. */
  name: string;
  long: string;
  /** Kort dansk forklaring af, hvad formatet er. */
  da: string;
  /** Hvad formatet går ud på. */
  hvad: string;
  /** Sådan gør du undervejs. */
  naa: string;
  /** Hvornår du er færdig. */
  faerdig: string;
}

export type LoadKind = 'barbell' | 'pair' | 'single' | 'sled' | 'ball' | 'bag';

export interface PlatePlan {
  /** Stangens egenvægt i kg. */
  bar: number;
  /** Skiver pr. side, tungeste først. */
  perSide: number[];
  /** Kilo pr. side i alt. */
  perSideKg: number;
  /** Dansk sætning: "20 kg stang + 15 kg på hver side, fx 10 kg + 5 kg". */
  text: string;
  /** Sandt hvis skiverne ikke kunne ramme vægten præcist med det valgte udstyr. */
  approximate: boolean;
}

export interface LoadPrescription {
  /** Samlet belastning i kg — for par tæller begge redskaber med. */
  totalKg: number;
  /** Kilo pr. redskab. */
  eachKg: number;
  kind: LoadKind;
  /** Færdigformateret, fx "2 × 22,5 kg" eller "50 kg i alt". */
  text: string;
  plates?: PlatePlan;
}

/** Én deltagers mål for én øvelse. */
export interface PersonTarget {
  label: string;
  profile: Profile;
  /** Reps, meter, kalorier eller sekunder — afhænger af `unit`. */
  amount: number;
  unit: Unit;
  /** Færdigformateret mål, fx "12 cal". */
  amountText: string;
  load: LoadPrescription | null;
}

export interface Movement {
  exerciseId: string;
  name: string;
  unit: Unit;
  reps: number;
  /** Færdig visningstekst, fx "21 Kettlebell Swing". */
  display: string;
  cue: string;
  workSec: number;
  transitionSec: number;
  /** Én linje pr. deltager. Ved solo er der præcis én. */
  targets: PersonTarget[];
  /** Sandt når deltagerne har forskellige mål på samme øvelse. */
  individualTargets: boolean;
  /** Sæt × reps på styrkedele. */
  sets?: number;
  restSec?: number;
  /**
   * Kun på opvarmning: hvilket RAMP-trin bevægelsen udfylder. Lint kræver, at hver
   * belastet hovedbevægelse har mindst ét `rehearse`- og ét `ramp`-trin, der peger
   * på den.
   */
  purpose?: WarmupPurpose;
  /** Kun på opvarmning: id'erne på de hovedbevægelser, trinnet forbereder. */
  preparesMovementIds?: string[];
  /**
   * Kun på opvarmning: loftet for, hvor hårdt trinnet må føles. Opvarmningen må
   * ikke være en skjult ekstra workout.
   */
  fatigueCapRpe?: number;
}

/** RAMP: raise → activate/mobilize → rehearse → potentiate/ramp. */
export type WarmupPurpose = 'raise' | 'activate' | 'rehearse' | 'ramp';

export type PartnerMode =
  | 'solo' | 'you_go_i_go' | 'shared' | 'relay' | 'rotation' | 'synchro';

export interface PartnerProtocol {
  mode: PartnerMode;
  /** Fx "You go, I go". */
  title: string;
  working: string;
  resting: string;
  /** "efter det viste mål", "efter hver runde", "hver 3. minut" … */
  switchOn: string;
  switchUnit: 'reps' | 'm' | 'cal' | 'sec' | 'runde' | 'interval';
  /** Har den ventende deltager en reel pause, eller arbejdes der videre? */
  realRest: boolean;
  nextStartsImmediately: boolean;
  workShare: 'per_person' | 'shared';
  /** Færdige danske linjer til workoutbriefen. */
  lines: string[];
  /** Udstyrslogistik: hvad der deles, og hvordan. */
  logistics: string[];
}

export interface Block {
  id: string;
  kind: BlockKind;
  /** Bloktitel, fx "16 min AMRAP" eller "Opvarmning". */
  title: string;
  format: FormatId | null;
  minutes: number;
  prescription: string;
  movements: Movement[];
  rounds?: number;
  cap?: number;
  /** Sekunder pr. interval for EMOM/E*MOM og interval. */
  everySec?: number;
  workSec?: number;
  restSec?: number;
  /** Kun på almindelig EMOM: hvert `movements.length`. interval efterfølges af ét
   * hvileminut, og `rounds` tæller fulde cyklusser (arbejde + hvile), ikke enkeltintervaller. */
  restEveryCycle?: boolean;
  /** Kun på Interval: stationerne har ikke et fast måltal — man når så langt man kan
   * på arbejdstiden, og skriver selv antallet ned. */
  openStations?: boolean;
  partner?: PartnerProtocol;
  /** Kun på opvarmning: "35 sekunders arbejde · 5 sekunders skift". */
  timing?: string;
  /** Kun på styrkedele: sat til 'ramp', når blokken er en stigende ramp mod en tung 5RM
   * i stedet for det almindelige flade sætskema. */
  scheme?: 'ramp';
}

export interface Person {
  label: string;
  profile: Profile;
  bodyweight: number;
  level: number;
}

export interface Issue {
  code: string;
  sev: 'error' | 'warning';
  msg: string;
}

/** Deltagerfordeling. Det samlede antal udledes af summen. */
export interface ParticipantMix {
  men: number;
  women: number;
  neutral: number;
}

export interface NormalizedRequest {
  minutes: number;
  participants: number;
  mix: ParticipantMix;
  people: Person[];
  level: LevelId;
  condition: number;
  strength: number;
  focus: FocusId;
  care: CareId[];
  included: string[];
  excluded: string[];
  warmup: boolean;
  inventory: Record<string, number>;
  equipment: string[];
  /** Skivestørrelser brugeren faktisk har, tungeste først. */
  plates: number[];
  /** Stangvægte brugeren har adgang til. */
  bars: number[];
  /** Sandbag-vægte brugeren faktisk har, tungeste først. */
  sandbags: number[];
  surprise: boolean;
  /** Signaturer fra de seneste workouts, brugt til at undgå gentagelse. */
  recentSignatures: WorkoutSignature[];
  recentPatterns: string[];
  seed: number;
  engineVersion: string;
  rulesVersion: string;
  exerciseDataVersion: string;
}

/** Fingeraftrykket, Smart Mix sammenligner kandidater og historik på. */
export interface WorkoutSignature {
  format: FormatId;
  /** Første øvelse i hoveddelen. */
  opener: string;
  /** Sorterede øvelses-id'er i hoveddelen. */
  movements: string[];
  /** Kort tekstsignatur, fx "amrap|row|burpee,row,wall_ball". */
  key: string;
}

export interface MatchPart {
  id: 'safety' | 'time' | 'focus' | 'execution' | 'variation';
  name: string;
  /** 0–100. */
  score: number;
  /** Dansk forklaring af, hvad der trækker op eller ned. */
  note: string;
}

export interface MatchScore {
  total: number;
  parts: MatchPart[];
  /** Hvad der trækker scoren op. */
  up: string[];
  /** Hvad der trækker den ned. */
  down: string[];
}

export type MixSource = 'smart' | 'ai';

export interface MixInfo {
  source: MixSource;
  /** Hvor mange kandidater der blev bygget. */
  candidates: number;
  /** Hvor mange der bestod hard validation. */
  valid: number;
  /** Dansk forklaring til workoutbriefen. */
  note: string;
  /** Kun sat når AI Mix leverede planen. */
  rationale?: string;
}

export interface Workout {
  id: string;
  seed: number;
  createdAt: string;
  engineVersion: string;
  rulesVersion: string;
  exerciseDataVersion: string;
  /** Workoutens titel ER dens format. */
  title: string;
  format: FormatId;
  formatName: string;
  participants: number;
  people: Person[];
  request: NormalizedRequest;
  blocks: Block[];
  estimatedMinutes: number;
  timeSplit: { warmup: number; main: number; transitions: number };
  dna: Record<DnaAxisId, number>;
  issues: Issue[];
  /** WW Match. */
  score: number;
  match: MatchScore;
  signature: WorkoutSignature;
  mix: MixInfo;
  /** Punktopstillet "hvorfor denne workout" på dansk. */
  explanation: string[];
  /** Samlet partnerprotokol for hoveddelen. */
  partner: PartnerProtocol;
}

/** Rå anmodning fra UI'et. Motoren normaliserer og udfylder resten. */
export interface WorkoutRequest {
  minutes?: number;
  /** Sættes normalt ikke — antallet udledes af fordelingen. */
  participants?: number;
  men?: number;
  women?: number;
  neutral?: number;
  bodyweightM?: number | undefined;
  bodyweightF?: number | undefined;
  bodyweightX?: number | undefined;
  level?: number;
  condition?: number;
  strength?: number;
  focus?: FocusId;
  care?: CareId[];
  included?: string[];
  excluded?: string[];
  warmup?: boolean;
  equipment?: string[];
  counts?: Record<string, number>;
  plates?: number[];
  bars?: number[];
  sandbags?: number[];
  profile?: Profile;
  recentSignatures?: WorkoutSignature[];
  recentPatterns?: string[];
  surprise?: boolean;
  seed?: number;
  people?: Person[];
}

export type GenerateResult =
  | { ok: true; workout: Workout }
  | { ok: false; error: string; issues: Issue[]; workout: null };

/* ---------- AI Mix ---------- */

/** Den schema-låste plan, AI må levere. Alt andet ejes af regelmotoren. */
export interface AiPlan {
  format: FormatId;
  /** Øvelses-id'er fra det katalog, der blev sendt med. */
  exerciseIds: string[];
  /** Kort dansk begrundelse, vises som citat i briefen. */
  rationale: string;
  /** Variationssignatur, så to AI-svar kan sammenlignes. */
  signature: string;
}

/* ---------- Program ---------- */

export interface ProgramGoal {
  id: string;
  name: string;
  desc: string;
  mix: { s: number; c: number; f?: FocusId }[];
}

export type ProgramDayStatus = 'planned' | 'done' | 'partial' | 'skipped';

export interface ProgramDay {
  day: number;
  status: ProgramDayStatus;
  workout: Workout | null;
  error: string | null;
  progression: number;
  /** Dagens formål i én sætning. Sat af programmotoren. */
  stimulus?: string;
  /** Beregnet paslængde inklusive pauser, opsætning og skift. */
  plannedMinutes?: number;
}

export interface ProgramWeek {
  index: number;
  deload: boolean;
  rationale: string;
  days: ProgramDay[];
  /** Blokkens navn, fx "Styrke" eller "Nedtrapning". */
  phaseName?: string;
  /** Sandt i de sidste uger op mod en konkurrence. */
  taper?: boolean;
  /** Sandt i en indkøringsuge, hvor tallene måles i stedet for at blive gættet. */
  assessment?: boolean;
  /** Advarsler og fejl, motoren fandt i ugen. */
  notes?: { code: string; severity: 'error' | 'warning'; message: string; fix?: string }[];
}

export interface Program {
  id: string;
  seed: number;
  goal: string;
  goalName: string;
  weeks: ProgramWeek[];
  createdAt: string;
  minutes: number;
  daysPerWeek: number;
  level: LevelId;
  equipment: string[];
  /**
   * Felterne herunder sættes af programmotoren i `src/program`. De er valgfri, så
   * programmer gemt af en tidligere version stadig kan indlæses og vises.
   */
  /** Punktopstillet "sådan er programmet bygget". */
  explanation?: string[];
  /** Fejl og advarsler på hele forløbet. */
  notes?: { code: string; severity: 'error' | 'warning'; message: string; fix?: string }[];
  /** Sat når der mangler tal, og første uge derfor er en indkøringsuge. */
  assessment?: { missing: { label: string; suggestion: string }[]; explanation: string } | null;
  /** Training max pr. hovedløft, som procenterne er regnet af. */
  trainingMaxes?: { lift: string; name: string; kg: number; coefficient: number; explanation: string }[];
  /** Seed, motorversion og regelversioner, så et program kan genskabes præcist. */
  provenance?: {
    generatorVersion: string;
    domainVersion: string;
    ontologyVersion: string;
    exerciseLibraryVersion: string;
    rulesVersion: string;
    ruleVersions: Record<string, string>;
    seed: number;
  };
  /** Programobjektets version. Tælles op hver gang planen tilpasses efter en uge. */
  version?: number;
}

export interface ProgramOptions {
  goal: string;
  weeks: number;
  daysPerWeek: number;
  minutes?: number;
  /** Klemmes til 1–5 af generatoren. */
  level?: number;
  profile?: Profile;
  bodyweight?: number;
  equipment?: string[];
  counts?: Record<string, number>;
  plates?: number[];
  care?: CareId[];
  seed?: number;
}

/* ---------- Timer ---------- */

export type SegmentKind = 'prep' | 'work' | 'rest' | 'transition' | 'done';

export interface TimerSegment {
  id: string;
  blockId: string;
  blockTitle: string;
  kind: SegmentKind;
  /** Overskriften i timeren, fx "AMRAP · runde 3". */
  label: string;
  /** Sekunder. `null` betyder åben tid (For Time uden fast varighed). */
  seconds: number | null;
  /** Tæller op i stedet for ned. */
  countUp: boolean;
  /** Tidscap i sekunder for åbne segmenter. */
  capSeconds?: number;
  /** Den aktive øvelse, hvis segmentet hører til én. */
  movement?: Movement;
  /** Hele blokkens liste, når segmentet dækker flere øvelser (AMRAP, chipper). */
  movements?: Movement[];
  /** Hvem der arbejder — kun ved partnerworkouts. */
  worker?: string;
  resting?: string;
  round?: number;
  totalRounds?: number;
  /** Dansk hjælpetekst under den aktive øvelse. */
  hint?: string;
}

export interface TimerPlan {
  workoutId: string;
  segments: TimerSegment[];
  /** Summen af de segmenter, der har en fast varighed. */
  totalSeconds: number;
  /** Sandt når mindst ét segment er åbent (For Time). */
  hasOpenSegments: boolean;
}
