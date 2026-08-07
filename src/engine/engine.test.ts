import { describe, expect, it } from 'vitest';
import * as eng from './index.js';
import type { Block, Exercise, GenerateResult, Workout, WorkoutRequest } from './index.js';

function build(raw: WorkoutRequest): Workout {
  const res: GenerateResult = eng.generateWorkout(raw);
  if (!res.ok) throw new Error(`motoren kunne ikke bygge workouten: ${res.error}`);
  return res.workout;
}

const main = (w: Workout): Block => {
  const b = w.blocks.find((x) => x.kind === 'conditioning') ?? w.blocks.find((x) => x.kind === 'strength');
  if (!b) throw new Error('workouten har ingen hoveddel');
  return b;
};

const person = (profile: 'm' | 'f' | 'x', level = 3, bodyweight = 82) =>
  ({ label: 'Test', profile, level, bodyweight });

describe('variation', () => {
  it('giver væsentligt mere end 16 forskellige workouts', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      keys.add(build({ minutes: 30, men: 1, level: 3, seed: 5000 + i }).signature.key);
    }
    expect(keys.size).toBeGreaterThan(16);
  });

  it('bygger op til 64 kandidater og rapporterer hvor mange der bestod', () => {
    const w = build({ minutes: 40, men: 1, level: 3, seed: 11 });
    expect(w.mix.candidates).toBe(eng.MAX_CANDIDATES);
    expect(w.mix.valid).toBeGreaterThan(0);
    expect(w.mix.valid).toBeLessThanOrEqual(eng.MAX_CANDIDATES);
    expect(w.mix.source).toBe('smart');
  });

  it('bevarer brugerens constraints, når der hentes en ny seed', () => {
    const constraints: WorkoutRequest = {
      minutes: 35, men: 1, level: 3, care: ['knee'],
      excluded: ['burpee'], equipment: ['bodyweight', 'kettlebell', 'rower'],
    };
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = build({ ...constraints, seed });
      expect(w.request.minutes).toBe(35);
      expect(w.request.care).toEqual(['knee']);
      expect(w.estimatedMinutes).toBeLessThanOrEqual(37);
      const ids = w.blocks.flatMap((b) => b.movements.map((m) => m.exerciseId));
      expect(ids).not.toContain('burpee');
      // Knæ-skån: ingen øvelse må have 'knee' på sin undgå-liste.
      ids.forEach((id) => expect(eng.BY_ID[id]?.avoid ?? []).not.toContain('knee'));
    }
  });

  it('undgår at gentage format, startøvelse og kombination fra historikken', () => {
    const first = build({ minutes: 30, men: 1, level: 3, seed: 77 });
    const second = build({
      minutes: 30, men: 1, level: 3, seed: 78,
      recentSignatures: [first.signature],
    });
    expect(second.signature.key).not.toBe(first.signature.key);
  });
});

describe('deltagere og partnerlogik', () => {
  it('udleder deltagerantallet af fordelingen', () => {
    const w = build({ minutes: 40, men: 2, women: 1, neutral: 1, level: 3, seed: 3 });
    expect(w.participants).toBe(4);
    expect(w.people.map((p) => p.profile)).toEqual(['m', 'm', 'f', 'x']);
  });

  it('vælger You go, I go ved to deltagere', () => {
    for (const seed of [1, 9, 42, 123, 999]) {
      const w = build({ minutes: 35, men: 1, women: 1, level: 3, seed });
      expect(w.format).toBe('you_go_i_go');
      expect(w.title).toBe('You go, I go');
      expect(w.partner.mode).toBe('you_go_i_go');
    }
  });

  it('forklarer hvem der arbejder, hvornår der skiftes, og om arbejdet er per person', () => {
    const w = build({ minutes: 35, men: 1, women: 1, level: 3, seed: 4 });
    const text = w.partner.lines.join(' ');
    expect(text).toContain('Én arbejder');
    expect(text).toContain('restituerer');
    expect(w.partner.switchOn).toMatch(/efter/);
    expect(w.partner.workShare).toBe('per_person');
    expect(w.partner.realRest).toBe(true);
    expect(w.partner.nextStartsImmediately).toBe(true);
  });

  it('lægger en eksplicit rotation ved flere end to deltagere med én maskine', () => {
    const w = build({
      minutes: 40, men: 2, women: 2, level: 3, seed: 6,
      equipment: ['bodyweight', 'rower', 'kettlebell', 'box'],
      counts: { rower: 1 },
    });
    expect(['team_rotation', 'partner_shared', 'interval']).toContain(w.format);
    expect(['rotation', 'relay', 'shared', 'synchro']).toContain(w.partner.mode);
    expect(w.partner.logistics.join(' ').length).toBeGreaterThan(0);
  });

  it('bruger aldrig opfundne workoutnavne — titlen er formatet', () => {
    const names = new Set(eng.FORMAT_LIST.map((f) => f.name));
    for (let i = 0; i < 30; i++) {
      const w = build({ minutes: 30, men: 1, level: 3, seed: 400 + i });
      expect(names.has(w.title)).toBe(true);
      expect(w.title).not.toContain('Makkertryk');
      expect(w.title).not.toMatch(/Skift, sved/);
    }
  });
});

