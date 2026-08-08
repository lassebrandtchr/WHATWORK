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

### `Result.tsx` — farve **og** adskilte kort, ikke kun farve på én fælles boks

Ren farvekodning er ikke nok til at gøre skiftet utvetydigt — opvarmning og hoveddel skal
stå i hver deres tydeligt afgrænsede boks, ikke i samme kort med en tynd streg imellem.
I dag er alle blokke pakket ind i ét fælles `ww-card`
([Result.tsx:101](../../../src/screens/Result.tsx)), og `BlockSection`
([Result.tsx:211](../../../src/screens/Result.tsx)) sætter kun en `borderTop` mellem dem
(`first ? 'none' : '1px solid var(--ww-line)'`) — visuelt én sammenhængende flade.

**Ny struktur:** den fælles wrapper erstattes af en simpel `flex column` med luft imellem,
og hver blok bliver sit **eget** `ww-card` i stedet for en `<section>` inde i ét delt kort:

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

`BlockSection` mister sin `first`-prop (ikke længere nødvendig, når hver blok er sit eget
kort) og bliver selv et `ww-card`, farvet efter `block.kind`:

```ts
const accent = block.kind === 'warmup'
  ? { line: 'var(--ww-green-line)', dim: 'var(--ww-green-dim)', fg: 'var(--ww-green)' }
  : { line: 'var(--ww-red-line)', dim: 'var(--ww-red-dim)', fg: 'var(--ww-red)' };

<section
  className="ww-card"
  style={{ padding: '22px 20px', borderColor: accent.line, background: accent.dim }}
>
```

`borderColor`/`background` overskriver `.ww-card`s standardværdier
([index.css:467](../../../src/index.css)) inline — kortets radius og struktur bevares,
kun farven ændres, samme kompositionsmønster som `.ww-badge--accent` allerede bruger
([index.css:772](../../../src/index.css)). Overskriftens (`<h2 className="ww-kicker">`)
farve sættes til `accent.fg`. Resultatet: to (eller flere, ved styrke + conditioning)
synligt separate, farvede kort efter hinanden med luft imellem — ikke til at tage fejl af,
hvor det ene slutter og det andet starter, selv for en bruger der ikke kan skelne
grøn/rød. `blockLabel` ([Result.tsx:7](../../../src/screens/Result.tsx)) er uændret — kun
selve indpakningen og farven ændrer sig.

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

---

# Runde 2 — rettelser og udvidelser efter første push

Del A–G ovenfor blev implementeret, testet og pushet til `main`. Brugeren har siden
testet den live app og bedt om en række yderligere rettelser og features i samme
arbejdsgang. De hedder Del H–R herunder, af samme spec, samme commit-rytme (test →
implementér → verificér → commit pr. del), fælles slutverifikation og push til sidst.

## Del H — Historik viser reel trænet tid, ikke den planlagte

### Fejlen

`entryFor()` ([useWhatwork.ts:593](../../../src/state/useWhatwork.ts)) sætter altid
`minutes: w.estimatedMinutes` — workoutens *planlagte* varighed — uanset om posten
kommer fra en fuldført session, en afbrudt session eller blot et "Gem" uden at træne.
`saveCompletion()` ([useWhatwork.ts:678](../../../src/state/useWhatwork.ts)) har allerede
den *faktiske* forløbne tid liggende i `completeFor.secs` (sat fra
`view.sessionElapsed` i `openCompletion`, [useWhatwork.ts:667](../../../src/state/useWhatwork.ts))
og bruger den til selve resultatteksten ("Afbrudt ved 28% — … · 6:12 på uret"), men
sender den aldrig med til `entryFor` som `minutes`. Resultatet: en 60 minutters workout
afbrudt efter 6 minutter gemmes i historikken som "60 min".

### Rettelse

`entryFor` får et nyt, valgfrit sidste parameter, `actualMinutes?: number`. Når det er
sat, bruges det i stedet for `w.estimatedMinutes`:

```ts
const entryFor = useCallback(
  (
    w: Workout, status: HistoryStatus, result = '', rpe: HistoryEntry['rpe'] = '',
    progressPct?: number, lastExercise?: string, actualMinutes?: number,
  ): HistoryEntry => ({
    id: `${w.id}_${Date.now()}`,
    title: w.title,
    format: w.formatName,
    minutes: actualMinutes ?? w.estimatedMinutes,
    date: new Date().toISOString(),
    status,
    rpe,
    result,
    ...(progressPct !== undefined ? { progressPct } : {}),
    ...(lastExercise ? { lastExercise } : {}),
    patterns: w.blocks.flatMap((b) => b.movements.map((m) => eng.BY_ID[m.exerciseId]?.cat ?? 'ukendt')),
    signature: w.signature,
    workout: w,
  }),
  [],
);
```

`saveCompletion` beregner allerede `mins = Math.floor(secs / 60)`
([useWhatwork.ts:681](../../../src/state/useWhatwork.ts)) — det tal sendes nu med:

```ts
const mins = Math.floor(secs / 60);
const rest = secs % 60;
...
entryFor(w, completion.status, result, completion.rpe, completion.progressPct, completion.lastExercise, Math.max(1, mins)),
```

