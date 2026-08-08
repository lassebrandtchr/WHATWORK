import { FORMATS, isEmomFamily } from './data/formats.js';
import type { Block, Movement, TimerPlan, TimerSegment, Workout } from './types.js';

/**
 * Timeren bygges direkte ud fra workoutens blokke og øvelser — den er ikke et løst
 * ur, man selv skal oversætte til programmet. Segmenter med `seconds: null` er åbne:
 * de tæller op, til brugeren trykker Næste, og styres af blokkens tidscap.
 */

let counter = 0;
const nextId = (): string => `seg_${(counter += 1)}`;

function workerPair(workout: Workout, index: number): { worker: string; resting: string } {
  const people = workout.people;
  const worker = people[index % people.length]?.label ?? 'Deltager 1';
  const resting = people
    .filter((_, i) => i % people.length !== index % people.length)
    .map((p) => p.label)
    .join(' og ');
  return { worker, resting: resting || '—' };
}

function warmupSegments(block: Block): TimerSegment[] {
  const segs: TimerSegment[] = [];
  const rounds = block.rounds ?? 1;
  for (let r = 0; r < rounds; r++) {
    block.movements.forEach((m, i) => {
      segs.push({
        id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'work',
        label: rounds > 1 ? `Opvarmning · runde ${r + 1} af ${rounds}` : 'Opvarmning',
        seconds: Math.round(m.workSec), countUp: false, movement: m,
        round: r + 1, totalRounds: rounds,
        hint: m.cue,
      });
      const last = r === rounds - 1 && i === block.movements.length - 1;
      if (!last && m.transitionSec > 0) {
        segs.push({
          id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'transition',
          label: 'Skift', seconds: Math.round(m.transitionSec), countUp: false,
          hint: 'Gør næste øvelse klar.',
        });
      }
    });
  }
  return segs;
}

function strengthSegments(block: Block): TimerSegment[] {
  const segs: TimerSegment[] = [];
  const lift = block.movements[0];
  if (!lift) return segs;
  const sets = lift.sets ?? block.rounds ?? 5;
  const rest = lift.restSec ?? block.restSec ?? 120;
  for (let s = 0; s < sets; s++) {
    segs.push({
      id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'work',
      label: `Sæt ${s + 1} af ${sets}`, seconds: null, countUp: true,
      movement: lift, round: s + 1, totalRounds: sets,
      hint: 'Tryk Næste, når sættet er gennemført.',
    });
    if (s < sets - 1) {
      segs.push({
        id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'rest',
        label: `Pause efter sæt ${s + 1}`, seconds: rest, countUp: false,
        hint: 'Hold pausen — også når du har lyst til at gå videre.',
      });
    }
  }
  block.movements.slice(1).forEach((m) => {
    segs.push({
      id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'work',
      label: 'Tilbehør', seconds: null, countUp: true, movement: m,
      hint: m.cue,
    });
  });
  return segs;
}

function rampStrengthSegments(block: Block): TimerSegment[] {
  const segs: TimerSegment[] = [];
  // Ramp-sæt har altid både `sets === 1` og `restSec` sat af buildRampMovements — det
  // adskiller dem fra en eventuel tilbehørs-bevægelse, som ingen af delene sætter.
  const rampMoves = block.movements.filter((m) => m.sets === 1 && m.restSec !== undefined);
  rampMoves.forEach((m, i) => {
    segs.push({
      id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'work',
      label: `Sæt ${i + 1} af ${rampMoves.length}`, seconds: null, countUp: true,
      movement: m, round: i + 1, totalRounds: rampMoves.length,
      hint: m.cue,
    });
    if (i < rampMoves.length - 1) {
      segs.push({
        id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'rest',
        label: `Pause efter sæt ${i + 1}`, seconds: m.restSec ?? 150, countUp: false,
        hint: 'Hold pausen — også når du har lyst til at gå videre.',
      });
    }
  });
  block.movements
    .filter((m) => !(m.sets === 1 && m.restSec !== undefined))
    .forEach((m) => {
      segs.push({
        id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'work',
        label: 'Tilbehør', seconds: null, countUp: true, movement: m,
        hint: m.cue,
      });
    });
  return segs;
}