describe('individuel skalering og maskintargets', () => {
  it('giver hver deltager sin egen linje', () => {
    const w = build({ minutes: 40, men: 1, women: 1, level: 3, seed: 12 });
    main(w).movements.forEach((m) => {
      expect(m.targets).toHaveLength(2);
      expect(m.targets[0]?.label).toBe('Mand 1');
      expect(m.targets[1]?.label).toBe('Kvinde 1');
    });
  });

  it('giver maskinøvelser individuelle mål pr. profil', () => {
    const w = build({
      minutes: 30, men: 1, women: 1, level: 3, seed: 21,
      equipment: ['bodyweight', 'assaultbike'], counts: { assaultbike: 2 },
    });
    const machine = w.blocks
      .flatMap((b) => b.movements)
      .find((m) => eng.BY_ID[m.exerciseId]?.machine && m.unit === 'cal');
    expect(machine).toBeDefined();
    const [man, woman] = machine?.targets ?? [];
    expect(man?.amount).toBeGreaterThan(woman?.amount ?? 0);
    expect(machine?.individualTargets).toBe(true);
    expect(woman?.amountText).toMatch(/cal$/);
  });
});

describe('kilo og skiver', () => {
  const barbell = (id: string): Exercise => {
    const ex = eng.BY_ID[id];
    if (!ex) throw new Error(`ukendt øvelse: ${id}`);
    return ex;
  };

  it('viser samlet vægt, stangens vægt og skiver pr. side', () => {
    const load = eng.scaleLoad(barbell('power_clean'), person('m'), {});
    expect(load?.kind).toBe('barbell');
    expect(load?.plates?.bar).toBeGreaterThan(0);
    expect(load?.text).toMatch(/kg i alt —/);
    expect(load?.text).toMatch(/stang/);
    const total = (load?.plates?.bar ?? 0) + (load?.plates?.perSideKg ?? 0) * 2;
    expect(total).toBe(load?.totalKg);
  });

  it('regner skiverne rigtigt for 50 kg med 20 kg stang', () => {
    const plan = eng.planPlates(50, [25, 20, 15, 10, 5, 2.5, 1.25], [20, 15]);
    expect(plan.bar).toBe(20);
    expect(plan.perSideKg).toBe(15);
    expect(plan.approximate).toBe(false);
    expect(plan.text).toContain('20 kg stang');
    expect(plan.text).toContain('15 kg på hver side');
  });

  it('respekterer de skiver, brugeren faktisk har valgt', () => {
    const plan = eng.planPlates(70, [20, 10], [20]);
    expect(plan.perSide.every((p) => [20, 10].includes(p))).toBe(true);
    // 70 kg kan ikke rammes præcist med kun 20 og 10 kg skiver. Planen markeres som
    // omtrentlig, og den viste vægt er den, stangen faktisk kommer til at veje.
    expect(plan.approximate).toBe(true);
    expect(plan.bar + plan.perSideKg * 2).toBe(60);
  });

  it('rammer præcist, når skiverne rækker', () => {
    const plan = eng.planPlates(70, [25, 20, 15, 10, 5, 2.5, 1.25], [20]);
    expect(plan.approximate).toBe(false);
    expect(plan.bar + plan.perSideKg * 2).toBe(70);
    expect(plan.perSideKg).toBe(25);
  });

  it('holder clean-familien på minimumsforslagene for en trænet profil', () => {
    for (const id of ['hang_power_clean', 'power_clean', 'clean_and_jerk']) {
      expect(eng.scaleLoad(barbell(id), person('m', 2, 70), {})?.totalKg).toBeGreaterThanOrEqual(50);
      expect(eng.scaleLoad(barbell(id), person('f', 2, 55), {})?.totalKg).toBeGreaterThanOrEqual(30);
      expect(eng.scaleLoad(barbell(id), person('x', 2, 65), {})?.totalKg).toBeGreaterThanOrEqual(40);
    }
  });

  it('holder pres-øvelserne på deres minimum', () => {
    for (const id of ['push_press', 'strict_press']) {
      expect(eng.scaleLoad(barbell(id), person('m', 2, 65), {})?.totalKg).toBeGreaterThanOrEqual(30);
      expect(eng.scaleLoad(barbell(id), person('f', 2, 50), {})?.totalKg).toBeGreaterThanOrEqual(20);
      expect(eng.scaleLoad(barbell(id), person('x', 2, 60), {})?.totalKg).toBeGreaterThanOrEqual(25);
    }
  });

  it('foreslår Reverse Lunge med håndvægte pr. håndvægt', () => {
    const ex = barbell('db_reverse_lunge');
    expect(eng.scaleLoad(ex, person('m', 2, 65), {})?.eachKg).toBeGreaterThanOrEqual(15);
    expect(eng.scaleLoad(ex, person('f', 2, 50), {})?.eachKg).toBeGreaterThanOrEqual(10);
    expect(eng.scaleLoad(ex, person('x', 2, 60), {})?.eachKg).toBeGreaterThanOrEqual(12.5);
    expect(eng.scaleLoad(ex, person('m'), {})?.text).toMatch(/^2 × /);
  });

  it('foreslår Sled Push og Sled Pull efter minimumstabellen', () => {
    expect(eng.scaleLoad(barbell('sled_push'), person('m', 2, 70), {})?.totalKg).toBeGreaterThanOrEqual(100);
    expect(eng.scaleLoad(barbell('sled_push'), person('f', 2, 55), {})?.totalKg).toBeGreaterThanOrEqual(70);
    expect(eng.scaleLoad(barbell('sled_push'), person('x', 2, 65), {})?.totalKg).toBeGreaterThanOrEqual(80);
    expect(eng.scaleLoad(barbell('sled_pull'), person('m', 2, 70), {})?.totalKg).toBeGreaterThanOrEqual(80);
    expect(eng.scaleLoad(barbell('sled_pull'), person('f', 2, 55), {})?.totalKg).toBeGreaterThanOrEqual(60);
    expect(eng.scaleLoad(barbell('sled_pull'), person('x', 2, 65), {})?.totalKg).toBeGreaterThanOrEqual(70);
  });

  it('foreslår Wall Balls på 9 og 6 kg', () => {
    expect(eng.scaleLoad(barbell('wall_ball'), person('m', 2, 70), {})?.totalKg).toBe(9);
    expect(eng.scaleLoad(barbell('wall_ball'), person('f', 2, 55), {})?.totalKg).toBe(6);
  });

  it('lader begyndere få lavere forslag end minimumsgulvet', () => {
    const beginner = eng.scaleLoad(barbell('power_clean'), person('f', 1, 55), {});
    expect(beginner?.totalKg).toBeLessThan(30);
  });
});

