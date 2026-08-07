# WHATWORK

> Bygget til funktionel fitness.

Dansk, local-first træningsapp til funktionel fitness, partnerworkouts og holdtræning.
Fortæl hvor lang tid I har, hvem der træner, hvilket niveau og hvilket udstyr der står i
salen — så bygger appen en færdig workout med konkrete kilo, skiver, mål, pauser og
arbejdsformer.

Alt sker lokalt på enheden. Der er ingen konto, ingen server og ingen cloud-synk i
kerneflowet. AI er et **valgfrit** variationslag oven på den lokale regelmotor.

## Kom i gang

```bash
npm install
```

```bash
npm run dev
```

Appen kører derefter på **http://localhost:5177**.

| Kommando | Hvad den gør |
| --- | --- |
| `npm run dev` | Udviklingsserver med HMR på port 5177 |
| `npm run build` | Typecheck + produktionsbuild til `dist/` (inkl. service worker) |
| `npm run preview` | Server `dist/` lokalt — brug denne til at teste PWA og offline |
| `npm run lint` | ESLint med typebevidste regler |
| `npm run typecheck` | TypeScript i strict mode |
| `npm test` | Vitest én gang |
| `npm run test:watch` | Vitest i watch-tilstand |
| `npm run icons` | Genrasteriserer app-ikonerne fra `public/icons/icon.svg` |

## Stak

React 18 + TypeScript i strict mode, bygget med Vite. PWA via `vite-plugin-pwa`/Workbox.
Test med Vitest og Testing Library. Ingen UI-framework og intet ikonbibliotek — designsystemet
og alle glyffer er appens egne.

## Arkitektur

```
src/
  engine/          Regelmotoren i TypeScript
    data/          Udstyr, øvelseskatalog og formater
    loads.ts       Skalering, minimumsforslag og skiveberegning
    warmup.ts      Workout-specifik opvarmning og cooldown
    blocks.ts      Hoveddele pr. format
    partner.ts     You go, I go, relay, rotation og udstyrslogistik
    validate.ts    Hard validation, workout-DNA og WW Match
    smartmix.ts    64-kandidat-generatoren og det endelige valg
    timerplan.ts   Timerens segmenter bygget ud fra workouten
  state/           useWhatwork: al app-tilstand, persistering og flow
  screens/         Én fil pr. rute
  components/      Navigation, byggeklodser og udstyrsikoner
  lib/             Lagring, tema, router, formatering, import/eksport, AI-klient
  index.css        Designtokens og komponentklasser
server/
  ai-mix.ts        Server-side AI-endpoint. Kører aldrig i browseren.
api/
  ai-mix.js        Serverless-shim til statiske værter
```

### Motoren

Motoren lå tidligere som utypet `whatwork-engine.js` med en håndskrevet `.d.ts` ved siden af.
Efter udvidelsen med Smart Mix, skiveberegning, partnerprotokoller og timerplan er overfladen
så stor, at en parallel erklæringsfil ville drive fra hinanden uden at det blev opdaget.
Motoren er derfor flyttet til TypeScript i strict mode, og typerne er nu kilden.

**Smart Mix** bygger op til 64 kandidater pr. generering. Hver kandidat køres gennem den
samme hard validator — udstyr, niveau, skånehensyn, volumen på tekniske løft, tidsbudget,
manglende deltagermål og udstyrslogistik. Kandidater med fejl kasseres og vises aldrig.
De tilbageværende scores på WW Match og sammenlignes med historikkens signaturer, så format,
startøvelse og bevægelseskombination ikke gentages.

**WW Match** er en intern, forklarlig kvalitetskontrol med fem delscorer: sikkerhed, tid,
retning, afvikling og variation. Den er ikke videnskabeligt valideret og er hverken en
helbreds- eller præstationsscore.

**Kilo og skiver** skaleres efter profil, kropsvægt og niveau, får et minimumsgulv for
trænede profiler, og snappes derefter til det udstyr, brugeren faktisk har. For vægtstang
vises samlet vægt, stangens vægt og skiver pr. side — fx «50 kg i alt — 20 kg stang +
15 kg på hver side». Alle kilo er programmeringsforslag, ikke præstationskrav.

### Timeren

Timeren bygges direkte ud fra workoutens blokke og øvelser (`buildTimerPlan`). Tiden regnes
ud fra urets faktiske tidspunkter — ikke fra en decrementerende tæller — så den er korrekt
efter genindlæsning eller et skift væk fra appen. Segmenter med fast varighed skifter selv;
åbne segmenter (For Time, Chipper, You go, I go) venter på Næste.

Lyd, haptik, Wake Lock og baggrundsadfærd afhænger af browser og styresystem og er ikke ens
på alle platforme.

## AI Mix (valgfrit)

AI Mix er slået fra som standard. Uden opsætning kører den lokale Smart Mix-generator alene,
og der er ingen reduceret kernefunktionalitet.

### Opsætning

1. Kopiér `.env.example` til `.env.local`.
2. Udfyld **én** af nøglerne:
   - `GEMINI_API_KEY` — anbefalet. Google Gemini har et gratis niveau, der rækker til privat
     brug. Nøgle hentes på <https://aistudio.google.com/apikey>.
   - `OPENAI_API_KEY` — alternativ udbyder. Bruges kun, hvis `GEMINI_API_KEY` er tom.
     `OPENAI_MODEL` kan valgfrit overstyre modellen.