`Math.max(1, mins)` undgår en misvisende "0 min" for en session afbrudt i første minut.

`saveWorkout`/`toggleFavorite` ([useWhatwork.ts:615](../../../src/state/useWhatwork.ts),
[useWhatwork.ts:626](../../../src/state/useWhatwork.ts)) kalder fortsat `entryFor` uden
det sjette argument — der er ingen løbet timer at måle på, når man gemmer eller sætter
favorit fra Resultat-siden uden at have trænet, så `estimatedMinutes` er fortsat det
korrekte tal der.

**Test:** ny sag i `useWhatwork.test.ts` (eller en ny `src/state/history.test.ts`, hvis
`entryFor` eksporteres til test — den er i dag ikke eksporteret, så testen dækkes i
stedet via en let integrationstest i `App.test.tsx`, der starter en workout, spoler
frem et par minutter med `vi.advanceTimersByTimeAsync`, afslutter med "Afbrudt", og
bekræfter at historik-posten viser et lavt minuttal, ikke `estimatedMinutes`).

## Del I — Realistiske reps og pauser i Interval-formatet

### Problemet

Et genereret "Interval 40/20" kunne indeholde "14 Ring Row" og "14 Dips" — urealistisk
mange reps af tunge, teknisk krævende trækøvelser/pres-øvelser på 40 sekunder, og 20
sekunders pause er for kort til reel restitution af skuldre/triceps/ryg mellem sæt af
den type. `repsForInterval()` ([blocks.ts:38](../../../src/engine/blocks.ts)) bruger i
dag ét fælles "fill"-forhold (62 %, dæmpet til ca. 43 % for `isHeavyImplement`, som kun
dækker vægtstang/slæde) til at oversætte arbejdstid til reps — kropsvægtsøvelser som
Ring Row, Dips, Pull-ups og Toes-to-Bar rammes ikke af den dæmpning, selvom de reelt er
langsommere og mere lokalt udmattende end fx Air Squat eller Kettlebell Swing.

### Løsning: øvelses-specifik intensitetsklasse

Tilføjer et nyt, valgfrit felt til `Exercise`
([types.ts:61](../../../src/engine/types.ts)):

```ts
/** Hvor muskulært krævende/langsom øvelsen er ved intervalarbejde — styrer både
 * hvor stor en del af arbejdstiden der reelt bruges på reps, og minimumspausen. */
grind?: 'low' | 'medium' | 'high';
```

`grind` sættes ud fra velkendt styrke-/konditionstræningspraksis (ikke fra en enkelt
kilde, men fra den brede konsensus i S&C-litteraturen om lokal muskeludmattelse ved
overkrops-trækøvelser i høj volumen — fx NSCA's retningslinjer for
hviletid-efter-intensitet, som anbefaler 30–90 sek. ved højt volumen/moderat
belastning for mindre muskelgrupper, og markant kortere for cyklisk
kropsvægts-/maskinarbejde):

- `'low'` (standard, sat implicit når feltet udelades): cyklisk kondition —
  Air Squat, Row/Ski/Bike/Assault, Wall Ball, Burpees, Kettlebell Swing. Tempoet holder
  stort set hele arbejdsvinduet.
- `'medium'`: sammensatte, men ikke ekstremt trættende — Box Jump-Over, Devil Press,
  Sandbag-øvelser, DB Snatch, Walking Lunge.
- `'high'`: teknisk krævende overkrops-træk/pres eller høj CNS-belastning i høj volumen
  — Ring Row, Dips, Pull-ups (alle varianter), Toes-to-Bar, HSPU, olympiske løft,
  Thrusters.

Konkrete `grind: 'high'`-tilføjelser i `src/engine/data/exercises.ts` (kun de øvelser,
der findes i kataloget og reelt hører til klassen — resten arver `'low'` implicit):
`ring_row`, `db_row`, `barbell_row`, `pull_up`, `band_pull_up`, `chest_to_bar`,
`jumping_pull_up`, `toes_to_bar`, `hanging_knee_raise`, `dip`, `hspu`, `push_jerk`,
`power_clean`, `hang_power_clean`, `clean_and_jerk`, `power_snatch`, `thruster`,
`devil_press`, `sandbag_shoulder`. `grind: 'medium'` på: `box_jump_over`, `box_jump`,
`db_snatch`, `db_walking_lunge`, `db_front_rack_lunge`, `sled_pull`,
`burpee_pull_up`, `burpee_box_jump_over`, `kb_american_swing`.

### Ændring i `repsForInterval` — realistisk repstal

```ts
const GRIND_FILL: Record<'low' | 'medium' | 'high', number> = { low: 1, medium: 0.8, high: 0.62 };

function repsForInterval(ex: Exercise, seconds: number, fill = 0.62): number {
  const heavy = isHeavyImplement(ex);
  const grindFactor = GRIND_FILL[ex.grind ?? 'low'];
  const effectiveFill = (heavy ? fill * 0.7 : fill) * grindFactor;
  const target = seconds * effectiveFill;
  const step = ex.unit === 'cal' ? 1 : ex.unit === 'm' ? 25 : ex.unit === 'sec' ? 5 : 1;
  const raw = ex.unit === 'sec' ? target : target / ex.sec;
  const [lo, hi] = ex.rep ?? [1, 999];
  const ceiling = heavy ? hi : hi * 1.5;
  return clamp(Math.max(step, roundTo(raw, step)), Math.min(lo, 3), ceiling);
}
```