describe('opvarmning', () => {
  it('bygges specifikt ud fra hoveddelens bevægelsesmønstre', () => {
    const w = build({ minutes: 45, men: 1, level: 3, seed: 31 });
    const warm = w.blocks.find((b) => b.kind === 'warmup');
    expect(warm).toBeDefined();
    const mainPatterns = eng.patternsOfBlocks(w.blocks.filter((b) => b.kind !== 'warmup'));
    const primed = (warm?.movements ?? [])
      .flatMap((m) => eng.BY_ID[m.exerciseId]?.primes ?? []);
    expect(primed.some((p) => mainPatterns.includes(p))).toBe(true);
  });

  it('holder sig inden for 5–10 minutter og er en del af tidsbudgettet', () => {
    for (const minutes of [20, 30, 45, 60, 90]) {
      const w = build({ minutes, men: 1, level: 3, seed: minutes });
      const warm = w.blocks.find((b) => b.kind === 'warmup');
      expect(warm?.minutes ?? 0).toBeLessThanOrEqual(eng.WARMUP_MAX_MINUTES);
      const sum = w.blocks.reduce((a, b) => a + b.minutes, 0) + w.timeSplit.transitions;
      expect(sum).toBe(w.estimatedMinutes);
      expect(w.estimatedMinutes).toBeLessThanOrEqual(minutes + 2);
    }
  });

  it('viser arbejds- og skiftetider direkte', () => {
    const w = build({ minutes: 45, men: 1, level: 3, seed: 33 });
    const warm = w.blocks.find((b) => b.kind === 'warmup');
    expect(warm?.timing).toMatch(/sekunders arbejde · \d+ sekunders skift/);
  });

  it('varierer mellem workouts og bruger ikke Thoracic Rotation som fast valg', () => {
    const sets = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const w = build({ minutes: 45, men: 1, level: 3, seed: 700 + i });
      const warm = w.blocks.find((b) => b.kind === 'warmup');
      const ids = (warm?.movements ?? []).map((m) => m.exerciseId);
      expect(ids).not.toContain('mob_thoracic');
      expect(ids).not.toContain('mob_hip_switch');
      sets.add(ids.join(','));
    }
    expect(sets.size).toBeGreaterThan(4);
  });

  it('holder cooldown adskilt og roligere end opvarmningen', () => {
    const w = build({ minutes: 45, men: 1, level: 3, seed: 34 });
    const cool = w.blocks.find((b) => b.kind === 'cooldown');
    expect(cool).toBeDefined();
    (cool?.movements ?? []).forEach((m) => {
      expect(eng.BY_ID[m.exerciseId]?.cat).toBe('mobility');
    });
  });
});

