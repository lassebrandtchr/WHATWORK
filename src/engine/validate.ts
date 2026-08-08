import { BY_ID } from './data/exercises.js';
import { findBottlenecks } from './partner.js';
import { clamp } from './rng.js';
import { WARMUP_MAX_MINUTES } from './warmup.js';
import type {
  Block, DnaAxisId, DnaAxis, FocusId, Issue, MatchPart, MatchScore,
  NormalizedRequest, Workout, WorkoutSignature,
} from './types.js';

export const DNA_AXES: DnaAxis[] = [
  { id: 'engine', name: 'Kondition' },
  { id: 'legs', name: 'Ben' },
  { id: 'hinge', name: 'Baglår' },
  { id: 'press', name: 'Pres' },
  { id: 'pull', name: 'Træk' },
  { id: 'core', name: 'Core' },
  { id: 'grip', name: 'Greb' },
  { id: 'cns', name: 'Intensitet' },
];

export function computeDNA(blocks: Block[]): Record<DnaAxisId, number> {
  const sum: Partial<Record<DnaAxisId, number>> = {};
  blocks
    .filter((b) => b.kind === 'conditioning' || b.kind === 'strength')
    .forEach((b) => b.movements.forEach((m) => {
      const ex = BY_ID[m.exerciseId];
      if (!ex) return;
      const w = clamp(m.workSec / 60, 0.5, 8);
      (Object.entries(ex.fat) as [DnaAxisId, number][]).forEach(([k, v]) => {
        sum[k] = (sum[k] ?? 0) + v * w;
      });
    }));
  const max = Math.max(1, ...Object.values(sum).filter((v): v is number => typeof v === 'number'));
  const dna = {} as Record<DnaAxisId, number>;
  DNA_AXES.forEach((a) => { dna[a.id] = Math.round(clamp(((sum[a.id] ?? 0) / max) * 10, 0, 10)); });
  return dna;
}

/** De akser, et fokus forventes at ramme. */
const FOCUS_AXES: Record<FocusId, DnaAxisId[]> = {
  allround: ['engine', 'legs', 'press', 'pull'],
  pulse: ['engine'],
  heavy: ['cns', 'legs', 'hinge'],
  legs: ['legs', 'hinge'],
  upper: ['press', 'pull'],
  engine: ['engine'],
  fast: ['engine', 'cns'],
  long: ['engine', 'grip'],
};

export function signatureOf(format: Workout['format'], blocks: Block[]): WorkoutSignature {
  const main = blocks.find((b) => b.kind === 'conditioning') ?? blocks.find((b) => b.kind === 'strength');
  const ids = main?.movements.map((m) => m.exerciseId) ?? [];
  const sorted = [...ids].sort();
  return {
    format,
    opener: ids[0] ?? '',
    movements: sorted,
    key: `${format}|${ids[0] ?? ''}|${sorted.join(',')}`,
  };
}

/**
 * Hard validation. Alt med `sev: 'error'` gør workouten ugyldig, og en ugyldig
 * workout bliver aldrig vist — hverken fra Smart Mix eller fra AI Mix.
 */
