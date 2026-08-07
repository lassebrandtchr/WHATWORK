# Individuelle kropsvægte + ramp til tung 5RM — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lad brugeren sætte kropsvægt pr. individuel deltager (i stedet for kun ét
gennemsnit pr. køn), og tilføj et nyt "ramp til en tung 5RM"-sætskema for udvalgte
hovedløft i styrkedelen.

**Architecture:** To uafhængige, sekventielle ændringer i det eksisterende
regelbaserede engine + React-UI: (A) en ny UI-tilstand og tre nye arrays på `GenDraft`,
der — når aktiveret — bygger en eksplicit `Person[]`-liste, som motoren allerede
understøtter via `WorkoutRequest.people`. (B) et nyt sætskema i `buildStrength`, der
bygges som fem separate étsæts-bevægelser i stedet for ét fladt sæt, plus en dedikeret
gren i timerplan-byggeren, som i dag antager præcis én bevægelse pr. styrkeblok.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library, ingen nye afhængigheder.

## Global Constraints

- Ingen nye eksterne npm-pakker.
- Alt brugervendt tekst er dansk, i samme tone som eksisterende copy.
- `GenDraft`-ændringer må ikke ændre opførsel for eksisterende brugere, der aldrig rører
  den nye "Individuel"-switch (gennemsnit-tilstand er uændret standard).
- Ramp-skemaet er kun ét blandt flere mulige udfald — det erstatter aldrig de
  eksisterende flade skemaer, og er kun tilgængeligt ved niveau ≥ 3 for de seks navngivne
  hovedløft (se spec).
- Spec: `docs/superpowers/specs/2026-08-07-individuelle-vaegte-og-5rm-ramp-design.md`.

---

## Task 0: Initialisér git og lav en baseline-commit

Projektet har intet `.git` endnu. Alle senere tasks slutter med en commit, så det skal
være på plads først. `.gitignore` findes allerede og udelukker `node_modules`, `dist`,
`.env*` osv.

**Files:**
- Ingen kodefiler — kun git-metadata.

- [ ] **Step 1: Initialisér repoet**

Run: `git init`
Expected: `Initialized empty Git repository in .../.git/`

- [ ] **Step 2: Sæt default branch til main**

Run: `git branch -M main`

- [ ] **Step 3: Stage og commit hele den nuværende kodebase**

```bash
git add -A
git status
```
Tjek outputtet: der må **ikke** optræde `node_modules/`, `dist/`, `.env` eller
`*.tsbuildinfo` i den stagede liste — hvis der gør, er `.gitignore` ikke blevet
respekteret, og det skal undersøges før commit.

```bash
git commit -m "chore: baseline commit af eksisterende WHATWORK-kodebase"
git log --oneline -1
```
Expected: én commit, arbejdstræet er rent (`git status` viser "nothing to commit").

---

## Task 1: Individuel kropsvægt — datamodel på `GenDraft`

**Files:**
- Modify: `src/types.ts` (`GenDraft`-interfacet, linje 44-65)
- Modify: `src/state/useWhatwork.ts` (`freshGen`, linje 40-64)
- Test: `src/state/useWhatwork.test.ts` (ny fil)

**Interfaces:**
- Produces: `GenDraft.individualWeights: boolean`, `GenDraft.weightsM/F/X: number[]`,
  brugt af Task 2 og Task 3.

- [ ] **Step 1: Skriv den fejlende test**

Opret `src/state/useWhatwork.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { freshGen } from './useWhatwork.js';
import type { UserProfile } from '../types.js';

const profile: UserProfile = {
  name: 'Test', level: 3, sex: 'm', bodyweight: 82,
  equipment: null, counts: {}, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  bars: [20, 15], onboarded: true,
};

describe('freshGen — individuel kropsvægt', () => {
  it('starter i gennemsnit-tilstand med tomme individuelle vægte', () => {
    const g = freshGen(profile);
    expect(g.individualWeights).toBe(false);
    expect(g.weightsM).toEqual([]);
    expect(g.weightsF).toEqual([]);
    expect(g.weightsX).toEqual([]);
  });
});
```

- [ ] **Step 2: Kør testen og bekræft, at den fejler**

Run: `npx vitest run src/state/useWhatwork.test.ts`
Expected: FAIL — `individualWeights`/`weightsM`/`weightsF`/`weightsX` findes ikke på
typen, eller er `undefined` ved runtime.

- [ ] **Step 3: Udvid `GenDraft` i `src/types.ts`**

Find (linje 44-65):

```ts
export interface GenDraft {
  minutes: number;
  men: number;
  women: number;
  neutral: number;
  /** Gennemsnitlig kropsvægt pr. profil. */
  bwM: number;
  bwF: number;
  bwX: number;
  level: LevelId;
```

Erstat med:

```ts
export interface GenDraft {
  minutes: number;
  men: number;
  women: number;
  neutral: number;
  /** Gennemsnitlig kropsvægt pr. profil — bruges i gennemsnit-tilstand og som fallback
   * for enhver deltager, der endnu ikke har fået sin egen vægt i individuel-tilstand. */
  bwM: number;
  bwF: number;
  bwX: number;
  /** Tændt: hver deltager har sin egen kropsvægt i stedet for gruppens gennemsnit. */
  individualWeights: boolean;
  /** Pr. person, indeks-justeret til "Mand 1, Mand 2, …" osv. Kan være kortere end
   * `men`/`women`/`neutral` — manglende indeks falder tilbage til bw-feltet. */
  weightsM: number[];
  weightsF: number[];
  weightsX: number[];
  level: LevelId;
```

