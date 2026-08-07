# WHATWORK

## Master PRD & teknisk specifikation

**Version:** 1.5 (gælder produktets V1.0-release)
**Status:** Build-ready source of truth  
**Sprog:** Dansk (brugeroplevelse og produkttekst)  
**Produkt:** Webbaseret Progressive Web App (PWA)  
**Tagline:** *Bygget til funktionel fitness.*

---

## Læsevejledning og beslutningshierarki

Dette dokument er den samlede source of truth for design, produkt, teknik og kvalitet i WHATWORK. Det er skrevet, så både ChatGPT Codex og Claude Code kan bygge produktet uden at udfylde centrale produktbeslutninger selv.

Hvis krav står i konflikt, gælder denne rækkefølge:

1. Brugerens sikkerhed, privatliv, tilgængelighed og korrekt træningslogik.
2. Den konkrete funktionelle specifikation i dette dokument.
3. Mobile-first brugbarhed og offline drift under aktiv træning.
4. Enkel, hurtig og tydelig brugeroplevelse.
5. Visuel identitet og animation.

Ord som “skal” er obligatoriske. Ord som “bør” er den foretrukne løsning; afvigelser skal begrundes i kode/PR-beskrivelse. Eksterne AI-kald må aldrig være nødvendige for normal workout-generering. En “gratis” ekstern tjeneste er aldrig en tilladelse til at sende hemmeligheder eller følsomme brugerdata ud af appen.

---

# 1. Produktvision

WHATWORK er en intelligent, dansk træningsapp til funktionel fitness. Den hjælper mennesker med hurtigt at få en velprogrammeret træning, der passer til deres tid, niveau, deltagere, kropsvægt, udstyr, dagsform og tidligere træning.

Produktet er ikke en kopi af CrossFit, HYROX, WHOOP, Strava eller en traditionel styrketræningslog. WHATWORK kombinerer funktionel fitness, klassisk styrke, olympiske løft, kondition, løb, ergonomaskiner, carries, gymnastics og bodyweight i én rolig, selvsikker oplevelse.

Det centrale løfte er simpelt:

> Fortæl hvad du har af tid, hvem der træner, og hvilket udstyr der er. WHATWORK finder en workout, der giver mening.

Systemet må gerne være avanceret. Brugeren må ikke mærke kompleksiteten som formulartræthed eller teknisk sprog.

## 1.1 Primære jobs-to-be-done

1. “Jeg vil træne nu, men mangler en god workout.”
2. “Vi er flere og har kun ét par maskiner – lav noget, der faktisk kan afvikles.”
3. “Jeg vil gerne have noget tungt, men ikke ødelægge min lænd eller mine skuldre.”
4. “Jeg vil have et program over flere uger med variation og progression.”
5. “Jeg vil kunne se, hvad jeg har lavet, og om jeg flytter mig.”
6. “Jeg vil kunne bruge min telefon under træningen – også hvis nettet forsvinder.”

## 1.2 Målgruppe og niveauer

WHATWORK er for voksne, der vil træne funktionelt – alene, med en partner eller i en lille gruppe. Den skal fungere for begyndere uden at tale ned til dem og for øvede/avancerede uden at blive banal.

Niveauer:

- **Begynder** – sikre, lette varianter, få komplekse bevægelser, tydelige pauser.
- **Let øvet** – grundlæggende barbell- og konditionsarbejde, moderat volumen.
- **Øvet** – bredere bevægelsesbibliotek, mere tæthed og kombinationer.
- **Avanceret** – højere volumen/intensitet, komplekse sammensætninger når passende.
- **Elite** – brugerens egne benchmarks og stærke kapacitet kan danne grundlag for præcis skalering.

Niveau er en programmeringsparameter, ikke en vurdering af brugerens værdi.

## 1.3 Første versions afgrænsning

V1 skal levere: konto/gæst, onboarding, single-workout generator, programmer, timer, gemte workouts, historik, grundlæggende statistik, offline-first, import/eksport og den fulde regelbaserede engine.

V1 skal ikke være et socialt netværk, et kostsystem, en medicinsk rådgiver eller afhængig af abonnements-AI. Wearables, live holdskærm, avanceret cloud-synk og AI-coaching kan bygges senere på det samme fundament.

---

# 2. Brand og tone

## 2.1 Karakter

WHATWORK skal føles **kraftfuld, hurtig, atletisk, enkel, premium og let drilsk**. Ikke aggressiv på en macho-måde og ikke som et køligt SaaS-dashboard. Produktet må have humor, men aldrig på bekostning af tydelighed eller sikkerhed.

Al brugerrettet tekst er på naturligt dansk. Almindelige internationale øvelsesnavne og træningsformater beholdes: AMRAP, EMOM, SkiERG, RowERG, Power Clean, Snatch osv.

## 2.2 Visuel retning

- Mørk charcoal som primær base, fx `#0E0F11`; aldrig et fladt rent sort univers.
- Flader: `#15171A` og `#1D2024` med diskret separation.
- Primær accent: varm orange, fx `#FF5A1F`.
- Sekundær accent: performance-rød, fx `#FF3B30` / mørkere `#D92D20`.
- Primær tekst: varm off-white, fx `#F5F2ED`; dæmpet tekst `#A6A8AD`.
- Grøn må kun bruges til succes/fuldført, rød kun til advarsel/krævende status – ikke som pynt.

Orange/rød bruges sparsomt til aktive valg, primære handlinger, timer, intensitet og små branddetaljer. Ingen overdrevet glassmorphism, puffy kort, hero-billeder af fitnessmodeller eller generiske fitnessikoner.

### 2.2.1 Signatur-CTA: Generér workout

**Generér workout** er appens vigtigste handling og skal være visuelt umulig at overse uden at blive skrigende. Den får sin helt egen `Action Ember`-farve: en lys, varm mandarin-orange (`#FF6A21`) med en kontrolleret rød kant/skygge (`#C83B13`) på de mørke flader. Denne kombination må kun bruges til handlingen, der faktisk starter generation, og til dens fokuserede/aktive tilstande – aldrig til almindelige links eller sekundære knapper.

- Knappen skal være stor, med markant men raffineret typografi, et eget WHATWORK-glyph og tydelig label: **Generér workout**.
- Ved hover/fokus/tryk må den føles fysisk responsiv med meget kort bevægelse og synlig fokusramme; den må ikke blinke eller ligne et casino-element.
- På mobil ligger den i tommelfingerzonen på hjemskærmen; på desktop er den den klare visuelle ankerhandling i indholdet, ikke gemt i topmenuen.
- Kontrast og fokus testes selvstændigt. Farven må ikke være eneste signal: teksten, glyphen og tilstanden fortæller også, hvad der sker.
- Ikonet inde i knappen skal være et unikt WHATWORK-SVG, fx et W-monogram der samles til en fremadgående markør – ikke et importeret “play”-, stjerne- eller sparkle-ikon.

## 2.3 Logo, wordmark og monogram

Primært brand er det typografiske wordmark **WHATWORK**. Det skal være originalt, læsbart og fungere monokromt. Retningen er en stærk, redaktionel serif med Apple Garamond-inspireret elegance: brede former, tydelig kontrast og høj selvtillid.

- Apple Garamond må kun anvendes som visuel reference, hvis en gyldig licens er til stede.
- Fonten må aldrig pakkes, distribueres eller rekonstrueres ulovligt.
- Brug i stedet en kommercielt sikker/open-source serif eller et originalt custom wordmark.
- Tilpas især de to W’er med en fælles, genkendelig detalje (fx en kontrolleret indre vinkel eller terminal). Undgå gimmicks.
- Et separat **W** eller **WW** monogram skal dele samme geometri og kunne bruges som app-ikon, avatar og loading-markør.
- Ingen håndvægte i bogstaver, flammer, muskler, lyn eller barbell-clipart.

## 2.4 Custom glyph/icon-system

Kerneikoner må ikke ligne et tilfældigt mix af biblioteker. Byg et lille, eget SVG-baseret glyph-system med ens stregvægt, afrunding og optisk størrelse. Det skal dække mindst navigation, indstillinger, timer, gem, del, historik, program, profil, udstyr, plus/minus, luk, pil og “overrask mig”.

Ikoner ledsager altid tekst i primær navigation. De skal have tilgængelige labels og aldrig være eneste måde at forstå en kernefunktion på. **Alle** produktikoner, illustrationelle symboler og states skal tegnes specifikt til WHATWORK som egne SVG-assets; der må ikke importeres Lucide, Heroicons, Font Awesome, emoji eller anden ikonpakke som færdigt UI. Kun standardiserede teknik-/brandkrav, der reelt kræver et tredjepartsmærke, er undtagelser.

## 2.5 Dansk microcopy

Eksempler på tone – brug samme stil, men varierende og situationspassende:

- “Hvad skal vi træne?”
- “Byg en workout, der passer til i dag.”
- “Overrask mig”
- “Finder noget tungt …”
- “Blander lidt cardio …”
- “Tilføjer dårlige beslutninger …”
- “Så er den der.”
- “Gør den lettere” / “Gør den værre”
- “Gem til en anden dag”
- “Ingen workouts endnu. Det er let at ændre.”
- “Du er klar. Tryk start, når du er.”
- “Hvad betyder EMOM?”
- “Start arbejdet ved hvert nyt minut. Resten af minuttet er din pause.”

Undgå engelske UI-ord som “submit”, “settings”, “dashboard”, “save changes” og AI-sprog som “jeg har optimeret din prompt”. Brug ikke sundheds- eller præstationspåstande, som appen ikke kan dokumentere.

---

# 3. Platform, arkitektur og driftsprincipper

## 3.1 PWA, web og mobile-first

WHATWORK skal bygges som en moderne webapp og Progressive Web App – ikke som en native iOS-app. Den åbner via en almindelig webadresse og kan installeres på kompatible iOS- og Android-enheder.

Krav:

- Web App Manifest med navn, kort navn, ikoner, theme color og `display: standalone`.
- Service worker og versioneret cache-strategi.
- App-shell, øvelsesdatabase, regelmotor, aktive workouts og senest viste data skal fungere offline efter første indlæsning.
- Start hurtigt på middelklasse-mobil og undgå afhængighed af netværk under en aktiv workout.
- Touch-first mål på mindst 44 × 44 CSS px; respekter safe areas.
- Ingen funktion må kun virke ved mouse hover.

### 3.1.1 Touch-first som produktkrav

Mobil er ikke en nedskaleret desktop-udgave. WHATWORK skal være behagelig og sikker at bruge med én tommelfinger på iPhone og Android – også midt i en workout, med svedige hænder og uden præcis musemarkør.

- Alle primære touch-handlinger har en faktisk træfflade på mindst **48 × 48 CSS px**; ikonknapper, tabs, stepper-kontroller og luk-handlinger mindst 44 × 44 CSS px. Der er mindst 8 CSS px fri afstand mellem selvstændige touch-mål.
- Den visuelle flade må gerne være mindre end træffladen, men træffladen må aldrig overlappe en nabohandling. Hele kortet må kun være trykbart, hvis det ikke skjuler separate knapper indeni.
- Den primære handling skal ligge inden for naturlig tommelfingerrækkevidde: på Hjem og i generatoren som tydelig bundforankret CTA; i Timer Mode som stor kontrol i den nederste del af skærmen. Respekter `env(safe-area-inset-*)`, dynamisk mobilbrowser-chrome og liggende visning.
- Touchfeedback er umiddelbar: synlig pressed-state, klar loading-state og deaktivering mod dobbelttryk, så én berøring aldrig kan starte to genereringer, to synks eller to timers. Feedback må ikke kun være farve eller haptik.
- Brug ikke hover, højreklik, præcis drag-and-drop, små "X"-rammer eller swipe som eneste løsning. Swipe kan bruges som genvej, men den samme handling skal altid kunne udføres med en synlig knap og tastatur.
- Formularer bruger de rigtige mobile inputtyper (`number`, decimal keypad hvor relevant), mindst 16 CSS px tekst i tekstfelter for at undgå uønsket iOS-zoom, tydelige labels og en fast, synlig fejl tæt ved feltet. Autocomplete og autocorrect må ikke forvanske øvelsesnavne eller tal.
- Scroll må ikke kæmpe med horisontale carouseller. Drag, pinch-zoom og systemets tilbage-gestus må ikke utilsigtet afslutte, slette eller ændre en workout.
- Lyd og haptik er frivillige supplementer med lokal indstilling og en tydelig visuel/tekstlig pendant. Ingen funktion afhænger af vibration, lyd eller Wake Lock.
- Destruktive handlinger på touch – slet, nulstil, afslut aktiv workout eller skift workout – kræver en forståelig bekræftelse. Stop/afslut i Timer Mode skal ikke kunne udløses af et enkelt utilsigtet tryk.
- Testes på fysisk iPhone med aktuel Safari og fysisk Android-telefon med aktuel Chrome. Device-emulering er et supplement, ikke et bevis på touch-kvalitet.

## 3.2 Anbefalet stack

Dette er den anbefalede, konkrete v1-stack. Der må kun afviges, hvis den erstattende løsning opfylder samme sikkerheds-, PWA- og driftskrav og beslutningen dokumenteres.

| Lag | Valg | Rolle |
|---|---|---|
| Klient | React + TypeScript i strict mode, bygget med Vite | Hurtig, statisk PWA uden krav om en konstant server. |
| PWA | `vite-plugin-pwa`/Workbox med eksplicit cache-versionering | Manifest, service worker og offline app-shell. |
| Lokal data | IndexedDB via Dexie eller en tynd intern adapter | Primær datalagring for gæst, timer, workout-data og cache. |
| Validering | Zod eller tilsvarende schema-validering | Én kontrakt for formularer, imports, øvelsesdata og API-grænser. |
| Test | Vitest + Testing Library + Playwright | Domain, komponent og reelle mobil-/desktopflows. |
| Hosting | Vercel som statisk CDN-deploy | HTTPS, preview-deployments og rollback. Vercel er ikke et krav for lokal/offline brug. |
| Valgfri konto/cloud | Supabase Auth + Postgres + Storage | Kun ved aktiveret konto/synk; gæsteflowet må aldrig afhænge af det. |
| Valgfri LLM-bro | Server-side Vercel Function **eller** Supabase Edge Function | Kun for den valgfri AI-assistent; aldrig fra browseren. |