describe('udstyr og validering', () => {
  it('har alle de krævede udstyrstyper valgt som standard', () => {
    const required = [
      'dumbbell', 'kettlebell', 'barbell', 'rower', 'skierg', 'bikeerg',
      'assaultbike', 'sled', 'box', 'pullupbar', 'wallball', 'sandbag',
    ];
    required.forEach((id) => expect(eng.DEFAULT_EQUIPMENT).toContain(id));
  });

  it('viser aldrig en workout med en valideringsfejl', () => {
    for (let i = 0; i < 40; i++) {
      const res = eng.generateWorkout({ minutes: 25, men: 1, women: 1, level: 2, seed: 900 + i });
      if (!res.ok) continue;
      expect(res.workout.issues.filter((x) => x.sev === 'error')).toHaveLength(0);
    }
  });

  it('bruger kun øvelser, der er udstyr til', () => {
    const w = build({
      minutes: 30, men: 1, level: 3, seed: 55,
      equipment: ['bodyweight', 'kettlebell'],
    });
    w.blocks.flatMap((b) => b.movements).forEach((m) => {
      const ex = eng.BY_ID[m.exerciseId];
      expect(ex?.eq.every((e) => e === 'bodyweight' || e === 'kettlebell')).toBe(true);
    });
  });

  it('afviser en anmodning, der ikke kan bygges forsvarligt', () => {
    const res = eng.generateWorkout({
      minutes: 8, men: 6, level: 1, seed: 2,
      equipment: ['bodyweight'], care: ['knee', 'back', 'shoulder', 'wrist', 'hip'],
      included: ['clean_and_jerk'],
    });
    if (!res.ok) {
      expect(res.error.length).toBeGreaterThan(10);
      expect(res.workout).toBeNull();
    } else {
      expect(res.workout.issues.filter((x) => x.sev === 'error')).toHaveLength(0);
    }
  });

  it('lader ikke skaleringsøvelser bære en hoveddel', () => {
    for (let i = 0; i < 20; i++) {
      const w = build({ minutes: 30, men: 1, level: 3, seed: 1200 + i });
      const cond = w.blocks.find((b) => b.kind === 'conditioning');
      if (!cond) continue;
      const allAccessory = cond.movements.every((m) => eng.BY_ID[m.exerciseId]?.accessory === true);
      expect(allAccessory).toBe(false);
    }
  });
});