- [ ] **Step 4: Initialisér felterne i `freshGen` i `src/state/useWhatwork.ts`**

Find (linje 47-50):

```ts
    bwM: sex === 'm' ? profile.bodyweight : PEER_BODYWEIGHT.m,
    bwF: sex === 'f' ? profile.bodyweight : PEER_BODYWEIGHT.f,
    bwX: sex === 'x' ? profile.bodyweight : PEER_BODYWEIGHT.x,
    level: profile.level,
```

Erstat med:

```ts
    bwM: sex === 'm' ? profile.bodyweight : PEER_BODYWEIGHT.m,
    bwF: sex === 'f' ? profile.bodyweight : PEER_BODYWEIGHT.f,
    bwX: sex === 'x' ? profile.bodyweight : PEER_BODYWEIGHT.x,
    individualWeights: false,
    weightsM: [],
    weightsF: [],
    weightsX: [],
    level: profile.level,
```

- [ ] **Step 5: Kør testen og bekræft, at den nu består**

Run: `npx vitest run src/state/useWhatwork.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck hele projektet**

Run: `npm run typecheck`
Expected: ingen fejl — dette fanger ethvert andet sted, der bygger en `GenDraft` uden de
nye felter (bør ikke være nogen, da `freshGen` er den eneste konstruktør).

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/state/useWhatwork.ts src/state/useWhatwork.test.ts
git commit -m "feat: tilføj individuel kropsvægt-felter til GenDraft"
```

---

## Task 2: Byg `people[]` til motoren, når individuel-tilstand er aktiv

**Files:**
- Modify: `src/state/useWhatwork.ts` (tilføj helper-funktioner nær `participantsOf`,
  linje 66, og opdatér `buildRequest`, linje 356-384)
- Test: `src/state/useWhatwork.test.ts` (udvid filen fra Task 1)

**Interfaces:**
- Consumes: `GenDraft` fra Task 1.
- Produces: `personWeight(g: GenDraft, key: 'M' | 'F' | 'X', index: number): number`,
  brugt af Task 3 (UI) og internt af `buildRequest`.

- [ ] **Step 1: Skriv de fejlende tests**

Tilføj nederst i `src/state/useWhatwork.test.ts`:

```ts
import { personWeight } from './useWhatwork.js';

describe('personWeight', () => {
  it('falder tilbage til gruppens gennemsnit, når personen ikke er individuelt justeret', () => {
    const g = { ...freshGen(profile), bwM: 90, weightsM: [] };
    expect(personWeight(g, 'M', 0)).toBe(90);
  });

  it('bruger den individuelt satte vægt, når den findes', () => {
    const g = { ...freshGen(profile), bwM: 90, weightsM: [78] };
    expect(personWeight(g, 'M', 0)).toBe(78);
    expect(personWeight(g, 'M', 1)).toBe(90);
  });
});
```

- [ ] **Step 2: Kør testen og bekræft, at den fejler**

Run: `npx vitest run src/state/useWhatwork.test.ts`
Expected: FAIL — `personWeight` er ikke eksporteret fra `useWhatwork.ts`.

- [ ] **Step 3: Tilføj `personWeight` og `individualPeople` i `src/state/useWhatwork.ts`**

Find linje 66 (`export const participantsOf = ...`) og indsæt lige efter:

```ts
export const participantsOf = (g: GenDraft): number => g.men + g.women + g.neutral;

export type WeightGroupKey = 'M' | 'F' | 'X';

/** Den vægt, deltager `index` i sin kønsgruppe reelt bruger — egen værdi, hvis den er
 * individuelt justeret, ellers gruppens gennemsnit. */
export function personWeight(g: GenDraft, key: WeightGroupKey, index: number): number {
  const arr = key === 'M' ? g.weightsM : key === 'F' ? g.weightsF : g.weightsX;
  const fallback = key === 'M' ? g.bwM : key === 'F' ? g.bwF : g.bwX;
  return arr[index] ?? fallback;
}

/** Bygger den eksplicitte deltagerliste til motoren, når individuel-tilstand er aktiv.
 * Samme rækkefølge og labelkonvention som `peopleFromMix` i `engine/request.ts`. */
function individualPeople(g: GenDraft): eng.Person[] {
  const people: eng.Person[] = [];
  for (let i = 0; i < g.men; i++) {
    people.push({ label: `Mand ${i + 1}`, profile: 'm', bodyweight: personWeight(g, 'M', i), level: g.level });
  }
  for (let i = 0; i < g.women; i++) {
    people.push({ label: `Kvinde ${i + 1}`, profile: 'f', bodyweight: personWeight(g, 'F', i), level: g.level });
  }
  for (let i = 0; i < g.neutral; i++) {
    people.push({
      label: `Deltager ${g.men + g.women + i + 1}`,
      profile: 'x',
      bodyweight: personWeight(g, 'X', i),
      level: g.level,
    });
  }
  return people;
}
```

`eng.Person` findes allerede — `Person` eksporteres fra `engine/types.ts` via
`export * from './types.js'` i `engine/index.ts`, og `useWhatwork.ts` importerer allerede
`* as eng from '../engine/index.js'` (linje 2), så ingen ny import er nødvendig.

