# Nye workout-typer, bænkpres, sandbag-vægte, farvekodning og timer-lyde — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementere spec'en i `docs/superpowers/specs/2026-08-08-workout-typer-lyd-farve-design.md`
(Del A–G) i WHATWORK: flere øvelser i AMRAP/For Time, EMOM med hvileminut, nye
øvelser (bænkpres, skrå bænkpres, push-up-varianter), faste sandbag-vægte, adskilte
farvede kort for opvarmning/hoveddel, og timer-lyd/skærmsignaler.

**Arkitektur:** Rene tilføjelser til den eksisterende motor (`src/engine/`) og UI
(`src/screens/`, `src/components/`) — ingen eksisterende offentlige funktionssignaturer
fjernes, kun nye valgfrie felter og nye grene i eksisterende `if`/`switch`-blokke. Alle
nye motor-felter er valgfrie (`?:`), så gamle gemte workouts i `localStorage` fortsat
deserialiserer korrekt.

**Tech Stack:** TypeScript (strict), React 18, Vitest + Testing Library, Web Audio API
(ingen nye afhængigheder).

## Global Constraints

- Alt brugervendt tekst er dansk, i samme tone som resten af appen (kort, direkte, ingen
  emoji).
- Alle kilo vises fortsat kun i kg — ingen lbs-visning (spec, "Ikke i scope").
- Ingen nye eksterne npm-pakker — Web Audio API er indbygget i browseren.
- Følg eksisterende mønstre præcist frem for at opfinde nye (plates/bars → sandbags,
  ThemeToggle → SoundToggle, osv.) — se spec'ens filhenvisninger.
- `npm test`, `npm run typecheck` og `npm run lint` skal være grønne efter hver task, der
  rører kode.

---

## Task 1: Del A — op til 5 øvelser i AMRAP / For Time

**Files:**
- Modify: `src/engine/smartmix.ts:116-123` (`movementCount`, tilføj `export`)
- Test: `src/engine/smartmix.test.ts`

**Interfaces:**
- Produces: `movementCount(minutes: number, format: FormatId, rnd: Rng): number` bliver
  eksporteret (var modul-privat).

- [ ] **Step 1: Write the failing test**

Tilføj nederst i `src/engine/smartmix.test.ts`:

```ts
import { movementCount } from './smartmix.js';

describe('movementCount — AMRAP/For Time kan nu gå op til 5 øvelser', () => {
  it('rammer aldrig over 4 øvelser under 26 minutter', () => {
    const rnd = () => 0.999; // vælger altid den øvre gren
    for (const minutes of [8, 15, 20, 25]) {
      expect(movementCount(minutes, 'amrap', rnd)).toBeLessThanOrEqual(4);
      expect(movementCount(minutes, 'fortime', rnd)).toBeLessThanOrEqual(4);
    }
  });

  it('kan ramme 5 øvelser ved 26+ minutter, når terningen falder rigtigt', () => {
    const rnd = () => 0.999; // over 0.4-tærsklen → vælger 5
    expect(movementCount(30, 'amrap', rnd)).toBe(5);
    expect(movementCount(30, 'fortime', rnd)).toBe(5);
  });

  it('falder tilbage til 4 øvelser ved 26+ minutter, når terningen falder lavt', () => {
    const rnd = () => 0; // under 0.4-tærsklen → vælger 4
    expect(movementCount(30, 'amrap', rnd)).toBe(4);
  });

  it('rører ikke EMOM-familien, Interval eller Ladder', () => {
    const rnd = () => 0.999;
    expect(movementCount(40, 'emom', rnd)).toBeLessThanOrEqual(4);
    expect(movementCount(40, 'interval', rnd)).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/smartmix.test.ts -t "movementCount"`
Expected: FAIL — `movementCount` er ikke eksporteret fra `./smartmix.js` (import-fejl).

- [ ] **Step 3: Implement**

I `src/engine/smartmix.ts`, gør funktionen offentlig og tilføj en dedikeret gren for
`amrap`/`fortime` før den generiske gren:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/smartmix.test.ts`
Expected: PASS (alle tests i filen, inkl. de eksisterende `ensureFullBodyCoverage`-tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/smartmix.ts src/engine/smartmix.test.ts
git commit -m "feat: op til 5 oevelser i AMRAP/For Time ved lange sessioner"
```

---

## Task 2: Del B — EMOM med indbygget hvileminut (motor-lag)

**Files:**
- Modify: `src/engine/types.ts` (`Block`-interface, ~linje 192-213)
- Modify: `src/engine/blocks.ts:59-190` (`buildConditioning`)
- Test: `src/engine/blocks.test.ts`

**Interfaces:**
- Produces: `Block.restEveryCycle?: boolean`. Når sand, betyder `Block.rounds` "fulde
  arbejde+hvile-cyklusser", ikke enkeltintervaller.

- [ ] **Step 1: Write the failing test**

Tilføj nederst i `src/engine/blocks.test.ts`:

```ts
const ski = byId('ski');
const row = byId('row');

describe('buildConditioning — EMOM med hvileminut', () => {
  it('indsætter intet hvileminut, når intensiteten er lav', () => {
    const req = normalizeRequest({ minutes: 20, men: 1, level: 3, condition: 4, seed: 1 });
    const block = buildConditioning(req, mulberry32(1), {
      format: 'emom', exercises: [ski, row], minutes: 20,
    });
    expect(block?.restEveryCycle).toBeUndefined();
  });

  it('indsætter et hvileminut for hver fulde rotation, når intensiteten er høj', () => {
    const req = normalizeRequest({ minutes: 25, men: 1, level: 3, condition: 9, seed: 1 });
    const block = buildConditioning(req, mulberry32(1), {
      format: 'emom', exercises: [ski, row], minutes: 25,
    });
    expect(block?.restEveryCycle).toBe(true);
    // 2 øvelser + 1 hvile = 3 min pr. cyklus → floor(25/3) = 8 cyklusser.
    expect(block?.rounds).toBe(8);
    expect(block?.title).toContain('med hvile');
    expect(block?.prescription).toContain('hvileminut');
  });

  it('kræver mindst 2 øvelser for at aktivere hvile-cyklussen', () => {
    const req = normalizeRequest({ minutes: 20, men: 1, level: 3, condition: 9, seed: 1 });
    const block = buildConditioning(req, mulberry32(1), {
      format: 'emom', exercises: [ski], minutes: 20,
    });
    expect(block?.restEveryCycle).toBeUndefined();
  });

  it('rører ikke E2MOM — kun almindelig EMOM får hvile-cyklussen', () => {
    const req = normalizeRequest({ minutes: 25, men: 1, level: 3, condition: 9, seed: 1 });
    const block = buildConditioning(req, mulberry32(1), {
      format: 'e2mom', exercises: [ski, row], minutes: 25,
    });
    expect(block?.restEveryCycle).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/blocks.test.ts -t "EMOM med hvileminut"`
Expected: FAIL — `block?.restEveryCycle` er altid `undefined` (feltet findes ikke endnu).

- [ ] **Step 3: Implement — `Block`-typen**

I `src/engine/types.ts`, i `Block`-interfacet, lige efter feltet `restSec?: number;`:

```ts
  /** Kun på almindelig EMOM: hvert `movements.length`. interval efterfølges af ét
   * hvileminut, og `rounds` tæller fulde cyklusser (arbejde + hvile), ikke enkeltintervaller. */
  restEveryCycle?: boolean;
```

- [ ] **Step 4: Implement — `buildConditioning`**

I `src/engine/blocks.ts`, find deklarationsblokken øverst i funktionen:

```ts
  let title = FORMATS[format]?.name ?? format;
  let prescription = '';
  let rounds: number | undefined;
  let cap: number | undefined;
  let everySec: number | undefined;
  let workSec: number | undefined;
  let restSec: number | undefined;
```

Tilføj `restEveryCycle` til samme blok:

```ts
  let title = FORMATS[format]?.name ?? format;
  let prescription = '';
  let rounds: number | undefined;
  let cap: number | undefined;
  let everySec: number | undefined;
  let workSec: number | undefined;
  let restSec: number | undefined;
  let restEveryCycle: boolean | undefined;
```

Erstat hele `isEmomFamily(format)`-grenen:

```ts
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
```

med:

```ts
  if (isEmomFamily(format)) {
    everySec = EVERY_SEC[format] ?? 60;
    movements = movements.slice(0, Math.min(4, movements.length));
    movements = movements.map((_m, i) => {
      const ex = exercises[i] as Exercise;
      return resize(ex, req, rnd, repsForInterval(ex, everySec ?? 60));
    });
    const wantsRestCycle = format === 'emom' && req.condition >= 7 && movements.length >= 2;
    if (wantsRestCycle) {
      restEveryCycle = true;
      const cycleSec = everySec * (movements.length + 1);
      rounds = Math.max(1, Math.floor((min * 60) / cycleSec));
      title = `${FORMATS[format]?.name ?? format} ${min} · med hvile`;
      prescription = `${rounds} runder à ${movements.length} arbejdsminutter + 1 hvileminut · `
        + `skiftevis: ${movements.map((m) => m.name).join(' → ')}`;
    } else {
      const slots = Math.max(2, Math.floor((min * 60) / everySec));
      title = `${FORMATS[format]?.name ?? format} ${min}`;
      rounds = slots;
      prescription = `${slots} intervaller à ${(everySec ?? 60) / 60} min · skiftevis: ${movements.map((m) => m.name).join(' → ')}`;
    }
  } else if (format === 'amrap') {
```

Til sidst, i retur-objektet nederst i funktionen, find:

```ts
    ...(rounds === undefined ? {} : { rounds }),
    ...(cap === undefined ? {} : { cap }),
    ...(everySec === undefined ? {} : { everySec }),
    ...(workSec === undefined ? {} : { workSec }),
    ...(restSec === undefined ? {} : { restSec }),
  };
```

og tilføj en linje:

