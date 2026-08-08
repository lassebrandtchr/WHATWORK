# Nye workout-typer, bænkpres, sandbag-vægte, farvekodning og timer-lyde

**Dato:** 2026-08-08
**Status:** Godkendt design — klar til implementeringsplan
**Berørte skærme/moduler:** `src/engine/smartmix.ts`, `src/engine/blocks.ts`,
`src/engine/timerplan.ts`, `src/engine/types.ts`, `src/engine/data/exercises.ts`,
`src/engine/data/equipment.ts`, `src/engine/loads.ts`, `src/engine/movements.ts`,
`src/engine/request.ts`, `src/engine/index.ts`, `src/types.ts`, `src/state/useWhatwork.ts`,
`src/screens/Generator.tsx`, `src/screens/Equipment.tsx`, `src/screens/Result.tsx`,
`src/screens/Timer.tsx`, `src/index.css`, `src/components/EquipmentIcon.tsx`, ny fil
`src/lib/sound.ts`

## Baggrund

To referencebilleder viser workout-typer, appen i dag ikke fuldt understøtter:

1. En AMRAP med op til fire-fem bevægelser i hoveddelen, inkl. tunge vægtstangsløft
   (power clean, bench press) angivet i lbs (205#) — kun en visuel reference, appen
   fortsætter med at vise alt i kg.
2. Et EMOM-mønster med fire arbejdsminutter efterfulgt af ét fast hvileminut, gentaget i
   runder (fx 5 × (4 min arbejde + 1 min hvile) = 25 min).

Derudover er der fire selvstændige ønsker: bænkpres skal kunne vælges eksplicit i
generatoren, sandbags skal kunne sættes til faste vægte (10/20/30 kg) i stedet for et bredt
auto-skaleret spænd, opvarmning og hoveddel skal farvekodes tydeligt (grøn/rød), og timeren
skal have lyd- og skærmsignaler ved start, øvelsesskift, pause og afslutning.

Alle seks dele er uafhængigt implementerbare og berører ikke hinandens kernelogik, men
deles op i denne ene spec, fordi de blev besluttet i samme samtale og alle rører
generator-/timer-flowet.

## Del A — Op til 5 øvelser i AMRAP / For Time

### Nuværende opførsel

`movementCount()` ([smartmix.ts:116](../../../src/engine/smartmix.ts)) styrer, hvor mange
øvelser Smart Mix vælger til hoveddelen. Chipper har allerede en særregel (5 øvelser ved
≥30 min, ellers 4). AMRAP og For Time rammer i dag den generiske gren nederst i funktionen,
som topper ved 4 øvelser (45 % chance) for sessioner over 18 minutter.

### Ændring

Tilføj en dedikeret gren for `amrap`/`fortime`, med samme trappetrins-stil som resten af
funktionen, men med et ekstra trin for længere sessioner:

```ts
if (format === 'amrap' || format === 'fortime') {
  if (minutes <= 10) return 2;
  if (minutes <= 18) return rnd() < 0.5 ? 2 : 3;
  if (minutes <= 25) return rnd() < 0.45 ? 4 : 3;
  return rnd() < 0.4 ? 5 : 4;
}
```

EMOM-familien, Interval, Team rotation og Ladder er bevidst uændrede — deres struktur
(faste intervaller, roterende stationer) passer ikke naturligt til 5 øvelser og var ikke en
del af ønsket.

Ingen ændringer nødvendige i `chooseExercises` ([smartmix.ts:169](../../../src/engine/smartmix.ts))
eller `buildConditioning`s AMRAP/For Time-grene ([blocks.ts:92](../../../src/engine/blocks.ts),
[blocks.ts:164](../../../src/engine/blocks.ts)) — begge itererer allerede generisk over
`exercises`/`movements` uden et hårdkodet loft.

## Del B — EMOM med indbygget hvileminut

### Nuværende opførsel

`isEmomFamily(format)`-grenen i `buildConditioning` ([blocks.ts:81](../../../src/engine/blocks.ts))
bygger almindelig EMOM som en flad rotation: øvelseslisten (op til 4) gentages slot for
slot i `slots = floor((min*60)/everySec)` intervaller uden nogen fast hvileplads. Timeren
([timerplan.ts:118](../../../src/engine/timerplan.ts)) spejler dette 1:1 — ét `work`-segment
pr. interval, ingen `rest`.

### Ny opførsel

Kun **almindelig EMOM** (`format === 'emom'`, 60 sekunders intervaller) — ikke
E2MOM/E3MOM/E4MOM/E5MOM, som allerede har indbygget hvile via deres længere interval — får
et hvileminut for hver fulde rotation af øvelseslisten, når sessionen er intens
(`req.condition >= 7`, samme tærskel appen allerede bruger til "intens" andre steder, fx
[blocks.ts:117](../../../src/engine/blocks.ts) i Team rotation).

**Datamodel:** nyt valgfrit felt på `Block` ([types.ts:192](../../../src/engine/types.ts)):

```ts
/** Kun på almindelig EMOM: hvert `movements.length`. interval efterfølges af ét
 * hvileminut, og `rounds` tæller fulde cyklusser (arbejde + hvile), ikke enkeltintervaller. */
restEveryCycle?: boolean;
```

**`blocks.ts`:** i EMOM-grenen, efter øvelseslisten er bygget (op til 4, uændret loft):

```ts
const restEveryCycle = format === 'emom' && req.condition >= 7 && movements.length >= 2;
if (restEveryCycle) {
  const cycleSec = everySec * (movements.length + 1);
  rounds = Math.max(1, Math.floor((min * 60) / cycleSec));
  title = `EMOM ${min} · med hvile`;
  prescription = `${rounds} runder à ${movements.length} arbejdsminutter + 1 hvileminut · `
    + `skiftevis: ${movements.map((m) => m.name).join(' → ')}`;
} else {
  // eksisterende slots-beregning uændret
}
```

`rounds` betyder nu "fulde cyklusser" i stedet for "enkeltintervaller" i denne gren —
konsistent med, hvordan `team_rotation` og `interval` allerede bruger `rounds` som
runde-antal, ikke interval-antal ([blocks.ts:121](../../../src/engine/blocks.ts),
[blocks.ts:133](../../../src/engine/blocks.ts)).

**`timerplan.ts`:** `conditioningSegments`s EMOM-gren ([timerplan.ts:118](../../../src/engine/timerplan.ts))
forgrener på `block.restEveryCycle`:

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
          label: `EMOM · runde ${r + 1} af ${rounds} · min ${i + 1}`,
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
  // eksisterende gren uændret (ingen restEveryCycle)
  ...
}
```

Den eksisterende (ikke-intense eller kortere) EMOM-gren rører ikke ved dette — kun
tilføjelsen af `if (block.restEveryCycle)` før den nuværende løkke.

### Grænsetilfælde

- `movements.length >= 2` forhindrer en meningsløs "1 min arbejde + 1 min hvile"-cyklus ved
  meget kort øvelsesliste.
- Er `min * 60 < cycleSec`, bliver `rounds` mindst 1 (`Math.max(1, …)`), så en meget kort
  session stadig får præcis én cyklus i stedet for at fejle.

## Del C — Bænkpres i øvelsesvælgeren

`bench_press` findes allerede fuldt defineret i øvelseskataloget
([exercises.ts:57](../../../src/engine/data/exercises.ts)) og er allerede valgbar af Smart
Mix (kategorien `press` indgår i `MAIN_CATS`, [exercises.ts:167](../../../src/engine/data/exercises.ts)).
Den mangler udelukkende i `PICKABLE`
([Generator.tsx:11](../../../src/screens/Generator.tsx)) — listen, der styrer, hvilke
øvelser brugeren kan markere som "Ønsket"/"Udelukket" i generatoren. Tilføjes som ét nyt
element i arrayet. Ingen andre ændringer.

## Del D — Sandbag i faste vægte (10/20/30 kg)

### Nuværende opførsel

Sandbag-belastning skalerer i dag automatisk til et bredt, fast spænd
(`SANDBAGS = [20, 30, 40, 50, 60, 70, 80]`, [loads.ts:21](../../../src/engine/loads.ts)),
uafhængigt af hvad salen faktisk har stående. Dette adskiller sig fra Skiver og Stænger,
hvor brugeren allerede vælger sit eget udstyr (`PLATE_SIZES`/`DEFAULT_PLATES`,
`BAR_SIZES`/`DEFAULT_BARS`, [equipment.ts:37](../../../src/engine/data/equipment.ts)), som
føres gennem `NormalizedRequest.plates`/`.bars` ([request.ts:96](../../../src/engine/request.ts))
og bruges i `planPlates` ([loads.ts:36](../../../src/engine/loads.ts)).

### Ændring — spejler Skiver/Stænger-mønsteret præcist

**`equipment.ts`:** nye eksporterede konstanter, samme sted som `PLATE_SIZES`:

```ts
export const SANDBAG_SIZES = [10, 20, 30];
export const DEFAULT_SANDBAGS = [10, 20, 30];
```

**`engine/types.ts`:** `NormalizedRequest` får `sandbags: number[]`
([types.ts:235](../../../src/engine/types.ts)), `WorkoutRequest` får `sandbags?: number[]`
([types.ts:338](../../../src/engine/types.ts)), og `LoadContext`
([loads.ts:82](../../../src/engine/loads.ts)) får `sandbags?: number[]`.

**`request.ts`:** samme mønster som plates/bars ([request.ts:96](../../../src/engine/request.ts)):

```ts
sandbags: (raw.sandbags?.length ? raw.sandbags : DEFAULT_SANDBAGS).slice().sort((a, b) => b - a),
```

**`movements.ts`:** `targetFor`s `ctx`-objekt ([movements.ts:62](../../../src/engine/movements.ts))
udvides med `sandbags: req.sandbags`.

**`loads.ts`:** `prescribe`s `'bag'`-gren ([loads.ts:114](../../../src/engine/loads.ts))
bruger `ctx.sandbags` i stedet for den lokale `SANDBAGS`-konstant:

```ts
case 'bag': {
  const list = ctx.sandbags?.length ? ctx.sandbags : DEFAULT_SANDBAGS;
  const kg = snapToList(perUnit, list, floor);
  return { totalKg: kg, eachKg: kg, kind, text: fmtKg(kg) };
}
```

Den lokale `SANDBAGS`-konstant fjernes til fordel for den importerede `DEFAULT_SANDBAGS`.
`rawPerUnit` ([loads.ts:138](../../../src/engine/loads.ts)) er uændret — den beregner
stadig den "rå" ønskede vægt ud fra køn/niveau/kropsvægt som i dag; det er kun
*afrundingslisten*, der nu er brugerens eget udstyr i stedet for et fast spænd. Dette er
netop den ønskede opførsel: vægten varierer stadig efter køn/styrke, men holder sig inden
for de 10/20/30 kg, salen faktisk har.

**`src/types.ts`:** `UserProfile` ([types.ts:20](../../../src/types.ts)) og `GenDraft`
([types.ts:44](../../../src/types.ts)) får hver `sandbags: number[]`.

**`useWhatwork.ts`:** spejler `plates`/`bars` tre steder:
- `DEFAULT_PROFILE` (nær linje 23-24): `sandbags: eng.DEFAULT_SANDBAGS.slice()`.
- Indlæsningsmigrering (nær linje 219-220): `if (!loadedProfile.sandbags?.length) loadedProfile.sandbags = eng.DEFAULT_SANDBAGS.slice();`.
- `buildRequest` (nær linje 418-419 og 672): `sandbags: profile.sandbags` sendes med i
  `WorkoutRequest`.

**`engine/index.ts`:** eksportér `SANDBAG_SIZES`, `DEFAULT_SANDBAGS` fra barrel-filen,
samme linje som `PLATE_SIZES`/`DEFAULT_PLATES` ([index.ts:9](../../../src/engine/index.ts)).

**`Equipment.tsx`:** ny sektion "Sandbag-vægte", placeret lige efter "Stænger"
([Equipment.tsx:90](../../../src/screens/Equipment.tsx)), med samme `Chip`-mønster:

```tsx
<h2 className="ww-kicker" style={{ marginBottom: 6 }}>Sandbag-vægte</h2>
<p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
  De vægte, du markerer her, er dem motoren vælger imellem — nærmest din foreslåede
  belastning, justeret efter køn og niveau.
