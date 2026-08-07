# Individuelle kropsvægte pr. person + ramp til tung 5RM

**Dato:** 2026-08-07
**Status:** Godkendt design — klar til implementeringsplan
**Berørte skærme/moduler:** `src/screens/Generator.tsx` (Kropsvægt-trinnet), `src/types.ts`
(`GenDraft`), `src/state/useWhatwork.ts` (`buildRequest`), `src/engine/blocks.ts`
(`buildStrength`), `src/engine/data/exercises.ts` (ingen skemaændring, kun brug af
eksisterende felter)

## Baggrund

I dag sætter Kropsvægt-trinnet i generatoren (trin 3/7) kun ét gennemsnitstal pr. køn
(`bwM`/`bwF`/`bwX` på `GenDraft`). Motoren understøtter allerede at modtage en eksplicit
liste af personer med individuel kropsvægt (`WorkoutRequest.people`,
[request.ts:68](../../../src/engine/request.ts)) og skalerer belastning kontinuerligt efter
kropsvægt og niveau (`rawPerUnit`, [loads.ts:138](../../../src/engine/loads.ts)) — men UI'et
udnytter det ikke, og der findes ingen "ramp op til en tung 5RM"-sætstruktur i styrkedelen
(`buildStrength`, [blocks.ts:178](../../../src/engine/blocks.ts)), som i dag kun bygger flade
sætskemaer (samme vægt i alle sæt).

Denne spec dækker to sammenhængende, men uafhængigt implementerbare dele:

- **Del A:** Individuel kropsvægt pr. deltager i generatoren.
- **Del B:** Et nyt "ramp til tung 5RM"-sætskema for udvalgte hovedløft i styrkedelen.

## Del A — Individuel kropsvægt pr. person

### Datamodel (`src/types.ts`, `GenDraft`)

Tilføj fire felter til `GenDraft`:

```ts
individualWeights: boolean;   // false = gennemsnit (dagens opførsel)
weightsM: number[];           // pr. person, indeks-justeret til "Mand 1, Mand 2, …"
weightsF: number[];           // samme for kvinder
weightsX: number[];           // samme for "ikke angivet"
```

- `bwM`/`bwF`/`bwX` bevares uændret og bruges som (a) værdien i gennemsnit-tilstand og
  (b) fallback for enhver person, der endnu ikke er justeret individuelt:
  `weightsM[i] ?? bwM`.
- Arrays resizes ikke eksplicit, når `men`/`women`/`neutral` ændres på People-trinnet —
  de læses positionelt med fallback, så nye deltagere automatisk arver gruppens
  gennemsnit, og fjernede deltageres gamle værdi blot ligger ubrugt (ingen oprydning
  nødvendig).
- `freshGen()` initialiserer `individualWeights: false` og de tre arrays til `[]`.

### UI (`WeightStep` i `src/screens/Generator.tsx`)

- **Solo (1 deltager):** uændret — ét "Din vægt"-felt, ingen switch vises.
- **2+ deltagere:** to `Chip`-komponenter øverst, "Gennemsnit" / "Individuel", gensidigt
  udelukkende, patcher `individualWeights`.
  - **Gennemsnit:** dagens UI uændret (én række pr. kønsgruppe med count > 0, redigerer
    `bwM`/`bwF`/`bwX`).
  - **Individuel:** én `Counter`-række pr. person, pr. aktiv kønsgruppe — labels følger
    samme konvention som `peopleFromMix` allerede genererer
    ([request.ts:22](../../../src/engine/request.ts)): "Mand 1", "Mand 2", "Kvinde 1", …
    Værdi = `weights_/i/ ?? bw_`, ±1 kg, clamp 35–200 som i dag. Ændring af én person
    skriver en kopieret array med det ene indeks opdateret tilbage via `patch`.
- Forklarende brødtekst nederst bevares i begge tilstande.

### Sammenkobling til motoren (`buildRequest` i `src/state/useWhatwork.ts`)

Når `draft.individualWeights && participantsOf(draft) > 1`: byg en eksplicit
`people: Person[]` (samme label-/rækkefølgekonvention som `peopleFromMix`, kropsvægt fra
den resolverede per-person-værdi) og inkludér den i `WorkoutRequest`. Motoren foretrækker
allerede `raw.people` over `peopleFromMix`, når den er sat
([request.ts:68](../../../src/engine/request.ts)), og `scaleLoad`
([loads.ts:162](../../../src/engine/loads.ts)) skalerer allerede pr. individuel
`Person.bodyweight` — så dette er ikke kosmetisk, hver persons foreslåede belastning vil
reelt afvige. Ellers (gennemsnit-tilstand eller solo) udelades `people`, og
`bodyweightM/F/X` sendes som i dag — ingen ændring for eksisterende brugere.

