import { EQUIPMENT_BY_ID } from './data/equipment.js';
import { BY_ID, EXERCISES } from './data/exercises.js';
import { FORMATS } from './data/formats.js';
import { buildConditioning, buildStrength } from './blocks.js';
import { buildWarmup } from './warmup.js';
import { computeDNA, scoreMatch, signatureOf, validate } from './validate.js';
import { normalizeRequest } from './request.js';
import { clamp, mulberry32, pickWeighted, shuffle } from './rng.js';
import type { Rng } from './rng.js';
import { ENGINE_VERSION, EXERCISE_DATA_VERSION, RULES_VERSION } from './version.js';
import type {
  AiPlan, Block, Exercise, FormatId, GenerateResult, Issue, MixInfo,
  MovementPattern, NormalizedRequest, Workout, WorkoutRequest,
} from './types.js';

/**
 * Smart Mix bygger op til 64 gyldige kandidater pr. generering og vælger den, der
 * matcher bedst. Alle kandidater går gennem den samme hard validator — en ugyldig
 * workout bliver aldrig vist, heller ikke som "næstbedste".
 */
export const MAX_CANDIDATES = 64;

/* ---------- Tidsbudget ---------- */

export interface Budget { warm: number; main: number; transitions: number }

export function budget(req: NormalizedRequest): Budget {
  const t = req.minutes;
  // Opvarmningen holdes altid i et fast 10-12 minutters spænd, uanset sessionens
  // samlede længde — den skal nå at varme hele kroppen op ordentligt hver gang.
  const warm = req.warmup ? 10 + (t % 3) : 0;
  // Skiftetid mellem blokke og stationer er en del af budgettet, ikke noget der lægges oveni.
  const transitions = clamp(Math.round(t * 0.05), 1, 4);
  return { warm, transitions, main: Math.max(5, t - warm - transitions) };
}

/* ---------- Formatvalg ---------- */

function formatPool(req: NormalizedRequest): FormatId[] {
  const { participants: p, minutes: t, strength: s, condition: c, focus } = req;

  if (p === 2) {
    // Ved to deltagere er You go, I go det foretrukne format. De øvrige er med,
    // så to på hinanden følgende workouts ikke bliver identiske.
    const pool: FormatId[] = ['you_go_i_go', 'you_go_i_go', 'you_go_i_go', 'you_go_i_go', 'partner_shared'];
    if (s >= 8 && t >= 35) pool.push('strength_cond');
    return pool;
  }
  if (p > 2) {
    const pool: FormatId[] = ['team_rotation', 'team_rotation', 'team_rotation', 'partner_shared'];
    if (t >= 30) pool.push('interval');
    return pool;
  }

  // Beder brugeren udtrykkeligt om styrke, skal der være en styrkedel — ikke bare
  // en tung conditioning-workout. Puljen holdes så snæver, at det faktisk sker.
  if (focus === 'heavy' || s >= 8) {
    const heavy: FormatId[] = t >= 30
      ? ['strength_cond', 'strength_cond', 'strength', 'strength_cond']
      : ['strength', 'strength', 'strength_cond'];
    if (t >= 40) heavy.push('e3mom', 'e4mom');
    return heavy;
  }

  const pool: FormatId[] = [];
  if (s >= 6 && t >= 35) pool.push('strength_cond', 'strength_cond');
  if (focus === 'engine' || focus === 'long' || c >= 8) pool.push('amrap', 'interval', 'e2mom');
  if (focus === 'fast') pool.push('fortime', 'amrap', 'ladder');
  pool.push('amrap', 'emom', 'fortime', 'interval', 'ladder');
  if (t >= 25) pool.push('e2mom', 'e3mom');
  if (t >= 35) pool.push('chipper', 'e4mom');
  if (t >= 45) pool.push('e5mom');
  return pool;
}

/* ---------- Øvelsesvalg ---------- */

function eligible(ex: Exercise, req: NormalizedRequest): boolean {
  if (req.excluded.includes(ex.id)) return false;
  if (!ex.eq.every((e) => e === 'bodyweight' || (req.inventory[e] ?? 0) > 0)) return false;
  if (ex.lvl > req.level) return false;
  if (ex.elig === 'coach-only' || ex.elig === 'disabled') return false;
  if (ex.elig === 'advanced' && (req.level < 4 || req.surprise)) return false;
  if (ex.avoid.some((a) => req.care.includes(a))) return false;
  if (ex.cat === 'warmup') return false;
  return true;
}