</p>
<div className="ww-wrap">
  {eng.SANDBAG_SIZES.map((kg) => (
    <Chip key={kg} on={profile.sandbags.includes(kg)} onClick={() => toggleSandbag(kg)}>
      {kg} kg
    </Chip>
  ))}
</div>
```

med en `toggleSandbag`-funktion identisk til `togglePlate` ([Equipment.tsx:19](../../../src/screens/Equipment.tsx)),
minus specialtilfældet fra `toggleBar` der forhindrer en tom liste (samme regel bør gælde
her: mindst én vægt skal forblive valgt, ellers falder motoren tilbage til hele
standardlisten via `?.length ? … : DEFAULT_SANDBAGS` — men UI'et bør stadig ikke tillade at
fravælge den sidste, for konsistens med Stænger).

Det eksisterende `sandbag`-udstyrs-toggle (antal stationer,
[equipment.ts:20](../../../src/engine/data/equipment.ts)) er urelateret og forbliver
uændret — det styrer *antal fysiske sandbags til rotation*, ikke deres vægt.

## Del E — Farvekodning: Opvarmning grøn, hoveddel rød

### Nye CSS-tokens (`src/index.css`)

`--ww-green`/`--ww-red` findes allerede i begge temaer ([index.css:35-39](../../../src/index.css),
[index.css:82-86](../../../src/index.css)), men mangler de tonede "dim"/"line"-varianter,
som `--ww-orange` allerede har og bruges til badges/kanter
([index.css:30-31](../../../src/index.css)). Tilføjes parallelt i begge
`:root`-blokke:

```css
--ww-green-dim: rgb(52 211 153 / 14%);   /* lys tema: rgb(4 120 87 / 10%) */
--ww-green-line: rgb(52 211 153 / 42%);  /* lys tema: rgb(4 120 87 / 40%) */
--ww-red-dim: rgb(220 38 38 / 14%);      /* lys tema: rgb(185 28 28 / 10%) */
--ww-red-line: rgb(220 38 38 / 42%);     /* lys tema: rgb(185 28 28 / 40%) */
```

### `Result.tsx`

`BlockSection` ([Result.tsx:211](../../../src/screens/Result.tsx)) får en farve udledt af
`block.kind`:

```ts
const accent = block.kind === 'warmup'
  ? { fg: 'var(--ww-green)', line: 'var(--ww-green-line)', dim: 'var(--ww-green-dim)' }
  : { fg: 'var(--ww-red)', line: 'var(--ww-red-line)', dim: 'var(--ww-red-dim)' };
