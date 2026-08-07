import { EVERY_SEC, FORMATS, isEmomFamily } from './data/formats.js';
import { buildMovement, roundSeconds, unitLabel } from './movements.js';
import { planPartner } from './partner.js';
import { clamp, pick, roundTo } from './rng.js';
import type { Rng } from './rng.js';
import type { Block, Exercise, FormatId, Movement, NormalizedRequest } from './types.js';

/** Trapper til Ladder-formatet. */
const LADDERS: number[][] = [
  [21, 15, 9],
  [15, 12, 9, 6, 3],
  [10, 8, 6, 4, 2],
  [5, 10, 15, 20],
  [3, 6, 9, 12, 15],
  [9, 15, 21],
];

function resize(ex: Exercise, req: NormalizedRequest, rnd: Rng, reps: number): Movement {
  return buildMovement(ex, req, rnd, { reps, intensity: 1 });
}

/** Antal gentagelser, der passer i et interval af den givne længde. */
function repsForInterval(ex: Exercise, seconds: number, fill = 0.62): number {
  const target = seconds * fill;
  const step = ex.unit === 'cal' ? 1 : ex.unit === 'm' ? 25 : ex.unit === 'sec' ? 5 : 1;
  const raw = ex.unit === 'sec' ? target : target / ex.sec;
  const [lo, hi] = ex.rep ?? [1, 999];
  return clamp(Math.max(step, roundTo(raw, step)), Math.min(lo, 3), hi * 1.5);
}

export interface ConditioningOptions {
  format: FormatId;
  exercises: Exercise[];
  minutes: number;
}

/**
 * Bygger hoveddelen ud fra et allerede valgt format og et allerede valgt sæt øvelser.
 * Selve valget ligger i Smart Mix — her omsættes det til reps, tider og runder.
 */
export function buildConditioning(
  req: NormalizedRequest,
  rnd: Rng,
  opts: ConditioningOptions,
): Block | null {
  const { format, exercises } = opts;
  const min = Math.max(4, Math.round(opts.minutes));
  if (!exercises.length) return null;

  const intensity = clamp(0.5 + req.condition / 14, 0.5, 1.15);
  let movements = exercises.map((ex) => buildMovement(ex, req, rnd, { intensity }));

  let title = FORMATS[format]?.name ?? format;
  let prescription = '';
  let rounds: number | undefined;
  let cap: number | undefined;
  let everySec: number | undefined;
  let workSec: number | undefined;
  let restSec: number | undefined;

  const perRound = () => roundSeconds(movements);

  if (isEmomFamily(format)) {
    everySec = EVERY_SEC[format] ?? 60;
    const slots = Math.max(2, Math.floor((min * 60) / everySec));
    movements = movements.slice(0, Math.min(4, movements.length));
    movements = movements.map((_m, i) => {
      const ex = exercises[i] as Exercise;
      return resize(ex, req, rnd, repsForInterval(ex, everySec ?? 60));
    });
    title = `${FORMATS[format]?.name ?? format} ${min}`;
    rounds = slots;
    prescription = `${slots} intervaller à ${(everySec ?? 60) / 60} min · skiftevis: ${movements.map((m) => m.name).join(' → ')}`;
  } else if (format === 'amrap') {
    title = `${min} min AMRAP`;
    rounds = Math.max(2, Math.round((min * 60) / Math.max(45, perRound())));
    prescription = `Så mange runder og gentagelser som muligt på ${min} minutter`;
    cap = min;
  } else if (format === 'partner_shared') {
    movements = movements.map((m, i) => {
      const ex = exercises[i] as Exercise;
      const shared = m.reps * req.participants;
      const built = resize(ex, req, rnd, shared);
      return { ...built, display: `${unitLabel(ex.unit, shared)} ${ex.name} · delt` };
    });
    title = `${min} min Partner shared work`;
    rounds = Math.max(1, Math.round((min * 60) / Math.max(60, perRound())));
    prescription = `Delt arbejde på ${min} minutter · tallene er jeres samlede antal`;
    cap = min;
  } else if (format === 'you_go_i_go') {
    // Begge partnere kører hele listen, den ene ad gangen — én runde koster dobbelt tid.
    const perPersonRound = perRound();
    const roundCost = perPersonRound * req.participants;
    rounds = clamp(Math.round((min * 60 * 0.85) / Math.max(60, roundCost)), 2, 12);
    title = 'You go, I go';
    cap = min;
    prescription = `${rounds} runder pr. person · I skiftes efter hver øvelse · cap ${min} min`;
  } else if (format === 'team_rotation') {
    workSec = req.condition >= 7 ? 45 : 60;
    restSec = req.condition >= 7 ? 15 : 20;
    everySec = workSec + restSec;
    const stations = movements.length;
    rounds = Math.max(2, Math.floor((min * 60) / (everySec * stations)));
    movements = movements.map((_m, i) => {
      const ex = exercises[i] as Exercise;
      return resize(ex, req, rnd, repsForInterval(ex, workSec ?? 45, 0.9));
    });
    title = 'Team rotation';
    prescription = `${rounds} runder à ${stations} stationer · ${workSec} sek arbejde / ${restSec} sek skift`;
    cap = min;
  } else if (format === 'interval') {
    workSec = req.condition >= 7 ? 40 : 60;
    restSec = req.condition >= 7 ? 20 : 30;
    everySec = workSec + restSec;
    const sets = Math.max(3, Math.floor((min * 60) / (everySec * movements.length)));
    movements = movements.map((_m, i) => {
      const ex = exercises[i] as Exercise;
      return resize(ex, req, rnd, repsForInterval(ex, workSec ?? 40, 0.85));
    });
    title = `Interval ${workSec}/${restSec}`;
    rounds = sets;
    prescription = `${sets} sæt · ${workSec} sekunders arbejde / ${restSec} sekunders pause pr. station`;
    cap = min;
  } else if (format === 'ladder') {
    const ladder = pick(rnd, LADDERS) ?? (LADDERS[0] as number[]);
    rounds = ladder.length;
    title = `Ladder ${ladder.join('-')}`;
    cap = min;
    prescription = `${ladder.join('-')} gentagelser pr. runde · ${movements.map((m) => m.name).join(' + ')} · cap ${min} min`;
    // Trappen vises som runde 1's tal; timeren og briefen bruger hele trappen.
    movements = movements.map((_m, i) => {
      const ex = exercises[i] as Exercise;
      const built = resize(ex, req, rnd, ladder[0] as number);
      return { ...built, display: `${ladder.join('-')} ${ex.name}` };
    });
  } else if (format === 'chipper') {
    movements = movements.map((m, i) => {
      const ex = exercises[i] as Exercise;
      return resize(ex, req, rnd, Math.round(m.reps * 1.7));
    });
    title = 'Chipper';
    rounds = 1;
    cap = min;
    prescription = `Én gang igennem listen · cap ${min} min`;
  } else {
    // For Time
    const target = clamp(Math.round((min * 60 * 0.78) / Math.max(60, perRound())), 2, 8);
    rounds = target;
    cap = min;
    const est = (perRound() * target) / 60;
    title = `${target} runder For Time`;
    prescription = `${target} runder · cap ${min} min · forventet ${Math.max(1, Math.floor(est * 0.85))}–${Math.ceil(est * 1.15)} min`;
  }

  const partner = planPartner(movements, req, format);

  return {
    id: 'conditioning',
    kind: 'conditioning',
    title,
    format,
    minutes: min,
    prescription,
    movements,
    partner,
    ...(rounds === undefined ? {} : { rounds }),
    ...(cap === undefined ? {} : { cap }),
    ...(everySec === undefined ? {} : { everySec }),
    ...(workSec === undefined ? {} : { workSec }),
    ...(restSec === undefined ? {} : { restSec }),
  };
}