### Edge cases

- Skift frem og tilbage mellem tilstande bevarer både gennemsnittene og eventuelle
  individuelt justerede vægte, da ingen af dem ryddes — kun hvilken der fødes ind i
  `buildRequest`, ændrer sig.
- Fjernelse af en deltager (count falder) efterlader en harmløs, ubrugt array-post, der
  aldrig læses igen.

## Del B — Ramp til en tung 5RM

### Formål

I dag bygger `buildStrength` ét fladt sætskema (fx "5×5 @ 78%", samme vægt i alle sæt) for
hovedløftet i styrkedelen, valgt tilfældigt fra `SCHEMES_BEGINNER`/`SCHEMES_TRAINED`
([blocks.ts:174](../../../src/engine/blocks.ts)). Der findes intet skema, hvor vægten
stiger sæt for sæt hen mod et tungt topsæt. Denne del tilføjer det, som **ét ekstra mulige
skema** motoren kan vælge — ikke en erstatning af de eksisterende.

### Kvalificerende øvelser

Kun de seks primære barbell-hovedløft:

- Back Squat (`back_squat`)
- Front Squat (`front_squat`)
- Deadlift (`deadlift`)
- Bench Press (`bench_press`)
- Strict Press (`strict_press`)
- Push Press (`push_press`)

Olympiske/teknisk krævende løft (fx `push_jerk`) og dumbbell-/accessory-varianter (fx
`db_rdl`, `kb_deadlift`, `hip_thrust`, `db_shoulder_press`) er **ikke** kvalificerende —
en tung ramp på teknisk krævende løft er en teknik-/sikkerhedsrisiko snarere end en god
styrke-stimulus i denne apps kontekst.

### Niveaugating

Kun tilgængeligt ved `req.level >= 3` — samme tærskel, der i dag låser
`SCHEMES_TRAINED` op ([blocks.ts:186](../../../src/engine/blocks.ts)). Begyndere
(niveau 1–2) skal ikke rampe mod et tungt topsæt.

### Sætstruktur

5 sæt × 5 reps, stigende belastning på samme grundlag, som motoren allerede beregner pr.
person og niveau (`rawPerUnit`), via de eksisterende procent-baserede
`scaleLoadPct`-kald:

| Sæt | Andel af arbejdsvægt |
|-----|----------------------|
| 1   | 40 %                 |
| 2   | 55 %                 |
| 3   | 70 %                 |
| 4   | 85 %                 |
| 5   | 100 % (tung 5RM)      |

Samme antal sæt/reps og samme pause (150 s) som dagens eksisterende "5×5 @ 78%"-skema —
det samlede tidsforbrug for styrkedelen ændrer sig derfor ikke, og den eksisterende
tidsbudget-logik (`sc.s * (sc.r * main.sec + restSec)`) er fortsat retvisende, blot summeret
over fem separate étsæts-bevægelser i stedet for én bevægelse med fem sæt.

### Udvælgelse

Ramp-skemaet tilføjes til den samme tilfældige pulje, `buildStrength` allerede trækker
fra ([blocks.ts:187](../../../src/engine/blocks.ts)), men kun når hovedløftet er
kvalificerende og niveauet tillader det. For at "jo mere øvet, jo tungere" afspejles i
hyppigheden (ikke kun i selve vægten), vægtes ramp-skemaet tungere ved højere niveau: antal
kopier af ramp-skemaet i puljen = `req.level - 2` (niveau 3 → 1 kopi blandt de eksisterende
~4 flade skemaer, niveau 5 → 3 kopier) — én ekstra parameter til den eksisterende, uniforme
`pick(rnd, schemes)`, ingen ny vægtningsmekanisme.

### Implementering

Én ny valgfri type-udvidelse: `Block.scheme?: 'ramp'`. En ramp bygges som **fem
sekventielle étsæts `Movement`-objekter** (samme øvelse, stigende `pct` via
`buildMovement(..., { reps: 5, pct, restSec: 150, sets: 1, display })`) i stedet for det
nuværende ene flade `Movement` med `sets: 5`. Det genbruger `scaleLoadPct` pr. person
uændret og den eksisterende visning i Result/Program-skærmene, som allerede lister
bevægelser sekventielt ([Result.tsx:285](../../../src/screens/Result.tsx)) — ingen
UI-ændringer nødvendige der. Blokkens `title` sættes til noget i stil med `Styrke · ramp
til tung 5RM` for at adskille den visuelt fra de flade skemaers `Styrke · 5 × 5`.
Accessory-øvelsen ved `min >= 14` tilføjes som i dag, uændret.