40 sek. arbejde på Ring Row (`sec: 2.5`, `grind: 'high'`): `40 * 0.62 * 0.62 ≈ 15.4`
sek. effektivt → `15.4 / 2.5 ≈ 6` reps, ikke 14 — realistisk for uafbrudte, kontrollerede
ring rows.

### Ændring i Interval/Team rotation — minimumspause efter grind

`buildConditioning`s `interval`- og `team_rotation`-grene
([blocks.ts:117](../../../src/engine/blocks.ts),
[blocks.ts:130](../../../src/engine/blocks.ts)) sætter i dag `restSec` som ét tal for
*hele* blokken (15–30 sek., afhængig af `req.condition`), fælles for alle stationer.
Det udvides til at tage højde for den *tungeste* (højeste grind-klasse) øvelse i
listen:

```ts
const GRIND_MIN_REST: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 15, high: 30 };

function restFor(exercises: Exercise[], baseRest: number): number {
  const worst = exercises.reduce<'low' | 'medium' | 'high'>(
    (acc, e) => (GRIND_MIN_REST[e.grind ?? 'low'] > GRIND_MIN_REST[acc] ? (e.grind ?? 'low') : acc),
    'low',
  );
  return Math.max(baseRest, GRIND_MIN_REST[worst]);
}
```

I `interval`-grenen: `restSec = restFor(exercises, req.condition >= 7 ? 20 : 30);` —
samme for `team_rotation`. En liste med Ring Row/Dips kan dermed ikke få mindre end 30
sekunders pause, uanset hvor højt konditionsniveauet er sat, mens en ren
maskine-/kropsvægtsliste beholder dagens korte pauser.

### Alternativ: AMRAP-pr.-station i stedet for fast repstal

For formater, hvor et fast måltal ikke giver mening (høj `grind`, lang arbejdstid
relativt til øvelsens tech-niveau), tilføjes en ny variant af Interval:
`format: 'interval'` med et nyt, valgfrit blok-felt:

```ts
/** Kun på Interval: stationerne har ikke et fast måltal — man når så langt man kan
 * på arbejdstiden, og skriver selv antallet ned. */
openStations?: boolean;
```

Sat sandt, når `exercises.some((e) => e.grind === 'high')` og arbejdstiden pr. station
er ≥ 40 sek. (kort arbejdstid + høj grind giver stadig mening som fast, lavt måltal —
det er ved længere arbejdsvinduer, at et estimeret fast tal bliver mest usikkert).
`movements[i].display` sættes til `${ex.name} · så mange som muligt` i stedet for et
repstal, og `timerplan.ts`s `interval`/`team_rotation`-gren
([timerplan.ts:133](../../../src/engine/timerplan.ts)) sætter `hint` til "Notér dit
antal, når tiden er gået," i stedet for det nuværende faste hint — ingen ændring i
selve segment-strukturen (stadig faste `work`/`rest`-sekunder), kun i hvad der vises
som mål.

**Test:** `blocks.test.ts` — Ring Row/Dips i en `interval`-blok med `condition: 9`
giver ≤ 8 reps (ikke 14) og `restSec >= 30`; en ren `row`/`ski`/`air_squat`-liste
beholder det korte, konditions-styrede `restSec`; en høj-grind station med lang
arbejdstid sætter `openStations: true` og et "så mange som muligt"-display.

## Del J — Orange sektions-overskrifter + "Hovedworkout"

`.ww-kicker--accent` findes allerede ([index.css:248](../../../src/index.css)) og
sætter `color: var(--ww-orange)` — den tilføjes til de navngivne overskrifter i stedet
for at opfinde ny CSS:

- `src/screens/Result.tsx:74` — `<h2 id="ww-protocol" className="ww-kicker ww-kicker--accent">Sådan afvikles den</h2>`
- `src/screens/Result.tsx:115` — samme for `Udstyrslogistik`
- `src/screens/Result.tsx:130` — samme for `Hvorfor denne workout`
- `src/screens/Result.tsx:147` — samme for `Workout-DNA`
- `blockLabel()` ([Result.tsx:7](../../../src/screens/Result.tsx)): `case 'conditioning':
  return hasStrength ? 'Del 2 — Conditioning' : 'Hovedworkout';` (omdøbt fra "Hoveddel").
  `BlockSection`s `<h2>` ([Result.tsx:226](../../../src/screens/Result.tsx)) mister sin
  `color: accent.fg`-override og bruger i stedet `className="ww-kicker ww-kicker--accent"`
  — kortets farvede kant/baggrund (grøn/rød, Del E) er uændret, kun selve
  eyebrow-tekstens farve bliver orange i stedet for grøn/rød, så alle kickers i appen
  er konsekvent orange, mens kort-niveauet stadig signalerer intensitet.
