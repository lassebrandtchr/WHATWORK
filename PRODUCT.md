# Product

## Register

product

## Users

Voksne der træner funktionel fitness — alene, med en makker eller i et lille hold — fra
begyndere til elite. De bruger appen typisk på telefonen, ofte i hallen, midt i eller
lige før en workout, nogle gange med svedige hænder og uden præcis musemarkør. De vil
hurtigt have en workout eller et program, der rent faktisk kan afvikles med det udstyr,
den tid og de mennesker, de har for hånden — uden formulartræthed og uden at skulle
kende funktionel fitness-jargon på forhånd. Job to be done for Program-siden specifikt:
"Jeg vil have et program over flere uger med variation og progression" og "Jeg vil kunne
se, hvad jeg har lavet, og om jeg flytter mig."

## Product Purpose

WHATWORK er en dansk, lokal, regelbaseret træningsgenerator (PWA). Den bygger en
konkret, færdig workout eller et flerugers program på sekunder — med rigtige kilo,
skiver, pauser og rækkefølge, ikke gæt. Ingen konto, ingen server, ingen cloud-synk er
påkrævet; alt kører offline på egen enhed. Programmer er en af fire hovedområder
(Hjem, Program, Historik, Profil) og skal føles som en selvstændig, gennemtænkt del af
produktet — ikke en efterhåndsmodel af enkelt-workout-generatoren.

## Brand Personality

Kraftfuld, hurtig, atletisk, enkel, premium og let drilsk. Ikke aggressiv/macho, og ikke
et koldt SaaS-dashboard. Må have humor, aldrig på bekostning af tydelighed eller
sikkerhed. Mørk charcoal (ikke fladt sort) som base er standard; orange er
handlings-signalet, brugt sparsomt og med intention. Navy er reserveret til "Overrask
mig", elektrisk "volt"-gul til "Kør igen" — begge special-farver, ikke genbrugelige
knapfarver. Grøn/rød er status, aldrig pynt. Tonen i tekst er kort, konkret, selvsikker
dansk — aldrig AI-agtigt sprog eller importeret engelsk UI-jargon.

## Anti-references

Ingen overdrevet glassmorphism, puffy kort eller stak-på-stak nested cards. Ingen
hero-billeder af generiske fitnessmodeller eller stock-agtige ikoner. Intet importeret
ikonbibliotek (Lucide, Heroicons, Font Awesome) og ingen emoji som UI — kun appens egne
SVG-glyffer. Ikke en "AI-tænker-højt" loading-oplevelse (ingen falsk usikkerhed, ingen
overdrevne spinnere). Ikke et koldt, dashboard-agtigt produkt-UI med KPI-mur. Undgår
generiske SaaS-mønstre (hero-metric-skabelonen, identiske ikon+overskrift-kortgitre).

## Design Principles

1. **Sikkerhed og korrekt træningslogik før alt andet.** Ingen visuel løsning må skjule
   eller forsimple reelle tal, skaleringer eller sikkerhedshensyn.
2. **Konkrete tal, ikke gæt.** Vis rigtige kilo, skiver, minutter og reps — aldrig vage
   beskrivelser, hvor et konkret tal findes.
3. **Mobile-first og robust offline.** Motoren er lokal og synkron; UI skal aldrig
   foregive netværksafhængighed eller kunstigt forlænge ventetid ud over det tilsigtede.
4. **Enkel og tydelig frem for imponerende.** Kompleksiteten bor i motoren, ikke i
   brugerens oplevelse — avancerede valg gemmes bag tydelige, forudsigelige mønstre.
5. **Forklar alt inline.** Ingen jargon uden en tilstødende forklaring; brugeren skal
   aldrig skulle vide, hvad EMOM eller en deload-uge betyder på forhånd.
6. **Premium gennem restraint, ikke dekoration.** Ét tydeligt accentsignal ad gangen;
   orange/navy/volt er reserverede, ikke genbrugelige som generel pynt.
7. **Destruktive handlinger kræver en tydelig, uforhastet bekræftelse** — særligt hvor de
   kan slette fremdrift eller gennemførte data.

## Accessibility & Inclusion

Mål mindst WCAG 2.2 AA. Semantisk HTML og korrekt heading-rækkefølge; fuld
tastaturnavigation med synlig fokusmarkering; modaler/drawers med fokusfælde, korrekt
returneret fokus og Escape-lukning; kontrast mindst AA og farve aldrig eneste
statussignal; touchmål mindst 44×44 px (primære handlinger 48×48 px); screen reader
-labels for alle custom glyffer og dynamiske statusbeskeder; `prefers-reduced-motion`
respekteres fuldt ud, og ingen animation er eneste bærer af betydning. Minimum
viewport-bredde 320 px, ingen vandret hovedscroll. Sproget er dansk gennemgående.