```

Bruges til: en 3px venstre-kant på selve `<section>` (`borderLeft: '3px solid ${accent.line}'`),
og overskriftens (`<h2 className="ww-kicker">`) farve sættes til `accent.fg` i stedet for
standard-kickerfarven. `blockLabel` ([Result.tsx:7](../../../src/screens/Result.tsx)) er
uændret — kun farven på den tekst, den allerede returnerer.

### `Timer.tsx`

Topbjælkens sekundære linje (`{segment.blockTitle} · {KIND_LABEL[segment.kind]}`,
[Timer.tsx:62](../../../src/screens/Timer.tsx)) og segmentskinnens `is-now`-prik
([Timer.tsx:74](../../../src/screens/Timer.tsx), styles i index.css) farves efter samme
princip: slå det aktive segments `blockId` op i `workout.blocks` for at finde `block.kind`,
og brug samme `accent`-logik som i Result. Dette kræver, at `Timer`-komponenten får adgang
til `workout.blocks` (allerede en prop, [Timer.tsx:19](../../../src/screens/Timer.tsx)) —
ingen nye props nødvendige.

## Del F — Timer-lyde: nedtælling, START, skift, pause, færdig

### Princip: én generisk mekanisme, ikke special-logik pr. format

Ethvert segment i timerplanen har en kendt afslutning — enten en fast varighed
(`segment.seconds !== null`) eller en tidscap for åbne segmenter
(`segment.capSeconds`, relevant for For Time/Chipper/Ladder/You go, I go). De sidste 3
sekunder før *ethvert* segment slutter, afspilles et "tick" ved 3-2-1, og ved overgangen
til næste segment afspilles en distinkt "ankomst-lyd" plus en kort tekst-animation på
skærmen. Hvilken ankomst-type det er, udledes af nuværende og næste segments `kind`
([types.ts:442](../../../src/engine/types.ts)):

| Nuværende → Næste segment | Ankomst-type | Skærmtekst |
|---|---|---|
| `prep` → `work` | `start` | "START" |
| `work`/`transition` → `rest` | `rest_start` | "PAUSE STARTER" |
| `rest` → `work` | `rest_end` | "ARBEJD IGEN" |
| `work` → `work`/`transition` | `switch` | "SKIFT ØVELSE" |
| (nås) `done` | `complete` | "FÆRDIG" |

`done`-tilfældet har ingen forudgående nedtælling (det åbne slutsegment venter på et
brugertryk) — der affyres i stedet én gang, når `segment.kind` bliver `'done'`.

### Ny fil: `src/lib/sound.ts`

Ren Web Audio API-baseret lydgenerator — ingen lydfiler, korte syntetiske toner:

```ts
export type ArrivalKind = 'start' | 'switch' | 'rest_start' | 'rest_end' | 'complete';