- "Hvad knapperne gør" er ikke en `ww-kicker`, men et `<Note label="…" tone="quiet">`
  ([Result.tsx:185](../../../src/screens/Result.tsx)), hvis label i dag altid er
  `var(--ww-text-3)` for `tone="quiet"` ([index.css:1017](../../../src/index.css)). I
  stedet for at ændre *alle* stille noter i appen (Equipment, Program, Settings,
  Transfer bruger også `tone="quiet"`), får `Note`-komponenten
  ([ui.tsx:154](../../../src/components/ui.tsx)) et nyt, valgfrit `accent?: boolean`-prop,
  der — når sandt — lægger `ww-note__label--accent` til uanset `tone`:

  ```tsx
  export function Note({
    label, children, tone = 'accent', accent = false,
  }: {
    label: string;
    children: ReactNode;
    tone?: 'accent' | 'danger' | 'good' | 'quiet';
    accent?: boolean;
  }) {
    const cls = (tone === 'accent' ? '' : ` ww-note--${tone}`) + (accent ? ' ww-note--label-accent' : '');
    return (
      <div className={`ww-note${cls}`}>
        <span className="ww-note__label">{label}</span>
        {children}
      </div>
    );
  }
  ```

  ny CSS-regel, høj nok specificitet til at slå `.ww-note--quiet .ww-note__label` ihjel:
  `.ww-note--label-accent .ww-note__label { color: var(--ww-orange); }`. Kun
  `Result.tsx`s "Hvad knapperne gør" sætter `accent` — alle andre noter er uændrede.

**Test:** ingen ny automatiseret test nødvendig (ren styling) — verificeres visuelt +
via `getComputedStyle` i Task 15-stil browser-check, samme metode som Del E.

## Del K — Større logo + fuld responsivitet

### Logo

`WwMark` ([WwMark.tsx](../../../src/components/WwMark.tsx)) bruges i
`DesktopHeader` med `size={30}` ([Navigation.tsx:92](../../../src/components/Navigation.tsx))
og formentlig et tilsvarende sted i mobilheaderen (findes i `App.tsx`s topbjælke for
mobil-visning — samme komponent, mindre `size`). Begge hæves: desktop `30 → 36`,
mobil-header `size` (findes ved at søge `<WwMark` i `App.tsx`) hæves fra sin nuværende
værdi til mindst `28` (typisk startpunkt er `24`, jf. samme forhold som desktop). Ingen
strukturændring — kun `size`-proppen, som allerede skalerer hele SVG'et proportionalt.

### Responsivitet

Appens grundform er allerede fornuftig: `useIsDesktop()`
([useWhatwork.ts:110](../../../src/state/useWhatwork.ts)) skifter mellem
`MobileNav`/`DesktopHeader` ved 1024px, og hver skærm er en enkelt, centreret kolonne
med `maxWidth` (760–860px) — det holder sig læsbart fra telefon til bred desktop uden
separate tablet-layouts. `.ww-eq-grid` bruger allerede `repeat(auto-fill,
minmax(104px, 1fr))` ([index.css:437](../../../src/index.css)), så udstyrsfliserne
allerede reflower korrekt.

"100 %-tilpasning på tværs af enheder" verificeres konkret (ikke påstået) ved at
resize'e den kørende app til seks repræsentative viewports og rette det, der reelt går
i stykker:

| Viewport | Repræsenterer |
|---|---|
| 375×812 | iPhone (standard) |
| 320×568 | Mindste almindelige iPhone (SE) |
| 768×1024 | iPad, portræt / Android-tablet |
| 1024×1366 | iPad, landskab |
| 1280×800 | Bærbar |
| 1920×1080 | Stor desktop-skærm |

Konkrete rettelser, der allerede kan forudses fra kodegennemgangen:
- Ved 320px bliver `Kicker`/`h1.ww-display` (brugt på Home/Generator) og
  DNA-rækkens faste `width: 88`-label ([Result.tsx:154](../../../src/screens/Result.tsx))
  de mest sandsynlige overløbspunkter — hvis testen bekræfter det, sættes en let
  `@media (max-width: 360px)`-regel, der reducerer `.ww-display`s `font-size` og
  fjerner DNA-labelens faste bredde til fordel for `flex: '0 1 auto'`.
- Timerens faste kontrolknapper ([Timer.tsx](../../../src/screens/Timer.tsx)) og
  callout-overlayet fra Del F testes eksplicit ved 320px bredde, da store, faste
  `font-size: 28px`-tekster er det mest risikable element for at knække linjen for
  tidligt på en meget smal skærm.

Præcis hvilke regler der ender med at blive tilføjet, afhænger af, hvad
resize-testen i Task 15 rent faktisk finder — denne sektion sætter rammen
(bredder, hvilke skærme der prioriteres, og hvordan fejl rettes), ikke et facit på
forhånd.

## Del L — Grønne, fede tidsangivelser

`ca. {block.minutes} min` ([Result.tsx:228](../../../src/screens/Result.tsx)) — den
eneste forekomst af dette mønster i appen — farves og gøres fed:

```tsx
<span className="ww-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ww-green)', whiteSpace: 'nowrap' }}>
  ca. {block.minutes} min
</span>
```

(Kun `fontWeight`/`color` tilføjet til den eksisterende `style`-linje.)

