/**
 * Ordforklaringer.
 *
 * Alt fagsprog i appen skal kunne forstås af en person, der aldrig har været i et
 * træningscenter. Hvert udtryk har derfor tre niveauer:
 *
 *  - `short`: én sætning i hverdagssprog, som kan stå direkte ved siden af ordet.
 *  - `long`:  den fulde forklaring til ordlisten, stadig uden nyt fagsprog.
 *  - `why`:   hvorfor tallet eller begrebet overhovedet betyder noget for brugeren.
 *
 * Reglen er enkel: står en forkortelse i en brugertekst, skal den findes her.
 * `assertExplained` i testene håndhæver det.
 */

export type GlossaryCategory =
  | 'styrke' | 'anstrengelse' | 'planlægning' | 'kondition' | 'workout' | 'data' | 'sikkerhed';

export interface GlossaryEntry {
  id: string;
  /** Ordet, som det står i brugerfladen. */
  term: string;
  /** Andre skrivemåder, som skal genkendes som det samme ord. */
  aliases: string[];
  category: GlossaryCategory;
  short: string;
  long: string;
  why: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  /* ---------- Styrke ---------- */
  {
    id: '1rm',
    term: '1RM',
    aliases: ['1 RM', 'én-rep-max', 'one rep max'],
    category: 'styrke',
    short: 'Den tungeste vægt, du kan løfte én gang.',
    long:
      '1RM står for "1 repetition maximum" og betyder den tungeste vægt, du kan løfte '
      + 'præcis én gang med god teknik. Kan du løfte den to gange, er det ikke din 1RM — '
      + 'så er din rigtige 1RM højere.',
    why:
      'Mange programmer angiver vægte som en procentdel af din 1RM. Uden tallet er en '
      + 'procent bare et gæt. WHATWORK kræver ikke, at du tester din 1RM — du kan nøjes '
      + 'med et lettere sæt, som appen regner om.',
  },
  {
    id: 'e1rm',
    term: 'e1RM',
    aliases: ['estimeret 1RM', 'beregnet 1RM'],
    category: 'styrke',
    short: 'Et beregnet bud på din tungeste enkelte løft — uden at du skal teste det.',
    long:
      'e1RM betyder "estimeret 1RM". I stedet for at gå til den tungeste vægt, du kan klare '
      + 'én gang, tager du et lettere sæt — for eksempel tre gentagelser — og fortæller, hvor '
      + 'hårdt det føltes. Ud fra det regner appen, hvad du sandsynligvis kunne have løftet '
      + 'én gang. Det er et kvalificeret skøn, ikke en måling.',
    why:
      'Det gør det muligt at beregne dine vægte uden at du skal maxe ud. Til gengæld er det '
      + 'et skøn, og appen viser altid, hvor sikkert det er.',
  },
  {
    id: 'training-max',
    term: 'Training max',
    aliases: ['TM', 'træningsmaks'],
    category: 'styrke',
    short: 'Et bevidst lavere tal end din maksimale styrke, som programmets vægte regnes ud fra.',
    long:
      'Et training max er et tal, der ligger omkring 85-90 % af det, du reelt kan løfte én '
      + 'gang. Programmet regner alle procenter ud fra dette lavere tal i stedet for din '
      + 'absolutte maksimale styrke.',
    why:
      'Fordi din maksimale styrke svinger fra dag til dag. Regner programmet ud fra et lidt '
      + 'lavere tal, rammer vægtene rigtigt også på en dårlig dag — i stedet for at være for '
      + 'tunge hver gang du er træt.',
  },
  {
    id: 'top-set',
    term: 'Top-sæt',
    aliases: ['topsæt', 'top set'],
    category: 'styrke',
    short: 'Dagens tungeste sæt, som bestemmer hvor tungt resten af passet bliver.',
    long:
      'Et top-sæt er det tungeste arbejdssæt i et pas. Du kører det først, og hvor hårdt det '
      + 'føltes afgør, hvad de efterfølgende sæt skal veje. Var det lettere end forventet, går '
      + 'resten lidt op. Var det hårdere, går resten ned.',
    why: 'Det lader dagens form styre passet i stedet for et tal, du satte for en måned siden.',
  },
  {
    id: 'backoff',
    term: 'Backoff',
    aliases: ['backoff-sæt', 'back-off'],
    category: 'styrke',
    short: 'De lettere sæt, du kører efter dagens tungeste sæt.',
    long:
      'Backoff-sæt er arbejdssæt med lavere vægt end top-sættet — typisk 10-15 % lettere. '
      + 'De giver mængden af træning, mens top-sættet giver den tunge påvirkning.',
    why:
      'Du kan ikke få nok træningsmængde af ét tungt sæt alene, og du kan ikke tåle mange '
      + 'tunge sæt. Backoff løser begge dele.',
  },
  {
    id: 'hard-set',
    term: 'Hårdt sæt',
    aliases: ['hard set', 'hårde sæt'],
    category: 'styrke',
    short: 'Et sæt, der er udfordrende nok til at give fremgang — ikke bare bevægelse.',
    long:
      'Et hårdt sæt er et arbejdssæt, hvor du stopper med højst nogle få gentagelser tilbage '
      + 'i tanken. Opvarmningssæt og lette sæt tæller ikke med.',
    why:
      'Antallet af hårde sæt om ugen er det bedste enkle mål for, hvor meget træning du '
      + 'faktisk har lavet. Derfor er det den enhed, appen budgetterer i.',
  },
  {
    id: 'pr',
    term: 'PR',
    aliases: ['personlig rekord', 'personal record'],
    category: 'styrke',
    short: 'Din personlige rekord — det bedste, du har præsteret i netop den øvelse.',
    long:
      'PR står for personlig rekord. Det kan være den tungeste vægt, flest gentagelser eller '
      + 'den hurtigste tid. WHATWORK holder de forskellige slags adskilt, fordi en rekord i '
      + 'antal gentagelser ikke er sammenlignelig med en rekord i vægt.',
    why: 'For at fremgang måles på det, der faktisk er sammenligneligt.',
  },

