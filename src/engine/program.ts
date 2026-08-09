import { DEFAULT_EQUIPMENT } from './data/equipment.js';
import { generateWorkout } from './smartmix.js';
import { clamp, makeSeed } from './rng.js';
import type { LevelId, Program, ProgramGoal, ProgramOptions, ProgramWeek } from './types.js';

/**
 * Faserne, program-loading-skærmen viser mens programmet bygges. Hvert trin svarer til
 * én linje på det animerede dokument — når fremdriften krydser `to`, får linjen et flueben.
 */
export const PROGRAM_PHASES: { to: number; text: string; label: string }[] = [
  { to: 8, label: 'Uger og mål', text: 'Lægger ugerne til rette efter dit mål og din tid.' },
  { to: 28, label: 'Ugebalance', text: 'Fordeler styrke, engine og recovery ud over ugerne.' },
  { to: 54, label: 'Træningsdage', text: 'Bygger hver træningsdag, uge for uge.' },
  { to: 76, label: 'Kilo og tid', text: 'Regner kilo, skiver og tid ud for hver dag.' },
  { to: 92, label: 'Roligere uger', text: 'Lægger roligere uger ind, hvor programmet har brug for dem.' },
  { to: 100, label: 'Program klar', text: 'Sætter programmet sammen. Snart klar.' },
];

export const PROGRAM_GOALS: ProgramGoal[] = [
  {
    id: 'allround', name: 'Funktionel allround',
    desc: 'Bredt program med både styrke, kondition og bevægelseskvalitet.',
    mix: [{ s: 5, c: 7 }, { s: 3, c: 8 }, { s: 7, c: 5 }, { s: 4, c: 7 }, { s: 6, c: 6 }, { s: 2, c: 9 }],
  },
  {
    id: 'strength_cond', name: 'Styrke + kondition',
    desc: 'Tungt hovedløft først, kondition bagefter.',
    mix: [{ s: 8, c: 5 }, { s: 7, c: 6 }, { s: 6, c: 7 }, { s: 8, c: 4 }, { s: 5, c: 7 }, { s: 7, c: 5 }],
  },
  {
    id: 'engine', name: 'Kondition',
    desc: 'Maskiner, intervaller og længere arbejde.',
    mix: [{ s: 3, c: 9 }, { s: 2, c: 10 }, { s: 4, c: 8 }, { s: 3, c: 9 }, { s: 2, c: 9 }, { s: 4, c: 8 }],
  },
  {
    id: 'legs', name: 'Fokus underkrop',
    desc: 'Squat, hinge og lunges bærer ugerne.',
    mix: [{ s: 7, c: 5, f: 'legs' }, { s: 5, c: 7, f: 'legs' }, { s: 8, c: 4, f: 'legs' }, { s: 4, c: 8 }, { s: 6, c: 6, f: 'legs' }, { s: 5, c: 6 }],
  },
  {
    id: 'upper', name: 'Fokus overkrop',
    desc: 'Pres og træk med kondition imellem.',
    mix: [{ s: 7, c: 5, f: 'upper' }, { s: 5, c: 7, f: 'upper' }, { s: 8, c: 4, f: 'upper' }, { s: 4, c: 8 }, { s: 6, c: 6, f: 'upper' }, { s: 5, c: 6 }],
  },
];

/**
 * Programgeneratoren kører den samme motor pr. dag, men med et lavere kandidatloft.
 * Et 12-ugers program på 6 dage er 72 workouts — 64 kandidater pr. dag ville tage
 * længere tid, end nogen vil vente på en knap.
 */
const CANDIDATES_PER_DAY = 16;

export function generateProgram(opts: ProgramOptions): Program {
  const goal = PROGRAM_GOALS.find((g) => g.id === opts.goal) ?? (PROGRAM_GOALS[0] as ProgramGoal);
  const weeks = clamp(opts.weeks || 4, 2, 12);
  const days = clamp(opts.daysPerWeek || 3, 2, 6);
  const seed = opts.seed ?? makeSeed();
  const level = clamp(opts.level ?? 2, 1, 5) as LevelId;
  const equipment = opts.equipment ?? DEFAULT_EQUIPMENT;
  const minutes = opts.minutes ?? 45;

  const out: Program = {
    id: `p_${seed}`, seed, goal: goal.id, goalName: goal.name,
    weeks: [], createdAt: new Date().toISOString(),
    minutes, daysPerWeek: days, level, equipment,
  };

  let k = 0;
  for (let w = 0; w < weeks; w++) {
    const deload = weeks >= 6 && (w + 1) % 4 === 0;
    const week: ProgramWeek = {
      index: w + 1,
      deload,
      rationale: deload
        ? 'Roligere uge. Volumen ned, teknik og bevægelighed op — så næste blok kan tages hårdere.'
        : w === 0
          ? 'Første uge sætter udgangspunktet. Hold lidt tilbage, så der er noget at bygge videre på.'
          : `Bygger videre på uge ${w}: lidt mere volumen i hoveddelen, samme tid.`,
      days: [],
    };

    for (let d = 0; d < days; d++) {
      const m = goal.mix[k % goal.mix.length] as { s: number; c: number; f?: Program['goal'] };
      k += 1;
      const prog = deload ? 0.85 : 1 + w * 0.03;
      const res = generateWorkout({
        minutes,
        level,
        strength: clamp(Math.round(m.s * (deload ? 0.8 : 1)), 1, 10),
        condition: clamp(Math.round(m.c * (deload ? 0.8 : 1)), 1, 10),
        focus: (m.f as never) ?? 'allround',
        equipment,
        counts: opts.counts ?? {},
        plates: opts.plates ?? [],
        care: opts.care ?? [],
        men: opts.profile === 'f' ? 0 : opts.profile === 'x' ? 0 : 1,
        women: opts.profile === 'f' ? 1 : 0,
        neutral: opts.profile === 'x' ? 1 : 0,
        bodyweightM: opts.profile === 'f' || opts.profile === 'x' ? undefined : opts.bodyweight,
        bodyweightF: opts.profile === 'f' ? opts.bodyweight : undefined,
        bodyweightX: opts.profile === 'x' ? opts.bodyweight : undefined,
        seed: seed + w * 100 + d * 13,
      }, { maxCandidates: CANDIDATES_PER_DAY });

      week.days.push({
        day: d + 1,
        status: 'planned',
        workout: res.ok ? res.workout : null,
        error: res.ok ? null : res.error,
        progression: Math.round(prog * 100) / 100,
      });
    }
    out.weeks.push(week);
  }
  return out;
}