- Feature-baseret struktur, fx `features/generator`, `features/timer`, `features/history`, `domain/workout-engine`, `data/exercises`.
- Pure, testbare domain-funktioner uden UI-afhængighed.
- Ingen tung state management uden behov; hold persisted data og transient UI-state klart adskilt.
- CSS med design tokens; undgå inline style-spredning og tilfældige pixelværdier.
- Git-repository, låst dependency-fil og automatiseret CI er obligatorisk. GitHub Actions eller en tilsvarende CI må kun bruge gratis tier/egen runner, hvis der er nulbudget-krav.

### 3.2.1 Beslutning om Vercel og Supabase

**Vercel anbefales** til v1-hosting, fordi den statiske PWA kan deployes uden en driftsserver. Brug kun den plan, der er gratis på implementeringstidspunktet, og sæt forbrugs-/projektgrænser, så en betalt opgradering aldrig sker automatisk. Hvis Vercels gratis betingelser ikke passer, skal appen kunne flyttes til en almindelig statisk host uden kodeændring i domain-laget.

**Supabase er valgfrit, men anbefalet når konti og synk realiseres.** Det må ikke initialiseres som en forudsætning for at åbne, generere, time eller gemme en workout som gæst. Brug kun den tilgængelige gratis tier, og dokumentér dens konkrete kvoter ved release. Hvis projektet pauses, rammer en quota eller gratis vilkår ændres, fortsætter appen lokalt og viser “Cloud-synk er midlertidigt utilgængelig. Dine data på denne enhed er sikre.”

Supabase-klientens **publishable key** og projekt-URL er med vilje offentlige klientkonfigurationsværdier; de er ikke hemmeligheder og kan ses i browseren. De er kun forsvarlige sammen med korrekt Row Level Security (RLS). En `sb_secret_...`/`service_role`-nøgle er en hemmelighed og må aldrig findes i kildekode, browserbundle, PWA-cache, log, preview-build eller klientmiljøvariabel.

## 3.3 Billig/gratis drift

Normal drift må være mulig med statisk hosting og gratis/meget generøse niveauer. Standardgeneratoren skal være lokal og deterministisk nok til at fungere helt uden server.

- Ingen obligatoriske OpenAI-, Claude-, Gemini- eller andre LLM-kald pr. workout.
- Ingen always-on server som forudsætning.
- Hosting: statisk deploy på en robust CDN-platform.
- Backend er valgfri og bruges kun til konto/cloud-sync, hvis det implementeres.
- Brug kontrollerbare, åbne dataformater til eksport og backup.

## 3.4 Valgfrit LLM-lag – nulomkostningsprincip

LLM må gerne bruges som et **valgfrit, afgrænset supplement**, fx til at formulere en kort dansk forklaring til en allerede valideret workout eller forstå en frivilligt indtastet fri tekst. LLM må ikke vælge øvelser, ændre skalering, omgå validatorer, styre timeren eller være eneste vej til et resultat. Den regelbaserede motor er altid autoriteten.

Der findes ingen evig garanti for gratis API-kald: modeller, kvoter, regioner og priser ændres. Derfor er dette den bindende politik:

1. `LLM_MODE=off` er produktets standard. En fuld workout kan altid genereres lokalt uden login, nøgle, netværk eller omkostning.
2. Første mulige adapter er **Gemini Developer API Free Tier**, men kun når projektet ikke har knyttet betalingsprofil, den valgte model eksplicit er gratis på kaldtidspunktet, og den aktuelle kvote kan håndtere kaldet. OpenAI, Claude eller andre udbydere må kun aktiveres, hvis de på implementeringstidspunktet tilbyder en ægte gratis API-tier uden krav om betalingsprofil; et ChatGPT- eller Claude-abonnement tæller ikke som gratis API-adgang.
3. Appen må aldrig registrere betalingskort, knytte billing, skifte til paid tier, retrye mod en betalt model eller automatisk falde tilbage til en betalt udbyder. Hvis gratis kvote mangler, svarer den: “Den frivillige AI-hjælp er ikke tilgængelig lige nu. Din workout er stadig klar.”
4. Hver LLM-adapter skal have en statisk allowlist af gratis model-ID’er, en global nødafbryder, per-bruger/IP-rate-limit, maksimal input-/outputlængde, hård dagskvote og telemetry uden promptindhold. En ændring af model eller prisstatus kræver manuel release, ikke en runtime-konfiguration fra klienten.
5. Intet LLM-kald må gå direkte fra browseren. Serverfunktionen verificerer session og opt-in, normaliserer input, fjerner persondata/frit tekstindhold som ikke er nødvendigt, udfører schema-validering af svaret og sender kun en ufarlig, kort derived output tilbage.
6. Før aktivering vises dansk samtykke: “Valgfri AI-hjælp sender kun det nødvendige til en ekstern tjeneste. Din workout virker også uden.” Ved gratis tiers må der aldrig sendes navn, e-mail, kropsvægt, køn, historik, skån-tags, fritekst eller andre følsomme data. Brug en anonymiseret, minimal workoutrepræsentation – eller lad være med at kalde tjenesten.
7. Appen skal behandle 429, timeout, netfejl, content-filter og ugyldigt output som forventede tilstande. De må ikke blokere workouten, eksponere leverandørfejl eller skabe en ny regning.

Gemini har på dokumentdatoen en gratis tier for udvalgte modeller, men med begrænsede og foranderlige rate limits. Dens gratis vilkår skal gennemgås igen lige før release. Dette er en valgfri produktbeslutning, ikke et løfte om livslang gratis drift.

## 3.5 Offline-first og synkronisering

Lokal IndexedDB er source of truth på enheden. Hver ændring får et UUID, `updatedAt`, en data-model-version og en synk-status. Hvis cloud-synk er tilsluttet, sendes ændringer køvis, når forbindelsen vender tilbage.

Konflikter løses per objekt: seneste opdatering vinder for simple præferencer; en workout completion er append-only og må aldrig overskrives af en anden completion. Vis en kort, menneskelig status: “Gemt på denne enhed” eller “Synkroniseret”.

Cache må ikke gøre gamle engine-regler usynligt gældende. Versionér øvelsesdata og regler; aktive/gemte workouts bevarer altid den version, de blev genereret med.

---

# 4. Information architecture og navigation

## 4.1 Primære områder

Kerneområder:

1. **Hjem** – hurtig start, seneste og overrask mig.
2. **Program** – aktive og oprettede træningsprogrammer.
3. **Historik** – gennemførte, gemte og favoritter.
4. **Profil** – brugerdata, statistik, indstillinger og eksport.

Workout-generatoren åbner fra Hjem som en tydelig primær handling, men har egen URL/rute, så flowet er genoptageligt og deep-linkbart.

## 4.2 Mobilnavigation

På mobil bruges en fast bundnavigation med tekst og custom glyphs: Hjem, Program, Historik og Profil. Workout-generatoren er den fremhævede handling på Hjem i stedet for en femte uklar tab.

En menu/drawer fra headeren giver adgang til sekundære sider: Favoritter, Udstyr, Indstillinger, Hjælp, Import/eksport og Om WHATWORK. Drawer skal kunne lukkes med knap, Escape, swipe hvor naturligt og ved at trykke udenfor; fokus skal holdes korrekt.

## 4.3 Desktopnavigation

På desktop (fra ca. 1024 px) vises en egentlig topmenu:

- Venstre: wordmark og hjemlink.
- Midte: Hjem, Generér workout, Program, Historik, Statistik.
- Højre: profilmenu med navn/monogram og sekundære handlinger.

Topmenuen er tydelig, rolig og sticky uden at optage unødig højde. Desktop er ikke bare en bred mobilskærm: generatorens valg kan vises i to kolonner, og workout-resultatet kan have et fast action-panel. Mobilens rækkefølge og fokus skal stadig bevares.

## 4.4 Responsive regler

- 320–767 px: én kolonne, bundnavigation, fuldbredde handlinger.
- 768–1023 px: mere luft, 2-spaltede valglister når de er lette at scanne.
- 1024 px+: topmenu, max-indholdsbredden ca. 1200–1280 px, mere information uden tæt dashboard-følelse.
- Store tal, workout-kort og timer må ikke blive så brede, at læsning under træning bliver svær.
- Respekter `prefers-reduced-motion`, zoom til 200 %, tekstforstørrelse og liggende mobil.

## 4.5 Adaptivt layout og aspect-ratio-kontrakt

WHATWORK skal fungere elegant på reelle viewport-størrelser og aspect ratios — ikke blot på nogle få kendte telefonmodeller. Målet er ikke at foregive pixelidentiskhed på enhver fremtidig enhed, men at alle kerneflows altid er læsbare, betjenbare og uden skjult eller overlappende indhold.

- Byg med fluid CSS (`minmax`, `clamp`, fleksible grids og indholdsbaserede højder), ikke faste skærmbredder eller skrøbelige device-detekteringer.
- Brug moderne viewport-enheder med fornuftig fallback (`dvh`/`svh` efter kontekst), aldrig kun `100vh`. Bundnavigation, sticky CTA’er og Timer Mode må ikke havne bag mobilbrowserens adresselinje, home indicator eller soft keyboard.
- Respekter alle `safe-area-inset-*`-værdier. Løsningen skal fungere i kompakt portræt, høj portræt, bred telefon, liggende telefon, iPad split view, resizable desktopvindue og ultrabred desktop uden vandret hovedscroll.
- Indholdets rækkefølge er stabil på tværs af breakpoints: ingen kritisk information forsvinder, flytter bag hover eller bliver visuelt adskilt fra den handling, den hører til. Sidepaneler bliver til sektioner/drawer på smalle flader; de må ikke bare klippes væk.
- Minimumsbaseline er 320 CSS px bredde. Test mindst: 320 × 568, 375 × 667, 390 × 844, 414 × 896, 768 × 1024, 1024 × 768, 1280 × 800, 1440 × 900 samt en ultrabred/resizable desktopbredde. Test hver i relevant portræt/landskab, med browserzoom og ved åbent virtuelt tastatur.
- I Timer Mode må tid, aktiv øvelse og primær kontrol altid være synlige samtidig i både portræt og landskab. Ikke-kritiske detaljer kan foldes sammen; controls må ikke overlappe eller kræve horisontal scrolling.
- Brug container queries, hvor komponentens egen bredde er vigtigere end vinduets bredde. Overhold `prefers-reduced-motion`, systemets tekstskalering og mindst 200 % browserzoom uden funktionsbrud.

---

# 5. Konto, gæst, onboarding og profil

## 5.1 Login og gæstetilstand

Første skærm giver to ligeværdige veje: **Opret konto / Log ind** og **Fortsæt uden bruger**. Gæstetilstand må ikke være en fattet prøveversion; den kan generere, gemme lokalt, bruge timer, historik og program.

Konto kan bygges med en moden auth-løsning med gratis/lav pris. Implementér aldrig egne password-hashes eller kryptografi. Understøt mindst e-mail magic link eller passkey/social login, afhængigt af valgt provider.

Ved oprettelse af konto skal gæsten kunne vælge “Flyt mine lokale data med”. Vis hvad der flyttes og behold en lokal backup, indtil synk er bekræftet.

## 5.2 Kort onboarding

Spørg kun om det nødvendige og tillad ændring senere:

1. Niveau.
2. Køn / skaleringsprofil (kvinde, mand, selvvalgt/anden eller “brug standardforslag manuelt”).
3. Kropsvægt i kg (valgfrit, men forklarer bodyweight scaling).
4. Normalt tilgængeligt udstyr.

Afslut med **Start WHATWORK**. Spring over skal være muligt, og manglende data må give konservative defaults frem for blokering.

## 5.3 Profil

Toppen af profilen viser ét stort, motiverende tal: fx **247 workouts gennemført**. Dernæst vises niveau, aktive præferencer og sidste træning, uden at gøre skærmen til et dashboard.

Profil understøtter: navn/initialer, skaleringsprofil, kropsvægt, niveau, egne benchmarks, udstyr, lyd/haptik-præferencer, privatliv, eksport/import og sletning af lokale data/konto efter gældende databehandling.

---

# 6. Centrale brugerflows

## 6.1 Hjem

Hjem svarer straks på “Hvad skal vi træne?” og indeholder:

- Wordmark og tagline (bruges sparsomt, ikke på alle skærme).
- Stor signatur-CTA: **Generér workout** med `Action Ember`-farven og det unikke WHATWORK-glyph.
- Sekundær stor CTA: **Lav træningsprogram**.
- Signaturhandling: **Overrask mig**.
- Diskret blok: seneste workout / fortsæt aktiv workout.
- Denne uge i én rolig linje, ikke en mur af KPI’er.

## 6.2 Generér workout – progressivt flow

Flowet skal føles som en kort samtale, ikke en stor formular. Defaultværdier fra profil skal udfyldes, og avancerede valg skjules bag “Tilpas workout”. Brugeren kan gå frem/tilbage uden at miste valg.

1. **Tid** – 10, 15, 20, 25, 30, 40, 45, 60, 75, 90 min. plus brugerdefineret. Tiden betyder hele sessionen som standard.
2. **Deltagere** – 1–10; vis Solo, Partner eller Hold.
3. **Hvem træner?** – antal mænd/kvinder/andre skaleringsprofiler; summen skal validere mod antal deltagere.
4. **Kropsvægt** – solo: individuel kg. Flere: gennemsnit per skaleringsprofil og valgfri “Tilpas deltagere” med individuelle vægte.
5. **Niveau og fokus** – niveau + Kondition 1–10 + Styrke 1–10. Valgfrit: Allround, Puls, Tung, Ben, Overkrop, Engine, Hurtig & brutal, Lang & sej.
6. **Udstyr og antal** – vælg udstyr og disponible antal/weights.
7. **Øvelsesretning** – kategorier, ønskede/udelukkede øvelser, skån område, eller Overrask mig.
8. **Generér** – output med kort forklaring af valg og mulighederne Gør den lettere/værre/Ny workout/Gem/Del/Start.