  /* ---------- Anstrengelse ---------- */
  {
    id: 'rpe',
    term: 'RPE',
    aliases: ['anstrengelsesskala'],
    category: 'anstrengelse',
    short: 'En skala fra 1 til 10 for, hvor hårdt et sæt føltes.',
    long:
      'RPE betyder "oplevet anstrengelse". RPE 10 vil sige, at du ikke kunne have taget én '
      + 'gentagelse mere. RPE 9 betyder, at du havde én tilbage, RPE 8 at du havde to tilbage, '
      + 'og så videre. Det er din egen vurdering.',
    why:
      'Det lader programmet tage højde for dagsform. To ens sæt kan føles vidt forskelligt '
      + 'afhængigt af søvn, stress og hvad du lavede i går.',
  },
  {
    id: 'rir',
    term: 'RIR',
    aliases: ['gentagelser tilbage', 'reps in reserve'],
    category: 'anstrengelse',
    short: 'Hvor mange gentagelser du havde tilbage, da du stoppede sættet.',
    long:
      'RIR betyder "gentagelser i reserve". 2 RIR vil sige, at du kunne have taget to '
      + 'gentagelser mere med acceptabel teknik. Det er den samme skala som RPE, bare vendt '
      + 'om: 2 RIR svarer til RPE 8.',
    why:
      'De fleste finder det lettere at vurdere "jeg havde to tilbage" end at sætte et tal '
      + 'på anstrengelsen. Brug den af de to, der falder dig naturligt.',
  },
  {
    id: 'session-rpe',
    term: 'Sessions-RPE',
    aliases: ['session RPE'],
    category: 'anstrengelse',
    short: 'Hvor hårdt hele træningen føltes, sat på en skala fra 1 til 10.',
    long:
      'I stedet for at vurdere hvert enkelt sæt, giver du hele passet ét tal, når du er '
      + 'færdig. Ganges det med passets længde, får man et groft mål for dagens samlede '
      + 'belastning.',
    why:
      'Det er et hurtigt signal om, hvorvidt din uge er tungere, end den ser ud på papiret. '
      + 'Det er ikke en fysiologisk måling.',
  },
  {
    id: 'readiness',
    term: 'Overskud',
    aliases: ['readiness', 'dagsform'],
    category: 'anstrengelse',
    short: 'Hvor klar du er til at træne i dag — søvn, stress, ømhed og lyst.',
    long:
      'Overskud er en kort vurdering af, hvordan du har det inden træning. Appen bruger det '
      + 'til at justere let op eller ned, men den aflyser ikke din træning på et lavt tal.',
    why:
      'Et enkelt dårligt tal er ikke en dom. Derfor justerer appen kun lidt og beder dig '
      + 'vurdere igen efter opvarmningen.',
  },