## Del M — Justerbar vægt pr. øvelse med genberegnede skiver

### Ny motorfunktion: `stepLoad`

I dag beregnes hvert `PersonTarget.load` én gang ved generering
(`scaleLoad`/`scaleLoadPct`, [loads.ts:162](../../../src/engine/loads.ts)) ud fra
køn/niveau/kropsvægt — der er ingen vej til at bede motoren om "samme øvelse, men 5 kg
tungere" bagefter. `prescribe()` ([loads.ts:97](../../../src/engine/loads.ts)) er
allerede den funktion, der oversætter et ønsket antal kilo til en konkret, snappet
belastning (skiver, kettlebell-størrelse, sandbag-vægt, osv.) — den mangler kun at
blive eksporteret og pakket ind i en funktion, der tager "nuværende vægt + retning" i
stedet for "rå beregnet ønske":

```ts
/** Faste lister, en +/- ét trin skal bevæge sig til nabo-værdien i, i stedet for at
 * lægge et fast antal kilo til og risikere at snappe tilbage til samme værdi. */
function listFor(ex: Exercise, kind: LoadKind, ctx: LoadContext): number[] | null {
  if (kind === 'ball') return WALLBALLS;
  if (kind === 'bag') return ctx.sandbags?.length ? ctx.sandbags : DEFAULT_SANDBAGS;
  if ((kind === 'pair' || kind === 'single') && ex.eq.includes('kettlebell')) return KETTLEBELLS;
  return null;
}

/** Ét trin op eller ned fra `currentEachKg` — til "juster vægten"-knapperne i UI'et.
 * Genbruger `prescribe` til selve formateringen, så teksten altid matcher det, motoren
 * ville have skrevet ved generering. */
export function stepLoad(
  ex: Exercise, kind: LoadKind, currentEachKg: number, direction: 1 | -1, ctx: LoadContext = {},
): LoadPrescription {
  const list = listFor(ex, kind, ctx);
  let nextEach: number;
  if (list) {
    const sorted = [...list].sort((a, b) => a - b);
    let idx = 0;
    sorted.forEach((v, i) => {
      if (Math.abs(v - currentEachKg) < Math.abs((sorted[idx] as number) - currentEachKg)) idx = i;
    });
    nextEach = sorted[clamp(idx + direction, 0, sorted.length - 1)] as number;
  } else {
    const step = kind === 'barbell' || kind === 'sled' ? 5 : 2.5;
    const floor = kind === 'barbell' ? 0 : kind === 'sled' ? 20 : 1;
    nextEach = Math.max(floor, roundTo(currentEachKg + direction * step, step));
  }
  return prescribe(ex, kind, nextEach, 0, ctx);
}
```

`stepLoad` eksporteres fra `loads.ts` og videre fra `engine/index.ts`
([index.ts:15](../../../src/engine/index.ts)), sammen med `WALLBALLS`/`KETTLEBELLS`
(i dag modul-private konstanter i `loads.ts` — forbliver private, kun `stepLoad`
eksponeres, så resten af motorens indkapsling er uændret).

### UI: justeringsknapper i Result.tsx

`Result`-komponenten får `profile: UserProfile` som ny prop (sendt fra `App.tsx`s
`<Result profile={ww.profile} ... />`), som gives videre til `BlockSection` →
`MovementRow`. Justeringer holdes i lokal state i `Result`, nulstillet hver gang en ny
`workout` åbnes — de er en "hvad hvis jeg løfter mere/mindre"-visning, ikke en del af
den gemte workout eller historikken:

```tsx
const [overrides, setOverrides] = useState<Record<string, eng.LoadPrescription>>({});
useEffect(() => { setOverrides({}); }, [workout.id]);

const adjust = (key: string, ex: eng.Exercise, kind: eng.LoadKind, current: eng.LoadPrescription, dir: 1 | -1) => {
  const next = eng.stepLoad(ex, kind, current.eachKg, dir, {
    plates: profile.plates, bars: profile.bars, sandbags: profile.sandbags,
  });
  setOverrides((o) => ({ ...o, [key]: next }));
};
```

I `MovementRow` (nu med `profile`/`overrides`/`onAdjust`-props), hvor
`t.load?.text ?? ''` i dag vises rent tekstligt
([Result.tsx:275](../../../src/screens/Result.tsx)), tilføjes to små ikon-knapper
(genbruger `.ww-round-btn`-mønstret, allerede brugt til runde-tælleren i Timer,
[Timer.tsx:161](../../../src/screens/Timer.tsx)) omkring den *effektive* værdi
(`overrides[key] ?? t.load`):

```tsx
{t.load ? (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <button type="button" className="ww-step-btn" aria-label={`${movement.name}: mindre vægt til ${t.label}`}
      onClick={() => onAdjust(key, ex, t.load!.kind, effectiveLoad, -1)}>−</button>
    <span style={{ color: 'var(--ww-orange)', fontWeight: 600 }}>{effectiveLoad.text}</span>
    <button type="button" className="ww-step-btn" aria-label={`${movement.name}: mere vægt til ${t.label}`}
      onClick={() => onAdjust(key, ex, t.load!.kind, effectiveLoad, 1)}>+</button>
  </span>
) : null}
```