let ctx: AudioContext | null = null;
function getCtx(): AudioContext { ctx ??= new AudioContext(); return ctx; }

export function playTick(): void { /* ~100 ms tone, stigende tonehøjde 3→2→1 via en
  valgfri parameter, fx playTick(stepsLeft: 1 | 2 | 3) */ }

export function playArrival(kind: ArrivalKind): void { /* distinkt, ~300-500 ms tone
  pr. type — fx to-tone opadgående for 'start'/'rest_end', ét enkelt nedadgående for
  'rest_start', kort dobbelt-bip for 'switch', kort fanfare (3 toner) for 'complete' */ }
```

`AudioContext` oprettes først lazy ved første kald — skal ske fra en brugerhandling
(fx tryk på Start-knappen i timeren) for at overholde mobile browseres
autoplay-begrænsninger, hvilket allerede er tilfældet her.

### `useWhatwork.ts` — planlægning af tick/ankomst

Genbruger den eksisterende, præcise timeout-baserede model
(`window.setTimeout(() => advance(1), remaining * 1000)`,
[useWhatwork.ts:315](../../../src/state/useWhatwork.ts)) i stedet for at aflede lyd fra den
250 ms-polling, der allerede findes til visning — det undgår drift og dobbelt-affyring.

Ny `useEffect`, parallel til advance-planlægningen, der ved segmentskift (eller ved
pause/genoptag) planlægger op til fire `setTimeout`-kald relativt til `remaining`
(eller `capLeft` for åbne segmenter med cap): ved `remaining - 3000`, `-2000`, `-1000` ms
→ `playTick()`, og ved `remaining` ms → `playArrival(kindFor(segment, next))`, hvor
`kindFor` er en ren, testbar hjælpefunktion (tabellen ovenfor). Alle kald er betinget af
`settings.sound` — er den `false`, planlægges timeouts slet ikke (ikke bare lydløse kald),
så der ikke ophobes unødige timers.

En separat, edge-triggered effekt (ref der husker forrige `segment.kind`) affyrer
`playArrival('complete')`, når `segment.kind` skifter *til* `'done'`.

### Mute — ét delt flag, to steder at se/ændre det

`settings.sound` ([types.ts:34](../../../src/types.ts), allerede eksisterende) forbliver
den ene sandhedskilde og persisteres som i dag. Den bruges allerede i
`Settings.tsx:101`. Timeren får en ny højtaler-knap i topbjælken
([Timer.tsx:50](../../../src/screens/Timer.tsx)), som kalder samme `onChange({ sound: !settings.sound })`-mønster
som Dark/Light-skifteren i headeren gør i dag — dvs. et slag i timeren er permanent og ses
også under Indstillinger bagefter, og omvendt. Ingen separat "kun denne session"-tilstand.

### Skærmanimation

Et transient overlay i `Timer.tsx`, drevet af en ny stykke state fra hooket
(`timerCallout: { kind: ArrivalKind; ts: number } | null`, sat af samme effekt som
planlægger `playArrival`), vist i op til ~900 ms centreret over uret — stor tekst
("START"/"SKIFT ØVELSE"/"PAUSE STARTER"/"ARBEJD IGEN"/"FÆRDIG") i den tilsvarende
statusfarve (grøn for start/rest_end, blå for rest_start, orange for switch, grøn for
complete — genbruger `--ww-green`/`--ww-blue`/`--ww-orange` fra Del E's palette). En simpel
CSS `@keyframes`-fade/scale, samme letvægts-stil som resten af `index.css`.

### Test

`kindFor(prevKind, nextKind)` er en ren funktion uden Web Audio-afhængighed og kan
enhedstestes direkte (jsdom har ikke `AudioContext`) — dækker alle fem overgange i
tabellen ovenfor plus et par negative tilfælde (fx `transition → transition`, som ikke bør
forekomme, men ikke må kaste en fejl).

## Del G — Skrå bænkpres + push-up-varianter

### Ny udstyrstype: justerbar bænk

Skrå bænkpres bruger ikke en plyobox som underlag — det er en justerbar bænk (typisk
0–70°, brugeren vælger selv vinklen efter, hvor meget skulderfokus de vil have). Denne
udstyrstype findes slet ikke i dag; `box`
([equipment.ts:17](../../../src/engine/data/equipment.ts)) er en plyobox til spring/step
og er *ikke* det samme redskab. Ny post i `EQUIPMENT`
([equipment.ts:7](../../../src/engine/data/equipment.ts)):

```ts
{ id: 'bench', name: 'Justerbar bænk', countable: true, def: 2, onByDefault: true, hint: 'Fladt til skrå, 0–70°' },
```

`countable`/`def: 2` matcher, hvordan `box` allerede er modelleret — antallet styrer
rotation ved flere deltagere. `onByDefault: true`, da de fleste sale har mindst én. Kræver
ingen ændringer i `Equipment.tsx` ud over det, der allerede sker automatisk — udstyrsgrid'et
([Equipment.tsx:38](../../../src/screens/Equipment.tsx)) itererer `EQUIPMENT` generisk.

**Ikon:** ny post i `GLYPHS`-kortet ([EquipmentIcon.tsx:19](../../../src/components/EquipmentIcon.tsx)),
tegnet i samme stil som de øvrige (skrå bænk-flade med ben og hævet ryglæn), så den ikke
falder tilbage til standard-kropsvægt-ikonet.

**Sideeffekt — ensretning af eksisterende Bench Press:** i dag bruger både `bench_press` og
`db_bench` fejlagtigt `box` som underlag ([exercises.ts:57-58](../../../src/engine/data/exercises.ts)),
formentlig fordi der ikke fandtes noget bænk-udstyr, da de blev skrevet. Nu hvor `bench`
findes, rettes begges `eq` fra `['barbell', 'box']`/`['dumbbell', 'box']` til
`['barbell', 'bench']`/`['dumbbell', 'bench']` — samme rettelse, brugeren bad om for skrå
bænkpres, anvendt konsekvent. `bench` er `onByDefault: true`, så eksisterende brugere
mister ikke adgang til øvelserne ved denne rettelse. `dip` ([exercises.ts:59](../../../src/engine/data/exercises.ts))
bruger fortsat `box` — dét er korrekt, en box som forhøjning til dips er reelt udstyr.

### Ny øvelse: Skrå bænkpres

```ts
E({
  id: 'incline_bench_press', name: 'Incline Bench Press', cat: 'press',
  eq: ['barbell', 'bench'], lvl: 2, tech: 2, avoid: ['shoulder'],
  da: 'Bænken vinklet 45–70°. Skulderbladene samlet, kontrolleret ned til øverste bryst.',
  fat: { press: 3, shoulder: 3, cns: 2 }, sec: 4, rep: [3, 10],
  load: { m: 75, f: 42 }, sub: ['bench_press', 'db_shoulder_press'], weight: 0.75,
}),
```

Referencevægten (75/42 kg) sættes lavere end fladt bænkpres (90/50 kg) — løftet er hårdere
ved samme vægt pga. den forlængede vej og øget skulderinvolvering, som du påpegede. `avoid:
['shoulder']` tilføjes (findes ikke på almindelig `bench_press`), fordi skråt pres belaster
skulderen mere direkte. Tilføjes til `PICKABLE` ([Generator.tsx:11](../../../src/screens/Generator.tsx)),
sammen med `bench_press` fra Del C.

### To nye push-up-varianter

`push_up` findes allerede ([exercises.ts:50](../../../src/engine/data/exercises.ts)) men
mangler i `PICKABLE` — rettes samme sted som bænkpres. Derudover to nye kataloge-poster,
samme skema som de øvrige pres-øvelser:

```ts
E({ id: 'diamond_push_up', name: 'Diamond Push-up', cat: 'press', lvl: 2, tech: 2,
  avoid: ['wrist', 'shoulder'],
  da: 'Hænderne samlet under brystet, tommel mod tommel. Mere triceps, sværere end almindelig push-up.',
  fat: { press: 3, core: 1 }, sec: 2.2, rep: [8, 20], sub: ['push_up'], weight: 0.7 }),