/** Kandidatpuljen til hoveddele: alt der er tilladt og ikke er en ren skaleringsøvelse. */
export function mainPool(req: NormalizedRequest): Exercise[] {
  return EXERCISES.filter((e) => eligible(e, req) && !e.accessory);
}

const BUCKETS: Record<string, MovementPattern[]> = {
  engine: ['cardio'],
  legs: ['squat'],
  posterior: ['hinge'],
  push: ['press'],
  pull: ['pull'],
  power: ['oly', 'fullbody'],
  grind: ['carry', 'core'],
};

function bucketOrder(req: NormalizedRequest, rnd: Rng): string[] {
  const wantEngine = req.condition >= 6 || ['engine', 'pulse', 'fast', 'long'].includes(req.focus);
  const order: string[] = [];
  if (wantEngine) order.push('engine');
  if (req.focus === 'legs') order.push('legs', 'power', 'posterior');
  else if (req.focus === 'upper') order.push('push', 'pull', 'power');
  else if (req.focus === 'heavy') order.push('power', 'legs', 'posterior');
  else order.push(...shuffle(rnd, ['power', 'legs', 'pull', 'push', 'posterior']));
  order.push(...shuffle(rnd, ['grind', 'engine', 'push', 'pull', 'legs', 'posterior', 'power']));
  return [...new Set(order)];
}

export function movementCount(minutes: number, format: FormatId, rnd: Rng): number {
  if (format === 'chipper') return minutes >= 30 ? 5 : 4;
  if (format === 'ladder') return 2 + (rnd() < 0.4 ? 1 : 0);
  if (format === 'strength') return 0;
  if (format === 'amrap' || format === 'fortime') {
    if (minutes <= 10) return 2;
    if (minutes <= 18) return rnd() < 0.5 ? 2 : 3;
    if (minutes <= 25) return rnd() < 0.45 ? 4 : 3;
    return rnd() < 0.4 ? 5 : 4;
  }
  if (minutes <= 10) return 2;
  if (minutes <= 18) return rnd() < 0.5 ? 2 : 3;
  return rnd() < 0.45 ? 4 : 3;
}

/**
 * Dæmper vægtningen, så øvelser med lav `weight` også reelt dukker op over mange
 * genereringer, i stedet for at de tungest vægtede altid dominerer poolen.
 */
const spreadWeight = (e: Exercise): number => Math.sqrt(e.weight ?? 1);

/** Overkrop og underkrop — de mønstre, en bred session bør ramme begge sider af. */
const CORE_PATTERNS: MovementPattern[] = ['press', 'pull', 'squat', 'hinge'];

/**
 * Sikrer, at en bred session (uden et snævrende fokus som "legs"/"upper"/"heavy")
 * rammer både over- og underkrop, i stedet for at overlade det til bucket-rækkefølgens
 * tilfældighed. Bytter kun en øvelse ud, hvis dens mønster allerede er repræsenteret
 * mindst to gange — så en session mister aldrig sin eneste engine- eller grind-øvelse
 * for at presse et fjerde mønster ind.
 */
export function ensureFullBodyCoverage(
  out: Exercise[], pool: Exercise[], req: NormalizedRequest, rnd: Rng,
): Exercise[] {
  if (out.length < 3 || ['legs', 'upper', 'heavy'].includes(req.focus)) return out;

  const result = out.slice();
  for (const pattern of CORE_PATTERNS) {
    if (result.some((e) => e.cat === pattern)) continue;
    const usedIds = new Set(result.map((e) => e.id));
    const candidates = pool.filter((e) => e.cat === pattern && !usedIds.has(e.id));
    const replacement = pickWeighted(rnd, candidates, spreadWeight);
    if (!replacement) continue;

    const catCounts = new Map<MovementPattern, number>();
    result.forEach((e) => catCounts.set(e.cat, (catCounts.get(e.cat) ?? 0) + 1));
    let swapIndex = -1;
    let swapCount = 1;
    result.forEach((e, i) => {
      const c = catCounts.get(e.cat) ?? 1;
      if (c > swapCount) { swapCount = c; swapIndex = i; }
    });
    if (swapIndex === -1) continue;
    result[swapIndex] = replacement;
  }
  return result;
}