3. Start `npm run dev` igen.
4. Slå **Brug AI Mix** til under Indstillinger.

`.env.local` er i `.gitignore` og bliver aldrig committet.

### Hvorfor der ikke er `VITE_`-prefix

Kun variabler med `VITE_` lægges ind i browserbundlen. Nøglerne her læses udelukkende på
serveren af `server/ai-mix.ts` og kommer aldrig ud til klienten eller i localStorage.
Kaldet går til `/api/ai-mix`, som serveres af Vite-pluginnet i udvikling og `npm run preview`,
og af `api/ai-mix.js` på en serverless-vært.

### Hvad AI må og ikke må

AI må foreslå en schema-låst plan: format, tilladte øvelses-ID'er, bevægelseskombination,
et kort rationale og en variationssignatur. Svaret filtreres mod de lister, appen selv
sendte — først på serveren, dernæst i klienten.

Den lokale regelmotor ejer fortsat den endelige øvelsesliste, alle loads og kilo, skiver,
deltagermål, tidsbudget, udstyrslogistik, sikkerhedsvalidering og WW Match. Der sendes
hverken navn eller kropsvægt — kun de nødvendige constraints og korte historiksignaturer.

Fejler kaldet — ingen nøgle, ingen netværk, timeout eller et svar der ikke består
skemakontrollen — bygger Smart Mix workouten lokalt, og brugeren får det at vide på
workoutsiden.

## Local-first data og PWA

- Data ligger i **IndexedDB** under `whatwork` med et versioneret skema. Findes IndexedDB
  ikke (jsdom, private mode i visse browsere), falder laget tilbage til localStorage med
  samme grænseflade.
- Gemt data fra den tidligere version (`whatwork.v1` i localStorage) migreres automatisk.
  Migreringen omdøber samtidig de gamle, opfundne workoutnavne til workoutens faktiske format.
- Temaet ligger for sig selv i localStorage, så det kan læses synkront i `index.html` før
  første paint. Dark Mode er standard.
- Import og eksport bruger JSON med skemaversion (`whatwork.export.v2`). Ved import ser
  brugeren en preview og skal bekræfte. En fil, der ikke holder, afvises som helhed —
  der skrives aldrig halve datasæt ind over eksisterende data.
- Manifest og service worker genereres ved build. Ikoner i 180, 192 og 512 px plus et
  maskable-ikon. `registerType: 'prompt'` — en ny version installeres i baggrunden, men
  overtager aldrig af sig selv. Brugeren ser «Opdatering klar — hent efter din workout».
- Service workeren kører ikke i `npm run dev`. Test PWA-adfærd med
  `npm run build && npm run preview`.

## Ruter

Alle ruter har en dansk sti og kan åbnes direkte, bogmærkes og deles:

`/velkommen` `/opstart` `/hjem` `/generator` `/bygger` `/workout` `/timer` `/program`
`/historik` `/statistik` `/profil` `/favoritter` `/udstyr` `/indstillinger` `/hjaelp`
`/import-eksport` `/om` `/afsluttet`

## Tilgængelighed

- Ingen vandret hovedscroll ved 320 px og opefter.
- Inputtekst er mindst 16 px; alle trykflader er mindst 44 px, primære mindst 48 px.
- Valgt tilstand markeres altid med mere end farve — baggrund, kant, tekst og en
  eksplicit statuslinje som «Valgt»/«Fra».
- Synlig fokusmarkering på 3 px, korrekte landmarks og headingniveauer, dansk `lang`.
- Dialoger og menuen fastholder fokus, lukkes med Escape og klik udenfor, og giver
  fokus tilbage bagefter.
- Timeren annoncerer ikke hvert sekund til skærmlæsere — kun segmentskift.
- `prefers-reduced-motion` slår animationer fra. Safe-area og `dvh`/`svh` er brugt.

## Kendte afgrænsninger

- **Ingen konto og ingen cloud-synk.** Velkomstskærmen tilbyder kun «Fortsæt uden bruger»,
  fordi det er det eneste, der faktisk er implementeret.
- **Ingen Playwright-suite.** Der er Vitest + Testing Library, inkl. et gennemløb fra
  velkomst til gemt historik, men ingen rigtige browserflows i CI. Kerneflowet er kørt
  manuelt igennem i browser.
- **Lyd og haptik er indstillinger, ikke garantier.** Hvad der faktisk sker, afhænger af
  browser og styresystem.
- **Ikke valideret på fysiske enheder eller af en træningsfaglig person.** Både
  belastningsforslag og afviklingsformer bør gennemgås af en coach, før appen bruges
  til at programmere for andre end en selv.

## Sikkerhed

WHATWORK er en træningsplanlægger — ikke en læge, fysioterapeut eller coach. Appen
diagnosticerer og behandler ikke skader, kender ikke din krop og garanterer ingen
resultater. Skånehensyn er et filter i programmeringen, ikke en medicinsk vurdering.
Tilpas altid til teknik og dagsform, stop ved skarp smerte eller utryghed, og søg
faglig hjælp ved behov.