E({ id: 'decline_push_up', name: 'Decline Push-up', cat: 'press', eq: ['box'], lvl: 2,
  da: 'Fødderne hævet på boxen. Mere skulder- og øvre brystbelastning.',
  fat: { press: 3, shoulder: 1, core: 1 }, sec: 2.2, rep: [8, 20], sub: ['push_up'], weight: 0.8 }),
```

Begge tilføjes til `PICKABLE`. Ingen af dem er `accessory: true` — de er fuldgyldige
hoveddels-øvelser, ligesom `hr_push_up` allerede er, ikke skaleringer af `push_up`.

## Ikke i scope (tilføjelse til Del G)

- `incline_bench_press` tilføjes **ikke** til `RAMP_ELIGIBLE_IDS`
  ([blocks.ts:197](../../../src/engine/blocks.ts)) — den ramp-mod-5RM-struktur, der findes
  fra tidligere spec, er bevidst holdt til de seks navngivne hovedløft. Kan tilføjes senere
  som en selvstændig beslutning, hvis det ønskes.
- Ingen dumbbell-variant af skrå pres (Incline Dumbbell Press) — kun den efterspurgte
  vægtstangsversion.

## Test (samlet)

- Eksisterende `App.test.tsx`/`engine.test.ts`/`timer.test.ts`-suiter skal fortsat bestå.
- Ny dækning bør bekræfte:
  - `movementCount('amrap'/'fortime', …)` returnerer op til 5 ved lange sessioner, uændret
    loft for øvrige formater.
  - EMOM med `restEveryCycle`: korrekt antal runder, timerplanen indeholder præcis ét
    `rest`-segment pr. cyklus af samme længde som arbejdsintervallet.
  - `bench_press` findes i `PICKABLE`.
  - Sandbag-belastning snapper til `req.sandbags` (ikke det gamle faste spænd); tom/udeladt
    liste falder tilbage til `DEFAULT_SANDBAGS`.
  - `kindFor(...)`-tabellen for timer-lyde (ren funktion, alle fem overgangstyper).
  - `incline_bench_press`, `diamond_push_up`, `decline_push_up` og `push_up` findes i
    `PICKABLE`; `bench_press`/`db_bench`/`incline_bench_press` kræver `bench` (ikke `box`)
    i deres `eq`.

## Ikke i scope

- Visning af belastning i lbs — kun kg, som i dag; 205#-eksemplet var kun reference for
  forståelsen af billedmaterialet.
- Ændringer til E2MOM/E3MOM/E4MOM/E5MOM's struktur — kun almindelig EMOM får det nye
  hvile-mønster.
- Faktiske lydfiler/eksternt lydbibliotek — alle toner genereres proceduralt med Web Audio
  API.
- En separat "session-only" lydkontakt adskilt fra Indstillinger — bekræftet af brugeren:
  timerens lydknap og Indstillinger er to visninger af samme, persisterede flag.