  /* ---------- Planlægning ---------- */
  {
    id: 'anchor',
    term: 'Fast eksponering',
    aliases: ['anchor', 'anchors'],
    category: 'planlægning',
    short: 'Den træning, der skal være der hver uge, hvis målet skal nås.',
    long:
      'En fast eksponering er en øvelse eller en type træning, som ugen ikke må mangle. '
      + 'Træner du for at blive bedre til squat, skal der være squat hver uge — uanset hvor '
      + 'sjove de andre øvelser er.',
    why:
      'Det er forskellen på et program og en samling tilfældige træningspas. Appen siger fra, '
      + 'hvis en uge mangler en fast eksponering.',
  },
  {
    id: 'deload',
    term: 'Roligere uge',
    aliases: ['deload'],
    category: 'planlægning',
    short: 'En planlagt lettere uge, hvor mængden sættes ned, så kroppen kan indhente.',
    long:
      'I en roligere uge skæres antallet af sæt markant ned, mens en del af vægten bevares. '
      + 'Det er ikke en fridag og ikke en pause — det er mindre træning, så den træning du '
      + 'allerede har lavet, kan give effekt.',
    why:
      'Fremgang sker, mens du restituerer. Kører du hårdt i for mange uger i træk, samler '
      + 'trætheden sig, og fremgangen stopper.',
  },
  {
    id: 'taper',
    term: 'Nedtrapning',
    aliases: ['taper'],
    category: 'planlægning',
    short: 'De sidste uger før en konkurrence, hvor mængden falder, men farten bevares.',
    long:
      'Nedtrapning betyder, at du træner mindre, men stadig rører ved de tunge vægte eller '
      + 'det hurtige tempo. Formålet er at møde op frisk uden at have mistet noget.',
    why:
      'Det er ikke det samme som en roligere uge. En roligere uge skal fjerne træthed midt '
      + 'i et forløb; nedtrapning skal give topform på en bestemt dag.',
  },
  {
    id: 'progression',
    term: 'Progression',
    aliases: ['progressiv overload'],
    category: 'planlægning',
    short: 'At træningen bliver en smule sværere over tid, så kroppen bliver ved med at udvikle sig.',
    long:
      'Progression kan være mere vægt, flere gentagelser, flere sæt, kortere pauser eller '
      + 'hurtigere tempo. Appen ændrer normalt kun én ting ad gangen.',
    why:
      'Ændrer man flere ting samtidig, kan man ikke se hvad der virkede. Én ændring ad '
      + 'gangen gør fremgangen aflæselig.',
    },
  {
    id: 'double-progression',
    term: 'Dobbelt progression',
    aliases: [],
    category: 'planlægning',
    short: 'Først flere gentagelser, derefter mere vægt — og så forfra.',
    long:
      'Du starter for eksempel med 8 gentagelser og lægger én til hver uge, indtil du når 12. '
      + 'Så sættes vægten op, og du starter forfra på 8.',
    why:
      'Det virker uden at du kender dine maksimale tal, og det passer særligt godt til '
      + 'mindre øvelser og til begyndere.',
  },
  {
    id: 'assessment-week',
    term: 'Indkøringsuge',
    aliases: ['assessment week', 'testuge'],
    category: 'planlægning',
    short: 'En første uge, hvor appen måler dine tal i stedet for at gætte dem.',
    long:
      'Mangler appen de tal, den skal bruge for at regne vægte ud, bygger den en let uge med '
      + 'tekniske sæt, hvor du finder tallene. Bagefter er programmet dit eget.',
    why:
      'Alternativet ville være at finde på kilo, du aldrig har løftet. Én uge er hurtigere '
      + 'end et helt program, der rammer forkert.',
  },
  {
    id: 'volume',
    term: 'Mængde',
    aliases: ['volumen'],
    category: 'planlægning',
    short: 'Hvor meget du træner i alt — typisk målt i antal hårde sæt om ugen.',
    long:
      'Mængde dækker over det samlede arbejde: antal sæt, antal gentagelser og hvor tungt '
      + 'der blev løftet. I appen tælles den primært som antal hårde sæt.',
    why: 'Mængden er det, der oftest afgør, om du gør fremgang eller bare vedligeholder.',
  },
  {
    id: 'weak-point',
    term: 'Svagt punkt',
    aliases: ['weak point'],
    category: 'planlægning',
    short: 'Det sted i en øvelse, hvor løftet typisk går galt for dig.',
    long:
      'Et svagt punkt kan være bunden af en squat, hvor du sidder fast, eller den sidste del '
      + 'af et pres, hvor armene ikke kan strække ud. Det er ikke en muskel — det er et sted '
      + 'i bevægelsen.',
    why:
      'Hjælpeøvelser vælges efter det svage punkt. Uden det ville valget være gæt baseret '
      + 'på muskelnavne.',
  },
  {
    id: 'adherence',
    term: 'Gennemførelse',
    aliases: ['adherence'],
    category: 'planlægning',
    short: 'Hvor stor en del af de planlagte pas du faktisk har lavet.',
    long:
      'Gennemførelse måles som gennemførte pas ud af de planlagte. Pas, du har flyttet til en '
      + 'anden dag, tæller ikke som sprunget over.',
    why:
      'Hvis du kun når to ud af fire pas, er svaret som regel en mindre plan — ikke et '
      + 'hårdere program.',
  },