`key` er `` `${movement.exerciseId}_${i}_${t.label}` `` (blok-id + index + label —
unikt inden for én workout-visning). Ny, lille CSS-klasse `.ww-step-btn` (26×26px,
rund, samme visuelle familie som `.ww-round-btn` men mindre — passer til inline
tekstflow i stedet for en fritstående kontrol).

Vægtstang-øvelser viser dermed straks den nye "X kg i alt — Y kg stang + Z kg på hver
side"-tekst ved tryk, præcis den formatering motoren allerede bruger ved generering —
ingen dobbelt formateringslogik at holde i sync.

**Test:** `stepLoad` testes direkte i `loads.test.ts` — ét trin op/ned for barbell
genberegner skiver korrekt og runder til 5 kg; ét trin på en kettlebell-baseret
øvelse rammer den *faktiske* nabo-kettlebell (ikke en vilkårlig ±2,5 kg, der kan snappe
tilbage til samme værdi); ét trin ved den letteste/tungeste værdi i en liste går ikke
under/over listens grænser.

## Del N — "Liquid Glass" bundmenu

`.ww-tab` ([index.css:612](../../../src/index.css)) skifter i dag kun tekstfarve ved
`aria-current='page'` — der er ingen visuel "pille", der glider mellem faner. Tilføjes:

- Et nyt `<span className="ww-tab__glass" />` inde i hver `.ww-tab`-knap i `MobileNav`
  ([Navigation.tsx:37](../../../src/components/Navigation.tsx)), positioneret absolut
  bag ikon+label.
- `MobileNav` måler den aktive knaps position med `getBoundingClientRect()` i en
  `useLayoutEffect` (afhænger af `screen`) og sætter et CSS custom property,
  `--ww-tab-x`/`--ww-tab-w`, på `.ww-tabbar`-elementet — ét flydende "glas"-element
  (`.ww-tab-highlight`), placeret som søskende til de fire faner (ikke inde i hver
  enkelt), animeres med `transform: translateX(var(--ww-tab-x))` og
  `width: var(--ww-tab-w)`, `transition: transform 0.32s var(--ww-ease), width 0.32s
  var(--ww-ease)` — samme lette, "glidende" fornemmelse som resten af appens
  `--ww-ease`-brug (fx timer-callouten i Del F).
- Visuelt: afrundet rektangel (`border-radius: 14px`), `background:
  var(--ww-glass)`, `backdrop-filter: blur(14px)`, `border: 1px solid
  var(--ww-glass-line)` — samme tokens som `.ww-glass`-klassen allerede bruger til
  navigation/sheets ([index.css:41-43](../../../src/index.css)), så det matcher
  appens eksisterende "liquid glass"-sprog i stedet for at opfinde en ny stil.
- `prefers-reduced-motion: reduce` ([index.css:201](../../../src/index.css)) slår
  `transition` fra på `.ww-tab-highlight`, så brugere, der har bedt om mindre
  bevægelse, får et øjeblikkeligt skift i stedet for en glidende animation.

```tsx
export function MobileNav({ screen, onGo }: { screen: Screen; onGo: (s: Screen) => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const active = activeRef.current;
    if (!bar || !active) return;
    const barRect = bar.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    bar.style.setProperty('--ww-tab-x', `${activeRect.left - barRect.left}px`);
    bar.style.setProperty('--ww-tab-w', `${activeRect.width}px`);
  }, [screen]);

  return (
    <nav className="ww-tabbar ww-glass" aria-label="Hovedmenu" ref={barRef}>
      <span className="ww-tab-highlight" aria-hidden="true" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="ww-tab"
            ref={screen === tab.id ? activeRef : undefined}
            aria-current={screen === tab.id ? 'page' : undefined}
            onClick={() => onGo(tab.id)}
          >
            {/* ...uændret indhold... */}
          </button>
        ))}
      </div>
    </nav>
  );
}
```

**Test:** ingen meningsfuld unit-test for en `getBoundingClientRect`-baseret
layout-effekt (jsdom returnerer nul-rects) — verificeres visuelt: skift mellem alle
fire faner i browser-checket og bekræft, at highlighten glider i stedet for at
springe, samt at den rammer den rigtige fane ved direkte navigation (fx `Historik`
åbnet fra et link, ikke via tabbaren).

## Del O — Brandnavnet bliver "WHATWORK?"