/** Vælger hoveddelens øvelser med bevægelsesspredning og vægtet tilfældighed. */
export function chooseExercises(
  req: NormalizedRequest,
  rnd: Rng,
  count: number,
  allowed?: string[],
): Exercise[] {
  let pool = mainPool(req);
  if (allowed?.length) {
    const filtered = pool.filter((e) => allowed.includes(e.id));
    if (filtered.length >= Math.min(2, count)) pool = filtered;
  }
  if (!pool.length) return [];

  const out: Exercise[] = [];
  const usedIds = new Set<string>();
  const usedCats = new Set<MovementPattern>();

  // Ønskede øvelser kommer først, hvis de er lovlige.
  req.included.forEach((id) => {
    const ex = BY_ID[id];
    if (ex && out.length < count && eligible(ex, req) && !usedIds.has(id)) {
      out.push(ex); usedIds.add(id); usedCats.add(ex.cat);
    }
  });

  for (const bucket of bucketOrder(req, rnd)) {
    if (out.length >= count) break;
    const cats = BUCKETS[bucket] ?? [];
    const options = pool.filter((e) => cats.includes(e.cat) && !usedIds.has(e.id) && !usedCats.has(e.cat));
    const chosen = pickWeighted(rnd, options, spreadWeight);
    if (chosen) { out.push(chosen); usedIds.add(chosen.id); usedCats.add(chosen.cat); }
  }

  // Fylder resten op — men foretrækker stadig et mønster, der endnu ikke er brugt.
  // Kun hvis poolen reelt er tømt for nye mønstre, gentages et allerede brugt et.
  let guard = 0;
  while (out.length < count && guard++ < 30) {
    const fresh = pool.filter((e) => !usedIds.has(e.id) && !usedCats.has(e.cat));
    const stale = pool.filter((e) => !usedIds.has(e.id));
    const chosen = pickWeighted(rnd, fresh.length ? fresh : stale, spreadWeight);
    if (!chosen) break;
    out.push(chosen); usedIds.add(chosen.id); usedCats.add(chosen.cat);
  }

  return shuffle(rnd, ensureFullBodyCoverage(out, pool, req, rnd));
}

function strengthLift(req: NormalizedRequest, rnd: Rng): Exercise | null {
  const cats: MovementPattern[] = req.focus === 'upper'
    ? ['press', 'pull']
    : req.focus === 'legs' ? ['squat', 'hinge'] : ['squat', 'hinge', 'press', 'oly'];
  const pool = mainPool(req).filter((e) => cats.includes(e.cat) && e.load && e.tech <= (req.level >= 3 ? 5 : 3));
  return pickWeighted(rnd, pool, (e) => e.weight ?? 1) ?? null;
}

function accessoryLift(req: NormalizedRequest, rnd: Rng, main: Exercise): Exercise | null {
  const cats: MovementPattern[] = main.cat === 'squat' || main.cat === 'hinge'
    ? ['pull', 'core'] : ['press', 'core'];
  const pool = EXERCISES.filter((e) => eligible(e, req) && cats.includes(e.cat) && e.tech <= 3);
  return pickWeighted(rnd, pool, (e) => e.weight ?? 1) ?? null;
}

/* ---------- Kandidatbygning ---------- */

interface Candidate {
  blocks: Block[];
  format: FormatId;
  issues: Issue[];
  estimatedMinutes: number;
  b: Budget;
}

function buildCandidate(
  req: NormalizedRequest,
  seedOffset: number,
  format: FormatId,
  b: Budget,
  allowed?: string[],
): Candidate | null {
  const rnd = mulberry32(req.seed + seedOffset * 7919 + 17);
  const blocks: Block[] = [];

  let mainMin = b.main;
  if (format === 'strength' || format === 'strength_cond') {
    const lift = strengthLift(req, rnd);
    if (!lift) return null;
    const sMin = format === 'strength' ? mainMin : Math.max(8, Math.round(mainMin * 0.45));
    const strengthBlock = buildStrength(req, rnd, sMin, lift, accessoryLift(req, rnd, lift));
    blocks.push(strengthBlock);
    mainMin -= sMin;
  }

  if (format !== 'strength') {
    const condFormat: FormatId = format === 'strength_cond'
      ? (req.participants === 2 ? 'you_go_i_go' : req.participants > 2 ? 'team_rotation' : mainMin <= 12 ? 'amrap' : 'fortime')
      : format;
    const count = movementCount(mainMin, condFormat, rnd);
    const exercises = chooseExercises(req, rnd, count, allowed);
    if (!exercises.length) return null;
    const cond = buildConditioning(req, rnd, { format: condFormat, exercises, minutes: Math.max(5, mainMin) });
    if (!cond) return null;
    blocks.push(cond);
  }

  const main = blocks.slice();
  const ordered: Block[] = [];
  if (req.warmup && b.warm > 0) ordered.push(buildWarmup(req, rnd, b.warm, main));
  ordered.push(...main);

  const estimatedMinutes = ordered.reduce((s, bl) => s + bl.minutes, 0) + b.transitions;
  const issues = validate(ordered, req, estimatedMinutes);

  return { blocks: ordered, format, issues, estimatedMinutes, b };
}