describe('intern kandidat-scoring (bruges kun til at vælge den bedste af op til 64 kandidater — vises aldrig i appen)', () => {
  it('har fem delscorer med hver sin forklaring', () => {
    const w = build({ minutes: 30, men: 1, level: 3, seed: 61 });
    expect(w.match.parts.map((p) => p.id)).toEqual(['safety', 'time', 'focus', 'execution', 'variation']);
    w.match.parts.forEach((p) => {
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
      expect(p.note.length).toBeGreaterThan(5);
    });
    expect(w.score).toBe(w.match.total);
  });
});

describe('buildMovement — cue-override', () => {
  it('bruger den normale teknik-cue, når intet er angivet', () => {
    const w = build({ minutes: 20, men: 1, level: 3, seed: 1 });
    const m = w.blocks.flatMap((b) => b.movements)[0];
    expect(m?.cue).toBeTruthy();
  });
});

describe('timerplan', () => {
  it('viser hvert ramp-sæt som sit eget segment med pause imellem, i stedet for at gentage sæt 1', () => {
    let w: Workout | null = null;
    let strengthBlock: Block | undefined;
    // strength/strength_cond kommer kun i formatpuljen ved strength >= 8 (eller focus
    // 'heavy'); focus 'legs' indsnævrer hovedløftet til squat/hinge, så deadlift/back
    // squat/front squat reelt bliver valgt i stedet for oly-løft som power clean.
    for (let seed = 1; seed <= 300 && !strengthBlock; seed++) {
      const candidate = build({ minutes: 30, men: 1, level: 5, focus: 'legs', strength: 8, seed });
      const sb = candidate.blocks.find((b) => b.kind === 'strength' && b.scheme === 'ramp');
      if (sb) { w = candidate; strengthBlock = sb; }
    }
    if (!w || !strengthBlock) {
      throw new Error('fandt ingen ramp-workout i 300 forsøg — undersøg RAMP_ELIGIBLE_IDS/pulje-vægtningen');
    }
    const blockId = strengthBlock.id;

    const plan = eng.buildTimerPlan(w);
    const workSegs = plan.segments.filter((s) => s.blockId === blockId && s.kind === 'work');
    expect(workSegs).toHaveLength(5);
    const displays = workSegs.map((s) => s.movement?.display);
    expect(new Set(displays).size).toBe(5);

    const restSegs = plan.segments.filter((s) => s.blockId === blockId && s.kind === 'rest');
    expect(restSegs).toHaveLength(4);
  });

  it('bygges ud fra workoutens blokke og øvelser', () => {
    const w = build({ minutes: 30, men: 1, level: 3, seed: 71 });
    const plan = eng.buildTimerPlan(w);
    expect(plan.workoutId).toBe(w.id);
    expect(plan.segments.length).toBeGreaterThan(2);
    expect(plan.segments[0]?.kind).toBe('prep');
    expect(plan.segments.at(-1)?.kind).toBe('done');
    const blockIds = new Set(plan.segments.map((s) => s.blockId));
    w.blocks.forEach((b) => expect(blockIds.has(b.id)).toBe(true));
  });

  it('laver ét segment pr. interval i en EMOM', () => {
    const w = build({ minutes: 20, men: 1, level: 3, condition: 9, strength: 1, seed: 1 });
    const plan = eng.buildTimerPlan(w);
    const cond = w.blocks.find((b) => b.kind === 'conditioning');
    if (cond?.format === 'emom') {
      const work = plan.segments.filter((s) => s.blockId === cond.id && s.kind === 'work');
      expect(work.length).toBe(cond.rounds);
      expect(work[0]?.seconds).toBe(60);
    }
  });

  it('markerer hvem der arbejder i en You go, I go', () => {
    const w = build({ minutes: 35, men: 1, women: 1, level: 3, seed: 8 });
    const plan = eng.buildTimerPlan(w);
    const work = plan.segments.filter((s) => s.worker);
    expect(work.length).toBeGreaterThan(0);
    expect(work.map((s) => s.worker)).toContain('Mand 1');
    expect(work.map((s) => s.worker)).toContain('Kvinde 1');
    expect(work[0]?.seconds).toBeNull();
    expect(work[0]?.capSeconds).toBeGreaterThan(0);
  });

  it('lægger en tidscap på For Time', () => {
    const w = build({ minutes: 25, men: 1, level: 3, focus: 'fast', condition: 9, strength: 1, seed: 15 });
    const cond = w.blocks.find((b) => b.kind === 'conditioning');
    if (cond?.format === 'fortime' || cond?.format === 'chipper') {
      const plan = eng.buildTimerPlan(w);
      const open = plan.segments.find((s) => s.blockId === cond.id && s.seconds === null);
      expect(open?.countUp).toBe(true);
      expect(open?.capSeconds).toBe((cond.cap ?? cond.minutes) * 60);
    }
  });
});