function conditioningSegments(block: Block, workout: Workout): TimerSegment[] {
  const segs: TimerSegment[] = [];
  const format = block.format;
  const title = block.title;
  const rounds = block.rounds ?? 1;
  const capSeconds = (block.cap ?? block.minutes) * 60;

  if (format && isEmomFamily(format)) {
    const every = block.everySec ?? 60;
    const n = block.movements.length || 1;
    if (block.restEveryCycle) {
      for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < n; i++) {
          const m = block.movements[i] as Movement;
          segs.push({
            id: nextId(), blockId: block.id, blockTitle: title, kind: 'work',
            label: `${FORMATS[format]?.name ?? format} · runde ${r + 1} af ${rounds} · min ${i + 1}`,
            seconds: every, countUp: false, movement: m, round: r + 1, totalRounds: rounds,
            hint: 'Arbejd, og hvil resten af minuttet.',
          });
        }
        segs.push({
          id: nextId(), blockId: block.id, blockTitle: title, kind: 'rest',
          label: `Hvile · runde ${r + 1} af ${rounds}`,
          seconds: every, countUp: false,
          hint: 'Fuld pause — saml kræfter til næste runde.',
        });
      }
      return segs;
    }
    for (let i = 0; i < rounds; i++) {
      const m = block.movements[i % n] as Movement;
      segs.push({
        id: nextId(), blockId: block.id, blockTitle: title, kind: 'work',
        label: `${FORMATS[format]?.name ?? format} · interval ${i + 1} af ${rounds}`,
        seconds: every, countUp: false, movement: m, round: i + 1, totalRounds: rounds,
        hint: 'Arbejd, og hvil resten af intervallet.',
      });
    }
    return segs;
  }

  if (format === 'interval' || format === 'team_rotation') {
    const work = block.workSec ?? 45;
    const rest = block.restSec ?? 15;
    const n = block.movements.length || 1;
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < n; i++) {
        const m = block.movements[i] as Movement;
        const station = format === 'team_rotation' ? ` · station ${i + 1} af ${n}` : '';
        segs.push({
          id: nextId(), blockId: block.id, blockTitle: title, kind: 'work',
          label: `Runde ${r + 1} af ${rounds}${station}`,
          seconds: work, countUp: false, movement: m, round: r + 1, totalRounds: rounds,
          ...(format === 'team_rotation'
            ? { worker: 'Alle arbejder på hver sin station', resting: '—' }
            : {}),
          hint: block.openStations
            ? 'Notér dit antal, når tiden er gået.'
            : format === 'team_rotation' ? 'Skift station, når uret siger til.' : 'Arbejd hårdt — pausen kommer.',
        });
        const last = r === rounds - 1 && i === n - 1;
        if (!last) {
          segs.push({
            id: nextId(), blockId: block.id, blockTitle: title, kind: 'rest',
            label: format === 'team_rotation' ? 'Skift station' : 'Pause',
            seconds: rest, countUp: false,
            hint: format === 'team_rotation' ? 'Efterlad stationen klar til den næste.' : 'Hvil helt.',
          });
        }
      }
    }
    return segs;
  }

  if (format === 'you_go_i_go') {
    const people = workout.people.length || 2;
    for (let r = 0; r < rounds; r++) {
      block.movements.forEach((m) => {
        for (let p = 0; p < people; p++) {
          const { worker, resting } = workerPair(workout, p);
          segs.push({
            id: nextId(), blockId: block.id, blockTitle: title, kind: 'work',
            label: `Runde ${r + 1} af ${rounds} · ${worker} arbejder`,
            seconds: null, countUp: true, capSeconds,
            movement: m, worker, resting, round: r + 1, totalRounds: rounds,
            hint: `${worker} arbejder. ${resting} restituerer og gør stationen klar. Tryk Næste ved skift.`,
          });
        }
      });
    }
    return segs;
  }

  if (format === 'fortime' || format === 'chipper' || format === 'ladder') {
    segs.push({
      id: nextId(), blockId: block.id, blockTitle: title, kind: 'work',
      label: `${FORMATS[format]?.name ?? format} · cap ${block.cap ?? block.minutes} min`,
      seconds: null, countUp: true, capSeconds,
      movements: block.movements, totalRounds: rounds,
      hint: block.prescription,
    });
    return segs;
  }

  // AMRAP og partner shared: ét tidsbestemt stykke med hele listen.
  segs.push({
    id: nextId(), blockId: block.id, blockTitle: title, kind: 'work',
    label: title, seconds: block.minutes * 60, countUp: false,
    movements: block.movements, totalRounds: rounds,
    hint: block.prescription,
  });
  return segs;
}

export function buildTimerPlan(workout: Workout): TimerPlan {
  counter = 0;
  const segments: TimerSegment[] = [{
    id: nextId(), blockId: 'prep', blockTitle: 'Gør klar', kind: 'prep',
    label: 'Gør klar', seconds: 10, countUp: false,
    hint: 'Sæt udstyret op, og find din plads.',
  }];

  workout.blocks.forEach((block) => {
    if (block.kind === 'warmup') {
      segments.push(...warmupSegments(block));
    } else if (block.kind === 'strength' && block.scheme === 'ramp') {
      segments.push(...rampStrengthSegments(block));
    } else if (block.kind === 'strength') {
      segments.push(...strengthSegments(block));
    } else {
      segments.push(...conditioningSegments(block, workout));
    }
    segments.push({
      id: nextId(), blockId: block.id, blockTitle: block.title, kind: 'transition',
      label: `Skift til næste del`, seconds: 30, countUp: false,
      hint: 'Puste ud, ryd op, og gør næste del klar.',
    });
  });

  // Den sidste skiftepause er overflødig.
  if (segments[segments.length - 1]?.kind === 'transition') segments.pop();

  segments.push({
    id: nextId(), blockId: 'done', blockTitle: 'Færdig', kind: 'done',
    label: 'Færdig', seconds: null, countUp: true,
    hint: 'Godt gået. Gem resultatet, når du er klar.',
  });

  const totalSeconds = segments.reduce((s, seg) => s + (seg.seconds ?? 0), 0);
  return {
    workoutId: workout.id,
    segments,
    totalSeconds,
    hasOpenSegments: segments.some((s) => s.seconds === null && s.kind !== 'done'),
  };
}