Opvarmning og cooldown er slået til som default og kan slås fra. Ved fx 45 min fordeler motoren typisk 6 min opvarmning, 32 min hoveddel, 4 min cooldown og 3 min buffer/overgange. Brugeren skal altid kunne se den reelle estimerede tidsfordeling.

## 6.3 Deltagere, kønsfordeling og individuel scaling

For grupper er kønsfordeling og individuelle kropsvægte input til konkrete skaleringer – ikke til antagelser om evne. Eksempel:

- 4 deltagere: 2 mænd, 2 kvinder.
- Standardinput: gennemsnit mænd 88 kg, gennemsnit kvinder 66 kg.
- Avanceret: Mand 1 92 kg, Mand 2 81 kg, Kvinde 1 63 kg, Kvinde 2 70 kg.

Enhver deltagers workout-kort skal kunne vise en individuelt relevant vægt, variant eller rep-mål. Ved shared work skal systemet beskrive præcis, hvad der deles, og hvad der er per person.

## 6.4 Overrask mig

Overrask mig bruger profilens sikre defaults, seneste fatigue/variation, normalt udstyr og en fornuftig tid (fx 30 min, hvis ingen præference findes). Funktionen må generere med ét tryk, men skal vise og respektere aktuelle begrænsninger såsom “skån skuldre”. Den kan ikke omgå valgte eksklusioner.

## 6.5 Resultat og redigering

Det genererede resultat er en læsbar træningsbriefing med navn, format, estimeret varighed, opvarmning, styrke-del hvis relevant, conditioning-del, vægte/skalering og praktiske holdinstruktioner.

Brugeren kan:

- **Start workout**.
- **Gør den lettere** – sænker udfordring med forklarlig ændring.
- **Gør den værre** – øger udfordring uden at bryde safety-regler.
- **Ny workout** – ny seed/variation med samme constraints.
- **Gem**, favoritmarkere, dele en tekst/screenshot-sikker workout-briefing.
- Redigere enkelte øvelser med kompatible erstatninger; ændringen kører validatoren igen.

## 6.6 Forklar mens du træner: format- og instruktionshjælp

Ingen bruger må skulle kende funktionel fitness-terminologi på forhånd. Alt, der kan ændre hvordan workouten udføres, skal forklares direkte dér, hvor det står. Det gælder især formatnavne, tidsenheder, scoring, scaling, stationer, rotationsregler, caps og øvelser.

- Hvert formatnavn som **AMRAP**, **EMOM**, **E2MOM**, **For Time**, **Interval**, **cal**, **RPE**, **cap** og **shared work** har en tilstødende, unik WHATWORK-info-glyph. Glyphen har altid tilgængeligt navn, fx `aria-label="Forklaring af EMOM"`, og mindst 44 × 44 CSS px træfflade på touch.
- Et tryk åbner en kort forklaring i en bundsheet på mobil og en tilgængelig popover eller sheet på større skærme. Det må aldrig være en hover-only tooltip, en ekstern artikel eller en LLM-afhængig forklaring.
- Forklaringen følger den samme faste struktur: **Hvad betyder det?**, **Hvad gør du nu?**, **Hvordan er du færdig?** og, hvor relevant, et mini-eksempel. Den er kort, konkret og på dansk; internationale format- og øvelsesnavne beholdes.
- Eksempel for **AMRAP**: “As Many Rounds And Reps As Possible. Gennemfør listen i rækkefølge så mange gange som muligt, indtil tiden er gået. Notér hele runder og eventuelle ekstra reps.”
- Eksempel for **EMOM**: “Every Minute On the Minute. Start det angivne arbejde, hver gang et nyt minut begynder. Når du er færdig, hviler du resten af minuttet. Start igen ved næste minut.”
- Eksempel for **For Time**: “Gennemfør alt arbejde så hurtigt og kontrolleret som muligt. Uret tæller op; stop ved færdig. Hvis der står en cap, stopper formatet også ved den tid.”
- Hver øvelse kan åbnes for en ultrakort workout-relevant briefing: hvad øvelsen er, antal/reps eller load, en sikkerheds-/teknikcue, registreret substitution og hvordan den tæller. Den er ikke en erstatning for kvalificeret coaching eller en lang videolektion.
- I partner- og holdworkouts kan man åbne samme hjælp på rotations- og shared-work-regler, så alle kan se præcist hvem der arbejder, hvornår der skiftes, og hvad holdet samlet tæller.
- I Timer Mode er `Hvad betyder det?` altid tilgængelig ved format og aktiv øvelse. Åbning af hjælpen må ikke stoppe eller nulstille timeren; tiden fortsætter korrekt i baggrunden, og sheeten kan lukkes med tydelig knap, Escape og tilbagegestus.
- Format- og øvelsesforklaringer ligger i det lokale, versionsstyrede øvelses-/formatbibliotek. De kan bruges offline og opdateres sammen med reglerne; et valgfrit LLM-lag må højst formulere ekstra forklaring og må aldrig erstatte den kuraterede standardtekst.

## 6.7 Generation screen – 0 til 100 %

Når brugeren trykker **Generér workout** eller **Overrask mig**, skal appen åbne en decideret, fuldskærms WHATWORK-loading screen. Den er en del af produktoplevelsen – ikke en lille spinner oven på formularen.

Skærmen skal føles som om systemet bygger en træning med intention: mørk charcoal baggrund, WHATWORK-monogrammet som det visuelle centrum, en varm orange/rød fremdriftslinje og ét stort, roligt procenttal. Den må gerne have diskret, fysisk bevægelse i monogram/progresslinje, men ingen hektiske effekter eller falsk “AI-tænkning”.

Krav til fremdrift:

- Vis **0–100 %** med både grafisk indikator og læsbar tekst, fx `64 %`.
- Procenten skal afspejle motorens virkelige faser, ikke en vilkårlig timer. Når regelmotoren er hurtig, må den færdiggøre hurtigt; den må aldrig tilbageholdes for at gøre animationen længere.
- Foreslåede faser: 0–10 % input og udstyr, 11–30 % øvelseskandidater, 31–55 % struktur og format, 56–75 % skalering og holdlogistik, 76–92 % tidsestimat og validatorer, 93–100 % workout klar.
- Når output er gyldigt, viser skærmen **100 % · Klar** i et kort, sikkert overgangsøjeblik og åbner derefter workout-kortet. Er output ikke gyldigt, må den ikke nå “klar”; vis i stedet den konkrete, menneskelige fejl og et valg om at tilpasse eller prøve igen.
- Tilgængelighed: status og procent eksponeres via en rolig live-region; farve er ikke eneste signal; `prefers-reduced-motion` giver en stillestående indikator uden at fjerne fremdriften.

### Microcopy til generation screen

Vis kun én frase ad gangen. Frasen kan skifte, når en reel fase skifter, eller med rolig variation ved længere beregning. Brug ikke tekst, der lover mere intelligens, end motoren har, og brug aldrig humor til at skjule ventetid eller fejl.

- “Bygger din workout …”
- “Finder noget tungt, du kan løfte.”
- “Tæller på tiden. Ikke på undskyldninger.”
- “Matcher øvelser med dit udstyr.”
- “Holder øje med maskinerne.”
- “Finder en plan, der kan afvikles.”
- “Skalerer til dem, der træner.”
- “Blander puls og styrke.”
- “Sørger for, at den ikke bliver dum.”
- “Tjekker om tiden faktisk passer.”
- “Gør klar til arbejde.”
- “Så er der serveret.”

Formuleringer skal knyttes til passende faser. Eksempelvis må “Holder øje med maskinerne” bruges ved concurrency-validatoren, mens “Finder noget tungt, du kan løfte” bruges, når styrkevalg og belastning fastlægges. Den valgte frase og procent må være deterministisk/logbar i test-mode, så generation screen kan testes visuelt og funktionelt.

---

# 7. Workout Intelligence Engine

## 7.1 Princip

WHATWORK Intelligence Engine er en lokal, data- og regelbaseret motor. Den må bruge pseudotilfældighed til variation, men skal være reproducérbar med en `seed`, så fejl kan genskabes og en workout kan gemmes præcist.

Den må aldrig bare trække tilfældige øvelser ud af en liste. Den skal først vælge passende struktur, derefter kandidater, derefter validere hele workouten og til sidst estimere tid og skalering.

## 7.2 Inputkontrakt

Mindst følgende input er serialiserbare og versionerede:

- `totalMinutes`, `includeWarmup`, `includeCooldown`.
- Deltagere, individuelle/skaleringsprofiler, kropsvægt og niveau.
- Kondition- og styrkeønske 1–10.
- Fokus-tags, ønskede kategorier/øvelser, eksklusioner, skån-områder.
- Udstyrs-inventar inkl. antal maskiner, barbell-stænger og tilgængelige vægttrin.
- Historikssammendrag: nylige movement patterns, fatigue, gennemførsel og eksplicit feedback.
- `engineVersion`, `rulesVersion`, `exerciseDataVersion`, `seed`.

## 7.3 Outputkontrakt

En workout indeholder mindst:

- Stabilt ID, seed og versionsmetadata.
- Titel, format, deltagelsesmodel og estimeret total tid.
- Session blocks: opvarmning, strength/skill, conditioning, cooldown.
- For hver movement: øvelse-ID, instruktion, enhed, reps/distance/calories/tid, vægt/skalering pr. profil/person, estimeret arbejdstid og transitionstid.
- Holdlogik: synkront, rotation, relay, “you go/I go”, delte reps eller stationer.
- Workout DNA, WW Score, fatigue-estimat og validatorresultat.
- Visningsklar dansk tekst og maskinlæsbar struktur; UI må ikke parse fri tekst for at forstå workouten.

## 7.4 Generator-pipeline

1. Normalisér input og find sikre defaults.
2. Tjek hard constraints: tid, udstyr, maskinantal, eksklusioner, niveau, gruppestørrelse.
3. Fordel sessionens tidsbudget.
4. Vælg sessiontype og format efter fokus, styrke/kondition, tid og variation.
5. Hent kandidater fra øvelsesdata og filtrér på constraints/fatigue.
6. Sæt blocks sammen med passende rep- og loading-schemes.
7. Planlæg samtidig brug af udstyr for partner/hold.
8. Skaler pr. deltager/profil og beregn realistisk tid.
9. Kør validatorer; reparér ved at substituere/reducere/restrukturere og prøv igen med begrænset antal forsøg.
10. Beregn DNA, score og forklaring; gem alle beslutningsspor til debug, ikke som synlig teknisk støj.

Hvis motoren ikke kan producere en gyldig løsning efter et begrænset antal forsøg, returnerer den en tydelig, konkret fejl: fx “Med 10 minutter, én stang og tre valgte tunge løft kan der ikke laves en forsvarlig workout. Prøv 15 minutter eller vælg færre låste øvelser.” Den må aldrig udsende en halvgyldig workout.

## 7.5 Sessionformer

Motoren skal kunne generere mindst:

- **AMRAP** – rounds/reps as many as possible på fast tid.
- **EMOM** – every minute on the minute, inkl. alternerende minutter.
- **E2MOM/E3MOM/E4MOM/E5MOM** – når pauser eller tungt arbejde kræver det.
- **For Time** – tydeligt cap og realistisk forventet tidsinterval.
- **Interval** – arbejde/hvile eller stationer.
- **Calorie workout** – ergs/bike med `cal` som enhed, aldrig blandet fejlagtigt med meter.
- **Strength** – fx 5×5, 5×3, 3×8, teknisk tempo eller progressive sæt.
- **Strength + Conditioning** – en afgrænset styrkedel efterfulgt af conditioning, ikke bare ekstra volumen.
- **Chipper**, **ladder**, **relay**, **partner shared work** og **team rotation** hvor constraints passer.

Eksempel på legitim Strength + Conditioning:

> Del 1 – Back Squat, 5 × 5 med anbefalet vægt/pauser.  
> Del 2 – 12 min AMRAP: 12 cal SkiERG, 10 Dumbbell Snatches, 8 Burpees.

Det er ikke et krav, at alle workouts er hurtige. En tung styrkesession må være tung, teknisk og pauserig.

---

# 8. Øvelsesdatabase og kategorisering

## 8.1 Datakrav pr. øvelse

Øvelsesbiblioteket skal ligge lokalt og være struktureret data, ikke bare beskrivelser. Hver øvelse skal have mindst:

- stabilt ID, dansk visningsnavn og eventuelle alternative navne;
- primær kategori, underkategori og movement patterns;
- nødvendigt/valgfrit udstyr samt set-up- og transitionskrav;
- primære/sekundære muskelgrupper;
- teknikniveau, regresser/progressioner og kontraindicerede skån-tags;
- fatigue-vektorer: ben, squat, hinge/posterior chain, skulder, pres, træk, core, grip, kondition og CNS;
- egnede formater, typiske reps/arbejdstid, load-enheder og standardskalaer;
- støtte for kg, reps, meter, km, calories, sekunder/minutter hvor relevant;
- estimeret arbejdstid, transitionstid og partner/hold-kompatibilitet;
- kombinationer og volumenregler, der bør undgås;
- data- og kilde/review-status.

Der skal være et redaktionelt admin-/indholdspanel eller et sikkert, valideret data-workflow, så øvelser, regler og skabeloner kan versioneres uden omskrivning af motoren.

## 8.2 Kategorier og konkrete v1-øvelser

### Underkrop / squat

- Air Squat, Goblet Squat, Back Squat, Front Squat, Box Squat, Pause Squat, Overhead Squat.
- Walking Lunge, Reverse Lunge, Front Rack Lunge, Bulgarian Split Squat, Step-up, Box Jump, Broad Jump.

### Underkrop / hinge og posterior chain

- Deadlift, Romanian Deadlift (RDL), Sumo Deadlift, Trap Bar Deadlift hvis udstyret findes.
- Good Morning, Hip Thrust, Glute Bridge, Kettlebell Deadlift, Kettlebell Swing, Dumbbell RDL.

### Overkrop / pres

