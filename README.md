# WHATWORK

> Bygget til funktionel fitness.

WHATWORK er en dansk træningsapp, der bygger en færdig, konkret workout på sekunder —
til dig selv, en makker eller et helt hold. Du fortæller hvor lang tid I har, hvem der
træner, hvilket niveau og hvilket udstyr der står i salen. Appen leverer resten: øvelser,
kilo, skiver, pauser, rækkefølge og en timer, der kører workouten fra start til slut.

Ingen konto. Ingen server. Ingen cloud-synk. Alt sker lokalt på din egen enhed.

## Hvad appen kan

**Smart Mix-generator** — Vælg tid, antal deltagere, niveau (1–5), en retning som puls,
tung, ben, overkrop eller allround, og det udstyr I faktisk har for hånden. Motoren bygger
op til 64 kandidat-workouts pr. generering, tjekker hver enkelt for sikkerhed, udstyr,
tidsbudget og teknisk volumen, og vælger den bedste — uden at gentage format eller
øvelseskombination fra sidste gang.

**Konkrete tal, ikke gæt** — Kilo skaleres efter niveau og profil og snappes til det
udstyr, du rent faktisk har. For vægtstang vises både samlet vægt, stangens vægt og skiver
pr. side, fx «50 kg i alt — 20 kg stang + 15 kg på hver side».

**Partnerworkouts og holdtræning** — You go/I go, delt arbejde og team-rotation med
udstyrslogistik, der tager højde for hvor mange der skal dele det samme håndvægte- eller
kettlebell-sæt.

**14 træningsformater** — AMRAP, EMOM, E2–E5MOM, For Time, Chipper, Ladder, Interval,
Styrke, Styrke + Conditioning og de tre partnerformater ovenfor.

**Indbygget timer** — Bygget direkte ud fra workoutens blokke og øvelser. Segmenter med
fast varighed skifter selv; åbne segmenter venter på et tryk. Tiden regnes ud fra urets
faktiske klokkeslæt, så den er korrekt selv efter en genindlæsning eller et skift væk fra
appen midt i settet.

**Flerugers program** — Generér et helt træningsprogram (2–12 uger, 2–6 dage/uge) ud fra
et mål som allround, styrke + conditioning, engine, eller fokus på ben/overkrop.

**WW Match** — En intern, forklarlig kvalitetsscore med fem delscorer: sikkerhed, tid,
retning, afvikling og variation. Den er ikke en videnskabeligt valideret score, men et
gennemsigtigt signal om, hvor godt en workout matcher det, du bad om.

**Historik, statistik og favoritter** — Gennemførte workouts gemmes automatisk med øvelser,
format og tid. Statistiksiden viser mønstre over tid, og du kan gemme favoritworkouts til
senere.

**Udstyrsbibliotek** — Et katalog på 106 øvelser og alt fra kropsvægt, håndvægte og
kettlebells til rower, ski-erg, assault bike, slæde, wall ball og sandbag. Sæt kun det
udstyr, salen faktisk har, så genereres der aldrig en øvelse, I ikke kan lave.

**AI Mix (valgfrit, slået fra som standard)** — Med egen API-nøgle kan et AI-lag foreslå
variation oven på den lokale motor. AI'en foreslår kun format, øvelsesvalg og et rationale
inden for rammer, appen selv sætter — den lokale regelmotor ejer stadig alle kilo, skiver,
sikkerhedstjek og den endelige WW Match-score. Fejler kaldet, falder appen automatisk
tilbage til den lokale generator.

## Sådan er den bygget

- **Local-first.** Data ligger i IndexedDB (med localStorage som fallback) direkte på
  enheden. Ingen af dine data forlader telefonen, medmindre du selv eksporterer dem.
- **PWA.** Kan installeres som en app og virker offline efter første besøg. Opdateringer
  installeres i baggrunden og overtager først, når du selv siger ja.
- **Import/eksport.** Tag dine data med som en JSON-fil med versioneret skema — med preview
  og bekræftelse, så en fejlbehæftet fil aldrig overskriver eksisterende data.
- **Tilgængelighed.** Bygget til at virke ned til 320 px skærmbredde, med 44–48 px
  trykflader, synlig fokusmarkering, korrekte landmarks og `prefers-reduced-motion`.
- **Dansk gennemgående.** Alle sider har en dansk sti — fx `/generator`, `/timer`,
  `/historik`, `/statistik` — og kan åbnes direkte, bogmærkes og deles.

React 18 og TypeScript i strict mode, bygget med Vite. Ingen UI-framework og intet
ikonbibliotek — designsystem og glyffer er appens egne.

## Kendte afgrænsninger

- Ingen konto og ingen cloud-synk — kun lokal lagring på enheden.
- Lyd, haptik og baggrundsadfærd i timeren afhænger af browser og styresystem.
- Ikke valideret på fysiske enheder eller af en træningsfaglig person. Belastningsforslag
  og afviklingsformer bør gennemgås af en coach, før appen bruges til at programmere for
  andre end en selv.

## Sikkerhed

WHATWORK er en træningsplanlægger — ikke en læge, fysioterapeut eller coach. Appen
diagnosticerer og behandler ikke skader, kender ikke din krop og garanterer ingen
resultater. Skånehensyn er et filter i programmeringen, ikke en medicinsk vurdering.
Tilpas altid til teknik og dagsform, stop ved skarp smerte eller utryghed, og søg faglig
hjælp ved behov.