describe('dansk microcopy', () => {
  it('bruger danske enheder i motorens output', () => {
    expect(eng.unitLabel('sec', 30)).toBe('30 sek');
    expect(eng.unitLabel('m', 200)).toBe('200 m');
    expect(eng.unitName('reps', 3)).toBe('gentagelser');
    expect(eng.unitName('sec', 3)).toBe('sekunder');
  });

  it('skriver ikke engelske systemord i beskrivelser og forklaringer', () => {
    const forbidden = /\b(seconds|minutes|reps|rounds|rest|work|next|previous)\b/i;
    // Formatnavnene er internationale og beholdes bevidst — de har hver sin danske
    // forklaring i appen. De tælles derfor ikke med som engelske systemord.
    const stripFormats = (text: string): string =>
      eng.FORMAT_LIST.reduce((acc, f) => acc.split(f.name).join('·').split(f.long).join('·'), text);
    for (let i = 0; i < 20; i++) {
      const w = build({ minutes: 40, men: 1, women: 1, level: 3, seed: 1500 + i });
      const text = [
        ...w.explanation,
        ...w.partner.lines,
        ...w.partner.logistics,
        ...w.match.parts.map((p) => p.note),
        ...w.blocks.map((b) => `${b.title} ${b.prescription}`),
      ].join(' ');
      expect(stripFormats(text)).not.toMatch(forbidden);
    }
  });

  it('giver hvert format en dansk forklaring', () => {
    eng.FORMAT_LIST.forEach((f) => {
      expect(f.da.length).toBeGreaterThan(10);
      expect(f.naa.length).toBeGreaterThan(10);
      expect(f.faerdig.length).toBeGreaterThan(10);
    });
  });

  it('bruger komma som decimaltegn i kilo', () => {
    expect(eng.fmtKg(22.5)).toBe('22,5 kg');
    expect(eng.fmtKg(1.25)).toBe('1,25 kg');
    expect(eng.fmtKg(60)).toBe('60 kg');
  });
});

describe('program', () => {
  it('bygger uger, pas og roligere uger', () => {
    const p = eng.generateProgram({ goal: 'allround', weeks: 8, daysPerWeek: 3, minutes: 45, seed: 5 });
    expect(p.weeks).toHaveLength(8);
    expect(p.weeks[0]?.days).toHaveLength(3);
    expect(p.weeks.filter((w) => w.deload).length).toBeGreaterThan(0);
    expect(p.weeks.flatMap((w) => w.days).every((d) => d.workout !== null || d.error !== null)).toBe(true);
  });

  it('holder sig inden for 2–12 uger og 2–6 pas', () => {
    const p = eng.generateProgram({ goal: 'engine', weeks: 99, daysPerWeek: 99, seed: 1 });
    expect(p.weeks).toHaveLength(12);
    expect(p.daysPerWeek).toBe(6);
  });
});