export function validate(
  blocks: Block[],
  req: NormalizedRequest,
  estimatedMinutes: number,
): Issue[] {
  const issues: Issue[] = [];
  const main = blocks.find((b) => b.kind === 'conditioning') ?? blocks.find((b) => b.kind === 'strength');

  if (!main || !main.movements.length) {
    issues.push({ code: 'EMPTY', sev: 'error', msg: 'Hoveddelen endte uden øvelser.' });
  }

  if (estimatedMinutes > req.minutes + 2) {
    issues.push({
      code: 'TIME_OVER', sev: 'error',
      msg: `Estimeret ${estimatedMinutes} minutter mod et budget på ${req.minutes} minutter.`,
    });
  }
  if (estimatedMinutes < req.minutes * 0.55) {
    issues.push({ code: 'TIME_UNDER', sev: 'warning', msg: 'Sessionen fylder mindre end den afsatte tid.' });
  }

  const warm = blocks.find((b) => b.kind === 'warmup');
  if (warm && warm.minutes > WARMUP_MAX_MINUTES) {
    issues.push({
      code: 'WARMUP_LONG', sev: 'error',
      msg: `Opvarmningen fylder mere end ${WARMUP_MAX_MINUTES} minutter.`,
    });
  }

  blocks.forEach((b) => b.movements.forEach((m) => {
    const ex = BY_ID[m.exerciseId];
    if (!ex) {
      issues.push({ code: 'UNKNOWN', sev: 'error', msg: `Ukendt øvelse: ${m.exerciseId}.` });
      return;
    }
    const hasEquipment = ex.eq.every((e) => e === 'bodyweight' || (req.inventory[e] ?? 0) > 0);
    if (!hasEquipment) {
      issues.push({ code: 'EQUIPMENT', sev: 'error', msg: `${ex.name} kræver udstyr, I ikke har valgt.` });
    }
    if (ex.avoid.some((a) => req.care.includes(a))) {
      issues.push({ code: 'SAFETY', sev: 'error', msg: `${ex.name} går imod dit skånehensyn.` });
    }
    if (ex.lvl > req.level) {
      issues.push({ code: 'LEVEL', sev: 'error', msg: `${ex.name} kræver et højere niveau, end du har valgt.` });
    }
    if (req.excluded.includes(ex.id)) {
      issues.push({ code: 'EXCLUDED', sev: 'error', msg: `${ex.name} er på din fravalgsliste.` });
    }
    if (m.targets.length !== req.people.length) {
      issues.push({ code: 'SCALING', sev: 'error', msg: `${ex.name} mangler mål til alle deltagere.` });
    }
    if (ex.load && m.targets.some((t) => t.load === null)) {
      issues.push({ code: 'LOAD', sev: 'error', msg: `${ex.name} mangler en belastning til en af deltagerne.` });
    }
    if (m.unit === 'reps' && m.reps > 60 && ex.tech >= 4) {
      issues.push({
        code: 'VOLUME', sev: 'error',
        msg: `${m.reps} gentagelser ${ex.name} er for meget for et teknisk løft.`,
      });
    }
  }));

  if (main && req.participants > 1) {
    const bottlenecks = findBottlenecks(main.movements, req);
    if (bottlenecks.length && main.partner && (main.partner.mode === 'synchro' || main.partner.mode === 'solo')) {
      issues.push({
        code: 'CONCURRENCY', sev: 'error',
        msg: 'Flere deltagere om det samme udstyr uden en rotationsplan.',
      });
    }
    if (bottlenecks.some((b) => b.have === 0)) {
      issues.push({ code: 'CONCURRENCY', sev: 'error', msg: 'En øvelse kræver udstyr, der slet ikke er valgt.' });
    }
  }

  // En hoveddel må ikke bæres af skalerings- og rehabøvelser alene.
  if (main && main.kind === 'conditioning') {
    const accessoryOnly = main.movements.every((m) => BY_ID[m.exerciseId]?.accessory === true);
    if (accessoryOnly) {
      issues.push({
        code: 'ACCESSORY', sev: 'error',
        msg: 'Hoveddelen består kun af skaleringsøvelser.',
      });
    }
  }

  // Hård regel: en hoveddel på over 25 minutter skal have mindst 4 forskellige
  // øvelser. Opvarmning, cooldown og en selvstændig styrke-/skills-del tæller
  // ikke med — de er andre blokke med deres eget øvelsesvalg.
  if (main && main.kind === 'conditioning' && main.minutes > 25) {
    const distinctMain = new Set(main.movements.map((m) => m.exerciseId)).size;
    if (distinctMain < 4) {
      issues.push({
        code: 'MAIN_VARIETY', sev: 'error',
        msg: `Hoveddelen varer over 25 minutter og skal have mindst 4 forskellige øvelser (har ${distinctMain}).`,
      });
    }
  }

  return issues;
}

function variationScore(sig: WorkoutSignature, recent: WorkoutSignature[]): { score: number; note: string } {
  if (!recent.length) return { score: 100, note: 'Ingen nyere workouts at gentage.' };
  let penalty = 0;
  const reasons: string[] = [];
  recent.slice(0, 8).forEach((r, i) => {
    const recency = 1 - i * 0.1;
    if (r.key === sig.key) { penalty += 55 * recency; reasons.push('samme workout som en af de seneste'); }
    else {
      if (r.format === sig.format) penalty += 12 * recency;
      if (r.opener === sig.opener && sig.opener) penalty += 12 * recency;
      const shared = sig.movements.filter((m) => r.movements.includes(m)).length;
      const overlap = shared / Math.max(1, sig.movements.length);
      if (overlap >= 0.75) penalty += 18 * recency;
      else if (overlap >= 0.5) penalty += 8 * recency;
    }
  });
  const score = clamp(Math.round(100 - penalty), 0, 100);
  const note = score >= 85
    ? 'Format, startøvelse og bevægelseskombination adskiller sig fra dine seneste workouts.'
    : score >= 60
      ? `Deler ${reasons.length ? 'noget' : 'lidt'} med dine seneste workouts, men er ikke en gentagelse.`
      : 'Ligner en af dine seneste workouts. Tryk "Ny workout" for en anden variation.';
  return { score, note };
}

/**
 * WW Match er WHATWORKs interne kvalitetskontrol af, hvor godt workouten matcher
 * dine valg. Det er ikke en helbreds- eller præstationsscore, og den er ikke
 * videnskabeligt valideret — den er et forklarligt signal, ikke en måling.
 */