**Timeren er den ene reelle undtagelse fra "ingen UI-ændringer":**
`strengthSegments()` i [timerplan.ts:48](../../../src/engine/timerplan.ts) antager i dag,
at en styrkeblok har præcis ét `Movement` (`block.movements[0]`), som gentages
`lift.sets ?? block.rounds ?? 5` gange med samme pause mellem hvert — det er den model,
der matcher et fladt skema, men ikke fem forskelligt vægtede ramp-sæt. Uden en dedikeret
gren ville timeren fejlagtigt vise `movements[0]` (det letteste, 40 %-sættet) fem gange og
reducere resten af rampen til udifferentierede "Tilbehør"-segmenter. Løsningen er det nye
`Block.scheme` felt: `buildTimerPlan` forgrener på `block.kind === 'strength' &&
block.scheme === 'ramp'` til en ny `rampStrengthSegments()`, der viser hvert af de fem
`Movement`-objekter som sit eget sæt (med egen pause efter, undtagen det sidste), og
lægger eventuelle resterende bevægelser (accessory) bagefter som i dag. Ramp-bevægelser
kendes fra almindelige accessory-bevægelser ved, at de altid har både `sets === 1` og
`restSec` sat — accessory-kaldet i `buildStrength` sætter ingen af delene.

### Vægtvisning: eksempel, ikke facit

En reel 5RM er for individuel til, at bodyweight/niveau-skaleringen bør fremstå som en
facitliste — to personer på samme niveau og kropsvægt kan sagtens have en meget
forskellig styrke i akkurat dette løft. De beregnede kilo fra `scaleLoadPct` vises derfor
fortsat (de er stadig et fornuftigt udgangspunkt), men **eksplicit rammet som et
eksempel**, ikke en anvisning:

- Hvert sæts `display`-tekst præfikses med "Eksempel", fx `Eksempel · sæt 1/5 · 5 × Back
  Squat` … `Eksempel · tung 5RM (sæt 5/5) · 5 × Back Squat`.
- `MovementOptions` udvides med et valgfrit `cue?: string`, som — når sat — overskriver
  `buildMovement`s normale `cue` (i dag altid `ex.da`/`warmupCue`,
  [movements.ts:111](../../../src/engine/movements.ts)). Rampens første sæt sætter denne
  til en kort forklaring af, hvad en 5RM er, og at tallene er et eksempel, fx: *"En 5RM er
  den tungeste vægt, du kan løfte i god stil 5 gange i træk — ikke mere. Kilo herunder er
  ét eksempel på en fornuftig stigning; land der, hvor sæt 5 føles tungt, men teknisk
  rent."*
- Blokkens `prescription` opdateres til at nævne, at det er en stigende ramp med et
  eksempel, fx: `5 sæt, stigende vægt · eksempel på en ramp mod en tung 5RM · pause øges
  undervejs`.

### Køn og individuel kropsvægt

Håndteres automatisk: hvert ramp-sæt kalder `scaleLoadPct` pr. person, som allerede bruger
`load.m`/`load.f` og — når Del A er implementeret — den enkelte persons egen kropsvægt og
niveau, ikke et gruppegennemsnit.

## Test

- Eksisterende `App.test.tsx`/`engine.test.ts`-suiter skal fortsat bestå.
- Ny dækning bør bekræfte:
  - Individuel-tilstand: `buildRequest` sender korrekt `people[]` med de rigtige
    kropsvægte og labels; gennemsnit-tilstand sender fortsat `bodyweightM/F/X` som i dag.
  - Ramp-skema: kun tilgængeligt for de seks kvalificerende øvelser ved niveau ≥ 3;
    aldrig valgt for øvrige øvelser eller niveau 1–2; de fem sæt har stigende belastning,
    der ender i "100 %"-sættet; samlet tidsforbrug for styrkedelen matcher det
    eksisterende flade 5×5-skemas.

## Ikke i scope

- Faste kropsvægt-"bånd" (60–70/70–80/80–100 kg) — den eksisterende kontinuerlige
  `bwRatio`-skalering er bevidst bevaret i stedet, da den undgår spring ved bånd-grænser.
  Del A gør blot denne allerede eksisterende skalering individuel i stedet for
  gruppebaseret.
- Ramp-skemaer for andre øvelser end de seks nævnte hovedløft.
- Ændringer til partner-/rotationslogik (`planPartner`) — den håndterer allerede blokke
  med flere bevægelser (jf. accessory-øvelsen i dag) og forventes at fungere uændret med
  fem ramp-bevægelser.