- Bench Press, Incline Bench Press, Dumbbell Bench Press, Push-up, Hand-release Push-up.
- Strict Press, Push Press, Dumbbell Shoulder Press, Floor Press, Dips (med passende regression).

### Overkrop / træk

- Pull-up, Chin-up, Ring Row, Strict Pull-up, Kipping Pull-up kun ved passende niveau/kapacitet.
- Barbell Row, Dumbbell Row, Renegade Row, Inverted Row, Face Pull hvis relevant udstyr findes.

### Hele kroppen / funktionel styrke

- Thruster, Devil Press, Dumbbell Clean & Press, Man Maker (kun når passende), Turkish Get-up.
- Wall Ball, Burpee, Burpee over Bar, Burpee Box Jump-over med progressioner.

### Core og stabilitet

- Plank, Side Plank, Dead Bug, Hollow Hold/Rock, Sit-up, GHD Sit-up hvis eksplicit udstyr og niveau.
- Hanging Knee Raise, Toes-to-Bar, Russian Twist, Farmer Hold, Pallof Press hvis tilgængeligt.

### Olympiske løft og varianter

- Deadlift to Clean drill, Clean, Power Clean, Hang Clean, Hang Power Clean, Squat Clean.
- Clean & Jerk, Push Jerk, Split Jerk.
- Snatch drill, Power Snatch, Hang Power Snatch, Hang Snatch, Snatch.
- High Pull, Clean Pull, Snatch Pull, Muscle Clean/Snatch som læringsvarianter.

Olympiske løft kræver teknik-match; motoren må ikke vælge komplekse catches for begyndere eller ved høj fatigue uden en sikker grund.

### Carries og loaded movement

- Farmer Carry, Suitcase Carry, Front Rack Carry, Overhead Carry, Sandbag Bear-hug Carry, Sandbag Shoulder Carry.
- Sled Push, Sled Pull/Drag med tydelig vægt-/distanceinstruktion.

### Cardio, løb og ergs

- Løb: 100 m sprint, 200 m, 400 m, 800 m, 1 km og tidsbaseret løb.
- SkiERG, RowERG, BikeERG, Assault Bike, Air Runner.
- Enheder: calories, meter, kilometer, sekunder og minutter afhængigt af maskine/format.

### Gymnastics og bodyweight

- Burpee-varianter, Jumping Pull-up, Pull-up-varianter, Handstand Hold/Push-up med strenge niveaukrav.
- Rope skip/single unders; double unders kun med passende niveau og substitutionsregel.

### Mobilitet, opvarmning og accessories

- Ankel-/hofte-/skuldermobilitet, lette lunges, scapular work, band work hvis band findes.
- Let core, tempo squat/hinge, carries og technique primers.

**Ikke i standard v1-biblioteket:** Tire, Assault Runner og Peg Board. De må ikke dukke op i “Overrask mig” eller standardudstyr.

### Udvidet øvelseskatalog og sikker kuratering

Det eksisterende v1-katalog udvides med følgende kuraterede kandidater. Det er et bredt funktionelt bibliotek, **ikke** en tilladelse til at generere alle øvelser for alle. Hver post skal have `generatorEligibility` (`default`, `advanced`, `coach-only` eller `disabled`), teknikniveau, individuel scaling, substitutionsstige og fatigue-regler, før den kan vælges. Internationale øvelsesnavne står på internationalt engelsk; forklaringer og al anden UI-tekst er dansk.

**Squat, lunge og unilateral underkrop**

- Tempo Air Squat, Pause Air Squat, Double Kettlebell Front Squat, Pause Back Squat, Tempo Back Squat, Pin Squat, Safety Bar Squat (hvis registreret), Pause Front Squat og Zercher Squat (`advanced`).
- Split Squat, Rear-Foot Elevated Split Squat, Lateral Step-up, Cossack Squat, Pistol Squat progression, Shrimp Squat progression, Forward Lunge, Lateral Lunge, Curtsy Lunge, Overhead Lunge og Deficit Lunge (`advanced`).
- Step-up, Lateral Bound, Skater Jump, Jump Squat, Tuck Jump og single-leg landing drills. Plyometri kræver landing-/volumenregel og lav-impact substitution.

**Hinge, glutes og posterior chain**

- Stiff-Leg Deadlift, Deficit Deadlift (`advanced`), Paused Deadlift, Tempo Deadlift, Clean Deadlift, Snatch Deadlift, Dumbbell Deadlift, Single-Leg RDL, Suitcase Deadlift og Kettlebell Deadlift.
- Russian Kettlebell Swing, American Kettlebell Swing (niveau- og skulderstyret), Barbell Hip Thrust, Single-Leg Glute Bridge, Back Extension, Hip Extension, Nordic Hamstring Curl progression, Hamstring Walkout og Banded Pull-through.

**Pres**

- Pause Bench Press, Close-Grip Bench Press, Dumbbell Incline Bench Press, Dumbbell Floor Press, Barbell Floor Press, Incline Push-up, Knee Push-up, Tempo Push-up, Deficit Push-up, Ring Push-up og Pike Push-up.
- Seated Strict Press, Arnold Press, Z Press (`advanced`), Bench Dip, Ring Dip, Box Dip progression, Wall Walk, Handstand Hold, Strict Handstand Push-up og Kipping Handstand Push-up (strenge niveau-/skulderkrav).
- Behind-the-Neck Press er `disabled` som standard; den må kun aktiveres i eksplicit coach-styret kontekst.

**Træk og scapular kontrol**

- Scapular Pull-up, Dead Hang, Active Hang, Band-Assisted Pull-up, Neutral-Grip Pull-up, Chest-to-Bar Pull-up, Kipping Pull-up, Butterfly Pull-up og Bar Muscle-up (`advanced`).
- Ring Muscle-up (`advanced`), Pendlay Row, One-Arm Dumbbell Row, Gorilla Row, Seal Row (hvis udstyr findes), Face Pull, Band Pull-apart, Straight-Arm Pulldown, Prone Y-T-W og External Rotation med band.
- Upright Row er `coach-only`, ikke default, fordi udførelse og skuldertolerance varierer betydeligt.

**Hele kroppen, kettlebell, dumbbell og sandbag**

- Dumbbell Thruster, Kettlebell Thruster, Kettlebell Clean & Press, Dumbbell Complex (`advanced`), Kettlebell Snatch, Dumbbell Hang Clean, Dumbbell Power Clean, Sandbag Clean, Sandbag to Shoulder og Ground-to-Shoulder.
- Step-back Burpee, Hand-release Burpee, Lateral Burpee over Dumbbell, Burpee Pull-up, Broad-Jump Burpee, Half Turkish Get-up, Bear Crawl, Crab Walk, Inchworm, Sprawl og Med Ball Clean.

**Core og stabilitet**

- High Plank, RKC Plank, Plank Shoulder Tap, Body Saw, Bear Plank, Bird Dog, Arch Hold, Superman Hold, V-up, AbMat Sit-up, Weighted Sit-up og Seated Knee Tuck.
- Hanging Leg Raise, Knees-to-Elbows, Toes-to-Rings, L-Sit, Tuck L-Sit, Windshield Wiper (`advanced`), Anti-Rotation Hold, Front Rack Hold, Overhead Hold og Copenhagen Plank progression.

**Olympic Weightlifting og teknikvarianter**

- Tall Clean, High-Hang Clean, Clean from Blocks, Clean from Power Position, Clean High Pull, Clean Grip RDL og Clean Pull.
- Jerk Dip, Jerk Drive, Power Jerk og Snatch Balance. Behind-the-Neck Jerk er `coach-only`.
- Tall Snatch, Muscle Snatch, Snatch High Pull, Snatch Grip Deadlift, Snatch Grip RDL, Snatch Pull, Power Snatch, Hang Power Snatch, Hang Snatch og Squat Snatch.
- Catches over hovedet, komplekser og `advanced`-varianter kræver positiv teknik-match, passende fatigue-score og kontrollerbar load. USA Weightliftings konkurrenceløft er Snatch og Clean & Jerk; resten behandles som træningsvarianter.

**Carries, sled og loaded locomotion**

- Farmer Hold, Offset Carry, Double Front Rack Carry, Waiter Carry, Bottoms-up Carry (`advanced`), Sandbag Front Carry, Bear Crawl Drag, Backward Sled Drag og Rope Sled Pull (kun med konkret udstyrsdata).
- Hver carry skal have afstand, load, greb, vendepunkt og station-krav. Ingen upræcis “tung carry”.

**Cardio, løb, ergs og locomotion**

- Walk, incline walk (hvis registreret), shuttle run, 1 mile run, tidsintervaller og pace-baseret løb.
- Echo Bike, Curved Treadmill, almindeligt løbebånd og elliptisk træner, men kun når den specifikke maskine er registreret. RowERG, SkiERG, BikeERG, Assault Bike og Air Runner bevarer deres internationale navne.
- Crossovers (`advanced`), high knees, mountain climbers, jumping jacks, lateral line hops, pogo hops og stair climb hvis konkret kontekst/udstyr findes.
- Svømning, rucking og outdoor cycling er `coach-only` i v1, fordi rute-, sikkerheds- og tidsestimering ikke er generisk pålidelig.

**Gymnastics, rings og rope**

- Ring Support Hold, Toes-to-Rings, Handstand Shoulder Tap, Handstand Walk (`advanced`), seated rope pull, rope climb og legless rope climb (`advanced`).
- Rope-øvelser kræver eksplicit udstyr, fri højde, sikkerhedsopsætning og kompetence; de er aldrig standard i “Overrask mig”.

**Mobilitet, primers og accessories**

- Ankle Dorsiflexion, Calf Raise, Tibialis Raise, 90/90 Hip Switch, Hip Airplane, Couch Stretch, World's Greatest Stretch, Cossack Hold og Thoracic Rotation.
- PVC/Band Pass-through, Scapular Push-up, Banded Shoulder External Rotation, Wall Slide, Wrist Prep, Overhead Squat Mobility Drill, Empty-bar Complex, light carry og easy erg.
- Biceps Curl, Hammer Curl, Triceps Extension, Lateral Raise, Reverse Fly og grip work må bruges sparsomt i styrkedele/programmer, men må ikke dominere den funktionelle generator.