/* ---------- Forklaring ---------- */

function explain(w: Omit<Workout, 'explanation'>, req: NormalizedRequest): string[] {
  const parts: string[] = [];
  const cond = w.blocks.find((b) => b.kind === 'conditioning');
  const st = w.blocks.find((b) => b.kind === 'strength');
  const info = FORMATS[w.format];

  parts.push(
    `${req.minutes} minutter i alt: ${w.timeSplit.warmup} minutters opvarmning, `
    + `${w.timeSplit.main} minutters hoveddel og ${w.timeSplit.transitions} minutter til skift.`,
  );
  if (info) parts.push(`${info.name}: ${info.da}`);
  if (st) parts.push(`Der er en selvstændig styrkedel, fordi du satte styrke til ${req.strength} ud af 10.`);
  if (cond) parts.push(`Hoveddelen er sat efter kondition ${req.condition} ud af 10 og fokus "${req.focus}".`);
  if (req.care.length) {
    parts.push(`Øvelser med belastning på dine skånehensyn er sorteret fra, før der blev valgt.`);
  }
  if (req.participants > 1) parts.push(w.partner.lines[0] ?? '');
  parts.push(w.mix.note);
  // Formatets danske forklaring og partnerprotokollens første linje siger ofte det
  // samme. Dubletter fjernes, så briefen ikke gentager sig selv.
  return [...new Set(parts.filter(Boolean))];
}

function humanError(issues: Issue[], req: NormalizedRequest): string {
  const e = issues.find((i) => i.sev === 'error');
  if (!e) return 'Der kunne ikke bygges en workout med de valg.';
  if (e.code === 'TIME_OVER') {
    return `Med ${req.minutes} minutter og de valgte øvelser kan arbejdet ikke nås inden for tiden. `
      + 'Prøv mere tid, eller vælg færre låste øvelser.';
  }
  if (e.code === 'EQUIPMENT' || e.code === 'CONCURRENCY') {
    return 'Der er ikke udstyr nok til de valgte øvelser og deltagere. '
      + 'Tilføj udstyr, skru antallet op under "Hvor mange?", eller fjern en ønsket øvelse.';
  }
  if (e.code === 'SAFETY') {
    return 'De valgte øvelser går imod dit skånehensyn. Fjern en ønsket øvelse, eller slå hensynet fra.';
  }
  if (e.code === 'LEVEL') {
    return 'De ønskede øvelser kræver et højere niveau, end du har valgt.';
  }
  return e.msg;
}

/* ---------- Hovedfunktion ---------- */

export interface GenerateOptions {
  /** Valgfri kreativ plan fra AI Mix. Regelmotoren ejer stadig alt det, der tæller. */
  aiPlan?: AiPlan | null;
  /** Loft på antal kandidater. Bruges af programgeneratoren for at holde farten. */
  maxCandidates?: number;
}