const SCHEMES_BEGINNER = [{ s: 4, r: 6, pct: 0.7 }, { s: 3, r: 8, pct: 0.65 }, { s: 5, r: 5, pct: 0.68 }];
const SCHEMES_TRAINED = [{ s: 5, r: 5, pct: 0.78 }, { s: 5, r: 3, pct: 0.85 }, { s: 4, r: 6, pct: 0.75 }, { s: 3, r: 8, pct: 0.7 }];

/** Styrkedelen: ét hovedløft med rigtige pauser, eventuelt med en tilbehørsøvelse. */
export function buildStrength(
  req: NormalizedRequest,
  rnd: Rng,
  minutes: number,
  main: Exercise,
  accessory: Exercise | null,
): Block {
  const min = Math.max(6, Math.round(minutes));
  const schemes = req.level <= 2 ? SCHEMES_BEGINNER : SCHEMES_TRAINED;
  const sc = pick(rnd, schemes) ?? (schemes[0] as { s: number; r: number; pct: number });
  const restSec = sc.r <= 5 ? 150 : 120;

  const lift = buildMovement(main, req, rnd, {
    reps: sc.r, sets: sc.s, pct: sc.pct, restSec,
    display: `${sc.s} × ${sc.r} ${main.name}`,
  });

  const movements: Movement[] = [{ ...lift, workSec: sc.s * (sc.r * main.sec + restSec) }];
  if (accessory && min >= 14) {
    movements.push(buildMovement(accessory, req, rnd, { intensity: 0.8 }));
  }

  const partner = planPartner(movements, req, 'strength');

  return {
    id: 'strength',
    kind: 'strength',
    title: `Styrke · ${sc.s} × ${sc.r}`,
    format: 'strength',
    minutes: min,
    prescription: `${sc.s} × ${sc.r} · ca. ${Math.round((restSec / 60) * 10) / 10} min pause mellem sæt`,
    movements,
    rounds: sc.s,
    restSec,
    partner,
  };
}