Ændres, hvor navnet/logoet **vises som sig selv** (titel, wordmark, install-navn,
knapper der navngiver appen) — **ikke** i løbende sætninger, hvor "WHATWORK" bruges
som et almindeligt navneord midt i en dansk sætning (fx "Så bygger WHATWORK resten
…", "WHATWORK er en træningsplanlægger …") — der ville et tilføjet "?" læses som et
spørgsmålstegn i selve sætningen, hvilket ikke er meningen, og heller ikke
`vite.config.ts`s `PAGES_BASE = '/WHATWORK/'` ([vite.config.ts:44](../../../vite.config.ts)),
som er en URL-sti for GitHub Pages-deployet, ikke tekst nogen ser.

Ændres:

- `src/components/Wordmark.tsx`: alle tre `WHATWORK`-tekstlag
  ([Wordmark.tsx:29,39,50](../../../src/components/Wordmark.tsx)) → `WHATWORK?`, og
  `aria-label="WHATWORK"` ([Wordmark.tsx:24](../../../src/components/Wordmark.tsx)) →
  `aria-label="WHATWORK?"`.
- `src/components/WwMark.tsx`: `aria-label="WHATWORK"` ([WwMark.tsx:13](../../../src/components/WwMark.tsx))
  → `aria-label="WHATWORK?"` (selve ikonet er kun et "W", uændret — kun den
  skærmlæser-beskrivende label opdateres for konsistens).
- `index.html`: `<title>WHATWORK</title>` → `<title>WHATWORK?</title>`
  ([index.html:14](../../../index.html)); `apple-mobile-web-app-title`
  ([index.html:11](../../../index.html)) → `WHATWORK?`.
- `vite.config.ts`: PWA-manifestets `name`/`short_name`
  ([vite.config.ts](../../../vite.config.ts), `name: 'WHATWORK'`/`short_name:
  'WHATWORK'`) → `WHATWORK?`.
- `src/screens/Onboarding.tsx`: knapteksten `'Start WHATWORK'`
  ([Onboarding.tsx:147](../../../src/screens/Onboarding.tsx)) → `'Start WHATWORK?'`.
- `src/screens/About.tsx` (`title="Om WHATWORK"`), `src/screens/Profile.tsx`
  (`{ id: 'about', label: 'Om WHATWORK' }`), `src/components/Navigation.tsx`
  (`{ id: 'about', label: 'Om WHATWORK', hint: … }`) → `Om WHATWORK?` alle tre steder
  — det er et menupunkt/sidetitel, der navngiver appen, ikke en sætning.

**Ikke ændret** (bevidst — løbende prosa, ikke en navngivning): teksterne i
`Home.tsx`, `Welcome.tsx`, `Generator.tsx`, `Help.tsx`, `About.tsx`s brødtekst,
`Transfer.tsx`, og `index.html`s `meta description`.

**Test:** `App.test.tsx` har formentlig en eksisterende `getByText`/snapshot-agtig
sammenligning mod velkomstteksten eller titlen — gennemgås og opdateres, hvis en
sådan streng-match findes; ellers ingen ny test nødvendig for en ren tekstændring.

## Del P — Burpee Broad Jump, flere variationer, uændret hastighed

### Burpee Broad Jump

`burpee` findes allerede og er allerede i `PICKABLE`
([exercises.ts](../../../src/engine/data/exercises.ts),
[Generator.tsx:11](../../../src/screens/Generator.tsx)). Ny øvelse tilføjes efter
`burpee_pull_up`:

```ts
E({ id: 'burpee_broad_jump', name: 'Burpee Broad Jump', cat: 'fullbody', lvl: 2, da: 'Burpee direkte over i et langt hop fremad. Land blødt, klar til næste.', fat: { engine: 3, legs: 2 }, sec: 4.5, rep: [8, 16], sub: ['burpee'], weight: 1.1 }),
```

Tilføjes til `PICKABLE`.

### Flere, reelt forskellige variationer — uden at bremse generatoren

`MAX_CANDIDATES = 64` ([smartmix.ts:21](../../../src/engine/smartmix.ts)) er **ikke**
det samlede antal mulige workouts — det er, hvor mange kandidater *hver* generering
bygger og scorer, før den vælger den bedste. Det faktiske variationsrum styres af
kombinationen af formatpulje × øvelsespulje × tilfældighed, og er allerede langt
større end 64 — men brugerens oplevelse af gentagelse er reel nok til at være værd at
adressere. Tre uafhængige, billige ændringer, ingen af dem øger beregningstiden
mærkbart:

1. **Bredere formatpulje.** `formatPool()` ([smartmix.ts:39](../../../src/engine/smartmix.ts))
   tilføjer et par ekstra formater i den brede, ikke-indsnævrede gren (linje 65-73):
   `interval` og `ladder` optræder allerede, men kun én gang hver i den faste liste —
   `chipper` mangler helt fra den brede pulje (kun tilgængelig ved `t >= 35`, uændret),
   men `e4mom`/`e5mom` kan trygt komme ind tidligere (`t >= 20` i stedet for kun
   implicit via de eksisterende `t >= 35`/`t >= 45`-grænser), så flere distinkte
   format-titler reelt konkurrerer om at blive valgt ved kortere sessioner.
2. **Blødere vægtningskurve i øvelsesvalg.** `spreadWeight`
   ([smartmix.ts:129](../../../src/engine/smartmix.ts)) bruger i dag `Math.sqrt(e.weight
   ?? 1)` til at dæmpe forskellen mellem højt og lavt vægtede øvelser. Ændres til
   `Math.pow(e.weight ?? 1, 0.35)` — en anelse fladere kurve, så lavt vægtede (men
   stadig gyldige) øvelser dukker markant oftere op over mange genereringer, uden at de
   højt vægtede "kerne"-øvelser holder op med at være de hyppigste. Ren datavægtning,
   ingen ny beregning.
3. **`MAX_CANDIDATES` hæves fra 64 til 128.** Se performance-afsnittet nedenfor for
   hvorfor dette er trygt.

### Performance: hvorfor det ikke føles langsommere

`generateWorkout` kaldes synkront fra `runGenerate`
([useWhatwork.ts](../../../src/state/useWhatwork.ts)) — resultatet ligger klar på
millisekunder. Det, brugeren oplever som "loading", er en **fast, scriptet
animation** på `LOADING_MS = 7000`
([useWhatwork.ts:37](../../../src/state/useWhatwork.ts)) — bevidst langsommere end
den reelle beregning, som kommentaren i koden selv siger. At fordoble
`MAX_CANDIDATES` fordobler den reelle beregningstid fra i forvejen et par
millisekunder til stadig kun et par millisekunder — usynligt i forhold til det
7-sekunders scriptede forløb, som **ikke ændres** (ingen rørelse ved `LOADING_MS`,
`PHASES` eller animationslogikken).

For at gøre dette til en *garanti*, ikke en antagelse, tilføjes en performance-test i
`engine.test.ts`, der fejler, hvis nogen (nu eller senere) introducerer en reel
regression:

```ts
it('bygger 100 workouts på under 1500 ms i alt — MAX_CANDIDATES-forhøjelsen må ikke mærkes', () => {
  const start = performance.now();
  for (let i = 0; i < 100; i++) build({ minutes: 30, men: 1, level: 3, seed: 20000 + i });
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(1500);
});
```

1500 ms for 100 fulde genereringer (inkl. 128 kandidater hver) er en rummelig
tærskel — i praksis forventes det at lande markant under, men grænsen er sat, så
testen ikke bliver flaky på en langsom CI-maskine, samtidig med at den fanger en
reel, alvorlig regression (fx en utilsigtet uendelig løkke eller kvadratisk
kompleksitet indført ved et uheld).

## Del Q — Hjem-skærmens hurtigvalg matcher Generér workout

`QUICK_TIMES = [20, 30, 45, 60]` ([Home.tsx:7](../../../src/screens/Home.tsx)) udvides
til at matche `TIME_OPTIONS` i generatoren ([Generator.tsx:8](../../../src/screens/Generator.tsx)
— `[10, 15, 20, 25, 30, 40, 45, 60, 75, 90]`), så brugeren møder de samme valg begge
steder:

```ts
const QUICK_TIMES = [10, 15, 20, 25, 30, 40, 45, 60, 75, 90];
```

`.ww-wrap` ([Home.tsx:58](../../../src/screens/Home.tsx)) er allerede en `flex-wrap`-
container, så de ekstra chips bryder pænt om på flere linjer på smalle skærme uden
yderligere layoutændring — samme mønster, `Generator.tsx`s eget tidstrin allerede
bruger med den fulde liste.

## Del R — Tydeligere DNA-akse-navne

`engine`/`hinge`-aksernes visningsnavne ([validate.ts:10](../../../src/engine/validate.ts))
er i dag de engelske fagudtryk "Engine" og "Posterior" — uigennemskuelige for en
bruger uden trænerbaggrund. Da DNA-rækken i UI'et har en fast label-bredde
(`width: 88`, [Result.tsx:154](../../../src/screens/Result.tsx)), vælges korte,
almindelige danske ord frem for en parentetisk uddybning, som ville kræve mere plads
og risikere at knække:

```ts
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
```

`'Kondition'` er det almindelige danske ord for det, `engine`-aksen rent faktisk måler
(puls/udholdenhedsbelastning). `'Baglår'` er en forenkling af hinge-mønstrets fulde
muskelinvolvering (baglår, baller, lænd) til den mest genkendelige enkeltmuskelgruppe
for en lægmand — samme afvejning, `'Ben'` og `'Pres'` allerede laver for deres akser.
`DnaAxisId` (den interne værdi, `'engine'`/`'hinge'`) er uændret — kun `name`,
visningsteksten, ændres, så intet andet sted i motoren (fatigue-vægte, `computeDNA`)
påvirkes.

**Test:** ingen automatiseret test nødvendig (ren tekst-/datatabel-ændring, allerede
dækket indirekte af eksisterende DNA-relaterede tests, der ikke asserter på de
konkrete navne).

## Ikke i scope (Runde 2)

- Fuld, automatiseret cross-device-testsuite (fx BrowserStack/Percy) — Del K
  verificeres med manuel resize + screenshot ved seks repræsentative viewports, ikke
  et permanent CI-gated visuelt regressionstjek.
- Persistering af vægt-justeringer fra Del M på tværs af sessioner/historik — de er en
  live "hvad hvis"-visning på Resultat-siden, nulstillet ved ny workout. At gemme en
  brugerjusteret vægt tilbage i selve `Workout`-objektet (og dermed historikken) er en
  selvstændig, større datamodel-ændring, som ikke er bedt om her.
- Ændringer til selve loading-skærmens varighed eller faseanimation (`LOADING_MS`,
  `PHASES`) — eksplicit udelukket af brugeren.
- Forskning i eksterne kilder for Del I's rep-/hviletidstal — baseret på etableret
  styrke-/konditionstræningspraksis (NSCA-niveau konsensus), ikke en specifik,
  citeret undersøgelse.