Biblioteket skal revideres af en kvalificeret træningsfaglig person før production-release. WHATWORK skriver egne korte danske instruktioner og kopierer aldrig beskyttet redaktionelt indhold, billeder eller video. Kildegrundlag: [CrossFit Level 1 Training Guide](https://library.crossfit.com/free/pdf/CFJ_English_Level1_TrainingGuide.pdf) for brede movement-kategorier, [ACE Exercise Library](https://www.acefitness.org/resources/everyone/exercise-library/) for generelle øvelser/regressioner og [USA Weightlifting – The Lifts](https://www.usaweightlifting.org/weightlifting101/the-lifts) for olympiske konkurrenceløft. Nye øvelser kræver kilde, reviewdato, reviewer og komplet schema-validering.

## 8.3 Udstyr og inventar

Understøt mindst SkiERG, RowERG, BikeERG, Assault Bike, Air Runner, barbell, vægtskiver, kettlebells, håndvægte, sled, sandbag, wall ball, box, pull-up bar, rings og jump rope.

Kettlebells: 10–36 kg. Håndvægte: 10–40 kg inkl. 12,5/17,5/22,5 osv. Inventaret skal ikke bare være en checkboks: brugeren angiver antal maskiner, stænger og tilgængelige vægttrin. Generatoren må kun foreslå vægte, som kan sammensættes realistisk.

---

# 9. Skalering, tidsestimering og gruppe-logistik

## 9.1 Male/female scaling og individuel scaling

Visning kan angive fx `♂ 60 kg / ♀ 42,5 kg`, når brugerens valgte skaleringsprofiler bruger disse defaults. Det er et udgangspunkt, ikke en sandhed om den enkelte. Alle kan tilpasse belastning, og individuelle benchmarks/niveau vinder over profile-defaults.

Skalering må ændre vægt, variant, reps, distance eller tid, men skal bevare workoutens stimulus. Eksempel: en novice kan få Hang Power Clean med lavere vægt i stedet for at få samme høje rep-count med teknisk usikker barbell cycling.

## 9.2 Tidsmodel

Motoren estimerer ikke kun work time. Den inkluderer set-up, transitions, maskinskift, skiveændring, sandsynlige pauser og holdrotation. Den viser et forventet interval og cap frem for falsk præcision.

For Time må cap være realistisk. Hvis forventet arbejde + transitions overstiger sessionens budget, skal motoren reducere volumen/antal stationer eller vælge andet format.

## 9.3 Maskinknaphed og stationsplan

Ved flere deltagere skal antal maskiner styre designet. Fire deltagere med én SkiERG må aldrig få “alle laver 15 cal SkiERG samtidigt”. Gyldige patterns omfatter:

- **Relay:** én arbejder, andre hviler/holder næste station klar.
- **You go, I go:** makkerne skiftes om afgrænsede dele.
- **Shared work:** fx 60 cal tilsammen, delt frit men med instruktion om ansvar.
- **Rotation:** faste stationer og skift med timer.

Workoutkortet skal gøre flaskehalse og rotationsorden eksplicitte.

---

# 10. Workout DNA, WW Score og læring

## 10.1 Workout DNA

Workout DNA er en kompakt, forklarbar profil – ikke et pseudo-videnskabeligt tal. Den viser fx 0–10 for:

- Kondition / engine.
- Styrke.
- Ben/squat.
- Posterior chain/hinge.
- Overkrop pres/træk.
- Core.
- Grip.
- Teknik.
- Densitet/intensitet.

DNA bruges til at forklare workouten, styre variation og vise brugerens ugentlige balance. Den må ikke fremstilles som medicinsk måling.

## 10.2 WW Score

WW Score er en intern kvalitetsscore for en genereret workout, 0–100. Den samler mindst: constraint-fit, tidsrealismen, stimulus-fit, udstyrslogistik, balance/fatigue, variation mod historik og skalerbarhed.

- Under 80: workouten må som default ikke vises; motoren forsøger at reparere den.
- 80–89: acceptabel, men bør have eksplicit forklaring hvis trade-off findes.
- 90+: stærk løsning.

Scoren er primært et kvalitetssignal til motor og QA. Brugeren kan se en enkel “Godt match til dine valg” frem for et mystisk tal, medmindre en avanceret forklaring åbnes.

## 10.3 Progression Engine

Programmer og gentagne valg skal udvikle sig gradvist. Progression kan være mere vægt, flere kvalitetsreps, bedre teknikvariant, længere arbeidstid, kortere hvile eller højere kompleksitet – aldrig bare mere af alt.

Krav:

- Progression følger faktisk gennemførte workouts og feedback, ikke kun kalenderen.
- Planlæg deload/lette uger ved høj belastning eller lav gennemførsel.
- Undgå vægtstigning, hvis teknik/feedback indikerer, at det ikke passer.
- Gem hver programgenerations regel-version og begrundelse.

## 10.4 Fatigue Engine

Fatigue Engine bruger recency-vægtet summation af DNA og øvelsesfatigue. Den skal især beskytte mod uheldige klynger: mange tunge hinges tæt på hinanden, højvolumen overhead + skuldertræthed, meget spring/løb med knæskån osv.

Brugeren kan altid bevidst vælge tung træning, men systemet skal vise et klart, ikke-medicinsk signal: “Du har lavet meget hinge de sidste 48 timer. Vil du skifte til squat/overkrop eller fortsætte?”

## 10.5 Variation Engine

Variation må ikke blive variation for variationens skyld. Den skal variere format, rep-pattern, tidsdomæne, udstyr og movement patterns, men fastholde progressive mål. Gentag ikke samme “DNA-signatur” uden grund, og tving ikke nysgerrige circus-øvelser ind for at føles ny.

## 10.6 Learning Engine

Learning Engine arbejder først med lokal, forklarelig feedback:

- gennemført/ikke gennemført;
- faktisk tid/runder/load;
- RPE: “for let / passende / for hård”; 
- fritekst valgfri;
- senere ændringer foretaget af brugeren.

Den justerer future defaults og anbefalinger transparent. Den må ikke påstå at “kende din krop” eller bruge helbredsdiagnoser.

---

# 11. Validatorer og workout quality

## 11.1 Validator-arkitektur

Validatorer er rene, testbare funktioner, der returnerer strukturerede fejl/advarsler med kode, alvorlighed, berørt block og menneskelig forklaring. Hard errors blokerer output; warnings kan vises ved eksplicit valg.

Minimumsvalidatorer:

- **Input Validator** – værdier, summer, kg, niveau og alle required constraints.
- **Equipment Validator** – øvelse/variant og antal krævet udstyr eksisterer.
- **Time Validator** – estimeret tid og cap passer sessionbudget.
- **Concurrency Validator** – ingen samtidig maskin-/barbell-konflikt uden rotationsplan.
- **Movement Safety Validator** – teknik, skån-tags og høje fatigue-kombinationer.
- **Volume Validator** – reps, distance, loading og densitet er rimelige for niveau/format.
- **Balance Validator** – DNA passer mål og ikke utilsigtet ensidigt.
- **Scaling Validator** – alle deltagere har komplet, realistisk skalering.
- **Program Validator** – ugefordeling, progression og recovery giver mening.
- **Data Validator** – exercise/rule-template-data overholder schema før release.

## 11.2 Eksempler på fejl, der skal afvises

- 30 min For Time med estimat 49–58 min.
- Fire samtidige RowERGs når inventar er én og ingen rotationslogik er angivet.
- Begynder-workout med tung Squat Clean efter høj-volume deadlifts.
- “Skån skuldre” sammen med høj rep Overhead Squat og kipping pull-ups.
- 100 reps af samme avancerede movement uden tydelig begrundelse og niveau-match.
- Vægtforslag, der ikke kan sammensættes af registrerede skiver/DB/KB.

---

# 12. Timer Mode og workout completion

## 12.1 Timer Mode

Når brugeren trykker **Start workout**, åbner en fokusmode uden navigation-støj. Den har meget store tal, høj kontrast og den information, der er relevant netop nu.

Understøt mindst:

- AMRAP nedtælling og runde-tæller.
- EMOM/E2–E5MOM med runde, aktiv minute, næste movement og overgang.
- Intervaller med arbejde/hvile, sæt og station.
- For Time stopur, cap og aktuelle movement.
- Manual start/pause/fortsæt/afslut med beskyttelse mod accidental afslutning.

Brug valgfri lyd- og vibrationssignaler for nedtælling, intervalskift og afslutning. Disse er progressive enhancements: altid alternativ visuel cue, og respekter lydløs tilstand/browserbegrænsninger. Understøt `prefers-reduced-motion`.

Timer-state skal persisteres lokalt ved hvert relevant skift, så genåbning efter app-switch eller kort offline ikke mister aktiv workout. Vær ærlig om platformbegrænsninger for baggrundstimer og korrigér tidsforløb ud fra monotonic timestamp, når appen kommer tilbage.

På telefon er Timer Mode touch-optimeret: Start/Pause/Fortsæt er store, bundnære kontroller med mindst 56 × 56 CSS px træfflade; Næste/Forrige er tydeligt adskilt; og Afslut/Nulstil kræver bevidst bekræftelse. Skærmen må ikke låse tilpasning, tekstzoom, skærmlæsning eller systemgestus. Wake Lock kan tilbydes, hvor browseren understøtter det, men timeren skal altid korrigere og fortsætte korrekt uden Wake Lock.

Timeren viser altid formatnavnet med den nærliggende `Hvad betyder det?`-handling samt en tilsvarende handling ved aktiv øvelse. Hjælp indlæses øjeblikkeligt fra lokale data, beholder fokus korrekt i sheet/popover og annoncerer ikke hvert tik til skærmlæseren.

## 12.2 Completion-flow

Efter workouten spørges kort:

- Gennemført / afbrudt / ændret.
- Resultat: tid, runder, load eller valgfrit notat.
- Oplevelse: for let, passende, for hård.
- Gem i historik.

Ingen obligatoriske lange surveys efter fysisk aktivitet.

---

# 13. Træningsprogrammer

## 13.1 Program-flow

Brugeren vælger mål (allround, styrke + conditioning, engine, underkrop, overkrop, teknik), antal uger, dage pr. uge, tilgængelig tid/udstyr og niveau. Appen genererer en overskuelig plan, som kan redigeres uden at ødelægge resten.

Krav:

- Standard 2–6 pas pr. uge og 2–12 uger; fleksibel udvidelse senere.
- Hver uge skal have tydelig balance mellem stimulus, teknik og recovery.
- Dage kan flyttes, springes over eller regenereres; følge-workouts justeres efter faktisk completion.
- Programmet skal have en enkel ugeoversigt, workout-detalje og rationale: “Denne uge bygger på …”.
- Ingen falsk garanti om resultater.

## 13.2 Programtyper v1

- Funktionel allround.
- Styrke + conditioning.
- Engine / kondition.
- Klassisk styrke med funktionel conditioning.
- Partner-/holdvenligt program.
- Fokusprogram: underkrop, overkrop, olympisk teknik (kun passende niveau).

## 13.3 Programdata og versionshistorik

Hver plan gemmer original constraints, genererede workouts, completion-events og versioner. Regler kan forbedres i fremtiden uden at ændre, hvad brugeren faktisk lavede. Admin-/redaktionsændringer skal være auditerbare og reversible.

---

# 14. Historik, favoritter og statistik

## 14.1 Historik

Historik viser gennemførte, afbrudte og gemte workouts kronologisk med en rolig summary: dato, titel, format, tid og resultatsignal. Filtrér på format, kategori, deltagermodel, favoritter og periode. Det skal være muligt at genkøre en workout med ny skala eller genbruge dens DNA som udgangspunkt.

## 14.2 Favoritter

Favoritter er bevidst simple: markér, navngiv valgfrit, og genstart. De er ikke en erstatning for programmer eller historik.

## 14.3 Statistik

Statistik skal hjælpe, ikke score brugeren. Vis mindst:

- completed workouts over tid;
- konsistens pr. uge;
- samlet tid trænet;
- formatfordeling;
- DNA-balance (fx engine/styrke/ben/overkrop);
- personlige bedste resultater kun hvor data er sammenlignelige;
- foretrukket udstyr og seneste fatigue-signal.

Undgå ranglister, kropskritiske mål og “calories burned” som standard. Statistik må fungere med kun lokale data.

## 14.4 Import, eksport, backup og gendannelse

Brugeren skal kunne eksportere egne data som læsbart JSON og evt. CSV for completions. Import skal først validere schema, vise en oversigt og give mulighed for at vælge merge/erstat per kategori. Eksportfilen skal have schema-version og dokumentation; backups må ikke være et lukket proprietært format.

---

# 15. Data-model (konceptuel)

## 15.1 Centrale entiteter

- `UserProfile`: lokalt/cloud ID, navn, skaleringsprofil, niveau, kropsvægt, benchmarks, preferences.
- `EquipmentInventory`: equipment ID, antal, tilgængelige weight options og valgfri noter.
- `ExerciseDefinition`: versioneret databasepost efter schema i afsnit 8.
- `WorkoutRequest`: normaliseret input til motoren.
- `Workout`: versioneret genereret output med blocks, scaling, DNA, score og validatorlog.
- `WorkoutCompletion`: immutable event med resultat, RPE, tid og notat.
- `Program`: constraints, uger/dage, workout references og progression state.
- `FeedbackEvent`, `Favorite`, `SyncEnvelope`, `ImportExportManifest`.

Alle objekter har `id`, `createdAt`, `updatedAt`, schema-version og kilde/sync-metadata efter behov. Ingen persondata må ligge i URL-parametre eller analytics-events.

## 15.2 Data-governance

Øvelser, rule templates og engine-konstanter valideres mod schema i CI. Der skal eksistere test-fixtures for hvert niveau, format, udstyrsmønster og holdscenario. Det skal være let at tilføje data, men svært at publicere data med manglende scaling eller impossible equipment requirements.

---

# 16. Tilgængelighed, privacy og sikkerhed

## 16.1 Tilgængelighed

Mål mindst WCAG 2.2 AA hvor relevant:

- Semantisk HTML, korrekt heading-rækkefølge og landmarks.
- Tastaturnavigation for alle flows; synlig fokusmarkering.
- Modal/drawer med fokusfælde, korrekt returneret fokus og Escape-lukning.
- Kontrast mindst AA; farve er aldrig eneste statusindikator.
- Touchmål mindst 44 × 44 px.
- Screen reader labels for custom glyphs, timers og dynamiske statusbeskeder.
- Timer har både lyd/haptik og visuelt/tekstligt alternativ.
- Reduce motion respekteres; ingen meningsbærende animation alene.
- Sprog markeres som dansk i dokumentet.

## 16.2 Privacy

Vær dataminimal: kropsvægt, køn/skaleringsprofil og træningshistorik er privat data. Gem det lokalt som default, forklar hvad der synkroniseres, og gør eksport/sletning enkel.

- Ingen tredjeparts tracking som default.
- Analytics skal være privacy-bevarende, opt-in hvor relevant og uden workouts/fritekst/persondata.
- Ingen helbredsdiagnoser eller medicinske anbefalinger.
- Skån-område er et workout-filter, ikke en skadebehandling.
- Vis kort disclaimer i relevant kontekst: brugeren skal tilpasse træning til egen teknik, helbred og faglig rådgivning.

## 16.3 Sikkerhed

Målet er ikke en urealistisk påstand om, at en webapp “ikke kan hackes”. Målet er dokumenteret defense-in-depth, mindst privilegium, hurtig opdagelse og lav skadevirkning, hvis noget går galt. Sikkerhed er en release-gate – ikke en senere forbedring.

### 16.3.1 Identitet og adgang

- Brug Supabase Auth eller en tilsvarende etableret provider; aldrig hjemmelavet login, password-reset eller JWT-udstedelse.
- Foretræk passwordless e-mail/magic link eller en velkonfigureret OAuth-provider. Hvis password tilbydes: stærk provider-policy, breach-beskyttelse, rate-limit, sikker reset og ingen hjemmelavet hashing.
- Sessioner håndteres med sikre, `HttpOnly`, `Secure` og passende `SameSite` cookies, når server-session bruges. Tokens må ikke stå i URL’er, analytics, console-logs eller fejlrapporter.
- Autorisation sker på server/database for **hver** cloud-ressource. Et skjult UI-element er aldrig adgangskontrol.
- Konto- og data-sletning skal være testet, dokumenteret og ikke kun en UI-knap.

### 16.3.2 Supabase og dataadskillelse

- Aktivér RLS på **alle** eksponerede tabeller, views og Storage-buckets fra første migration. “RLS senere” er ikke acceptabelt.
- Hver policy skal knytte læs/indsæt/opdater/slet til den autentificerede ejer, fx `user_id = auth.uid()`. Default er deny; deling kræver en eksplicit, testet policy.
- Kør migrations med mindst privilegium. `service_role`/`sb_secret_...` må kun bruges i en serverfunktion og kun når en konkret adminopgave kræver det; de må aldrig sendes til klienten.
- Supabase publishable key og URL kan ligge i klienten, fordi de ikke er hemmeligheder. De må aldrig betragtes som en sikkerhedsbarriere; RLS-, grants- og API-tests er den reelle barriere.
- Storage anvender separate private buckets og ejerbaserede policies. Ingen offentlige backups, exports eller workout-filer som standard.
- Der skal være automatiske negative tests: bruger A kan aldrig læse, ændre, eksportere eller slette bruger B’s data – også ikke via direkte REST-kald, manipulerede ID’er eller Storage-URL’er.

### 16.3.3 Hemmeligheder, miljøer og leverandører

- Ingen hemmelighed i Git, klientkoden, `VITE_*`/`NEXT_PUBLIC_*`, PWA-cache, source map, test-fixture, screenshot, URL, build-log eller browser Network-panel.
- Brug `.env.example` med kun navne; `.env.local`, `.vercel/` og alle reelle nøglefiler ignoreres af Git. CI skal køre secret scanning på historik og pull requests.
- Vercel production/preview-hemmeligheder markeres Sensitive, holdes miljøadskilte og roteres ved mistanke. Preview må ikke dele production-database eller production-LLM-nøgler.
- LLM-, Supabase secret-, e-mail- og webhooknøgler læses kun ved runtime i serverkode. En build må ikke interpolere dem ind i et statisk bundle.
- Rotationsprocedure, kontaktperson og kill-switch dokumenteres for hver nøgle. En fundet nøgle anses som kompromitteret: tilbagekald/rotér først, derefter undersøg og deploy.

### 16.3.4 Web- og API-forsvar

- HTTPS overalt, HSTS og moderne TLS. Sæt restriktive response headers: Content-Security-Policy med allowlist, `frame-ancestors 'none'`/embed-policy efter behov, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` og passende `Permissions-Policy`.
- Ingen rå HTML fra bruger, LLM eller eksterne tjenester. Saniter ved den eneste nødvendige rich-text-grænse; brug frameworkets escaping og undgå `dangerouslySetInnerHTML`.
- CSRF-beskyttelse for cookie-baserede muterende endpoints, strict CORS-allowlist, origin-kontrol og ingen åbne redirects. Webhooks verificerer signatur og replay-beskyttes.
- Valider input på **både** klient og server med delte schemas; afvis ukendte felter, overdrevne størrelser, farlige filtyper og prototype-pollution. Importer behandles som ubetroede filer med schema-, størrelses- og versionskontrol før write.
- Rate-limit og abuse-beskyt login, magic-link, sync, eksport/import og LLM-bro pr. konto/IP. Returnér generiske fejl uden at afsløre om en konto eller ressource findes.
- Brug parameteriserede databasekald/RPC’er; ingen dynamisk SQL fra brugerinput. Kun serverkode kan udføre privilegerede operationer.

### 16.3.5 Supply chain, drift og hændelser

- Pin dependencies med lockfile, gennemgå licenser, kør dependency-/SCA-scanning, typecheck, lint, SAST og relevante browser security-tests i CI. Højkritiske fund blokerer release.
- Produktion bygges fra beskyttet hovedbranch med review, CI og immutable deploy. Ingen produktionshemmelighed i fork/PR-builds.
- Log kun hændelsesmetadata, aldrig adgangstokens, authorization headers, API-nøgler, workoutindhold, kropsvægt eller fritekst. Fejlrapportering er opt-in eller dataminimal og scrubber følsomme felter.
- Dokumentér incident-flow: stop/kill-switch, rotér hemmelighed, begræns adgang, vurder berørte data, ret, test og kommunikér efter gældende regler. Backup og restore testes – også ejeradskillelse efter gendannelse.
- Gennemfør trusselsmodel før launch: konto-overtagelse, IDOR/BOLA, XSS, CSRF, supply-chain-kompromis, nøglelæk, LLM-prompt injection, quota-abuse og tab af lokal enhed. Hver trussel får kontrol, test og ansvarlig ejer.

---

# 17. Performance og robusthed

Mål for en moderne mobil forbindelse/enhed:

- Første brugbare skærm hurtigt; prioriter app-shell og kritisk CSS.
- Lokalt genereret workout opleves øjeblikkelig; ingen kunstigt lange loading-animationer.
- Store databiblioteker lazy-loades efter behov, men offline-cache sikrer funktion efter første brug.
- Timer holder lavt CPU-forbrug og genberegner korrekt efter tabt fokus.
- Undgå store unødvendige billeder, tunge chart-biblioteker og blokering af main thread.
- Dæk svagt net, ingen net, browser refresh, luk/genåbn app, storage-kvota og gammel cached regelversion med robuste states.

Brug branded generation state kun hvis der faktisk er et mærkbart arbejde. Tekster som “Finder noget tungt …” må aldrig bruges til at forsinke svaret.

---

# 18. Skærmspecifikation

## 18.1 Onboarding/login

Mørk, enkel introduktion med wordmark. To tydelige paths: konto og gæst. Kort onboarding med progress. Ingen marketingvægge og ingen krav om kreditkort.

## 18.2 Hjem

Store actions, seneste workout og Overrask mig. Maksimalt ét sekundært informationsafsnit i folden. Tom state er motiverende og konkret.

## 18.3 Generator

Ét beslutningsområde ad gangen på mobil; tydelig progress og opsummering. På desktop: venstre valg, højre live summary. Advanced indstillinger må være tilgængelige men ikke dominerende.

Når format vælges eller vises i opsummeringen, kan brugeren åbne den samme korte forklaring som i resultatet og Timer Mode. Første gang en bruger møder et format, kan appen diskret vise “Ny i AMRAP? Se sådan gør du.” Det er en invitation, aldrig en blokerende onboarding.

## 18.4 Workout-resultat

Et stort premium workout-kort, læsbart på afstand. Vis format/tid, blocks, øvelser, reps/weights/scales og rotationsinstruktion. Under kortet: DNA i kompakt form, actions og praktiske noter. Gør det muligt at dele uden private data.

## 18.5 Timer

Ingen distraktioner. Højt kontrastniveau, enorme tidstal, aktiv og næste instruktion, pause/afslut. Landscape fungerer uden clipping.

## 18.6 Program

Kalenderlignende men ikke kalender-tung. Uge med træningsdage, status og kort rationale; mobil prioriterer næste workout. Brugeren kan flytte, regenerere eller springe over med sikre confirmation states.

## 18.7 Historik/statistik/profil

Rene lister og rolige grafer først når de giver svar. Ikke mange små kort. Profilens store counter og kontrollen over egne data er centrale.

---

# 19. Teststrategi

## 19.1 Testpyramide

- **Unit tests:** engine, scaling, time estimates, fatigue, validatorer, data schemas, timer time-correction.
- **Property/fuzz tests:** mange kombinationer af tid, udstyr, gruppe, niveau og seed – ingen output må bryde hard constraints.
- **Integration tests:** generator→validator→persistence→timer→completion, import/export og gæst→konto migration.
- **End-to-end:** mobil og desktop flows, offline reset/genåbning, navigation, keyboard, visual states.
- **Visual regression:** kerne-skærme ved mobile/desktop breakpoints, light conditions ikke krav hvis dark-only V1, men state coverage kræves.
- **Accessibility audits:** automatiske + manuel keyboard/screen reader smoke test.
- **Performance/PWA tests:** lighthouse som signal, installability, offline cache, service-worker updates.

## 19.2 Obligatoriske testscenarier

1. Solo begynder, 20 min, kun bodyweight + DB, skån skuldre.
2. Solo øvet, 45 min, strength + conditioning med Back Squat og SkiERG.
3. Partner, to personer, én RowERG, fælles reps og korrekt rotation.
4. Hold på fire: 2 mænd/2 kvinder, individuelle vægte, én SkiERG og to BikeERGs.
5. Avanceret ønsket Snatch, men nylig skulder-fatigue: sikker substitution/advarsel.
6. 10-minutters workout med for lille tidsbudget: ingen overskredet cap.
7. Gæst offline: generér, start timer, luk app, genåbn, gennemfør og se historik.
8. Gæst migrerer lokale data til konto uden dubletter.
9. Import med ukendt schema-version afvises uden at ændre data.
10. 200 % zoom og tastatur: alle funktioner er nåbare og læsbare.

---

# 20. Multi-agent build-system

Når opgaven løses med flere agenter, arbejder de mod dette dokument og en delt, versionsstyret backlog. Én ansvarlig agent/produktansvarlig skal integrere ændringer og sikre, at andre agents ikke overskriver hinandens arbejde.

## 20.1 Roller

| Rolle | Ansvar | Må ikke godkende alene |
|---|---|---|
| Build Agent | Implementerer afgrænsede features med tests og dokumentation. | Egen release eller utestet engine-logik. |
| Design Guardian | Beskytter brand, layout, responsive kvalitet, custom glyphs og microcopy. | Funktionel correctness alene. |
| Bug Guardian | Reproducerer, tester og fikser fejl; beskytter regressioner. | Produktprioritering alene. |
| Product Supervisor | Holder scope, acceptance criteria, data-kontrakter og beslutningslog samlet. | Visuel eller sikkerhedsmæssig release alene. |
| QA User Agent | Går rigtige brugerflows på mobil/desktop og rapporterer friktion. | Kodearkitektur alene. |
| Edge Case Agent | Finder constraints-, offline-, import-, timer- og gruppescenarier, der kan bryde. | Design/produktkompromiser alene. |
| Workout Quality Agent | Reviewer programmering, scaling, fatigue, validatorer og øvelsesdata. | UI/release alene. |
| Release Auditor | Bekræfter test-, sikkerheds-, performance-, PWA- og DoD-gate. | Implementerer hemmelige sidste-øjebliksændringer. |

## 20.2 Arbejdsprotokol

1. Product Supervisor skærer arbejdet i små, accepterbare vertikale slices.
2. Build Agent implementerer én slice med test og klart ownership.
3. Design Guardian og Workout Quality Agent reviewer relevant output tidligt, ikke kun ved slutningen.
4. Bug/Edge Case/QA kører konkrete scenarier imod acceptance criteria.
5. Release Auditor laver uafhængig go/no-go mod Definition of Done.
6. Ingen agent må “fikse” acceptance failures ved at svække krav uden dokumenteret produktbeslutning.

## 20.3 One-run-princip

Én samlet build-run skal være reproducerbar fra et rent checkout: installér, lint, typecheck, test, build og E2E/QA med dokumenterede kommandoer. Agenten skal ikke erklære færdig efter delvise manuelle klik eller kun HTTP 200.

Ved hver ændring, der berører generator eller UI, skal relevante automatiske tests køres, og kritiske ruter skal kontrolleres visuelt i en browser på både mobil og desktop viewport. En URL alene er ikke en QA-handoff.

---

# 21. Acceptance criteria

Produktet accepteres først, når mindst følgende kan demonstreres:

1. En ny bruger kan gå fra åbning til genereret solo-workout som gæst uden konto.
2. Generatoren respekterer tid, niveau, styrke, kondition, fokus, udstyr, antal maskiner, valgte/udelukkede øvelser og skån-tags.
3. Database indeholder de konkrete styrke-, olympiske-, cardio-, carry- og bodyweight-øvelser nævnt i afsnit 8, inkl. Back Squat, Front Squat, Bench Press, Deadlift, RDL, cleans, snatch og ergs.
4. Gruppeflow kan angive deltagertal, fordeling og individuelle kropsvægte; output viser relevant scaling og afviklingslogik.
5. En konflikt med én maskine til flere deltagere bliver til rotation/shared work – aldrig samtidig umulig brug.
6. AMRAP, EMOM, For Time, interval/calorie workout og Strength + Conditioning kan genereres og afvikles i Timer Mode.
7. Alle formatnavne, scoring-enheder, rotationsregler og aktive øvelser i et workout-flow har kontekstnær, dansk, offline-fungerende forklaring med “hvad betyder det”, “hvad gør du nu” og “hvordan er du færdig”; den kan åbnes med touch, tastatur og skærmlæser uden hover eller LLM.
8. Timer overlever app-switch/genåbning og giver korrekt tid efter returnering, inden for platformens realistiske begrænsninger.
9. Workout DNA og WW Score bliver beregnet; hard validatorfejl kan ikke nå brugeren som en valid workout.
10. Historik, favoritter, feedback og minimumsstatistik fungerer lokalt offline.
11. Programflow giver en flersugers plan med progression, recovery og justering efter completion.
12. Mobil har bundmenu + tilgængelig drawer, og desktop har professionel topmenu samt responsive layouts.
13. Wordmark, monogram, custom glyphs, mørk identitet og dansk microcopy fremstår konsekvent og uden ulovligt distribueret font.
14. PWA kan installeres, starter i standalone hvor platformen understøtter det, og kerneflows fungerer offline efter caching.
15. Gæst kan eksportere data og kan migrere data til konto uden tab; konto- og datasletning er tilgængeligt, hvis cloud-konto er implementeret.
16. Alle tests i den dokumenterede one-run pipeline passer, og visuel QA er foretaget på reelle mobil- og desktopruter.
17. **Generér workout** er en tilgængelig, entydig signatur-CTA med `Action Ember`, unik WHATWORK-glyph, tastaturfokus og ingen forveksling med sekundære handlinger.
18. Alle viste produktikoner er egne, dokumenterede WHATWORK-SVG’er; ingen generisk ikonpakke eller emoji fungerer som produktikon.
19. Hvis cloud er aktiveret, dokumenterer automatiske tests, at RLS forhindrer bruger A i at tilgå bruger B’s data via UI, REST og Storage.
20. Ingen secret/service-role/LLM-nøgle kan findes i repository, klientbundle, source maps, PWA-cache, preview eller browserdevtools. Den eneste offentlige Supabase-klientkonfiguration er eksplicit identificeret som publishable.
21. Hvis den valgfri LLM-bro er aktiveret, beviser tests, at workouten stadig genereres, når LLM er slået fra, afviser ikke-gratis/ikke-allowlistede modeller og aldrig sender følsomme brugerdata eller klientnøgler.
22. Produktet har en gennemtestet recovery-state for offline, manglende cloud-synk, udtømt lokal lagerplads, ugyldig import, mislykket migration og afbrudt LLM-kald. Ingen af dem må slette eller skjule en eksisterende workout.
23. En aktiv workout/timer kan aldrig afbrydes eller genindlæses automatisk af en PWA-opdatering. Brugeren vælger selv at opdatere efter træningen, og den præcise aktive state kan gendannes.
24. Første brug og Profil viser en kort, forståelig træningssikkerhedsnote. V1 accepterer kun voksne brugere; den stiller ikke diagnoser, indsamler ikke helbredsoplysninger og erstatter ikke professionel rådgivning.
25. Persondataflow, databehandleraftaler hvor relevante, sletterutine, eksportformat og ansvarlig kontakt er dokumenteret før en EU/DK-lancering.
26. Øvelser, skaleringer og programmer, der er nye eller ændrede siden sidste release, har reviewdato, kildegrundlag, reviewer og bestået schema-/validator-tests.
27. V1 er visuelt og funktionelt verificeret i de erklærede browserbaselines: aktuel Safari på iPhone/iPad, aktuel Chrome på Android samt aktuel Chrome, Safari og Edge på desktop.
28. En releasepakke indeholder versionsnummer, commit/reference, miljø, testresultater, kendte begrænsninger, backup/rollback-bevis, data-migrationsstatus og den konkrete billing-/LLM-status.
29. Kerneflows – generering, valg, redigering, Timer Mode, completion, navigation og recovery – kan gennemføres med én hånd og touch på fysisk iPhone og fysisk Android uden hover, præcis drag eller utilsigtede dobbelt-/stoptryk. Touch-mål, safe areas, mobilkeyboard og liggende visning er verificeret.
30. Kerneflows er visuelt og funktionelt verificeret ved den dokumenterede viewport-/aspect-ratio-matrix, inkl. dynamisk mobilhøjde, virtuelt tastatur, split view/resizable vindue, portræt/landskab, 200 % zoom og ultrabred desktop. Der er ingen skjult, afklippet eller overlappende kernefunktion.

---

# 22. Definition of Done

En feature eller release er først færdig, når:

- Krav og acceptance criteria er implementeret, ikke bare wireframed.
- Domain-logik er typed, testet og fri for UI-afhængighed.
- Input, persistence, loading, empty, error og offline states er håndteret.
- Dansk copy er gennemlæst og passer til tone.
- Mobil, tablet og desktop er testet visuelt; direkte ruter rendrer korrekt.
- Keyboard, screen reader-labels, fokus, kontrast og reduce-motion er verificeret.
- Format- og øvelseshjælp er kurateret, versionsstyret og offline. Den kan åbnes med touch, tastatur og skærmlæser, forklarer udførelsen konkret og forstyrrer ikke aktiv timer.
- Validatorer blokerer usikre/umulige workouts; tests demonstrerer det.
- Ingen obligatoriske betalte AI-kald eller constantly-running backend er indført. En LLM-adapter er som standard slukket, kan ikke selv aktivere billing og har testet graceful fallback.
- Ingen placeholder-ikoner, generisk font/logo, tredjeparts-ikonbibliotek som produkt-UI eller ulovligt fontmateriale er i den leverede app.
- Hemmeligheder er scannet, miljøadskilt og kun tilgængelige server-side; RLS/autorisation og kritiske negative sikkerhedstests er grønne.
- PWA-/service-worker-opdatering er testet uden tab af aktive/lokale data.
- PWA-opdatering kan udsættes under en aktiv workout og kræver aldrig, at appen genindlæser brugerens timer automatisk.
- Touch-first-specifikationen er testet på fysiske iPhone- og Android-enheder, inkl. safe areas, virtuelt tastatur, liggende visning, store touch-mål og sikker Timer Mode-betjening.
- Viewport-/aspect-ratio-kontrakten er testet og dokumenteret for alle erklærede skærmklasser; dynamisk browser-chrome, keyboard og resizable vindue skaber ikke tab af handlinger eller indhold.
- Browserbaselines, recovery-states, storage-fejl og migreringer er verificeret og dokumenteret.
- Træningssikkerhedsnote, voksenafgrænsning, databehandling, licenser/trademarks og redaktionelt exercise-review er afsluttet for de berørte V1-funktioner.
- Build, typecheck, lint, unit/integration/E2E tests og relevant performance/a11y-audit er grønne.
- Release Auditor har godkendt uden åbne P0/P1-problemer.

---

# 23. Deployment og release

Deploy skal være simpelt, reproducerbart og billigt. Primær plan er statisk Vite-deploy på Vercel med CDN, HTTPS, preview deployments og immutable/reversible releases. Supabase tilføjes kun, når konto/cloud-synk er aktiveret. Miljøvariabler må ikke indeholde hemmeligheder i klienten, og ingen gratis plan må automatisk opgraderes til betaling.

Før produktion:

1. Kør den dokumenterede one-run pipeline på rent miljø.
2. Test installerbar PWA, offline, service worker update og data persistence på fysisk eller troværdig mobilbrowser.
3. Test vigtigste ruter direkte og visuelt.
4. Gennemfør privacy/security check og release notes.
5. Udrul gradvist, hvis cloud-del eller migrationskode introduceres; hav rollback-plan.
6. Bekræft Vercel- og Supabase-planernes aktuelle kvoter, projektgrænser og billing-status. Bekræft særskilt, at LLM_MODE er `off`, medmindre den gratis, manuelle allowlist-gate er godkendt.
7. Lås den erklærede browserbaseline, kør PWA-opdateringsscenariet med aktiv timer, og gennemfør storage-full-/import-/migrations-recovery.
8. Gem releasepakken med testbeviser, rollout-/rollback-plan, databehandlingsstatus, øvelsesreview og kendte begrænsninger.

Efter release overvåges fejl privacy-bevarende. Produktmetrics må ikke kompromittere workout- eller helbredsdata.

---

# 24. Fremtidige udvidelser (ikke v1-blokering)

- Valgfri AI-coach som et tydeligt supplement, aldrig generatorens eneste vej.
- Apple Watch / Wear OS, widgets og låseskærmsstatus.
- Live holdskærm og coach mode.
- Delbare workout templates og privat holdbibliotek.
- Mere avancerede benchmarks, periodisering og autoregulering.
- Flere sprog med dansk som førsteprioritet.

Alle udvidelser skal bruge de eksisterende versionerede data-kontrakter og må ikke bryde offline-first-princippet.

---

# 25. Endelig byggeinstruks til Codex/Claude Code

Byg WHATWORK som et færdigt, responsive, offline-first PWA-produkt ud fra dette dokument. Start med det tekniske fundament, den versionerede øvelsesdatabase, engine/validatorer, PWA-lagring og kerneflows; implementér derefter visuelt system og skærme som ét sammenhængende produkt.

Tag velbegrundede, dokumenterede beslutninger inden for dette dokuments rammer. Stil kun spørgsmål, hvis en afgørende beslutning ikke kan udledes herfra. Erstat aldrig et krav med en dummy, placeholder eller utestet mock. Prioritér en mindre, fuldt fungerende og visuelt gennemført v1 over en stor, overfladisk app.

Brug Impeccable-skills/designprincipper, når de er tilgængelige i bygge-miljøet, til at forbedre designets helhed, spacing, interaktioner og visuelle konsistens. Hvis de ikke er tilgængelige, skal samme designkvalitet opnås manuelt.

Slut kun arbejdet, når Definition of Done og acceptance criteria er opfyldt og dokumenteret.

---

# 26. Eksterne rammer, der skal verificeres ved release

Følgende er brugt som teknisk/relationelt kildegrundlag for denne specifikation. De er ikke statiske kontrakter: priser, gratis kvoter, leverandørvilkår og platformfunktioner kan ændre sig. Release Auditor skal verificere dem igen på release-dagen og dokumentere resultatet.

- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) – gratis tier for udvalgte modeller på dokumentdatoen; gratis adgang er kvote- og vilkårsbegrænset.
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) – rate limits er per projekt/model og kan ændre sig.
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) – behandling af input på gratis/ubetalte tjenester skal vurderes, før noget eksternt sendes.
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) og [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) – public/publishable klientkonfiguration er ikke en hemmelighed; secret/service keys må ikke eksponeres, og RLS er obligatorisk.
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables) og [Sensitive Environment Variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables) – hemmeligheder skal holdes uden for kode og behandles som sensitive på server-siden.
- [CrossFit Level 1 Training Guide](https://library.crossfit.com/free/pdf/CFJ_English_Level1_TrainingGuide.pdf), [ACE Exercise Library](https://www.acefitness.org/resources/everyone/exercise-library/) og [USA Weightlifting – The Lifts](https://www.usaweightlifting.org/weightlifting101/the-lifts) – redaktionelle referencer til øvelseskategorier og teknik, ikke licens til at kopiere indhold.

---

# 27. V1.0-releasefundament: de sidste ikke-forhandlingsbare krav

Dette afsnit gør de produktionskrav eksplicitte, som ofte først opdages, når en app møder rigtige brugere, rigtige enheder og rigtige fejl. De er en del af V1.0 og må ikke skubbes til “senere”.

## 27.1 Træningssikkerhed, alder og ansvarlig produktadfærd

- V1 er for voksne. Appen må ikke bevidst indsamle data om børn eller markedsføres som en løsning til børn.
- WHATWORK er en workout-planlægger, ikke en læge, fysioterapeut eller coach-erstatning. Den må ikke diagnosticere, behandle skader eller love bestemte resultater.
- Før første træning og fra Profil skal der være en kort, rolig sikkerhedsnote: “Tilpas altid til din teknik og dagsform. Stop ved skarp smerte eller utryghed, og søg faglig hjælp ved behov.” Den må ikke være en mørk mønsteraftale eller blokere gæsteflowet.
- “Skån område” er et brugerens eget filter. Det gemmes som minimalt data, må ikke fortolkes medicinsk og må aldrig sende brugeren til en ekstern gratis AI-tjeneste.
- Uden benchmarks, registreret erfaring eller komplet udstyr vælges konservative progressioner, længere overgangstid og tydelige regressionsmuligheder. “Overrask mig” må aldrig vælge `advanced`-, `coach-only`- eller teknisk komplekse øvelser på et svagt datagrundlag.
- En kvalificeret træningsfaglig reviewer skal godkende katalogets standard-eligibility, skalering og substitutioner før produktion. Review er versioneret og kan spores tilbage til releasepakken.

## 27.2 Datalivscyklus, GDPR og transparens

- Local-first er standard: data ligger på enheden, indtil brugeren aktivt vælger konto/synk. Ingen reklameprofil, tredjeparts tracking-pixel eller salg af data.
- Før cloud-launch dokumenteres behandlingsformål, dataminimering, opbevaringstid, adgangsroller, underdatabehandlere, eventuelle overførsler uden for EU/EØS og kontaktvej for privatlivshenvendelser. Indhent juridisk vurdering, hvis den konkrete behandling kræver det.
- Brugeren kan i appen se, eksportere og slette sine data. Sletning beskriver klart, hvad der slettes lokalt straks, hvad der slettes i cloud, og hvilken snæver backup-retention der eventuelt gælder.
- E-mail bruges kun til kontoadgang og nødvendige servicebeskeder. Produktmails, analyser og AI-opt-in er separate, frivillige valg med enkelt fravalg.
- Support- og fejlrapporter må som standard kun indeholde teknisk metadata. Brugeren skal kunne godkende, før en diagnosticeringsrapport inkluderer loguddrag, og rapporten scrubbes for workoutindhold, kropsvægt, tokens og fri tekst.

## 27.3 Stabilitet, fejlrecovery og platformkontrakt

Følgende states er førstklassestates med dansk, konkret microcopy og testdækning – ikke generiske “noget gik galt”-sider:

| Situation | Påkrævet adfærd |
|---|---|
| Ingen forbindelse | Fortsæt med lokal generator, timer, historik og gemning. Vis kun en diskret offline-status. |
| Cloud-synk fejler | Behold lokal kopi, sæt synk køvis og forklar næste sikre skridt uden at miste data. |
| Valgfri LLM utilgængelig | Vis at den frivillige hjælp er væk; den allerede genererede/lokale workout fortsætter uændret. |
| Lokal lagerplads er fuld | Stop den næste skrivning sikkert, forklar hvordan data kan eksporteres eller frigøres, og overskriv aldrig ældre data i stilhed. |
| Import eller migration er ugyldig | Valider og afvis før write; behold originaldata og vis de konkrete felter/versionsproblemer. |
| Ny appversion findes | Lad brugeren udsætte opdateringen. En aktiv timer/workout afsluttes eller gemmes før reload. |

Platformbaseline for V1 dokumenteres og testes i aktuel stabil Safari på iPhone/iPad, aktuel stabil Chrome på Android samt aktuel stabil Chrome, Safari og Edge på desktop. Funktioner, som platformen ikke kan garantere i baggrunden, beskrives ærligt i UI og må ikke simulere falsk præcision.

## 27.4 PWA-opdatering, databaseændringer og backup

- Service worker må aldrig overtage en aktiv session uden brugerens bevidste handling. Vis “Opdatering klar – hent efter din workout” og anvend først versionen i et sikkert øjeblik.
- Datamigreringer er additive, versionsstyrede og testet mod anonymiserede fixtures. En migration må ikke slette data som standard og skal have preflight, backup/eksportmulighed, idempotens og rollback-/recovery-plan.
- Produktionsdata og øvelsesregler sikkerhedskopieres efter et dokumenteret interval, men backup er ikke en undskyldning for svage autorisationsregler. Restore testes med ejeradskillelse.
- Alle ændringer til workout-engine, øvelsesdata, scaling eller validatorer får en changelog-post med effekt, risiko, testscenarier og rollback-beslutning.

## 27.5 Indholdsrettigheder, trademarks og originale assets

- WHATWORK må beskrive almindelige træningsformater og internationale øvelsesnavne, men må ikke udgive sig for at være tilknyttet CrossFit, HYROX, Concept2, Apple, Google, OpenAI, Anthropic eller andre tredjepartsbrands uden skriftlig ret.
- Brug ikke kopierede workouttekster, billeder, video, benchmarks, logoer, programnavne eller brandede ikoner. Lav egne danske instruktioner og egne WHATWORK-SVG’er; opbevar et licens-/asset-register for alt eksternt materiale.
- “Apple Garamond-inspireret” er kun en visuel retning. Den leverede app bruger kun lovlige skrifter og egne glyphs/wordmarks.
- Hvis en maskine eller et brand nævnes for kompatibilitet, skal det ske faktuelt og uden at antyde godkendelse, partnerskab eller certificering.

## 27.6 Privacy-bevarende drift, misbrugsværn og omkostningskontrol

- Observability er dataminimal: mål kun fx teknisk succesrate, lokal genereringstid, offline-recovery og fejltype. Send aldrig workoutindhold, kropsvægt, e-mail, fritekst, auth headers eller nøgler til analytics.
- Alle offentlige endpoints har payload-grænser, schema-validering, per-IP/per-konto rate-limit og abuse-monitorering. Eksport, magic-link, synk, import og LLM-bro har selvstændige grænser.
- Eventuel LLM-drift har en hard “0 kr.”-politik: ingen betalingskort, ingen paid fallback, ingen automatisk provider-skift, server-side allowlist, manuel kill-switch og daglig kvote på den valgte gratis tier. Hvis betingelserne ikke kan bevises på release-dagen, forbliver `LLM_MODE=off`.
- Ved mistanke om kompromis eller unormalt forbrug: deaktiver den berørte integration først, roter hemmeligheder, bevar kun nødvendig teknisk evidens og følg den dokumenterede hændelsesplan.

## 27.7 Mål, produktlæring og releasepakke

V1 måles på, om den hjælper brugeren hurtigt til en sikker, afviklelig workout – ikke på engagement for enhver pris. Prioriterede kvalitetsmål er: lokal generator-success, realistisk tidsestimat, validator-afvisninger med forståelig recovery, gennemført workout uden timer-tab og stabil offline-brug. Måling er privacy-bevarende og, hvor identifikator kan forekomme, opt-in.

Release Auditor må ikke godkende uden en komplet releasepakke med:

1. PRD-/acceptance-traceability og commit-/versionsreference.
2. Test- og visual-QA-resultater for erklærede browserbaselines.
3. Sikkerhedsreview, RLS-negative tests, secret scan og dataflow.
4. Øvelses-/scaling-review, asset-/licensregister og ændringslog.
5. PWA-update-, offline-, storage-full-, import- og migrations-recovery-bevis.
6. Aktuel Vercel/Supabase/LLM-kvote-, billing- og kill-switch-status.
7. Rollout-, rollback-, support- og incident-runbook med ansvarlig ejer.

---

# 28. Tilslutnings- og launchguide: gør WHATWORK fuldt funktionsdygtig

Dette afsnit er den praktiske rækkefølge for at koble driftstjenester på den færdige app. Følg rækkefølgen. WHATWORK er først klar til at få eksterne tjenester på, når den lokale PWA, regelmotoren, timeren og offline-data fungerer uden konto og uden LLM.

> **Den vigtigste regel:** Appen skal altid være brugbar uden Gemini, Supabase og netværk. Vercel hoster appen; Supabase tilføjer valgfri konto/synk; Gemini kan højst være valgfri, gratis hjælp. Ingen af dem må blive en forudsætning for at generere eller gennemføre en workout.

## 28.1 Den anbefalede tilslutningsrækkefølge

1. Byg og godkend den lokale React/Vite-PWA med IndexedDB, generator, timer, historik, import/eksport og alle validatorer.
2. Opret et privat Git-repository og en sikker, tom `.env.example`; commit aldrig rigtige værdier eller nøgler.
3. Kobl Vercel på repository’et og få preview- samt produktionsdeploy til at fungere uden cloud og LLM.
4. Opret Supabase og tilføj Auth, migrations, RLS og privat cloud-synk. Test ejeradskillelse, før der findes rigtige brugerdata.
5. Slå først derefter Gemini-broen til — kun hvis den konkrete gratis model, kvote og vilkår er bekræftet på dagen, og `LLM_MODE=off` stadig giver fuld app-funktion.
6. Gennemfør hele one-run pipeline, den fysiske mobil-QA, security-review og releasepakken fra afsnit 27.7.

## 28.2 Fælles grundopsætning og miljøvariabler

Opret mindst tre miljøer: **lokal udvikling**, **preview** og **produktion**. De må ikke dele database, secrets eller LLM-kvote. Hav en fil med kun variabelnavne og forklaring, fx `.env.example`; den må aldrig indeholde værdier.

| Variabel | Hvor den må ligge | Formål | Må aldrig ligge i |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Lokal `.env.local`, Vercel preview/production | Offentlig projekt-URL til Supabase-klienten. | Ikke et problem i browseren; det er ikke en secret. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Lokal `.env.local`, Vercel preview/production | Offentlig client key sammen med RLS. | Må aldrig misforstås som adgangskontrol. |
| `SUPABASE_SERVICE_ROLE_KEY` | Kun server-side secret store, hvis en konkret adminfunktion kræver den. | Privilegerede baggrunds-/adminopgaver. | Git, `VITE_*`, klientkode, browser, PWA-cache og logs. |
| `GEMINI_API_KEY` | Kun server-side secret store, når gratis Gemini-bro er godkendt. | Serverens valgfrie Gemini-kald. | Git, `VITE_*`, klientkode, browser, PWA-cache og logs. |
| `LLM_MODE` | Server-side miljøvariabel. | `off` som standard; eksplicit kill-switch. | Klientens runtime-konfiguration. |

`.env.local`, `.env.*.local` og platform-filer med reelle værdier skal være i `.gitignore`. CI kører secret-scan før merge og før deploy. Hvis en secret nogensinde ender i et commit, preview, log eller klientbundle, skal den roteres/revokeres — ikke blot slettes fra den seneste fil.

## 28.3 Kobl Vercel på: hosting, previews og produktionsdomæne

1. Opret eller log ind på Vercel og importér det private Git-repository.
2. Vælg Vite som framework, byg med `npm run build` og brug `dist` som output-mappe. Den konkrete build skal komme fra repository’ets låste package manager og one-run pipeline — ikke fra en manuel lokalmaskineupload.
3. Sæt Vercel til at lave preview-deploy for reviewede branches og produktion kun fra den beskyttede hovedbranch. Preview må bruge sit eget Supabase-projekt eller helt slukket cloud; det må aldrig dele produktionsdata eller produktionssecrets.
4. Tilføj kun de nødvendige miljøvariabler i Vercels Environment Variables. `VITE_SUPABASE_URL` og `VITE_SUPABASE_PUBLISHABLE_KEY` må godt eksistere i klientbuildet; alle andre følsomme værdier markeres Sensitive og læses kun af serverfunktioner.
5. Konfigurér et eget domæne, HTTPS og en enkel redirect-policy. Hvis der er en serverfunktion, skal dens CORS-allowlist kun indeholde de faktiske WHATWORK-domæner og relevante previewdomæner.
6. Konfigurér Content-Security-Policy, HSTS, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, restriktiv `Permissions-Policy` og caching, der aldrig cacher brugerdata eller server-svar med secrets.
7. Test en preview-URL med gæsteflow, offline efter cache, direkte ruter, PWA-update og uden cloud. Først derefter forbindes produktionsdomænet.

**Vercel er færdigtilsluttet, når:** en ren checkout kan bygge, en preview deployes automatisk, en produktionsrelease er reversibel, ingen hemmelighed er synlig i klienten, og appen stadig virker med `LLM_MODE=off` samt uden Supabase-login.

## 28.4 Kobl Supabase på: projekt, auth, data og sikker synk

1. Opret et nyt Supabase-projekt til **produktion** og et separat projekt til **preview/test**. Vælg dataplacering ud fra den faktiske EU/DK-databehandlingsvurdering; vær ikke afhængig af en antaget region.
2. Hent projekt-URL og **publishable key** fra projektets Connect/API-område. Indsæt kun disse to offentlige værdier i lokal `.env.local` og Vercel for den rigtige miljøscope.
3. Opret alle dataobjekter som versionsstyrede SQL-migrations i repository’et — aldrig som udbokumenterede håndændringer. Mindst: `user_profiles`, `workouts`, `workout_completions`, `programs`, `sync_envelopes` og eventuelle private storage-objekter. Hver bruger-ejet række har `user_id uuid not null` og relevante tidsstempler/versioner.
4. Aktivér Row Level Security på **alle** eksponerede tabeller, views og storage buckets fra første migration. Default er deny. Hver select/insert/update/delete-policy begrænser adgang til den autentificerede ejer, typisk `user_id = auth.uid()`. Deling kommer kun senere med en særskilt, testet policy.
5. Opret Auth med passwordless magic link som V1-standard, medmindre en anden moden provider dokumenteres bedre. Angiv udviklings-, preview- og produktions-redirect-URL’er eksplicit; vilde redirects er forbudt. Slå ikke selvskrevet password- eller tokenlogik til.
6. Brug private Storage-buckets og ejerbaserede policies for eksport, backup eller vedhæftninger. Ingen public bucket, public backup eller forudsigelig download-URL som standard.
7. Behold IndexedDB som source of truth på enheden. En synk kan køres køvis, retry’e sikkert og konflikte pr. objekt; den må aldrig blokere en aktiv workout eller overskrive en lokal completion i stilhed.
8. Kør automatiske negative tests med mindst to testbrugere: Bruger A må ikke via UI, REST, manipuleret ID eller Storage-URL læse, ændre, eksportere eller slette bruger B’s data.

**Supabase er færdigtilsluttet, når:** gæsteflowet fortsat virker offline uden projektet, konto kan synkronisere uden datatab, RLS-negative tests er grønne i begge miljøer, og service-role-nøglen ikke kan findes i browser, source map, cache eller Git.

## 28.5 Kobl den gratis Gemini-bro på — kun hvis den fortsat er 0 kr.

Gemini er **ikke** nødvendig for workout-generatoren. Den kan først bruges, når den lokale engine allerede skaber det endelige, validerede resultat. Den må fx formulere en kort dansk forklaring til en workout, men må aldrig vælge øvelser, beregne weights, omgå validatorer eller være den eneste vej til output.

1. Gå til Google AI Studio, opret/forbind et særskilt projekt til WHATWORK og opret en Gemini API key efter Googles aktuelle sikkerhedsmodel. Brug den mest begrænsede nøgleform, som den officielle dokumentation anbefaler; nye Gemini-nøgler kan være authorization keys.
2. Bekræft **før aktivering**: den konkrete model er gratis på kaldtidspunktet, projektet har ingen betalingsprofil eller betalingskort, gratis kvote/rate limit er kendt, og vilkårene accepterer den planlagte behandling. Hvis ét punkt ikke kan bevises, forbliver `LLM_MODE=off`.
3. Begræns nøglen til Gemini API’en og den serveridentitet/IP, som udfører kaldet, hvor platformen tillader det. Behandl den som et password: aldrig i browseren, aldrig som `VITE_GEMINI_API_KEY`, aldrig i Git.
4. Indsæt `GEMINI_API_KEY` kun som Sensitive servervariabel på Vercel. Byg en lille serverfunktion, fx `/api/ai/explain`, som verificerer session/opt-in, rate-limiter, begrænser inputstørrelse og kalder Gemini. Browseren kalder kun denne WHATWORK-endpoint.
5. Serverfunktionen må kun sende en minimal, anonymiseret repræsentation af en allerede gyldig workout. Send aldrig navn, e-mail, auth header, kropsvægt, køn/skaleringsprofil, historie, skån-tags, fri tekst eller andre følsomme data til en gratis tredjepartstjeneste.
6. Validér svaret mod et stramt schema og vis det kun som et frivilligt supplement. Timeout, 429, filterfejl eller ugyldigt svar giver en dansk fallback og påvirker aldrig workout, timer, synk eller historik.
7. Indfør hard daglig kvote, per-IP/per-konto rate-limit, input/output-grænser, anonym teknisk telemetry og en manuel kill-switch. Ingen automatisk retry mod betalt model, ingen automatisk provider-skift og ingen automatisk betalingsaktivering.

**Gemini er færdigtilsluttet, når:** browseren aldrig kan udtrække nøglen, LLM-kaldet kan deaktiveres globalt uden funktionsbrud, gratis status er dokumenteret i releasepakken, og test viser at ingen følsom brugerdata forlader appen.

## 28.6 Den valgfri serverfunktion: minimal kontrakt

Hold Vercel-funktionen lille. Den modtager kun et schema-valideret request som fx `{ locale: 'da', workoutSummary: { format, duration, movementNames } }` efter et tydeligt opt-in. Den returnerer kun schema-valideret dansk tekst, fx `{ explanation: string }`.

Funktionen skal i rækkefølge: kontrollere origin og bruger/grænse; kontrollere `LLM_MODE`; validere og minimere input; kalde allowlistet gratis model; validere output; scrubbe fejl; og returnere en sikker fallback. Den må ikke have direkte adgang til alle brugerens data, ikke skrive ændringer uden særskilt autorisation og ikke logge prompt eller svarindhold.

## 28.7 Sidste tilslutningstjek før offentlig launch

1. **Lokal baseline:** Slå net, Supabase og LLM fra. Generér, start timer, app-switch, genåbn og gem completion som gæst.
2. **Vercel:** Kør one-run pipeline fra ren checkout, deploy preview, test direkte ruter og verificér response headers, PWA-installation og rollback.
3. **Supabase:** Kør migrations mod preview, RLS-negative tests, magic-link redirect-test, gæst-til-konto-migration, synk-konflikt og sletning/eksport.
4. **Gemini:** Bekræft gratis status igen; kør secret scan; kald via serverfunktion; test `LLM_MODE=off`, kvote opbrugt, timeout og malformed svar; tjek at der ikke forlader følsomme data.
5. **Skærme og touch:** Kør viewport-/aspect-ratio-matrix fra afsnit 4.5 og fysisk iPhone/Android-QA. Test især bundnavigation, generator-CTA, loading screen, mobile keyboard og Timer Mode i portræt/landskab.
6. **Releasebeslutning:** Udfyld releasepakken. Mangler en gratis-kvote-, RLS-, secret-, recovery- eller mobiltest, er det et no-go — ikke noget der rettes efter lancering.

## 28.8 Drift efter launch

- Revider Vercel-, Supabase- og Gemini-vilkår, gratis kvoter, modelstatus og billing-status før hver release. Tjenester må ændre priser, produkter og sikkerhedsmodeller.
- Hold `LLM_MODE=off`, når gratis status er uklar eller quota er opbrugt. Appens lokale funktion er den korrekte fallback.
- Roter nøgler straks ved mistanke om læk, slå den berørte integration fra, og dokumentér hændelsen uden at lagre brugerens workout- eller kontodata i fejlrapporten.
- Test restore, PWA-update, account deletion, RLS og mobile touchflows periodisk — ikke kun ved første launch.