- [ ] **Step 4: Kør personWeight-testene og bekræft, at de består**

Run: `npx vitest run src/state/useWhatwork.test.ts`
Expected: PASS (begge nye tests)

- [ ] **Step 5: Skriv den fejlende test for `buildRequest`-integrationen**

`buildRequest` er en `useCallback` inde i `useWhatwork`-hooket, ikke en selvstændig
eksporteret funktion, så den testes gennem `App`-komponenten. Tilføj i
`src/App.test.tsx` (samme fil, samme mønster som de øvrige `describe`-blokke):

```ts
describe('individuel kropsvægt', () => {
  it('bruger individuelle vægte i workout-anmodningen, når tilstanden er aktiv', async () => {
    seedOnboardedProfile();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Generér workout/ }));
    await user.click(screen.getByRole('button', { name: 'Videre' })); // tid → deltagere
    await user.click(screen.getByRole('button', { name: 'Kvinder: én mere' }));
    await user.click(screen.getByRole('button', { name: 'Videre' })); // deltagere → kropsvægt

    expect(screen.getByRole('heading', { name: 'Kropsvægt' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Individuel' }));

    // Mand 1 er 90 kg som standard (Storgaard-referencen for mænd), justér til 78.
    for (let i = 0; i < 12; i++) {
      await user.click(screen.getByRole('button', { name: 'Mand 1: én færre' }));
    }
    expect(screen.getByText('78 kg')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Kør testen og bekræft, at den fejler**

Run: `npx vitest run src/App.test.tsx -t "individuel kropsvægt"`
Expected: FAIL — knappen "Individuel" findes ikke endnu (den bygges i Task 3). Dette er
forventet på nuværende tidspunkt i planen — testen bekræftes først grønn efter Task 3.
Notér resultatet og fortsæt til Step 7 (selve `buildRequest`-ledningen kan stadig
verificeres af typecheck og af testen i Task 3's Step 6).

- [ ] **Step 7: Opdatér `buildRequest` i `src/state/useWhatwork.ts`**

Find (linje 356-364):

```ts
  const buildRequest = useCallback(
    (draft: GenDraft, extra?: Partial<WorkoutRequest>): WorkoutRequest => ({
      minutes: draft.minutes,
      men: draft.men,
      women: draft.women,
      neutral: draft.neutral,
      bodyweightM: draft.bwM,
      bodyweightF: draft.bwF,
      bodyweightX: draft.bwX,
      level: draft.level,
```

Erstat med:

```ts
  const buildRequest = useCallback(
    (draft: GenDraft, extra?: Partial<WorkoutRequest>): WorkoutRequest => ({
      minutes: draft.minutes,
      men: draft.men,
      women: draft.women,
      neutral: draft.neutral,
      bodyweightM: draft.bwM,
      bodyweightF: draft.bwF,
      bodyweightX: draft.bwX,
      ...(draft.individualWeights && participantsOf(draft) > 1
        ? { people: individualPeople(draft) }
        : {}),
      level: draft.level,
```

- [ ] **Step 8: Commit**

```bash
git add src/state/useWhatwork.ts src/state/useWhatwork.test.ts src/App.test.tsx
git commit -m "feat: byg eksplicit people-liste til motoren i individuel kropsvægt-tilstand"
```

---

## Task 3: UI — switch mellem "Gennemsnit" og "Individuel" på Kropsvægt-trinnet

**Files:**
- Modify: `src/screens/Generator.tsx` (`WeightStep`-funktionen, linje 242-270)
- Test: `src/App.test.tsx` (færdiggør testen fra Task 2, Step 5)

**Interfaces:**
- Consumes: `GenDraft.individualWeights/weightsM/F/X` (Task 1),
  `personWeight` (Task 2, importeres fra `../state/useWhatwork.js`).

- [ ] **Step 1: Erstat `WeightStep` i `src/screens/Generator.tsx`**

Find hele den nuværende funktion (linje 242-270):

```tsx
function WeightStep({ gen, patch }: StepProps) {
  const rows: { key: 'bwM' | 'bwF' | 'bwX'; label: string; count: number }[] = [
    { key: 'bwM', label: 'Gennemsnit mænd', count: gen.men },
    { key: 'bwF', label: 'Gennemsnit kvinder', count: gen.women },
    { key: 'bwX', label: 'Gennemsnit ikke angivet', count: gen.neutral },
  ];
  const active = rows.filter((r) => r.count > 0);
  const solo = participantsOf(gen) === 1;

  return (
    <div className="ww-stack">
      {active.map((r) => (
        <Counter
          key={r.key}
          label={solo ? 'Din vægt' : r.label}
          hint={solo ? 'Bruges til skalering af kropsvægtsøvelser og vægte' : `${r.count} ${r.count === 1 ? 'deltager' : 'deltagere'}`}
          value={`${gen[r.key]} kg`}
          minWidth={72}
          onDown={() => patch({ [r.key]: Math.max(35, gen[r.key] - 1) })}
          onUp={() => patch({ [r.key]: Math.min(200, gen[r.key] + 1) })}
        />
      ))}
      <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
        Kropsvægten bruges kun til at foreslå belastninger. Alle kilo er programmeringsforslag —
        tilpas dem efter teknik og dagsform.
      </p>
    </div>
  );
}
```

Erstat med:

```tsx
function WeightStep({ gen, patch }: StepProps) {
  const rows: {
    key: 'M' | 'F' | 'X';
    genderLabel: string;
    avgLabel: string;
    bwField: 'bwM' | 'bwF' | 'bwX';
    weightsField: 'weightsM' | 'weightsF' | 'weightsX';
    count: number;
  }[] = [
    { key: 'M', genderLabel: 'Mand', avgLabel: 'Gennemsnit mænd', bwField: 'bwM', weightsField: 'weightsM', count: gen.men },
    { key: 'F', genderLabel: 'Kvinde', avgLabel: 'Gennemsnit kvinder', bwField: 'bwF', weightsField: 'weightsF', count: gen.women },
    { key: 'X', genderLabel: 'Ikke angivet', avgLabel: 'Gennemsnit ikke angivet', bwField: 'bwX', weightsField: 'weightsX', count: gen.neutral },
  ];
  const active = rows.filter((r) => r.count > 0);
  const solo = participantsOf(gen) === 1;
  const showIndividual = !solo && gen.individualWeights;

  const setPerson = (weightsField: 'weightsM' | 'weightsF' | 'weightsX', index: number, value: number): void => {
    const next = gen[weightsField].slice();
    next[index] = Math.max(35, Math.min(200, value));
    patch({ [weightsField]: next });
  };

  return (
    <div className="ww-stack">
      {!solo && (
        <div className="ww-wrap" style={{ marginBottom: 4 }}>
          <Chip on={!gen.individualWeights} onClick={() => patch({ individualWeights: false })}>Gennemsnit</Chip>
          <Chip on={gen.individualWeights} onClick={() => patch({ individualWeights: true })}>Individuel</Chip>
        </div>
      )}

      {!showIndividual && active.map((r) => (
        <Counter
          key={r.key}
          label={solo ? 'Din vægt' : r.avgLabel}
          hint={solo ? 'Bruges til skalering af kropsvægtsøvelser og vægte' : `${r.count} ${r.count === 1 ? 'deltager' : 'deltagere'}`}
          value={`${gen[r.bwField]} kg`}
          minWidth={72}
          onDown={() => patch({ [r.bwField]: Math.max(35, gen[r.bwField] - 1) })}
          onUp={() => patch({ [r.bwField]: Math.min(200, gen[r.bwField] + 1) })}
        />
      ))}

      {showIndividual && active.flatMap((r) => Array.from({ length: r.count }, (_, i) => {
        const value = gen[r.weightsField][i] ?? gen[r.bwField];
        return (
          <Counter
            key={`${r.key}-${i}`}
            label={`${r.genderLabel} ${i + 1}`}
            value={`${value} kg`}
            minWidth={72}
            onDown={() => setPerson(r.weightsField, i, value - 1)}
            onUp={() => setPerson(r.weightsField, i, value + 1)}
          />
        );
      }))}

      <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
        Kropsvægten bruges kun til at foreslå belastninger. Alle kilo er programmeringsforslag —
        tilpas dem efter teknik og dagsform.
      </p>
    </div>
  );
}
```

Ingen nye imports nødvendige — `Chip` og `Counter` importeres allerede øverst i
`Generator.tsx` (linje 4), og `participantsOf` allerede fra `../state/useWhatwork.js`
(linje 5).

- [ ] **Step 2: Kør testen fra Task 2 og bekræft, at den nu består**

Run: `npx vitest run src/App.test.tsx -t "individuel kropsvægt"`
Expected: PASS

- [ ] **Step 3: Kør hele test-suiten**

Run: `npm test`
Expected: alle tests bestået, ingen regressioner i eksisterende `App.test.tsx`-tests
(fx testen "beregner deltagerantallet ud fra fordelingen", som ikke rører
Kropsvægt-trinnet).

- [ ] **Step 4: Typecheck og lint**

```bash
npm run typecheck
npm run lint
```
Expected: begge uden fejl.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Generator.tsx
git commit -m "feat: switch mellem gennemsnit og individuel kropsvægt i generatoren"
```

---

## Task 4: `buildMovement` kan få sin `cue` overskrevet

**Files:**
- Modify: `src/engine/movements.ts` (`MovementOptions`, linje 74-85, og
  `buildMovement`, linje 87-119)
- Test: `src/engine/engine.test.ts` (udvid eksisterende fil)

**Interfaces:**
- Produces: `MovementOptions.cue?: string`, brugt af Task 5.

- [ ] **Step 1: Skriv den fejlende test**

Tilføj i `src/engine/engine.test.ts` (fx lige under `describe('opvarmning', ...)`,
linje 225, som en ny top-level `describe`):

```ts
describe('buildMovement — cue-override', () => {
  it('bruger den normale teknik-cue, når intet er angivet', () => {
    const w = build({ minutes: 20, men: 1, level: 3, seed: 1 });
    const m = w.blocks.flatMap((b) => b.movements)[0];
    expect(m?.cue).toBeTruthy();
  });
});
```

Dette er en let regressionstest for standardopførslen (den nye `cue?`-mulighed testes
fuldt ud indirekte via ramp-testene i Task 5, som er den eneste forbruger).

- [ ] **Step 2: Kør testen og bekræft, at den består allerede (baseline)**

Run: `npx vitest run src/engine/engine.test.ts -t "cue-override"`
Expected: PASS — dette bekræfter blot nutidig opførsel, før ændringen. (Ingen "fejlende
test" her, fordi ændringen er additiv og bagudkompatibel — det reelle nye kontrakt-tjek
sker i Task 5's ramp-tests.)

- [ ] **Step 3: Tilføj `cue` til `MovementOptions` i `src/engine/movements.ts`**

Find (linje 74-85):

```ts
export interface MovementOptions {
  reps?: number;
  intensity?: number;
  /** Procentdel af arbejdsvægten — kun på styrkedele. */
  pct?: number;
  sets?: number;
  restSec?: number;
  /** Overskriv den viste tekst, fx "5 × 5 Back Squat". */
  display?: string;
  /** Det samlede arbejde deles mellem deltagerne i stedet for at gælde per person. */
  shared?: boolean;
}
```

Erstat med:

```ts
export interface MovementOptions {
  reps?: number;
  intensity?: number;
  /** Procentdel af arbejdsvægten — kun på styrkedele. */
  pct?: number;
  sets?: number;
  restSec?: number;
  /** Overskriv den viste tekst, fx "5 × 5 Back Squat". */
  display?: string;
  /** Overskriv den normale teknik-cue (`ex.da`) — fx til at forklare en ramp's første sæt. */
  cue?: string;
  /** Det samlede arbejde deles mellem deltagerne i stedet for at gælde per person. */
  shared?: boolean;
}
```

- [ ] **Step 4: Brug `opts.cue` i `buildMovement`**

Find (linje 111):

```ts
    cue: ex.warmupCue ? `${ex.da} ${ex.warmupCue}` : ex.da,
```

Erstat med:

```ts
    cue: opts.cue ?? (ex.warmupCue ? `${ex.da} ${ex.warmupCue}` : ex.da),
```

- [ ] **Step 5: Kør testen igen og bekræft, at den stadig består**

Run: `npx vitest run src/engine/engine.test.ts -t "cue-override"`
Expected: PASS

- [ ] **Step 6: Kør hele engine-suiten**

Run: `npx vitest run src/engine/engine.test.ts`
Expected: alle tests bestået, ingen regressioner.

- [ ] **Step 7: Commit**

```bash
git add src/engine/movements.ts src/engine/engine.test.ts
git commit -m "feat: tillad cue-override i buildMovement"
```

---

## Task 5: Ramp til tung 5RM i `buildStrength`

**Files:**
- Modify: `src/engine/types.ts` (`Block`-interfacet, linje 192-210)
- Modify: `src/engine/blocks.ts` (linje 174-214: konstanter og `buildStrength`)
- Test: `src/engine/blocks.test.ts` (ny fil)

**Interfaces:**
- Consumes: `MovementOptions.cue` (Task 4).
- Produces: `Block.scheme?: 'ramp'`, brugt af Task 6.

- [ ] **Step 1: Tilføj `scheme` til `Block` i `src/engine/types.ts`**

Find (linje 192-210):

```ts
export interface Block {
  id: string;
  kind: BlockKind;
  /** Bloktitel, fx "16 min AMRAP" eller "Opvarmning". */
  title: string;
  format: FormatId | null;
  minutes: number;
  prescription: string;
  movements: Movement[];
  rounds?: number;
  cap?: number;
  /** Sekunder pr. interval for EMOM/E*MOM og interval. */
  everySec?: number;
  workSec?: number;
  restSec?: number;
  partner?: PartnerProtocol;
  /** Kun på opvarmning: "35 sekunders arbejde · 5 sekunders skift". */
  timing?: string;
}
```

Erstat med:

```ts
export interface Block {
  id: string;
  kind: BlockKind;
  /** Bloktitel, fx "16 min AMRAP" eller "Opvarmning". */
  title: string;
  format: FormatId | null;
  minutes: number;
  prescription: string;
  movements: Movement[];
  rounds?: number;
  cap?: number;
  /** Sekunder pr. interval for EMOM/E*MOM og interval. */
  everySec?: number;
  workSec?: number;
  restSec?: number;
  partner?: PartnerProtocol;
  /** Kun på opvarmning: "35 sekunders arbejde · 5 sekunders skift". */
  timing?: string;
  /** Kun på styrkedele: sat til 'ramp', når blokken er en stigende ramp mod en tung 5RM
   * i stedet for det almindelige flade sætskema. */
  scheme?: 'ramp';
}
```

- [ ] **Step 2: Skriv de fejlende tests**

Opret `src/engine/blocks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildStrength } from './blocks.js';
import { normalizeRequest } from './request.js';
import { BY_ID } from './data/exercises.js';
import type { NormalizedRequest } from './types.js';

function req(level: number): NormalizedRequest {
  return normalizeRequest({ minutes: 30, men: 1, level, seed: 1 });
}

const backSquat = BY_ID.back_squat!;
const cleanAndJerk = BY_ID.clean_and_jerk!;

describe('buildStrength — ramp til tung 5RM', () => {
  it('kan vælge ramp-skemaet ved niveau 5 for et kvalificerende løft', () => {
    // rnd() returnerer altid 0.999 → pick() vælger sidste indgang i puljen, som er en
    // ramp-kopi, når niveau ≥ 3 og løftet kvalificerer.
    const rnd = () => 0.999;
    const block = buildStrength(req(5), rnd, 20, backSquat, null);

    expect(block.scheme).toBe('ramp');
    expect(block.movements).toHaveLength(5);
    expect(block.movements.every((m) => m.sets === 1 && m.restSec === 150)).toBe(true);
  });

  it('bygger fem sæt med stigende belastning, der ender i det tunge 5RM-sæt', () => {
    const rnd = () => 0.999;
    const block = buildStrength(req(5), rnd, 20, backSquat, null);
    const kilos = block.movements.map((m) => m.targets[0]?.load?.totalKg ?? 0);

    for (let i = 1; i < kilos.length; i++) {
      expect(kilos[i]).toBeGreaterThanOrEqual(kilos[i - 1] as number);
    }
    expect(block.movements[0]?.display).toContain('Eksempel');
    expect(block.movements[4]?.display).toContain('tung 5RM');
  });

  it('forklarer i cue\'en på første sæt, hvad en 5RM er, og at tallene er et eksempel', () => {
    const rnd = () => 0.999;
    const block = buildStrength(req(5), rnd, 20, backSquat, null);
    expect(block.movements[0]?.cue).toContain('5RM');
    expect(block.movements[0]?.cue).toContain('eksempel');
  });

  it('vælger aldrig ramp-skemaet under niveau 3', () => {
    const rnd = () => 0.999;
    const block = buildStrength(req(2), rnd, 20, backSquat, null);
    expect(block.scheme).toBeUndefined();
    expect(block.movements).toHaveLength(1);
  });

  it('vælger aldrig ramp-skemaet til et ikke-kvalificerende løft', () => {
    const rnd = () => 0.999;
    const block = buildStrength(req(5), rnd, 20, cleanAndJerk, null);
    expect(block.scheme).toBeUndefined();
  });

  it('bruger samme samlede sæt-tid som det tilsvarende flade 5×5-skema', () => {
    // pool[0] er altid det første flade skema i SCHEMES_TRAINED: { s: 5, r: 5, pct: 0.78 }.
    const flat = buildStrength(req(5), () => 0, 20, backSquat, null);
    const ramp = buildStrength(req(5), () => 0.999, 20, backSquat, null);

    const flatTime = flat.movements.reduce((s, m) => s + m.workSec, 0);
    const rampTime = ramp.movements.reduce((s, m) => s + m.workSec, 0);
    expect(flat.title).toContain('5 × 5');
    expect(rampTime).toBe(flatTime);
  });
});
```

- [ ] **Step 3: Kør testene og bekræft, at de fejler**

Run: `npx vitest run src/engine/blocks.test.ts`
Expected: FAIL — `block.scheme` er altid `undefined`, `buildStrength` bygger stadig kun
ét fladt sæt.

- [ ] **Step 4: Tilføj ramp-konstanterne og -builderen i `src/engine/blocks.ts`**

Find (linje 174-175):

```ts
const SCHEMES_BEGINNER = [{ s: 4, r: 6, pct: 0.7 }, { s: 3, r: 8, pct: 0.65 }, { s: 5, r: 5, pct: 0.68 }];
const SCHEMES_TRAINED = [{ s: 5, r: 5, pct: 0.78 }, { s: 5, r: 3, pct: 0.85 }, { s: 4, r: 6, pct: 0.75 }, { s: 3, r: 8, pct: 0.7 }];
```

Erstat med:

```ts
const SCHEMES_BEGINNER = [{ s: 4, r: 6, pct: 0.7 }, { s: 3, r: 8, pct: 0.65 }, { s: 5, r: 5, pct: 0.68 }];
const SCHEMES_TRAINED = [{ s: 5, r: 5, pct: 0.78 }, { s: 5, r: 3, pct: 0.85 }, { s: 4, r: 6, pct: 0.75 }, { s: 3, r: 8, pct: 0.7 }];

/** Hovedløft, det giver mening at ramp'e mod en tung 5RM. Teknisk krævende olympiske løft
 * og tilbehørs-/håndvægtsvarianter er bevidst udeladt — se design-specen. */
const RAMP_ELIGIBLE_IDS = new Set([
  'back_squat', 'front_squat', 'deadlift', 'bench_press', 'strict_press', 'push_press',
]);

/** Stigende andel af arbejdsvægten, 5 reps pr. sæt — sidste sæt er den tunge 5RM. */
const RAMP_STEPS = [0.4, 0.55, 0.7, 0.85, 1];

const RAMP_CUE = 'En 5RM er den tungeste vægt, du kan løfte i god stil 5 gange i træk — '
  + 'ikke mere. Kilo herunder er ét eksempel på en fornuftig stigning; land der, hvor '
  + 'sidste sæt føles tungt, men teknisk rent.';

const RAMP_SCHEME = Symbol('ramp-til-5rm');
type FlatScheme = { s: number; r: number; pct: number };
type SchemeChoice = FlatScheme | typeof RAMP_SCHEME;

function buildRampMovements(main: Exercise, req: NormalizedRequest, rnd: Rng): Movement[] {
  return RAMP_STEPS.map((pct, i) => {
    const isTop = i === RAMP_STEPS.length - 1;
    const display = isTop
      ? `Eksempel · tung 5RM (sæt ${i + 1}/${RAMP_STEPS.length}) · 5 × ${main.name}`
      : `Eksempel · sæt ${i + 1}/${RAMP_STEPS.length} · 5 × ${main.name}`;
    const movement = buildMovement(main, req, rnd, {
      reps: 5,
      sets: 1,
      pct,
      restSec: 150,
      display,
      ...(i === 0 ? { cue: RAMP_CUE } : {}),
    });
    return { ...movement, workSec: 5 * main.sec + 150 };
  });
}
```

- [ ] **Step 5: Omskriv `buildStrength` til at kunne vælge ramp-skemaet**

Find hele den nuværende funktion (linje 178-214):

```ts
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
```

Erstat med:

```ts
export function buildStrength(
  req: NormalizedRequest,
  rnd: Rng,
  minutes: number,
  main: Exercise,
  accessory: Exercise | null,
): Block {
  const min = Math.max(6, Math.round(minutes));
  const flatSchemes = req.level <= 2 ? SCHEMES_BEGINNER : SCHEMES_TRAINED;
  const rampEligible = req.level >= 3 && RAMP_ELIGIBLE_IDS.has(main.id);
  // Ramp-skemaet vægtes tungere ved højere niveau: flere kopier i den samme pulje.
  const rampCopies = rampEligible ? Math.max(1, req.level - 2) : 0;
  const pool: SchemeChoice[] = [...flatSchemes, ...(Array(rampCopies).fill(RAMP_SCHEME) as SchemeChoice[])];
  const sc = pick(rnd, pool) ?? (flatSchemes[0] as FlatScheme);

  if (sc === RAMP_SCHEME) {
    const movements = buildRampMovements(main, req, rnd);
    if (accessory && min >= 14) {
      movements.push(buildMovement(accessory, req, rnd, { intensity: 0.8 }));
    }
    const partner = planPartner(movements, req, 'strength');
    return {
      id: 'strength',
      kind: 'strength',
      title: 'Styrke · ramp til tung 5RM',
      format: 'strength',
      minutes: min,
      prescription: '5 sæt, stigende vægt · eksempel på en ramp mod en tung 5RM · pause øges undervejs',
      movements,
      rounds: RAMP_STEPS.length,
      restSec: 150,
      partner,
      scheme: 'ramp',
    };
  }

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
```

- [ ] **Step 6: Kør testene og bekræft, at de består**

Run: `npx vitest run src/engine/blocks.test.ts`
Expected: PASS (alle 6 tests)

- [ ] **Step 7: Kør hele engine-suiten for at fange regressioner**

Run: `npx vitest run src/engine/engine.test.ts`
Expected: PASS — især `describe('WW Match', ...)` og `describe('timerplan', ...)`, som
begge kan røre styrkeblokke.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: ingen fejl.

- [ ] **Step 9: Commit**

```bash
git add src/engine/types.ts src/engine/blocks.ts src/engine/blocks.test.ts
git commit -m "feat: tilføj ramp-til-tung-5RM sætskema i styrkedelen"
```

---

## Task 6: Ramp-bevidste timersegmenter

**Files:**
- Modify: `src/engine/timerplan.ts` (linje 48-77 og 183-184)
- Test: `src/engine/engine.test.ts` (udvid `describe('timerplan', ...)`)

**Interfaces:**
- Consumes: `Block.scheme` (Task 5), `Movement.sets`/`Movement.restSec` (uændrede,
  eksisterende felter).

- [ ] **Step 1: Skriv den fejlende test**

Tilføj i `src/engine/engine.test.ts`, inde i den eksisterende
`describe('timerplan', ...)`-blok (starter linje 347):

```ts
  it('viser hvert ramp-sæt som sit eget segment med pause imellem, i stedet for at gentage sæt 1', () => {
    let w: Workout | null = null;
    for (let seed = 1; seed <= 300 && !w; seed++) {
      const candidate = build({
        minutes: 30, men: 1, level: 5, seed, format: 'strength' as never,
      });
      const strengthBlock = candidate.blocks.find((b) => b.kind === 'strength');
      if (strengthBlock?.scheme === 'ramp') w = candidate;
    }
    if (!w) throw new Error('fandt ingen ramp-workout i 300 forsøg — undersøg RAMP_ELIGIBLE_IDS/pulje-vægtningen');

    const plan = eng.buildTimerPlan(w);
    const strengthBlock = w.blocks.find((b) => b.kind === 'strength');
    if (!strengthBlock) throw new Error('workouten mangler en styrkeblok');

    const workSegs = plan.segments.filter((s) => s.blockId === strengthBlock.id && s.kind === 'work');
    expect(workSegs).toHaveLength(5);
    const displays = workSegs.map((s) => s.movement?.display);
    expect(new Set(displays).size).toBe(5); // fem forskellige sæt, ikke det samme fem gange

    const restSegs = plan.segments.filter((s) => s.blockId === strengthBlock.id && s.kind === 'rest');
    expect(restSegs).toHaveLength(4); // pause mellem hvert af de 5 sæt, ikke efter det sidste
  });
```

`format: 'strength' as never` — `WorkoutRequest` har ikke et `format`-felt i typen (kun
`focus`), så dette er bevidst ugyldigt og skal fjernes; brug i stedet blot
`{ minutes: 30, men: 1, level: 5, seed }` og lad `build()`'s iteration over seeds finde
et tilfælde, hvor Smart Mix selv vælger et `strength`- eller `strength_cond`-format. Ret
testen til:

```ts
  it('viser hvert ramp-sæt som sit eget segment med pause imellem, i stedet for at gentage sæt 1', () => {
    let w: Workout | null = null;
    let strengthBlock: Block | undefined;
    for (let seed = 1; seed <= 400 && !strengthBlock; seed++) {
      const candidate = build({ minutes: 30, men: 1, level: 5, seed });
      const sb = candidate.blocks.find((b) => b.kind === 'strength' && b.scheme === 'ramp');
      if (sb) { w = candidate; strengthBlock = sb; }
    }
    if (!w || !strengthBlock) {
      throw new Error('fandt ingen ramp-workout i 400 forsøg — undersøg RAMP_ELIGIBLE_IDS/pulje-vægtningen');
    }

    const plan = eng.buildTimerPlan(w);
    const workSegs = plan.segments.filter((s) => s.blockId === strengthBlock!.id && s.kind === 'work');
    expect(workSegs).toHaveLength(5);
    const displays = workSegs.map((s) => s.movement?.display);
    expect(new Set(displays).size).toBe(5);

    const restSegs = plan.segments.filter((s) => s.blockId === strengthBlock!.id && s.kind === 'rest');
    expect(restSegs).toHaveLength(4);
  });
```

- [ ] **Step 2: Kør testen og bekræft, at den fejler**

Run: `npx vitest run src/engine/engine.test.ts -t "ramp-sæt"`
Expected: FAIL — `workSegs` har længde 1 (dagens `strengthSegments` gentager kun
`movements[0]`), eller testen fejler med "fandt ingen ramp-workout", hvis puljens
vægtning ikke giver nok ramp-forekomster inden for 400 forsøg (i så fald: øg loop-loftet
til 800 — Task 5's `rampCopies = level - 2 = 3` ved niveau 5 ud af en pulje på 4 flate +
3 ramp = 7 giver ~43 % chance pr. strength-blok, og de fleste seeds ved `men:1` bør give
et `strength`- eller `strength_cond`-format ofte nok til at finde en match langt inden
400 forsøg).

- [ ] **Step 3: Tilføj `rampStrengthSegments` i `src/engine/timerplan.ts`**

Find (linje 48-77), hele `strengthSegments`-funktionen, og indsæt en ny funktion lige
efter den (efter linje 77, før `conditioningSegments`):

```ts
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
```

- [ ] **Step 4: Forgren i `buildTimerPlan`**

Find (linje 183-184):

```ts
    } else if (block.kind === 'strength') {
      segments.push(...strengthSegments(block));
```

Erstat med:

```ts
    } else if (block.kind === 'strength' && block.scheme === 'ramp') {
      segments.push(...rampStrengthSegments(block));
    } else if (block.kind === 'strength') {
      segments.push(...strengthSegments(block));
```

- [ ] **Step 5: Kør testen og bekræft, at den består**

Run: `npx vitest run src/engine/engine.test.ts -t "ramp-sæt"`
Expected: PASS

- [ ] **Step 6: Kør hele test-suiten**

Run: `npm test`
Expected: alle tests bestået, ingen regressioner (specielt de eksisterende
`describe('timerplan', ...)`-tests for almindelige flade styrkeblokke).

- [ ] **Step 7: Typecheck og lint**

```bash
npm run typecheck
npm run lint
```
Expected: begge uden fejl.

- [ ] **Step 8: Commit**

```bash
git add src/engine/timerplan.ts src/engine/engine.test.ts
git commit -m "feat: dedikeret timer-visning for ramp-til-5RM styrkeblokke"
```

---

## Task 7: Slutverifikation og push til GitHub

**Files:**
- Ingen kodeændringer — kun verifikation og git-remote.

- [ ] **Step 1: Kør hele test-suiten én sidste gang**

Run: `npm test`
Expected: alle tests bestået.

- [ ] **Step 2: Typecheck og lint hele projektet**

```bash
npm run typecheck
npm run lint
```
Expected: begge uden fejl.

- [ ] **Step 3: Byg produktionsbuilden for at fange build-fejl, testene ikke rammer**

Run: `npm run build`
Expected: bygger uden fejl (kører `tsc -b && vite build`).

- [ ] **Step 4: Tilføj GitHub som remote**

```bash
git remote add origin https://github.com/lassebrandtchr/WHATWORK.git
git remote -v
```
Expected: `origin` peger på `https://github.com/lassebrandtchr/WHATWORK.git` for både
fetch og push.

- [ ] **Step 5: Push til main**

```bash
git push -u origin main
```
Expected: alle commits fra Task 0-6 lander på GitHub. Hvis push afvises, fordi remote
allerede har commits (fx en README oprettet via GitHub-UI'et), så kør i stedet:

```bash
git pull --rebase origin main
git push -u origin main
```

- [ ] **Step 6: Bekræft**

```bash
git log --oneline -10
git status
```
Expected: `git status` viser "up to date with origin/main", arbejdstræet er rent.

---

## Self-review — dækning mod specen

- Del A (individuel kropsvægt): datamodel (Task 1), motor-ledning (Task 2), UI (Task 3)
  — dækket.
- Del B (ramp til tung 5RM): kvalificerende løft, niveaugating, sætstruktur, pulje-valg
  med vægtning, "eksempel ikke facit"-copy med 5RM-forklaring (Task 5), timer-integration
  (Task 6) — dækket.
- Git-init og GitHub-push, som brugeren bad om separat — dækket i Task 0 og Task 7.