```ts
    ...(rounds === undefined ? {} : { rounds }),
    ...(cap === undefined ? {} : { cap }),
    ...(everySec === undefined ? {} : { everySec }),
    ...(workSec === undefined ? {} : { workSec }),
    ...(restSec === undefined ? {} : { restSec }),
    ...(restEveryCycle === undefined ? {} : { restEveryCycle }),
  };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/blocks.test.ts`
Expected: PASS (alle tests i filen).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: Ingen fejl.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/blocks.ts src/engine/blocks.test.ts
git commit -m "feat: EMOM med indbygget hvileminut ved hoej intensitet"
```

---

## Task 3: Del B — EMOM-hvile i timerplanen

**Files:**
- Modify: `src/engine/timerplan.ts:118-131` (`conditioningSegments`)
- Modify: `src/engine/engine.test.ts:383-392` (eksisterende EMOM-timerplan-test — skal
  udvides, ellers knækker den, når `condition: 9` rammer en `restEveryCycle`-EMOM)

**Interfaces:**
- Consumes: `Block.restEveryCycle` (Task 2).
- Produces: Timerplanen indeholder `kind: 'rest'`-segmenter mellem hver cyklus, når
  `restEveryCycle` er sand.

- [ ] **Step 1: Write/update the test**

I `src/engine/engine.test.ts`, erstat den eksisterende test:

```ts
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
```

med:

```ts
  it('laver ét segment pr. interval i en EMOM (eller arbejde+hvile-cyklusser ved høj intensitet)', () => {
    const w = build({ minutes: 20, men: 1, level: 3, condition: 9, strength: 1, seed: 1 });
    const plan = eng.buildTimerPlan(w);
    const cond = w.blocks.find((b) => b.kind === 'conditioning');
    if (cond?.format === 'emom') {
      const work = plan.segments.filter((s) => s.blockId === cond.id && s.kind === 'work');
      const rest = plan.segments.filter((s) => s.blockId === cond.id && s.kind === 'rest');
      expect(work[0]?.seconds).toBe(60);
      if (cond.restEveryCycle) {
        const n = cond.movements.length;
        expect(work.length).toBe((cond.rounds ?? 0) * n);
        expect(rest.length).toBe(cond.rounds);
        expect(rest[0]?.seconds).toBe(60);
        expect(rest[0]?.label).toContain('Hvile');
      } else {
        expect(work.length).toBe(cond.rounds);
        expect(rest.length).toBe(0);
      }
    }
  });

  it('bygger en EMOM med hvile-cyklus for en workout, hvor det er tydeligt intenst', () => {
    let w: Workout | null = null;
    let cond: Block | undefined;
    for (let seed = 1; seed <= 300 && !cond; seed++) {
      const candidate = build({ minutes: 25, men: 1, level: 3, condition: 10, strength: 1, seed });
      const c = candidate.blocks.find((b) => b.kind === 'conditioning' && b.format === 'emom' && b.restEveryCycle);
      if (c) { w = candidate; cond = c; }
    }
    if (!w || !cond) {
      throw new Error('fandt ingen EMOM-med-hvile-workout i 300 forsøg — undersøg formatPool/movementCount');
    }
    const plan = eng.buildTimerPlan(w);
    const rest = plan.segments.filter((s) => s.blockId === cond?.id && s.kind === 'rest');
    const work = plan.segments.filter((s) => s.blockId === cond?.id && s.kind === 'work');
    expect(rest.length).toBe(cond.rounds);
    expect(work.length).toBe((cond.rounds ?? 0) * cond.movements.length);
    // Rækkefølgen skal være N arbejdssegmenter, så ét hvilesegment, gentaget.
    const relevant = plan.segments.filter((s) => s.blockId === cond?.id);
    const n = cond.movements.length;
    for (let r = 0; r < (cond.rounds ?? 0); r++) {
      const cycleStart = r * (n + 1);
      for (let i = 0; i < n; i++) {
        expect(relevant[cycleStart + i]?.kind).toBe('work');
      }
      expect(relevant[cycleStart + n]?.kind).toBe('rest');
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/engine.test.ts -t "EMOM"`
Expected: FAIL — timerplanen laver stadig kun ét `work`-segment pr. interval uden
`rest`-segmenter, uanset `restEveryCycle`.

- [ ] **Step 3: Implement**

I `src/engine/timerplan.ts`, erstat EMOM-grenen i `conditioningSegments`:

```ts
  if (format && isEmomFamily(format)) {
    const every = block.everySec ?? 60;
    const n = block.movements.length || 1;
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
```

med:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/engine.test.ts`
Expected: PASS (hele filen, inkl. de øvrige `timerplan`-tests).

- [ ] **Step 5: Full engine suite + typecheck**

Run: `npx vitest run src/engine/ && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/timerplan.ts src/engine/engine.test.ts
git commit -m "feat: timerplan bygger arbejde+hvile-segmenter for EMOM med hvilecyklus"
```

---

## Task 4: Del C+G — udstyrstype "Justerbar bænk" (ikke box)

**Files:**
- Modify: `src/engine/data/equipment.ts:7-26` (`EQUIPMENT`)
- Modify: `src/components/EquipmentIcon.tsx` (nyt ikon)

**Interfaces:**
- Produces: nyt udstyrs-id `'bench'` i `EQUIPMENT`, tilgængeligt via `eng.EQUIPMENT_BY_ID.bench`.

- [ ] **Step 1: Implement — udstyrsliste**

I `src/engine/data/equipment.ts`, indsæt en ny linje lige efter `box`-posten:

```ts
  { id: 'box', name: 'Box', countable: true, def: 5, onByDefault: true, hint: 'Plyobox' },
  { id: 'bench', name: 'Justerbar bænk', countable: true, def: 2, onByDefault: true, hint: 'Fladt til skrå, 0–70°' },
  { id: 'pullupbar', name: 'Pull-up bar', countable: true, def: 6, onByDefault: true, hint: 'Stang at hænge i' },
```

- [ ] **Step 2: Implement — ikon**

I `src/components/EquipmentIcon.tsx`, indsæt et nyt glyf lige efter `box`:

```tsx
  /* Plyobox: kasse i perspektiv. */
  box: (
    <g {...S}>
      <path d="M4 9.4 12 6l8 3.4-8 3.4z" />
      <path d="M4 9.4v5.2L12 18l8-3.4V9.4" />
      <path d="M12 12.8V18" />
    </g>
  ),
  /* Justerbar bænk: skrå flade på ben, med hævet ryglæn. */
  bench: (
    <g {...S}>
      <path d="M3 16 11 12.4" />
      <path d="M11 12.4V8l6-2.6" />
      <path d="M5 16v4M9.4 13.7v4M17 5.9v4" />
    </g>
  ),
```

- [ ] **Step 3: Verify it compiles and renders**

Run: `npm run typecheck`
Expected: Ingen fejl (`EQUIPMENT` og `GLYPHS` er begge `Record`/array-litteraler, ingen
type-kontrakt at bryde).

Der er ingen eksisterende automatiseret test for selve udstyrslisten eller ikon-kortet —
`hasEquipmentIcon('bench')` verificeres visuelt i Task 15 (browser-check), og
funktionelt i Task 5's `exercises.test.ts` (næste task), som bekræfter at øvelser, der
kræver `bench`, rent faktisk refererer til dette id.

- [ ] **Step 4: Commit**

```bash
git add src/engine/data/equipment.ts src/components/EquipmentIcon.tsx
git commit -m "feat: tilfoej udstyrstypen justerbar baenk (adskilt fra box)"
```

---

## Task 5: Del C+G — nye/rettede øvelser i kataloget

**Files:**
- Modify: `src/engine/data/exercises.ts:50-58` (Pres-sektionen)
- Test: Create `src/engine/data/exercises.test.ts`

**Interfaces:**
- Consumes: udstyrs-id `'bench'` (Task 4).
- Produces: nye øvelses-id'er `incline_bench_press`, `diamond_push_up`,
  `decline_push_up` i `BY_ID`/`EXERCISES`. `bench_press`/`db_bench` bruger nu `eq: [...,
  'bench']` i stedet for `'box'`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/data/exercises.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BY_ID } from './exercises.js';

describe('nye pres-øvelser (Del C+G)', () => {
  it('Bench Press og Dumbbell Bench Press bruger en bænk, ikke en box', () => {
    expect(BY_ID.bench_press?.eq).toEqual(['barbell', 'bench']);
    expect(BY_ID.db_bench?.eq).toEqual(['dumbbell', 'bench']);
  });

  it('Incline Bench Press findes, bruger en bænk, og har lavere referencevægt end fladt bænkpres', () => {
    const incline = BY_ID.incline_bench_press;
    const flat = BY_ID.bench_press;
    expect(incline).toBeDefined();
    expect(incline?.eq).toEqual(['barbell', 'bench']);
    expect(incline?.eq).not.toContain('box');
    expect(incline?.load?.m ?? 0).toBeLessThan(flat?.load?.m ?? 0);
    expect(incline?.load?.f ?? 0).toBeLessThan(flat?.load?.f ?? 0);
  });

  it('Diamond og Decline Push-up findes og er fuldgyldige hoveddels-øvelser, ikke skaleringer', () => {
    expect(BY_ID.diamond_push_up).toBeDefined();
    expect(BY_ID.diamond_push_up?.accessory).toBeUndefined();
    expect(BY_ID.diamond_push_up?.eq).toEqual(['bodyweight']);

    expect(BY_ID.decline_push_up).toBeDefined();
    expect(BY_ID.decline_push_up?.accessory).toBeUndefined();
    expect(BY_ID.decline_push_up?.eq).toEqual(['box']);
  });

  it('almindelig Push-up findes stadig uændret', () => {
    expect(BY_ID.push_up).toBeDefined();
    expect(BY_ID.push_up?.eq).toEqual(['bodyweight']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/data/exercises.test.ts`
Expected: FAIL — `bench_press?.eq` er stadig `['barbell', 'box']`, og
`incline_bench_press`/`diamond_push_up`/`decline_push_up` er `undefined`.

- [ ] **Step 3: Implement**

I `src/engine/data/exercises.ts`, erstat push-up-klyngen:

```ts
  E({ id: 'push_up', name: 'Push-up', cat: 'press', da: 'Krop i én linje, bryst til gulv.', fat: { press: 2, core: 1 }, sec: 2, rep: [10, 25], avoid: ['wrist'], sub: ['knee_push_up'], weight: 1 }),
  E({ id: 'knee_push_up', name: 'Knee Push-up', cat: 'press', accessory: true, da: 'Samme pres fra knæene.', fat: { press: 1 }, sec: 2, rep: [10, 20], sub: [], weight: 0.3 }),
  E({ id: 'hr_push_up', name: 'Hand-release Push-up', cat: 'press', lvl: 2, da: 'Hænderne slippes gulvet i bunden — ingen bounce.', fat: { press: 2, core: 1 }, sec: 2.5, rep: [10, 20], sub: ['push_up'], weight: 1 }),
```

med (to nye linjer tilføjet efter `hr_push_up`):

```ts
  E({ id: 'push_up', name: 'Push-up', cat: 'press', da: 'Krop i én linje, bryst til gulv.', fat: { press: 2, core: 1 }, sec: 2, rep: [10, 25], avoid: ['wrist'], sub: ['knee_push_up'], weight: 1 }),
  E({ id: 'knee_push_up', name: 'Knee Push-up', cat: 'press', accessory: true, da: 'Samme pres fra knæene.', fat: { press: 1 }, sec: 2, rep: [10, 20], sub: [], weight: 0.3 }),
  E({ id: 'hr_push_up', name: 'Hand-release Push-up', cat: 'press', lvl: 2, da: 'Hænderne slippes gulvet i bunden — ingen bounce.', fat: { press: 2, core: 1 }, sec: 2.5, rep: [10, 20], sub: ['push_up'], weight: 1 }),
  E({ id: 'diamond_push_up', name: 'Diamond Push-up', cat: 'press', lvl: 2, tech: 2, avoid: ['wrist', 'shoulder'], da: 'Hænderne samlet under brystet, tommel mod tommel. Mere triceps, sværere end almindelig push-up.', fat: { press: 3, core: 1 }, sec: 2.2, rep: [8, 20], sub: ['push_up'], weight: 0.7 }),
  E({ id: 'decline_push_up', name: 'Decline Push-up', cat: 'press', eq: ['box'], lvl: 2, da: 'Fødderne hævet på boxen. Mere skulder- og øvre brystbelastning.', fat: { press: 3, shoulder: 1, core: 1 }, sec: 2.2, rep: [8, 20], sub: ['push_up'], weight: 0.8 }),
```

Erstat bænkpres-linjerne:

```ts
  E({ id: 'bench_press', name: 'Bench Press', cat: 'press', eq: ['barbell', 'box'], lvl: 2, tech: 2, avoid: ['shoulder'], da: 'Skulderbladene samlet, kontrolleret til brystet.', fat: { press: 3, shoulder: 2, cns: 2 }, sec: 4, rep: [3, 10], load: { m: 90, f: 50 }, sub: ['db_bench'], weight: 0.8 }),
  E({ id: 'db_bench', name: 'Dumbbell Bench Press', cat: 'press', eq: ['dumbbell', 'box'], accessory: true, da: 'Håndvægte giver frit bevægelsesbane for skulderen.', fat: { press: 2, shoulder: 1 }, sec: 3, rep: [8, 15], load: { m: 2 * 27.5, f: 2 * 15 }, pair: true, sub: ['push_up'], weight: 0.5 }),
```

med (rettet udstyr + ny incline-øvelse indsat imellem dem):

```ts
  E({ id: 'bench_press', name: 'Bench Press', cat: 'press', eq: ['barbell', 'bench'], lvl: 2, tech: 2, avoid: ['shoulder'], da: 'Skulderbladene samlet, kontrolleret til brystet.', fat: { press: 3, shoulder: 2, cns: 2 }, sec: 4, rep: [3, 10], load: { m: 90, f: 50 }, sub: ['db_bench'], weight: 0.8 }),
  E({ id: 'incline_bench_press', name: 'Incline Bench Press', cat: 'press', eq: ['barbell', 'bench'], lvl: 2, tech: 2, avoid: ['shoulder'], da: 'Bænken vinklet 45–70°. Skulderbladene samlet, kontrolleret ned til øverste bryst.', fat: { press: 3, shoulder: 3, cns: 2 }, sec: 4, rep: [3, 10], load: { m: 75, f: 42 }, sub: ['bench_press', 'db_shoulder_press'], weight: 0.75 }),
  E({ id: 'db_bench', name: 'Dumbbell Bench Press', cat: 'press', eq: ['dumbbell', 'bench'], accessory: true, da: 'Håndvægte giver frit bevægelsesbane for skulderen.', fat: { press: 2, shoulder: 1 }, sec: 3, rep: [8, 15], load: { m: 2 * 27.5, f: 2 * 15 }, pair: true, sub: ['push_up'], weight: 0.5 }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/data/exercises.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full engine suite (equipment-krav kan påvirke andre tests)**

Run: `npx vitest run src/engine/`
Expected: PASS. `bench` er `onByDefault: true` (Task 4), så `bench_press`s
udstyrskrav er stadig opfyldt i alle eksisterende tests, der bruger standardudstyr.

- [ ] **Step 6: Commit**

```bash
git add src/engine/data/exercises.ts src/engine/data/exercises.test.ts
git commit -m "feat: skraa baenkpres, diamond/decline push-up, ret baenkpres til bench-udstyr"
```

---

## Task 6: Del C+G — gør de nye øvelser valgbare i generatoren

**Files:**
- Modify: `src/screens/Generator.tsx:11-17` (`PICKABLE`)
- Test: Create `src/screens/Generator.test.ts`

**Interfaces:**
- Produces: `export const PICKABLE: string[]` (var modul-privat).

- [ ] **Step 1: Write the failing test**

Create `src/screens/Generator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PICKABLE } from './Generator.js';
import { BY_ID } from '../engine/data/exercises.js';

describe('PICKABLE — ønskede/udelukkede øvelser i generatoren', () => {
  it('indeholder bænkpres, skrå bænkpres og push-up-varianterne', () => {
    ['bench_press', 'incline_bench_press', 'push_up', 'diamond_push_up', 'decline_push_up']
      .forEach((id) => expect(PICKABLE).toContain(id));
  });

  it('alle id\'er i listen findes rent faktisk i øvelseskataloget', () => {
    PICKABLE.forEach((id) => {
      expect(BY_ID[id], `ukendt øvelse i PICKABLE: ${id}`).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Generator.test.ts`
Expected: FAIL — `PICKABLE` er ikke eksporteret (import-fejl), og selv når det rettes,
mangler de nye id'er.

- [ ] **Step 3: Implement**

I `src/screens/Generator.tsx`, erstat:

```ts
const PICKABLE = [
  'push_press', 'strict_press', 'pull_up', 'band_pull_up', 'clean_and_jerk',
  'hang_power_clean', 'power_clean', 'kb_swing', 'devil_press', 'box_jump_over',
  'sled_push', 'sled_pull', 'assault', 'wall_ball', 'row', 'ski', 'bike',
  'sandbag_shoulder', 'walking_lunge', 'db_reverse_lunge', 'thruster', 'burpee',
  'burpee_box_jump_over', 'double_under', 'toes_to_bar',
];
```

med:

```ts
export const PICKABLE = [
  'push_press', 'strict_press', 'pull_up', 'band_pull_up', 'clean_and_jerk',
  'hang_power_clean', 'power_clean', 'kb_swing', 'devil_press', 'box_jump_over',
  'sled_push', 'sled_pull', 'assault', 'wall_ball', 'row', 'ski', 'bike',
  'sandbag_shoulder', 'walking_lunge', 'db_reverse_lunge', 'thruster', 'burpee',
  'burpee_box_jump_over', 'double_under', 'toes_to_bar',
  'bench_press', 'incline_bench_press', 'push_up', 'diamond_push_up', 'decline_push_up',
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Generator.test.ts`
Expected: PASS.

- [ ] **Step 5: Full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS (bekræfter at `export` ikke bryder `App.test.tsx`s render af
Generator-skærmen).

- [ ] **Step 6: Commit**

```bash
git add src/screens/Generator.tsx src/screens/Generator.test.ts
git commit -m "feat: goer baenkpres og push-up-varianter valgbare i generatoren"
```

---

## Task 7: Del D — sandbag-vægte i motoren

**Files:**
- Modify: `src/engine/data/equipment.ts` (nye konstanter)
- Modify: `src/engine/types.ts` (`NormalizedRequest`, `WorkoutRequest`)
- Modify: `src/engine/request.ts` (`normalizeRequest`)
- Modify: `src/engine/movements.ts:62` (`targetFor`)
- Modify: `src/engine/loads.ts` (`LoadContext`, `prescribe`)
- Modify: `src/engine/index.ts:8-11` (barrel-eksport)
- Test: Create `src/engine/loads.test.ts`

**Interfaces:**
- Produces: `SANDBAG_SIZES: number[]`, `DEFAULT_SANDBAGS: number[]` fra
  `data/equipment.ts`; `NormalizedRequest.sandbags: number[]`;
  `WorkoutRequest.sandbags?: number[]`; `LoadContext.sandbags?: number[]`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/loads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scaleLoad } from './loads.js';
import { BY_ID } from './data/exercises.js';
import { DEFAULT_SANDBAGS } from './data/equipment.js';
import type { Person } from './types.js';

const sandbagClean = BY_ID.sandbag_clean!;

const person = (overrides: Partial<Person> = {}): Person => ({
  label: 'Test', profile: 'm', bodyweight: 88, level: 4, ...overrides,
});

describe('scaleLoad — sandbag snapper til brugerens eget udstyr', () => {
  it('snapper til standardlisten (10/20/30 kg), når intet udstyr er angivet', () => {
    const load = scaleLoad(sandbagClean, person());
    expect(load).not.toBeNull();
    expect(DEFAULT_SANDBAGS).toContain(load?.totalKg);
  });

  it('snapper til den brugerangivne liste, ikke standardlisten', () => {
    const load = scaleLoad(sandbagClean, person(), { sandbags: [10] });
    expect(load?.totalKg).toBe(10);
  });

  it('falder tilbage til standardlisten, hvis brugeren ikke har markeret nogen sandbag-vægte', () => {
    const load = scaleLoad(sandbagClean, person(), { sandbags: [] });
    expect(DEFAULT_SANDBAGS).toContain(load?.totalKg);
  });

  it('en let, uøvet kvinde lander på den letteste sandbag i hendes liste', () => {
    const load = scaleLoad(sandbagClean, person({ profile: 'f', level: 1, bodyweight: 55 }), {
      sandbags: [10, 20, 30],
    });
    expect(load?.totalKg).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/loads.test.ts`
Expected: FAIL — `DEFAULT_SANDBAGS` findes ikke i `data/equipment.js`
(import-/kompileringsfejl).

- [ ] **Step 3: Implement — konstanter**

I `src/engine/data/equipment.ts`, tilføj efter `DEFAULT_BARS`:

```ts
export const BAR_SIZES = [20, 15, 10];
export const DEFAULT_BARS = [20, 15];

/** Sandbags i kg — faste vægte, som findes i de fleste sale. */
export const SANDBAG_SIZES = [10, 20, 30];
export const DEFAULT_SANDBAGS = [10, 20, 30];
```

- [ ] **Step 4: Implement — typer**

I `src/engine/types.ts`, i `NormalizedRequest`, lige efter `bars: number[];`:

```ts
  /** Stangvægte brugeren har adgang til. */
  bars: number[];
  /** Sandbag-vægte brugeren faktisk har, tungeste først. */
  sandbags: number[];
```

I `WorkoutRequest`, lige efter `bars?: number[];`:

```ts
  plates?: number[];
  bars?: number[];
  sandbags?: number[];
```

- [ ] **Step 5: Implement — normalisering**

I `src/engine/request.ts`, opdater importen:

```ts
import {
  DEFAULT_BARS, DEFAULT_EQUIPMENT, DEFAULT_PLATES, DEFAULT_SANDBAGS, EQUIPMENT_BY_ID,
} from './data/equipment.js';
```

og i retur-objektet, lige efter `bars`-linjen:

```ts
    plates: (raw.plates?.length ? raw.plates : DEFAULT_PLATES).slice().sort((a, b) => b - a),
    bars: (raw.bars?.length ? raw.bars : DEFAULT_BARS).slice().sort((a, b) => b - a),
    sandbags: (raw.sandbags?.length ? raw.sandbags : DEFAULT_SANDBAGS).slice().sort((a, b) => b - a),
```

- [ ] **Step 6: Implement — `LoadContext` og `prescribe`**

I `src/engine/loads.ts`, opdater importen øverst:

```ts
import { DEFAULT_BARS, DEFAULT_PLATES, DEFAULT_SANDBAGS } from './data/equipment.js';
```

Fjern den lokale konstant:

```ts
/** Sandbags. */
const SANDBAGS = [20, 30, 40, 50, 60, 70, 80];
```

Udvid `LoadContext`:

```ts
export interface LoadContext {
  plates?: number[];
  bars?: number[];
  sandbags?: number[];
  inventory?: Record<string, number>;
}
```

Erstat `'bag'`-grenen i `prescribe`:

```ts
    case 'bag': {
      const kg = snapToList(perUnit, SANDBAGS, floor);
      return { totalKg: kg, eachKg: kg, kind, text: fmtKg(kg) };
    }
```

med:

```ts
    case 'bag': {
      const list = ctx.sandbags?.length ? ctx.sandbags : DEFAULT_SANDBAGS;
      const kg = snapToList(perUnit, list, floor);
      return { totalKg: kg, eachKg: kg, kind, text: fmtKg(kg) };
    }
```

- [ ] **Step 7: Implement — før belastningen beregnes**

I `src/engine/movements.ts`, i `targetFor`, erstat:

```ts
  const ctx = { plates: req.plates, bars: req.bars, inventory: req.inventory };
```

med:

```ts
  const ctx = { plates: req.plates, bars: req.bars, sandbags: req.sandbags, inventory: req.inventory };
```

- [ ] **Step 8: Implement — barrel-eksport**

I `src/engine/index.ts`, erstat:

```ts
export {
  EQUIPMENT, DEFAULT_EQUIPMENT, EQUIPMENT_BY_ID, PLATE_SIZES, DEFAULT_PLATES,
  BAR_SIZES, DEFAULT_BARS, CARE_AREAS, FOCUS_TAGS, LEVELS,
} from './data/equipment.js';
```

med:

```ts
export {
  EQUIPMENT, DEFAULT_EQUIPMENT, EQUIPMENT_BY_ID, PLATE_SIZES, DEFAULT_PLATES,
  BAR_SIZES, DEFAULT_BARS, SANDBAG_SIZES, DEFAULT_SANDBAGS, CARE_AREAS, FOCUS_TAGS, LEVELS,
} from './data/equipment.js';
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/engine/loads.test.ts`
Expected: PASS.

- [ ] **Step 10: Full engine suite + typecheck**

Run: `npx vitest run src/engine/ && npm run typecheck`
Expected: PASS — `NormalizedRequest.sandbags` er et nyt påkrævet felt, så enhver
håndbygget `NormalizedRequest`-literal i testfilerne skal stadig kompilere; da alle
eksisterende tests bygger deres request via `normalizeRequest(...)` (som nu selv
udfylder `sandbags`), er der ingen håndskrevne literals at rette.

- [ ] **Step 11: Commit**

```bash
git add src/engine/data/equipment.ts src/engine/types.ts src/engine/request.ts \
  src/engine/movements.ts src/engine/loads.ts src/engine/index.ts src/engine/loads.test.ts
git commit -m "feat: sandbag-belastning snapper til brugerens egne 10/20/30 kg-vaegte"
```

---

## Task 8: Del D — sandbag-vægte i profil, UI og useWhatwork

**Files:**
- Modify: `src/types.ts` (`UserProfile`)
- Modify: `src/state/useWhatwork.ts` (`DEFAULT_PROFILE`, migrering, `buildRequest`)
- Modify: `src/screens/Equipment.tsx` (ny sektion "Sandbag-vægte")
- Modify: `src/state/useWhatwork.test.ts:5-9` og `src/App.test.tsx:13-17` (mock-profiler
  skal opdateres, ellers fejler typecheck/tests)

**Interfaces:**
- Consumes: `eng.SANDBAG_SIZES`, `eng.DEFAULT_SANDBAGS` (Task 7).
- Produces: `UserProfile.sandbags: number[]`, sendt til motoren som `sandbags:
  profile.sandbags` i `buildRequest` (samme mønster som `bars: profile.bars`).

- [ ] **Step 1: Implement — `UserProfile`-typen**

I `src/types.ts`, i `UserProfile`, lige efter `bars: number[];`:

```ts
  /** Skivestørrelser brugeren faktisk har. */
  plates: number[];
  bars: number[];
  /** Sandbag-vægte brugeren faktisk har. */
  sandbags: number[];
  onboarded: boolean;
```

- [ ] **Step 2: Fix — eksisterende testfixtures (ellers fejler `npm run typecheck`)**

I `src/state/useWhatwork.test.ts`, erstat:

```ts
const profile: UserProfile = {
  name: 'Test', level: 3, sex: 'm', bodyweight: 82,
  equipment: null, counts: {}, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  bars: [20, 15], onboarded: true,
};
```

med:

```ts
const profile: UserProfile = {
  name: 'Test', level: 3, sex: 'm', bodyweight: 82,
  equipment: null, counts: {}, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  bars: [20, 15], sandbags: [10, 20, 30], onboarded: true,
};
```

I `src/App.test.tsx`, erstat (samme literal, i `seedOnboardedProfile`):

```ts
        equipment: null, counts: {}, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
        bars: [20, 15], onboarded: true,
```

med:

```ts
        equipment: null, counts: {}, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
        bars: [20, 15], sandbags: [10, 20, 30], onboarded: true,
```

(`App.test.tsx`s profil er en JSON-literal, der går gennem migreringskoden i Step 3 —
denne rettelse er ikke strengt nødvendig for at testen kører, men holder fixturen i
sync med et rigtigt, fuldt udfyldt profil-objekt.)

- [ ] **Step 3: Implement — `DEFAULT_PROFILE` og migrering**

I `src/state/useWhatwork.ts`, erstat:

```ts
const DEFAULT_PROFILE: UserProfile = {
  name: 'Gæst',
  level: 2,
  sex: 'm',
  bodyweight: 82,
  equipment: null,
  counts: {},
  plates: eng.DEFAULT_PLATES.slice(),
  bars: eng.DEFAULT_BARS.slice(),
  onboarded: false,
};
```

med:

```ts
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
};
```

Find migreringslinjerne (i indlæsnings-`useEffect`):

```ts
      if (!loadedProfile.plates?.length) loadedProfile.plates = eng.DEFAULT_PLATES.slice();
      if (!loadedProfile.bars?.length) loadedProfile.bars = eng.DEFAULT_BARS.slice();
```

og tilføj en tredje linje:

```ts
      if (!loadedProfile.plates?.length) loadedProfile.plates = eng.DEFAULT_PLATES.slice();
      if (!loadedProfile.bars?.length) loadedProfile.bars = eng.DEFAULT_BARS.slice();
      if (!loadedProfile.sandbags?.length) loadedProfile.sandbags = eng.DEFAULT_SANDBAGS.slice();
```

- [ ] **Step 4: Implement — `buildRequest`**

I `src/state/useWhatwork.ts`, i `buildRequest`, erstat:

```ts
      plates: draft.plates,
      bars: profile.bars,
      profile: profile.sex,
      recentSignatures,
      recentPatterns: history.slice(0, 3).flatMap((h) => h.patterns ?? []),
      ...extra,
    }),
    [profile.sex, profile.bars, history, recentSignatures],
  );
```

med:

```ts
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
```

- [ ] **Step 5: Implement — Udstyr-siden**

I `src/screens/Equipment.tsx`, tilføj en `toggleSandbag`-funktion lige efter
`toggleBar`:

```ts
  const toggleBar = (kg: number): void => {
    const next = profile.bars.includes(kg) ? profile.bars.filter((x) => x !== kg) : [...profile.bars, kg];
    onPatch({ bars: next.length ? next : [20] });
  };

  const toggleSandbag = (kg: number): void => {
    const next = profile.sandbags.includes(kg)
      ? profile.sandbags.filter((x) => x !== kg)
      : [...profile.sandbags, kg];
    onPatch({ sandbags: next.length ? next : [20] });
  };
```

Erstat den eksisterende Stænger-blok (som i dag slutter sektionen):

```tsx
        <h2 className="ww-kicker" style={{ marginBottom: 6 }}>Stænger</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
          Den tungeste stang, der passer under forslaget, bliver valgt.
        </p>
        <div className="ww-wrap">
          {eng.BAR_SIZES.map((b) => (
            <Chip key={b} on={profile.bars.includes(b)} onClick={() => toggleBar(b)}>{b} kg</Chip>
          ))}
        </div>
      </section>
```

med (Stænger-blokken uændret, plus en ny Sandbag-vægte-undersektion før sektionen lukkes):

```tsx
        <h2 className="ww-kicker" style={{ marginBottom: 6 }}>Stænger</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
          Den tungeste stang, der passer under forslaget, bliver valgt.
        </p>
        <div className="ww-wrap">
          {eng.BAR_SIZES.map((b) => (
            <Chip key={b} on={profile.bars.includes(b)} onClick={() => toggleBar(b)}>{b} kg</Chip>
          ))}
        </div>

        <h2 className="ww-kicker" style={{ margin: '20px 0 6px' }}>Sandbag-vægte</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
          De vægte, du markerer her, er dem motoren vælger imellem — nærmest din
          foreslåede belastning, justeret efter køn og niveau.
        </p>
        <div className="ww-wrap">
          {eng.SANDBAG_SIZES.map((kg) => (
            <Chip key={kg} on={profile.sandbags.includes(kg)} onClick={() => toggleSandbag(kg)}>
              {kg} kg
            </Chip>
          ))}
        </div>
      </section>
```

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: PASS — inkl. `App.test.tsx` og `useWhatwork.test.ts`.

- [ ] **Step 7: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: Ingen fejl.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/state/useWhatwork.ts src/screens/Equipment.tsx \
  src/state/useWhatwork.test.ts src/App.test.tsx
git commit -m "feat: sandbag-vaegte som valgbart udstyr paa Udstyr-siden"
```

---

## Task 9: Del E — CSS-tokens til grøn/rød/blå farvekodning

**Files:**
- Modify: `src/index.css` (begge `:root`-blokke)

**Interfaces:**
- Produces: `--ww-green-dim`, `--ww-green-line`, `--ww-red-dim`, `--ww-red-line`,
  `--ww-blue-dim`, `--ww-blue-line` i både dark- og light-tema.

- [ ] **Step 1: Implement — dark-tema**

I `src/index.css`, i det første `:root`-blok, erstat:

```css
  /* Status. */
  --ww-green: #34d399;
  --ww-blue: #60a5fa;
  --ww-red: #dc2626;
  --ww-red-soft: #f87171;
  --ww-red-hot: #ff4438;
```

med:

```css
  /* Status. */
  --ww-green: #34d399;
  --ww-green-dim: rgb(52 211 153 / 14%);
  --ww-green-line: rgb(52 211 153 / 42%);
  --ww-blue: #60a5fa;
  --ww-blue-dim: rgb(96 165 250 / 14%);
  --ww-blue-line: rgb(96 165 250 / 42%);
  --ww-red: #dc2626;
  --ww-red-dim: rgb(220 38 38 / 14%);
  --ww-red-line: rgb(220 38 38 / 42%);
  --ww-red-soft: #f87171;
  --ww-red-hot: #ff4438;
```

- [ ] **Step 2: Implement — light-tema**

I samme fil, i `:root[data-theme='light']`, erstat:

```css
  --ww-green: #047857;
  --ww-blue: #1d4ed8;
  --ww-red: #b91c1c;
  --ww-red-soft: #b91c1c;
  --ww-red-hot: #b91c1c;
```

med:

```css
  --ww-green: #047857;
  --ww-green-dim: rgb(4 120 87 / 10%);
  --ww-green-line: rgb(4 120 87 / 40%);
  --ww-blue: #1d4ed8;
  --ww-blue-dim: rgb(29 78 216 / 10%);
  --ww-blue-line: rgb(29 78 216 / 40%);
  --ww-red: #b91c1c;
  --ww-red-dim: rgb(185 28 28 / 10%);
  --ww-red-line: rgb(185 28 28 / 40%);
  --ww-red-soft: #b91c1c;
  --ww-red-hot: #b91c1c;
```

- [ ] **Step 3: Verify — ingen build-fejl**

Run: `npm run build`
Expected: Bygger uden fejl (rene CSS-variabel-tilføjelser, ingen syntaksrisiko udover
almindelig CSS).

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: groenne/roede/blaa dim- og line-tokens til statusfarver"
```

---

## Task 10: Del E — opvarmning og hoveddel i adskilte, farvede kort (Result.tsx)

**Files:**
- Modify: `src/screens/Result.tsx:100-111,211-240`

**Interfaces:**
- Consumes: CSS-tokens fra Task 9.

- [ ] **Step 1: Implement — wrapper**

I `src/screens/Result.tsx`, erstat blok-sektionen:

```tsx
      {/* Blokke */}
      <div className="ww-card" style={{ overflow: 'hidden', marginBottom: 22 }}>
        {workout.blocks.map((block, i) => (
          <BlockSection
            key={block.id}
            block={block}
            label={blockLabel(block, hasStrength)}
            first={i === 0}
            participants={workout.participants}
          />
        ))}
      </div>
```

med:

```tsx
      {/* Blokke — hver sin tydeligt adskilte boks, farvet efter opvarmning/hoveddel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
        {workout.blocks.map((block) => (
          <BlockSection
            key={block.id}
            block={block}
            label={blockLabel(block, hasStrength)}
            participants={workout.participants}
          />
        ))}
      </div>
```

- [ ] **Step 2: Implement — `BlockSection`**

Erstat:

```tsx
function BlockSection({
  block, label, participants, first,
}: {
  block: Block;
  label: string;
  participants: number;
  first: boolean;
}) {
  return (
    <section style={{ borderTop: first ? 'none' : '1px solid var(--ww-line)', padding: '22px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <h2 className="ww-kicker" style={{ margin: 0 }}>{label}</h2>
```

med:

```tsx
function BlockSection({
  block, label, participants,
}: {
  block: Block;
  label: string;
  participants: number;
}) {
  const accent = block.kind === 'warmup'
    ? { line: 'var(--ww-green-line)', dim: 'var(--ww-green-dim)', fg: 'var(--ww-green)' }
    : { line: 'var(--ww-red-line)', dim: 'var(--ww-red-dim)', fg: 'var(--ww-red)' };
  return (
    <section
      className="ww-card"
      style={{ padding: '22px 20px', borderColor: accent.line, background: accent.dim }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <h2 className="ww-kicker" style={{ margin: 0, color: accent.fg }}>{label}</h2>
```

(Resten af `BlockSection`s indhold — `<span className="ww-num">…`, titel, prescription,
bevægelseslisten — forbliver uændret; kun funktionssignaturen, den yderste `<section>`
og `<h2>`s farve ændrer sig.)

- [ ] **Step 3: Manuel visuel verifikation**

Dette er en ren layout-/farveændring uden ny forretningslogik — der skrives bevidst
ingen ny automatiseret test for selve farven/kort-adskillelsen (jf. eksisterende
konvention: UI-styling verificeres i browseren, ikke med snapshot-tests). Verificeres i
Task 15's browser-check.

- [ ] **Step 4: Run existing tests (ingen regressions)**

Run: `npm test -- App.test.tsx`
Expected: PASS — `App.test.tsx` navigerer til Result-skærmen i mindst én test; den
tjekker tekstindhold, ikke inline-styles, så den bør fortsat bestå uændret.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Result.tsx
git commit -m "feat: opvarmning og hoveddel i hver sit farvede, adskilte kort"
```

---

## Task 11: Del E — farvekodning i selve timeren (Timer.tsx)

**Files:**
- Modify: `src/screens/Timer.tsx:60-76`

**Interfaces:**
- Consumes: `workout.blocks` (allerede en prop), CSS-tokens fra Task 9.

- [ ] **Step 1: Implement**

I `src/screens/Timer.tsx`, tilføj en lille hjælpefunktion øverst i filen (efter
`KIND_LABEL`):

```ts
const KIND_LABEL: Record<string, string> = {
  prep: 'Gør klar', work: 'Arbejde', rest: 'Pause', transition: 'Skift', done: 'Færdig',
};

/** Grøn for opvarmning, rød for alt andet (styrke/conditioning) — samme princip som Result. */
function accentFor(blockId: string, workout: Workout): string {
  const block = workout.blocks.find((b) => b.id === blockId);
  return block?.kind === 'warmup' ? 'var(--ww-green)' : 'var(--ww-red)';
}
```

Erstat topbjælkens sekundære linje:

```tsx
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span className="ww-kicker ww-kicker--accent" style={{ whiteSpace: 'nowrap' }}>{workout.title}</span>
          <span style={{ fontSize: 12.5, color: 'var(--ww-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {segment.blockTitle} · {KIND_LABEL[segment.kind] ?? segment.kind}
          </span>
        </div>
```

med:

```tsx
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span className="ww-kicker ww-kicker--accent" style={{ whiteSpace: 'nowrap' }}>{workout.title}</span>
          <span style={{ fontSize: 12.5, color: accentFor(segment.blockId, workout), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {segment.blockTitle} · {KIND_LABEL[segment.kind] ?? segment.kind}
          </span>
        </div>
```

Erstat segmentskinnen:

```tsx
      <div className="ww-timer__rail" role="img" aria-label={`Segment ${view.index + 1} af ${view.total}`}>
        {plan.segments.map((s, i) => (
          <span key={s.id} className={i < view.index ? 'is-done' : i === view.index ? 'is-now' : ''} />
        ))}
      </div>
```

med:

```tsx
      <div className="ww-timer__rail" role="img" aria-label={`Segment ${view.index + 1} af ${view.total}`}>
        {plan.segments.map((s, i) => (
          <span
            key={s.id}
            className={i < view.index ? 'is-done' : i === view.index ? 'is-now' : ''}
            style={i === view.index ? { background: accentFor(s.blockId, workout) } : undefined}
          />
        ))}
      </div>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: Ingen fejl (`Workout` er allerede importeret i filen).

- [ ] **Step 3: Manuel visuel verifikation**

Verificeres i Task 15 (browser-check) — se topbjælkens undertekst og den aktive prik i
segmentskinnen skifte farve, når timeren går fra opvarmning til hoveddel.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Timer.tsx
git commit -m "feat: farv timerens topbjaelke og segmentskinne efter opvarmning/hoveddel"
```

---

## Task 12: Del F — lydmotor (`src/lib/sound.ts`)

**Files:**
- Create: `src/lib/sound.ts`
- Test: Create `src/lib/sound.test.ts`

**Interfaces:**
- Produces: `type ArrivalKind = 'start' | 'switch' | 'rest_start' | 'rest_end' |
  'complete'`; `kindFor(current: SegmentKind, next: SegmentKind): ArrivalKind | null`;
  `playTick(stepsLeft: 1 | 2 | 3): void`; `playArrival(kind: ArrivalKind): void`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sound.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { kindFor } from './sound.js';

describe('kindFor — hvilken ankomst-lyd/tekst der vises ved et segmentskift', () => {
  it('markerer sessionens start, når arbejdet begynder efter "gør klar"', () => {
    expect(kindFor('prep', 'work')).toBe('start');
  });

  it('markerer at en pause starter, uanset om man kommer fra arbejde eller et skift', () => {
    expect(kindFor('work', 'rest')).toBe('rest_start');
    expect(kindFor('transition', 'rest')).toBe('rest_start');
  });

  it('markerer at pausen slutter, og arbejdet genoptages', () => {
    expect(kindFor('rest', 'work')).toBe('rest_end');
  });

  it('markerer et øvelsesskift mellem to arbejdssegmenter, eller ind i et skift-segment', () => {
    expect(kindFor('work', 'work')).toBe('switch');
    expect(kindFor('work', 'transition')).toBe('switch');
  });

  it('returnerer null for overgange, der ikke skal varsles med en nedtælling', () => {
    expect(kindFor('work', 'done')).toBeNull();
    expect(kindFor('transition', 'transition')).toBeNull();
    expect(kindFor('rest', 'done')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sound.test.ts`
Expected: FAIL — `src/lib/sound.ts` findes ikke endnu (modul-fejl).

- [ ] **Step 3: Implement**

Create `src/lib/sound.ts`:

```ts
import type { SegmentKind } from '../engine/index.js';

export type ArrivalKind = 'start' | 'switch' | 'rest_start' | 'rest_end' | 'complete';

/**
 * Hvilken ankomst-type der skal varsles, når et segment går fra `current` til `next`.
 * Ren funktion — ingen afhængighed af Web Audio, så den kan testes uden en browser.
 */
export function kindFor(current: SegmentKind, next: SegmentKind): ArrivalKind | null {
  if (next === 'rest') return 'rest_start';
  if (next === 'work' || next === 'prep') {
    if (current === 'prep') return 'start';
    if (current === 'rest') return 'rest_end';
    if (current === 'work' || current === 'transition') return 'switch';
    return null;
  }
  if (next === 'transition') {
    if (current === 'work' || current === 'rest') return 'switch';
    return null;
  }
  // 'done' varsles ikke via en nedtælling — den håndteres separat, når segmentet nås.
  return null;
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Én kort, blød tone. `startAt`/`durationSec` er i sekunder fra nu. */
function tone(freq: number, startAt: number, durationSec: number, gainPeak = 0.2): void {
  const audio = getCtx();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = audio.currentTime + startAt;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + durationSec);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.02);
}

/** Tick ved 3, 2 og 1 sekund før et segment skifter — stigende tonehøjde jo tættere på 0. */
export function playTick(stepsLeft: 1 | 2 | 3): void {
  const freq = stepsLeft === 3 ? 440 : stepsLeft === 2 ? 523 : 659;
  tone(freq, 0, 0.12, 0.18);
}

const ARRIVAL_TONES: Record<ArrivalKind, number[]> = {
  start: [523, 784],
  rest_end: [523, 784],
  rest_start: [392],
  switch: [587, 587],
  complete: [523, 659, 784],
};

/** Distinkt ankomst-lyd ved segmentskift — én til tre toner afhængig af type. */
export function playArrival(kind: ArrivalKind): void {
  ARRIVAL_TONES[kind].forEach((freq, i) => tone(freq, i * 0.14, 0.22, 0.22));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sound.test.ts`
Expected: PASS (testene rammer kun `kindFor`, som ikke rører `AudioContext`).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: Ingen fejl. `AudioContext` er en indbygget DOM-type, tilgængelig via
TypeScripts `lib.dom.d.ts`, som projektet allerede bruger (browser-app).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sound.ts src/lib/sound.test.ts
git commit -m "feat: lydmotor til timeren (Web Audio, ingen lydfiler)"
```

---

## Task 13: Del F — skemalægning af tick/ankomst i `useWhatwork`

**Files:**
- Modify: `src/state/useWhatwork.ts`

**Interfaces:**
- Consumes: `sound.kindFor`, `sound.playTick`, `sound.playArrival`,
  `ArrivalKind` (Task 12); `view.remaining`, `view.segment`, `view.next`,
  `view.sessionElapsed`, `settings.sound`.
- Produces: nyt state `timerCallout: { kind: ArrivalKind; ts: number } | null` på
  hookets retur-objekt.

- [ ] **Step 1: Implement — import og state**

I `src/state/useWhatwork.ts`, tilføj importen øverst:

```ts
import * as sound from '../lib/sound.js';
import type { ArrivalKind } from '../lib/sound.js';
```

I `useWhatwork()`, lige efter deklarationen af `confirmDialog`:

```ts
  const [confirmDialog, setConfirmDialog] = useState<'exit' | 'reset' | null>(null);
  const [timerCallout, setTimerCallout] = useState<{ kind: ArrivalKind; ts: number } | null>(null);
```

- [ ] **Step 2: Implement — planlægning af tick/ankomst**

Find den eksisterende auto-advance-effekt:

```ts
  const remaining = view?.remaining ?? null;
  const atLastSegment = plan ? (view?.index ?? 0) >= plan.segments.length - 1 : true;
  useEffect(() => {
    if (!timer?.running || remaining === null || atLastSegment) return;
    const id = window.setTimeout(() => advance(1), Math.max(0, remaining * 1000));
    return () => window.clearTimeout(id);
  }, [timer?.running, remaining, atLastSegment, advance]);
```

Tilføj en ny effekt lige efter (før `startTimer`):

```ts
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
  }, [timer?.running, settings.sound, soundRemaining, view?.segment.kind, view?.next?.kind]);

  const prevSegmentKind = useRef<string | null>(null);
  useEffect(() => {
    if (!view) return;
    if (view.segment.kind === 'done' && prevSegmentKind.current !== 'done') {
      if (settings.sound) {
        sound.playArrival('complete');
        setTimerCallout({ kind: 'complete', ts: Date.now() });
      }
    }
    prevSegmentKind.current = view.segment.kind;
  }, [view?.segment.kind, settings.sound]);
```

- [ ] **Step 3: Implement — eksponér på retur-objektet**

I `return`-objektet nederst i `useWhatwork`, find:

```ts
    timer, plan, view, startTimer, toggleTimer, resetTimer, addRound, advance,
    confirmDialog, setConfirmDialog, openCompletion,
```

og tilføj `timerCallout`:

```ts
    timer, plan, view, startTimer, toggleTimer, resetTimer, addRound, advance,
    confirmDialog, setConfirmDialog, openCompletion, timerCallout,
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: Ingen fejl. `useRef` er allerede importeret fra `'react'` øverst i filen.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS — `timer.test.ts` og `useWhatwork.test.ts` kalder ikke `AudioContext`
direkte (de bruger `timerView`/`freshGen`/`personWeight`), og de nye effekter kører kun,
når `timer?.running` er sandt, hvilket ikke sker i disse rene funktions-tests.

- [ ] **Step 6: Commit**

```bash
git add src/state/useWhatwork.ts
git commit -m "feat: skemalaeg tick- og ankomst-lyde praecist under timerens forloeb"
```

---

## Task 14: Del F — mute-knap og skærmanimation i Timer.tsx

**Files:**
- Modify: `src/components/ui.tsx` (nyt `GlyphName`, nyt ikon, ny `SoundToggle`)
- Modify: `src/screens/Timer.tsx` (nye props, knap, overlay)
- Modify: `src/App.tsx` (nye props til `<Timer>`)
- Modify: `src/index.css` (callout-animation)

**Interfaces:**
- Consumes: `timerCallout`, `settings.sound`, `setSettings` (Task 13 / eksisterende).
- Produces: `SoundToggle`-komponent i `ui.tsx`; `Timer`-komponenten tager nu
  `soundOn: boolean`, `onToggleSound: () => void`, `timerCallout: { kind: ArrivalKind;
  ts: number } | null`.

- [ ] **Step 1: Implement — nyt ikon og `SoundToggle` i `ui.tsx`**

I `src/components/ui.tsx`, udvid `GlyphName`:

```ts
type GlyphName = 'back' | 'close' | 'menu' | 'bolt' | 'star' | 'star-filled' | 'check' | 'chevron' | 'sun' | 'moon' | 'gear' | 'sound-on' | 'sound-off';
```

Tilføj to nye glyffer i `paths`-objektet, lige efter `moon`:

```tsx
    moon: <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z" {...common} />,
    'sound-on': (
      <g {...common}>
        <path d="M4 10v4h3.6L13 18V6L7.6 10z" />
        <path d="M16.2 9a4.2 4.2 0 0 1 0 6M18.6 6.6a7.8 7.8 0 0 1 0 10.8" />
      </g>
    ),
    'sound-off': (
      <g {...common}>
        <path d="M4 10v4h3.6L13 18V6L7.6 10z" />
        <path d="M16 10.4l4.4 4.4M20.4 10.4 16 14.8" />
      </g>
    ),
```

Tilføj en ny komponent lige efter `ThemeToggle`:

```tsx
/** Lille, hurtig lyd-til/fra-knap — samme mønster som ThemeToggle, vises i timerens topbjælke. */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="ww-icon-btn"
      aria-label={on ? 'Slå timerlyd fra' : 'Slå timerlyd til'}
      aria-pressed={on}
      onClick={onToggle}
    >
      <Glyph name={on ? 'sound-on' : 'sound-off'} />
    </button>
  );
}
```

- [ ] **Step 2: Implement — `Timer.tsx` props, knap og overlay**

I `src/screens/Timer.tsx`, opdater importen:

```ts
import { Dialog, Glyph, SoundToggle } from '../components/ui.js';
```

og tilføj:

```ts
import type { ArrivalKind } from '../lib/sound.js';
```

Udvid props-typen og destruktureringen:

```tsx
export function Timer({
  timer, plan, view, workout, confirmDialog, keepAwake, soundOn, timerCallout,
  onToggle, onNext, onPrev, onRound, onRequestExit, onRequestReset, onCancelDialog,
  onConfirmExit, onConfirmReset, onFinish, onToggleSound,
}: {
  timer: TimerState;
  plan: TimerPlan;
  view: TimerView;
  workout: Workout;
  confirmDialog: 'exit' | 'reset' | null;
  keepAwake: boolean;
  soundOn: boolean;
  timerCallout: { kind: ArrivalKind; ts: number } | null;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRound: (delta: number) => void;
  onRequestExit: () => void;
  onRequestReset: () => void;
  onCancelDialog: () => void;
  onConfirmExit: () => void;
  onConfirmReset: () => void;
  onFinish: () => void;
  onToggleSound: () => void;
}) {
```

Tilføj den lokale synligheds-timer for animationen, lige efter de eksisterende
`const`-linjer øverst i komponenten (efter `hasRounds`):

```ts
  const [calloutVisible, setCalloutVisible] = useState(false);
  useEffect(() => {
    if (!timerCallout) return;
    setCalloutVisible(true);
    const id = window.setTimeout(() => setCalloutVisible(false), 900);
    return () => window.clearTimeout(id);
  }, [timerCallout?.ts]);
```

og opdater React-importen øverst i filen:

```ts
import { useEffect, useState } from 'react';
```

Indsæt `SoundToggle` i topbjælken, mellem titelblokken og "Nulstil"-knappen:

```tsx
        <button type="button" className="ww-btn ww-btn--ghost" style={{ minHeight: 44, flex: 'none' }} onClick={onRequestReset}>
          Nulstil
        </button>
```

erstattes af:

```tsx
        <SoundToggle on={soundOn} onToggle={onToggleSound} />
        <button type="button" className="ww-btn ww-btn--ghost" style={{ minHeight: 44, flex: 'none' }} onClick={onRequestReset}>
          Nulstil
        </button>
```

Tilføj overlayet lige før den afsluttende `</div>` af `ww-timer` (efter
`confirmDialog === 'reset'`-blokken, før filens sidste `</div>\n  );`):

```tsx
      {timerCallout && calloutVisible ? (
        <div className={`ww-callout ww-callout--${timerCallout.kind}`} aria-hidden="true">
          {CALLOUT_LABEL[timerCallout.kind]}
        </div>
      ) : null}
    </div>
  );
}
```

og tilføj mappingen `CALLOUT_LABEL` øverst i filen, lige efter `KIND_LABEL`:

```ts
const KIND_LABEL: Record<string, string> = {
  prep: 'Gør klar', work: 'Arbejde', rest: 'Pause', transition: 'Skift', done: 'Færdig',
};

const CALLOUT_LABEL: Record<ArrivalKind, string> = {
  start: 'START',
  switch: 'SKIFT ØVELSE',
  rest_start: 'PAUSE STARTER',
  rest_end: 'ARBEJD IGEN',
  complete: 'FÆRDIG',
};
```

- [ ] **Step 3: Implement — CSS-animation**

I `src/index.css`, tilføj efter `.ww-timer__rail span.is-now { background: var(--ww-orange); }`:

```css
/* ---------- Timer-callout (start/skift/pause/færdig) ---------- */

.ww-callout {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 80;
  padding: 14px 28px;
  border-radius: var(--ww-r-lg);
  font-family: var(--ww-sans);
  font-weight: 800;
  font-size: 28px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-align: center;
  pointer-events: none;
  border: 1px solid;
  animation: ww-callout-pop 0.9s var(--ww-ease) forwards;
}

@keyframes ww-callout-pop {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  15% { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
  30% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  75% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

.ww-callout--start, .ww-callout--rest_end, .ww-callout--complete {
  background: var(--ww-green-dim); border-color: var(--ww-green-line); color: var(--ww-green);
}
.ww-callout--switch {
  background: var(--ww-orange-dim); border-color: var(--ww-orange-line); color: var(--ww-orange);
}
.ww-callout--rest_start {
  background: var(--ww-blue-dim); border-color: var(--ww-blue-line); color: var(--ww-blue);
}
```

- [ ] **Step 4: Implement — `App.tsx` sender de nye props**

I `src/App.tsx`, i `<Timer ... />`-kaldet, tilføj:

```tsx
      <Timer
        timer={ww.timer}
        plan={ww.plan}
        view={ww.view}
        workout={ww.workout}
        confirmDialog={ww.confirmDialog}
        keepAwake={ww.settings.keepAwake}
        soundOn={ww.settings.sound}
        timerCallout={ww.timerCallout}
        onToggle={ww.toggleTimer}
        onNext={() => ww.advance(1)}
        onPrev={() => ww.advance(-1)}
        onRound={ww.addRound}
        onRequestExit={() => ww.setConfirmDialog('exit')}
        onRequestReset={() => ww.setConfirmDialog('reset')}
        onCancelDialog={() => ww.setConfirmDialog(null)}
        onConfirmExit={() => ww.openCompletion('stopped')}
        onConfirmReset={ww.resetTimer}
        onFinish={() => ww.openCompletion('done')}
        onToggleSound={() => ww.setSettings((s) => ({ ...s, sound: !s.sound }))}
      />
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: Ingen fejl.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: Ingen fejl.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui.tsx src/screens/Timer.tsx src/App.tsx src/index.css
git commit -m "feat: mute-knap og skaermanimation for start/skift/pause/faerdig i timeren"
```

---

## Task 15: Slutverifikation, manuel browser-check og push til main

**Files:** Ingen kodeændringer — kun verifikation.

- [ ] **Step 1: Fuld automatiseret suite**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: Alle fire kommandoer afslutter uden fejl. Ved fejl: ret dem i det relevante
task ovenfor (ikke ad hoc her), og genkør denne step.

- [ ] **Step 2: Start dev-serveren og åbn i browseren**

Brug `mcp__Claude_Browser__preview_start` med `{ name: "dev" }` (fra `.claude/launch.json`
— opret den med `runtimeExecutable: "npm"`, `runtimeArgs: ["run", "dev"]`, hvis den ikke
findes) og naviger til generatoren.

- [ ] **Step 3: Byg og gennemfør én workout manuelt**

- Generér en workout med opvarmning + hoveddel; bekræft at de to nu vises som
  synligt adskilte, farvede kort på Resultat-siden (grøn/rød).
- Start timeren; bekræft at topbjælken og segmentskinnen skifter farve ved skiftet fra
  opvarmning til hoveddel.
- Lyt efter (eller kontroller via `read_console_messages` at der ikke kastes fejl fra)
  tick-lydene ved 3-2-1 og ankomst-teksten ("START" osv.) ved et par segmentskift.
- Slå lyden fra med den nye højtaler-knap i timeren, bekræft at Indstillinger også
  viser den som slået fra.
- Bekræft i "Ønskede øvelser" i generatoren, at Bænkpres, Skrå bænkpres, Push-up,
  Diamond Push-up og Decline Push-up alle kan vælges.
- Bekræft på Udstyr-siden, at "Justerbar bænk" vises som redskab, og at "Sandbag-vægte"
  (10/20/30 kg) vises som en ny sektion.
- Generér gentagne gange med højt niveau/kondition, indtil en AMRAP med 5 øvelser eller
  en "EMOM … · med hvile"-titel dukker op, og bekræft visuelt at prescription-teksten
  giver mening.

Brug `read_console_messages` og `read_network_requests` til at bekræfte, at der ikke er
fejl eller mislykkede requests undervejs.

- [ ] **Step 4: Push til main**

```bash
git status
git log origin/main..HEAD --oneline
git push origin main
```

Expected: alle commits fra Task 1–14 (plus de to spec-commits fra brainstorming-fasen)
lander på `origin/main` uden konflikt. Hvis `git push` afvises pga. divergens, hent og
læs situationen (`git fetch && git log HEAD..origin/main --oneline`) i stedet for at
tvinge — ved simple, ikke-overlappende ændringer er et almindeligt `git pull --rebase`
efterfulgt af et nyt `git push` den rigtige vej frem.

---

# Runde 2 — Task 16-26

Del A–G (Task 1-15) er implementeret, testet og pushet. Denne del af planen dækker
Del H–R fra spec-tilføjelsen. Samme rytme: implementér → test/typecheck/lint →
commit pr. task. Fuld slutverifikation + push samles i Task 26 (ikke én pr. del, for
ikke at spamme CI/build 11 gange for beslægtede, lavrisiko-ændringer i samme runde).

## Task 16: Del H — Historik viser reel trænet tid

**Files:** Modify `src/state/useWhatwork.ts` (`entryFor`, `saveCompletion`)

- [ ] Tilføj `actualMinutes?: number` som 7. parameter til `entryFor`, brug
  `actualMinutes ?? w.estimatedMinutes` som `minutes`.
- [ ] I `saveCompletion`, send `Math.max(1, mins)` som `actualMinutes` til `entryFor`.
- [ ] Skriv/opdatér en test i `App.test.tsx`: start en workout, spol frem et par
  minutter med fake timers, afslut som "Afbrudt", bekræft at `history[0].minutes` er
  lavt (ikke `workout.estimatedMinutes`).
- [ ] `npm test && npm run typecheck` grønt. Commit.

## Task 17: Del I — Realistiske reps/pauser i Interval

**Files:** Modify `src/engine/types.ts` (`Exercise.grind`), `src/engine/data/exercises.ts`
(grind-felter), `src/engine/blocks.ts` (`repsForInterval`, `restFor`, `openStations`),
`src/engine/timerplan.ts` (hint ved `openStations`). Test: `src/engine/blocks.test.ts`.

- [ ] Skriv fejlende tests først: Ring Row/Dips i en `interval`-blok med `condition: 9`
  skal give ≤ 8 reps og `restSec >= 30`.
- [ ] Tilføj `grind?: 'low' | 'medium' | 'high'` til `Exercise`.
- [ ] Sæt `grind` på de navngivne øvelser i spec'ens Del I-liste.
- [ ] Implementér `GRIND_FILL`/opdateret `repsForInterval`, `GRIND_MIN_REST`/`restFor`,
  brug `restFor` i `interval`- og `team_rotation`-grenene.
- [ ] Implementér `openStations`-feltet og dets brug i `timerplan.ts`s
  interval/team_rotation-gren.
- [ ] Kør tests, ret indtil grønt. `npm run typecheck`. Commit.

## Task 18: Del J — Orange overskrifter + "Hovedworkout"

**Files:** Modify `src/screens/Result.tsx`, `src/components/ui.tsx` (`Note`
`accent`-prop), `src/index.css` (`.ww-note--label-accent`).

- [ ] Tilføj `ww-kicker--accent` til de fire navngivne `<h2 className="ww-kicker">` i
  Result.tsx (protocol, logistics, why, dna).
- [ ] Ret `blockLabel()`: `'Hoveddel'` → `'Hovedworkout'`.
- [ ] `BlockSection`s `<h2>`: fjern `color: accent.fg`, tilføj
  `className="ww-kicker ww-kicker--accent"`.
- [ ] Tilføj `accent?: boolean` til `Note`, ny CSS-regel, sæt `accent` på "Hvad
  knapperne gør".
- [ ] `npm run typecheck && npm run lint`. Commit.

## Task 19: Del L — Grønne, fede tidsangivelser

**Files:** Modify `src/screens/Result.tsx` (`ca. {block.minutes} min`-span).

- [ ] Tilføj `fontWeight: 700, color: 'var(--ww-green)'` til span-stylen.
- [ ] Commit sammen med Task 18 (samme fil, samme browser-check) eller separat — én
  commit, klart beskrevet.

## Task 20: Del K — Større logo + responsivitet

**Files:** Modify `App.tsx`/`Navigation.tsx` (`WwMark size`), `src/index.css`
(eventuelle nye smal-skærm-regler, kun hvis testen finder noget at rette).

- [ ] Hæv `WwMark`s `size` i desktop-header og mobil-header.
- [ ] `npm run typecheck`. Commit logo-ændringen for sig.
- [ ] Resize-test (Task 26's browser-check) ved de seks viewports fra spec'en; ret
  konkrete overløb/brud, hvis nogen findes, i en opfølgende commit.

## Task 21: Del M — Justerbar vægt pr. øvelse

**Files:** Modify `src/engine/loads.ts` (`stepLoad`, eksportér `WALLBALLS`/`KETTLEBELLS`
internt uændret), `src/engine/index.ts` (eksportér `stepLoad`), `src/screens/Result.tsx`
(`profile`-prop, `overrides`-state, justeringsknapper), `src/App.tsx` (`profile`-prop
til `<Result>`), `src/index.css` (`.ww-step-btn`). Test: `src/engine/loads.test.ts`.

- [ ] Skriv fejlende tests for `stepLoad` (barbell op/ned, kettlebell nabo-snap,
  grænseklampning).
- [ ] Implementér `stepLoad` + `listFor` i loads.ts, eksportér.
- [ ] `Result` får `profile`-prop; `App.tsx` sender `ww.profile`.
- [ ] Implementér `overrides`-state + `adjust`-handler i `Result`; giv `profile`,
  `overrides`, `onAdjust` videre til `BlockSection`/`MovementRow`.
- [ ] Tilføj +/- knapper i `MovementRow` ved `t.load`, med `.ww-step-btn`-styling.
- [ ] `npm test && npm run typecheck && npm run lint`. Browser-check: generér en
  workout med bænkpres, juster vægten op/ned, bekræft skive-teksten opdaterer sig.
  Commit.

## Task 22: Del N — Liquid Glass bundmenu

**Files:** Modify `src/components/Navigation.tsx` (`MobileNav`), `src/index.css`
(`.ww-tab-highlight`).

- [ ] Implementér `useLayoutEffect`-målingen og `--ww-tab-x`/`--ww-tab-w`.
- [ ] Tilføj `.ww-tab-highlight`-elementet og dets CSS (glas-stil, transition,
  `prefers-reduced-motion`-undtagelse).
- [ ] `npm run typecheck`. Browser-check ved 375px bredde: skift mellem alle fire
  faner, bekræft glidende animation og korrekt startposition ved direkte navigation.
  Commit.

## Task 23: Del O — "WHATWORK?"

**Files:** Modify `Wordmark.tsx`, `WwMark.tsx`, `index.html`, `vite.config.ts`,
`Onboarding.tsx`, `About.tsx`, `Profile.tsx`, `Navigation.tsx` (kun de steder, spec'ens
Del O lister — ikke løbende prosa, ikke `PAGES_BASE`).

- [ ] Foretag alle otte navngivne tekstændringer.
- [ ] `npm run build` (verificerer at PWA-manifestet og HTML stadig genererer korrekt
  med det nye navn).
- [ ] `npm test` — ret enhver streng-match-test, der forventede det gamle navn.
- [ ] Commit.

## Task 24: Del P — Burpee Broad Jump + flere variationer + perf-test

**Files:** Modify `src/engine/data/exercises.ts`, `src/screens/Generator.tsx`
(PICKABLE), `src/engine/smartmix.ts` (`formatPool`, `spreadWeight`,
`MAX_CANDIDATES`). Test: `src/engine/data/exercises.test.ts`, `src/engine/engine.test.ts`
(ny perf-test).

- [ ] Tilføj `burpee_broad_jump` til kataloget + `PICKABLE`, med en test der bekræfter
  begge dele (spejler Del C+G's mønster).
- [ ] Skriv perf-testen (100 genereringer < 1500 ms) FØR ændringerne, bekræft den
  allerede består på nuværende (64-candidate) baseline — den er en regressionsvagt,
  ikke en TDD-red-green for selve variationsændringen.
- [ ] Implementér de tre ændringer: bredere `formatPool`, blødere `spreadWeight`,
  `MAX_CANDIDATES` 64→128.
- [ ] Kør hele `engine`-mappens tests + perf-testen. Bekræft `npm run build` og en
  manuel gennerering i browseren stadig føles øjeblikkelig (ingen synlig forsinkelse
  ud over de faste 7 sekunders loading-animation). Commit.

## Task 25: Del Q + Del R — Hjem-hurtigvalg og DNA-navne

**Files:** Modify `src/screens/Home.tsx` (`QUICK_TIMES`), `src/engine/validate.ts`
(`DNA_AXES`).

- [ ] Udvid `QUICK_TIMES` til at matche `TIME_OPTIONS`.
- [ ] Ret `DNA_AXES`-navnene (`Kondition`, `Baglår`).
- [ ] `npm run typecheck && npm test`. Commit (kan være én fælles commit — begge er
  små, urelaterede tekst-/datarettelser).

## Task 26: Runde 2 — slutverifikation, resize-test og push

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` — alt grønt.
- [ ] Genkør performance-testen isoleret (`npx vitest run -t "100 workouts"`) og
  notér den faktiske tid — bekræft den er langt under 1500 ms-grænsen.
- [ ] Browser: generér en workout, bekræft Del H (afbryd tidligt, tjek historik-tid),
  Del J/L (orange overskrifter, grøn/fed "ca. X min"), Del M (justér en vægt, se
  skiverne opdatere), Del O (titel/logo viser "WHATWORK?").
- [ ] `resize_window` gennem de seks viewports fra Del K's spec-tabel på Hjem,
  Generér workout, Resultat og Timer — ret konkrete brud, genkør resten af
  test-suiten efter enhver rettelse.
- [ ] Skift mellem bundmenuens fire faner (Del N) og bekræft den glidende highlight.
- [ ] `git add -A && git status` — bekræft kun tilsigtede filer er staged (README.md's
  allerede-eksisterende, ikke-relaterede ændring holdes fortsat udenfor).
- [ ] `git push origin main`.