  /* ---------- Kondition ---------- */
  {
    id: 'talk-test',
    term: 'Taletesten',
    aliases: ['talk test'],
    category: 'kondition',
    short: 'Kan du tale i hele sætninger, mens du træner, er tempoet roligt.',
    long:
      'Taletesten er den enkleste måde at styre tempoet på. Kan du snakke normalt, er du i '
      + 'det rolige leje. Kan du kun sige nogle få ord, er du i det hårde.',
    why:
      'Den kræver hverken pulsur eller test, og den er mere brugbar end en formel baseret '
      + 'på din alder.',
  },
  {
    id: 'threshold',
    term: 'Tærskeltempo',
    aliases: ['threshold', 'tempo'],
    category: 'kondition',
    short: 'Det tempo, du lige akkurat kan holde i omkring en time.',
    long:
      'Tærskeltempo er anstrengende, men kontrolleret. Du kan holde det længe, men ikke tale '
      + 'meget imens. Det ligger mellem roligt og hårdt.',
    why: 'Det er det tempo, der flytter mest for udholdenhed uden at koste for meget.',
  },
  {
    id: 'critical-speed',
    term: 'Kritisk fart',
    aliases: ['critical speed'],
    category: 'kondition',
    short: 'Den højeste fart, du kan holde længe uden at gå død.',
    long:
      'Kritisk fart findes ved at løbe et par tidskørsler over forskellige distancer. Den '
      + 'siger mere om din udholdenhed end en enkelt maksimal test.',
    why: 'Den gør det muligt at sætte realistiske tempoer i stedet for at gætte.',
  },
  {
    id: 'compromised-running',
    term: 'Træt løb',
    aliases: ['compromised running'],
    category: 'kondition',
    short: 'At løbe med ben, der allerede er trætte fra en station.',
    long:
      'I HYROX løber man 1 km efter hver station. Benene er derfor aldrig friske, og tempoet '
      + 'falder markant i forhold til et almindeligt løb.',
    why:
      'Din tid på friske ben siger ikke ret meget om din tid i et race. Derfor trænes og '
      + 'måles det trætte løb for sig.',
  },
  {
    id: 'monostructural',
    term: 'Maskin- og løbearbejde',
    aliases: ['monostrukturelt', 'monostructural'],
    category: 'kondition',
    short: 'Kondition i én gentagen bevægelse — løb, romaskine, cykel eller ski.',
    long:
      'Modsat blandede træningspas med mange forskellige øvelser er det her én bevægelse, du '
      + 'gentager. Det gør det let at styre tempo og måle fremgang.',
    why: 'Det er den enkleste og mest målbare måde at bygge kondition på.',
  },