export function generateWorkout(raw: WorkoutRequest, opts: GenerateOptions = {}): GenerateResult {
  const req = normalizeRequest(raw);
  const b = budget(req);
  const limit = clamp(opts.maxCandidates ?? MAX_CANDIDATES, 4, MAX_CANDIDATES);

  const poolRnd = mulberry32(req.seed + 991);
  const formats = shuffle(poolRnd, formatPool(req));

  const ai = opts.aiPlan ?? null;
  const aiFormat = ai && FORMATS[ai.format] ? ai.format : null;

  const candidates: { c: Candidate; source: 'smart' | 'ai' }[] = [];
  let built = 0;

  // AI-planen får de første forsøg. Består den ikke valideringen, fortsætter Smart Mix
  // uden den — AI må aldrig kunne blokere for, at der kommer en workout ud.
  if (aiFormat) {
    for (let i = 0; i < 8 && built < limit; i++, built++) {
      const c = buildCandidate(req, i, aiFormat, b, ai?.exerciseIds);
      if (c && !c.issues.some((x) => x.sev === 'error')) candidates.push({ c, source: 'ai' });
    }
  }

  for (let i = built; i < limit; i++) {
    const format = formats[i % formats.length] as FormatId;
    const c = buildCandidate(req, i, format, b);
    if (c && !c.issues.some((x) => x.sev === 'error')) candidates.push({ c, source: 'smart' });
  }

  const lastIssues = candidates.length
    ? []
    : (buildCandidate(req, 0, formats[0] as FormatId, b)?.issues ?? [
      { code: 'EMPTY', sev: 'error', msg: 'Der kunne ikke bygges en workout.' },
    ]);

  if (!candidates.length) {
    return { ok: false, error: humanError(lastIssues, req), issues: lastIssues, workout: null };
  }

  const scored = candidates.map(({ c, source }) => {
    const dna = computeDNA(c.blocks);
    const signature = signatureOf(c.format, c.blocks);
    const match = scoreMatch(c.blocks, req, c.estimatedMinutes, c.issues, dna, signature);
    return { c, source, dna, signature, match };
  });

  scored.sort((a, x) => {
    if (x.match.total !== a.match.total) return x.match.total - a.match.total;
    const av = a.match.parts.find((p) => p.id === 'variation')?.score ?? 0;
    const xv = x.match.parts.find((p) => p.id === 'variation')?.score ?? 0;
    return xv - av;
  });

  // Har AI leveret en plan, der både består hard validation og holder en anstændig
  // WW Match, får den lov at bestemme format og bevægelseskombination — det er hele
  // pointen med laget. Sikkerheden er allerede afgjort af valideringen, ikke af scoren.
  const AI_FLOOR = 70;
  const bestAi = scored.find((s) => s.source === 'ai' && s.match.total >= AI_FLOOR);
  const best = (bestAi ?? scored[0]) as (typeof scored)[number];
  const mainBlock = best.c.blocks.find((bl) => bl.kind === 'conditioning')
    ?? best.c.blocks.find((bl) => bl.kind === 'strength');

  const mix: MixInfo = {
    source: best.source,
    candidates: limit,
    valid: candidates.length,
    note: best.source === 'ai'
      ? `AI Mix foreslog format og bevægelseskombination. WHATWORK valgte den bedste af ${candidates.length} `
        + `sikre variationer ud af ${limit} og bestemte selv vægte, mål, tid og logistik.`
      : `Smart Mix byggede ${limit} variationer lokalt, kasserede dem der ikke bestod kontrollen, `
        + `og valgte den bedste af de ${candidates.length}, der bestod.`,
    ...(best.source === 'ai' && ai?.rationale ? { rationale: ai.rationale } : {}),
  };

  const partner = mainBlock?.partner ?? {
    mode: 'solo' as const, title: 'Solo', working: 'Du arbejder alene.', resting: '—',
    switchOn: '—', switchUnit: 'reps' as const, realRest: false, nextStartsImmediately: true,
    workShare: 'per_person' as const, lines: [], logistics: [],
  };

  const base: Omit<Workout, 'explanation'> = {
    id: `w_${req.seed}_${best.c.format}`,
    seed: req.seed,
    createdAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    rulesVersion: RULES_VERSION,
    exerciseDataVersion: EXERCISE_DATA_VERSION,
    title: FORMATS[best.c.format]?.name ?? best.c.format,
    format: best.c.format,
    formatName: FORMATS[best.c.format]?.name ?? best.c.format,
    participants: req.participants,
    people: req.people,
    request: req,
    blocks: best.c.blocks,
    estimatedMinutes: best.c.estimatedMinutes,
    timeSplit: { warmup: b.warm, main: b.main, transitions: b.transitions },
    dna: best.dna,
    issues: best.c.issues,
    score: best.match.total,
    match: best.match,
    signature: best.signature,
    mix,
    partner,
  };

  return { ok: true, workout: { ...base, explanation: explain(base, req) } };
}

/** Udstyrsnavne til briefens logistikafsnit. */
export const equipmentName = (id: string): string => EQUIPMENT_BY_ID[id]?.name ?? id;