export function scoreMatch(
  blocks: Block[],
  req: NormalizedRequest,
  estimatedMinutes: number,
  issues: Issue[],
  dna: Record<DnaAxisId, number>,
  sig: WorkoutSignature,
): MatchScore {
  const errors = issues.filter((i) => i.sev === 'error');
  const warnings = issues.filter((i) => i.sev === 'warning');
  const main = blocks.find((b) => b.kind === 'conditioning') ?? blocks.find((b) => b.kind === 'strength');

  /* Sikkerhed */
  const safetyHits = issues.filter((i) => ['SAFETY', 'LEVEL', 'VOLUME', 'EQUIPMENT', 'LOAD'].includes(i.code));
  const safety = clamp(100 - safetyHits.length * 40 - (errors.length ? 20 : 0), 0, 100);
  const safetyNote = safetyHits.length
    ? `${safetyHits.length} sikkerhedsforbehold: ${safetyHits[0]?.msg ?? ''}`
    : 'Ingen øvelser går imod dit niveau, dine skånehensyn eller dit udstyr.';

  /* Tid */
  const drift = Math.abs(estimatedMinutes - req.minutes) / Math.max(1, req.minutes);
  const time = clamp(Math.round(100 - drift * 220), 0, 100);
  const timeNote = drift <= 0.06
    ? `${estimatedMinutes} minutter mod dine ${req.minutes} — opvarmning og skiftetid er regnet med.`
    : `${estimatedMinutes} minutter mod dine ${req.minutes}. Afvigelsen trækker ned.`;

  /* Retning og fokus */
  const wanted = FOCUS_AXES[req.focus] ?? FOCUS_AXES.allround;
  const hit = wanted.reduce((s, axis) => s + (dna[axis] ?? 0), 0) / Math.max(1, wanted.length);
  const usedAxes = Object.values(dna).filter((v) => v >= 3).length;
  const strengthWanted = req.strength >= 7;
  const hasStrength = blocks.some((b) => b.kind === 'strength');
  let focus = clamp(Math.round(hit * 9 + (usedAxes >= 4 ? 10 : 0)), 0, 100);
  if (strengthWanted && !hasStrength) focus = clamp(focus - 55, 0, 100);
  if (!strengthWanted && hasStrength && req.strength <= 3) focus = clamp(focus - 20, 0, 100);
  const axisName = (id: DnaAxisId): string => DNA_AXES.find((a) => a.id === id)?.name ?? id;
  const weak = wanted.filter((axis) => (dna[axis] ?? 0) < 5).map(axisName);
  const focusNote = strengthWanted && !hasStrength
    ? 'Du bad om meget styrke, men workouten har ingen selvstændig styrkedel.'
    : !strengthWanted && hasStrength && req.strength <= 3
      ? 'Du bad om lidt styrke, men workouten har en selvstændig styrkedel.'
      : weak.length
        ? `Rammer bredt, men ${weak.join(' og ')} fylder lidt i forhold til "${req.focus}".`
        : `Rammer ${wanted.map(axisName).join(', ')} — det er de akser, "${req.focus}" peger på.`;

  /* Afvikling */
  let execution = 100;
  const execNotes: string[] = [];
  if (main?.partner) {
    if (req.participants === 2 && main.partner.mode === 'you_go_i_go') {
      execNotes.push('To deltagere kører You go, I go — én arbejder, én restituerer.');
    } else if (req.participants === 2) {
      execution -= 12;
      execNotes.push('Der er to deltagere, men afviklingen er ikke You go, I go.');
    }
    if (req.participants > 2 && (main.partner.mode === 'rotation' || main.partner.mode === 'relay')) {
      execNotes.push('Rotationen er lagt eksplicit, så ingen deler et redskab samtidig.');
    }
  }
  if (issues.some((i) => i.code === 'CONCURRENCY')) { execution -= 45; execNotes.push('Udstyrslogistikken går ikke op.'); }
  if (warnings.length) execution -= warnings.length * 6;
  const transitionShare = main
    ? main.movements.reduce((s, m) => s + m.transitionSec, 0) / Math.max(1, main.movements.reduce((s, m) => s + m.workSec + m.transitionSec, 0))
    : 0;
  if (transitionShare > 0.35) { execution -= 12; execNotes.push('Der bruges meget tid på skift mellem stationer.'); }
  execution = clamp(Math.round(execution), 0, 100);

  /* Variation */
  const varRes = variationScore(sig, req.recentSignatures);

  const parts: MatchPart[] = [
    { id: 'safety', name: 'Sikkerhed', score: safety, note: safetyNote },
    { id: 'time', name: 'Tid', score: time, note: timeNote },
    { id: 'focus', name: 'Retning', score: focus, note: focusNote },
    { id: 'execution', name: 'Afvikling', score: execution, note: execNotes.join(' ') || 'Afviklingen er entydig for alle deltagere.' },
    { id: 'variation', name: 'Variation', score: varRes.score, note: varRes.note },
  ];

  const weights: Record<MatchPart['id'], number> = {
    safety: 0.3, time: 0.2, focus: 0.2, execution: 0.15, variation: 0.15,
  };
  const total = clamp(
    Math.round(parts.reduce((s, p) => s + p.score * weights[p.id], 0)),
    0, 100,
  );

  const up = parts.filter((p) => p.score >= 85).map((p) => `${p.name}: ${p.note}`);
  const down = parts.filter((p) => p.score < 70).map((p) => `${p.name}: ${p.note}`);

  return { total, parts, up, down };
}