  /* ---------- Workout ---------- */
  {
    id: 'wod',
    term: 'WOD',
    aliases: ['dagens workout', 'workout of the day'],
    category: 'workout',
    short: 'Dagens træningspas.',
    long: 'WOD står for "workout of the day" — altså dagens træning, klar til at gå i gang med.',
    why: 'Det er blot navnet på ét enkelt pas, i modsætning til et program over flere uger.',
  },
  {
    id: 'amrap',
    term: 'AMRAP',
    aliases: [],
    category: 'workout',
    short: 'Så mange runder som muligt inden for en fast tid.',
    long:
      'AMRAP betyder "as many rounds as possible". Du får en liste af øvelser og en tid — for '
      + 'eksempel 15 minutter — og kører listen forfra igen og igen, til tiden er gået.',
    why: 'Du styrer selv tempoet, og resultatet er antal runder plus gentagelser.',
  },
  {
    id: 'emom',
    term: 'EMOM',
    aliases: ['E2MOM', 'E3MOM', 'E4MOM', 'E5MOM'],
    category: 'workout',
    short: 'Et nyt sæt arbejde starter hvert minut — resten af minuttet er pause.',
    long:
      'EMOM betyder "every minute on the minute". Du starter arbejdet, når uret slår, og den '
      + 'tid du har tilovers, er din pause. E2MOM er det samme, bare hvert andet minut.',
    why:
      'Uret styrer pausen, så arbejdet bliver ensartet. Derfor skal arbejdet kunne nås med '
      + 'god margin — ellers forsvinder pausen, og formatet holder ikke.',
  },
  {
    id: 'for-time',
    term: 'For Time',
    aliases: [],
    category: 'workout',
    short: 'Et fast stykke arbejde, som skal klares så hurtigt som muligt.',
    long:
      'Du kender arbejdet på forhånd og tager tid på, hvor længe du er om det. Der er som '
      + 'regel en øvre tidsgrænse, så passet ikke trækker ud.',
    why: 'Det gør to forsøg direkte sammenlignelige, hvis arbejdet er præcis det samme.',
  },
  {
    id: 'time-cap',
    term: 'Tidsgrænse',
    aliases: ['time cap'],
    category: 'workout',
    short: 'Det tidspunkt, hvor du stopper, uanset hvor langt du er nået.',
    long:
      'En tidsgrænse sikrer, at et pas ikke trækker ud i det uendelige. Når tiden er gået, '
      + 'noterer du, hvor langt du nåede.',
    why: 'Den holder passet inden for den tid, du har afsat, og beskytter mod at køre for længe.',
  },
  {
    id: 'scaling',
    term: 'Skalering',
    aliases: ['scaling', 'skalere'],
    category: 'workout',
    short: 'At tilpasse en øvelse, så den passer til dig, uden at træningen mister sit formål.',
    long:
      'Skalering kan være færre gentagelser, lettere vægt, kortere afstand eller en simplere '
      + 'udgave af øvelsen. Det vigtige er, at passet stadig træner det samme.',
    why:
      'Et skaleret pas er ikke et nemmere pas — det er det samme pas i din størrelse. Derfor '
      + 'skifter appen aldrig hele workouten ud, når du trykker "Gør lettere".',
  },
  {
    id: 'stimulus',
    term: 'Formål',
    aliases: ['stimulus'],
    category: 'workout',
    short: 'Det, træningen skal opnå — for eksempel puls, styrke eller teknik.',
    long:
      'Formålet er den ene sætning, der beskriver hvad passet går ud på. Er formålet høj puls, '
      + 'skal vægtene være lette nok til, at du kan blive ved. Er formålet styrke, skal du '
      + 'have rigtige pauser.',
    why:
      'Uden et formål bliver et pas bare en samling øvelser. Med et formål kan man afgøre, '
      + 'om det virker.',
  },
  {
    id: 'ramp',
    term: 'RAMP-opvarmning',
    aliases: ['RAMP'],
    category: 'workout',
    short: 'En opvarmning i fire trin: få varmen, løsn op, øv bevægelsen, byg vægten op.',
    long:
      'RAMP er fire bogstaver for fire trin. Først får du pulsen op. Så løsner du de led, du '
      + 'skal bruge. Så øver du dagens bevægelser let. Til sidst bygger du vægten op i små '
      + 'spring mod den, du skal løfte.',
    why:
      'Det sidste trin er det vigtigste. Springer man fra en tom stang direkte til '
      + 'arbejdsvægten, er kroppen ikke forberedt.',
  },
  {
    id: 'max-unbroken',
    term: 'Flest i træk',
    aliases: ['max unbroken', 'ubrudt'],
    category: 'workout',
    short: 'Hvor mange gentagelser du kan tage i træk uden at sætte af.',
    long:
      'Det tal, du kan tage i én lang serie uden pause, når du er frisk. For eksempel 12 '
      + 'pull-ups i træk.',
    why:
      'Det afgør, hvor mange gentagelser der giver mening i et pas. Skal du tage 12 i træk '
      + 'ti gange, når du højst tre runder, før det falder fra hinanden.',
  },
  {
    id: 'work-rest',
    term: 'Arbejde og pause',
    aliases: ['work:rest', 'work rest'],
    category: 'workout',
    short: 'Forholdet mellem hvor længe du arbejder, og hvor længe du hviler.',
    long:
      'Arbejder du i 30 sekunder og hviler i 30, er forholdet 1:1. Jo hårdere arbejdet er, '
      + 'jo mere pause skal der til, for at kvaliteten holder.',
    why: 'Det afgør, om et pas træner udholdenhed eller fart. Ændrer man det, ændrer man passet.',
  },

  /* ---------- Data ---------- */
  {
    id: 'benchmark',
    term: 'Måltal',
    aliases: ['benchmark', 'benchmarks'],
    category: 'data',
    short: 'Et tal om din formåen, som appen regner videre på.',
    long:
      'Et måltal kan være en vægt, en tid, et tempo eller et antal gentagelser. Det gemmes '
      + 'med dato, og hvordan det blev målt.',
    why:
      'Alle vægte og tempoer i appen skal kunne spores tilbage til et måltal eller til et '
      + 'tydeligt markeret forsigtigt standardbud.',
  },
  {
    id: 'confidence',
    term: 'Sikkerhed',
    aliases: ['confidence'],
    category: 'data',
    short: 'Hvor meget appen stoler på et tal — fra lav til høj.',
    long:
      'Et tal fra i går, målt på en klar måde, har høj sikkerhed. Et halvt år gammelt tal, '
      + 'eller et gæt, har lav sikkerhed. Appen viser altid hvilken.',
    why:
      'Så du ved, om et forslag er baseret på dine egne tal eller på et forsigtigt '
      + 'standardbud, du roligt kan justere.',
  },
  {
    id: 'provenance',
    term: 'Grundlag',
    aliases: ['load provenance', 'beregningsgrundlag'],
    category: 'data',
    short: 'Forklaringen på, hvor et bestemt tal kommer fra.',
    long:
      'Ved hver vægt kan du se, hvad den er regnet ud fra — for eksempel "82 % af dit '
      + 'training max på 180 kg, rundet til nærmeste 2,5 kg".',
    why: 'Ingen vægt i appen må være et tal, der bare står der. Du skal kunne se hvorfor.',
  },
  {
    id: 'planned-vs-actual',
    term: 'Planlagt og faktisk',
    aliases: ['planned vs actual'],
    category: 'data',
    short: 'Forskellen på det, der stod i planen, og det, du rent faktisk lavede.',
    long:
      'Appen gemmer begge dele hver for sig. Ændrer du noget undervejs, overskrives planen '
      + 'ikke — ændringen gemmes ved siden af.',
    why:
      'Det er den eneste måde at se, om et program virker, eller om det bare bliver lavet om '
      + 'hver gang.',
  },
  {
    id: 'seed',
    term: 'Nummer på variationen',
    aliases: ['seed'],
    category: 'data',
    short: 'Et tal, der gør det muligt at få præcis den samme workout frem igen.',
    long:
      'Når appen bygger et pas, bruger den et startnummer til at vælge mellem de gyldige '
      + 'muligheder. Med samme nummer og samme version får du samme resultat.',
    why: 'Det gør det muligt at gentage et pas nøjagtigt og at finde fejl i motoren.',
  },
  {
    id: 'comparability',
    term: 'Sammenlignelighed',
    aliases: ['comparability'],
    category: 'data',
    short: 'Om to resultater overhovedet kan stilles op mod hinanden.',
    long:
      'To tider kan kun sammenlignes, hvis arbejdet var det samme: samme øvelser, samme '
      + 'vægte, samme afstande og samme underlag.',
    why:
      'Ellers ligner tilfældige udsving fremgang. Appen viser hellere ingenting end en '
      + 'sammenligning, der ikke holder.',
  },

  /* ---------- Sikkerhed ---------- */
  {
    id: 'screening',
    term: 'Helbredsscreening',
    aliases: ['screening'],
    category: 'sikkerhed',
    short: 'Nogle få spørgsmål om dit helbred, før du går i gang.',
    long:
      'Spørgsmålene handler om kendt sygdom, symptomer og skader. Appen stiller ikke '
      + 'diagnoser — den justerer kun, hvad den foreslår, og henviser videre hvis der er '
      + 'noget, der bør ses på af en fagperson.',
    why: 'For at appen ikke foreslår hård træning oven på noget, der burde undersøges først.',
  },
  {
    id: 'competence',
    term: 'Teknisk niveau',
    aliases: ['movement competence', 'kompetence'],
    category: 'sikkerhed',
    short: 'Hvor sikkert du behersker en bestemt øvelse.',
    long:
      'Fra "kender den ikke" over "kan den, når jeg er frisk" til "kan den, også når jeg er '
      + 'træt". Det vurderes for hver øvelse for sig.',
    why:
      'Et generelt niveau siger ikke, om du kan tage en håndstands-push-up. Derfor '
      + 'programmerer appen kun svære øvelser, hvor du selv har sagt god for teknikken.',
  },
  {
    id: 'axial-load',
    term: 'Belastning af rygsøjlen',
    aliases: ['aksial belastning', 'axial load'],
    category: 'sikkerhed',
    short: 'Hvor meget vægt der presser ned gennem ryggen i en øvelse.',
    long:
      'Squat med stang på ryggen og dødløft belaster rygsøjlen kraftigt. Romaskine og '
      + 'benpres gør ikke. Appen holder styr på, hvor meget der samler sig på en uge.',
    why:
      'Det er den type belastning, der tager længst tid at komme sig over. Lægges for meget '
      + 'af den på få dage, går det ud over resten.',
  },
  {
    id: 'rom',
    term: 'Bevægelsesbane',
    aliases: ['ROM', 'range of motion'],
    category: 'sikkerhed',
    short: 'Hvor langt du bevæger dig i en øvelse — for eksempel hvor dybt du går ned.',
    long:
      'En squat helt i bund har fuld bevægelsesbane. Stopper du halvvejs, er banen kortere. '
      + 'At forkorte banen er en måde at skalere en øvelse på.',
    why: 'Det kan gøre en øvelse mulig ved ømhed eller stivhed, uden at du dropper den helt.',
  },
  {
    id: 'substitution',
    term: 'Erstatningsøvelse',
    aliases: ['substitution'],
    category: 'sikkerhed',
    short: 'En anden øvelse, der træner det samme, når den planlagte ikke kan lade sig gøre.',
    long:
      'Mangler du udstyret, gør en øvelse ondt, eller er teknikken ikke på plads, foreslår '
      + 'appen en erstatning fra samme bevægelsesfamilie — og forklarer hvorfor.',
    why: 'Så passet stadig træner det, det skulle, i stedet for at blive et helt andet pas.',
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((g) => [g.id, g]),
);

export const CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  styrke: 'Styrke og vægte',
  anstrengelse: 'Hvor hårdt det føles',
  planlægning: 'Planlægning over tid',
  kondition: 'Kondition og løb',
  workout: 'Træningspas og formater',
  data: 'Tal og data',
  sikkerhed: 'Sikkerhed og teknik',
};

export const CATEGORY_ORDER: GlossaryCategory[] = [
  'styrke', 'anstrengelse', 'workout', 'planlægning', 'kondition', 'sikkerhed', 'data',
];

/** Slår et udtryk op på id, navn eller en af dets alternative skrivemåder. */
export function lookup(termOrId: string): GlossaryEntry | null {
  const needle = termOrId.trim().toLowerCase();
  return GLOSSARY.find((g) => (
    g.id === needle
    || g.term.toLowerCase() === needle
    || g.aliases.some((a) => a.toLowerCase() === needle)
  )) ?? null;
}

export const glossaryInCategory = (category: GlossaryCategory): GlossaryEntry[] =>
  GLOSSARY.filter((g) => g.category === category);

/**
 * Fagudtryk, der aldrig må stå i en brugertekst uden at være forklaret et sted.
 *
 * Listen bruges af testene: står et af ordene i en genereret tekst, skal det have
 * en post i ordlisten. Det er den mekanisme, der forhindrer, at nyt fagsprog
 * sniger sig ind i appen uden en forklaring.
 */
export const REQUIRES_EXPLANATION = [
  '1RM', 'e1RM', 'RPE', 'RIR', 'AMRAP', 'EMOM', 'ROM', 'PR',
  'training max', 'top-sæt', 'backoff', 'deload', 'taper', 'stimulus',
  'benchmark', 'confidence', 'critical speed', 'compromised running',
  'max unbroken', 'time cap', 'scaling', 'adherence', 'anchor',
];

/** Sandt når udtrykket har en forklaring i ordlisten. */
export const isExplained = (term: string): boolean => lookup(term) !== null;
