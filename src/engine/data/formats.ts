import type { FormatId, FormatInfo } from '../types.js';

/**
 * Formaterne. `name` er samtidig workoutens titel — der findes ingen genererede
 * fantasinavne i appen. De internationale navne (AMRAP, EMOM, For Time) er bevaret,
 * fordi de bruges i salen, men hver har en dansk forklaring i `da`.
 */
export const FORMATS: Record<FormatId, FormatInfo> = {
  amrap: {
    id: 'amrap', name: 'AMRAP', long: 'As Many Rounds And Reps As Possible',
    da: 'Så mange runder og gentagelser som muligt inden for tiden.',
    hvad: 'Gennemfør listen i rækkefølge så mange gange som muligt, indtil tiden er gået.',
    naa: 'Start ved 0 og arbejd i den rækkefølge, der står. Hold et jævnt tempo.',
    faerdig: 'Uret stopper dig. Notér hele runder og eventuelle ekstra gentagelser.',
  },
  emom: {
    id: 'emom', name: 'EMOM', long: 'Every Minute On the Minute',
    da: 'Hvert minut på minuttet — arbejd, og hvil resten af minuttet.',
    hvad: 'Start det angivne arbejde, hver gang et nyt minut begynder.',
    naa: 'Arbejd, og hvil resten af minuttet. Start igen ved næste minut.',
    faerdig: 'Når det sidste minut er kørt. Kan du ikke nå arbejdet, skalerer du ned.',
  },
  e2mom: {
    id: 'e2mom', name: 'E2MOM', long: 'Every 2 Minutes On the Minute',
    da: 'Hvert 2. minut — mere arbejde pr. interval, samme princip som EMOM.',
    hvad: 'Du starter forfra hvert andet minut.',
    naa: 'Arbejd, hvil resten af de to minutter, start igen.',
    faerdig: 'Når alle intervaller er gennemført.',
  },
  e3mom: {
    id: 'e3mom', name: 'E3MOM', long: 'Every 3 Minutes',
    da: 'Hvert 3. minut. Plads til tungere eller længere arbejde.',
    hvad: 'Du starter forfra hvert tredje minut.',
    naa: 'Arbejd, hvil resten af de tre minutter, start igen.',
    faerdig: 'Når alle intervaller er gennemført.',
  },
  e4mom: {
    id: 'e4mom', name: 'E4MOM', long: 'Every 4 Minutes',
    da: 'Hvert 4. minut. Længere arbejde med reel restitution imellem.',
    hvad: 'Du starter forfra hvert fjerde minut.',
    naa: 'Arbejd hårdt, og brug resten af intervallet på at komme dig.',
    faerdig: 'Når alle intervaller er gennemført.',
  },
  e5mom: {
    id: 'e5mom', name: 'E5MOM', long: 'Every 5 Minutes',
    da: 'Hvert 5. minut. Tæt på fuld restitution mellem hårde stykker.',
    hvad: 'Du starter forfra hvert femte minut.',
    naa: 'Kør stykket hårdt. Resten af intervallet er pause.',
    faerdig: 'Når alle intervaller er gennemført.',
  },
  fortime: {
    id: 'fortime', name: 'For Time', long: 'For Time',
    da: 'På tid — så hurtigt og kontrolleret som muligt, med en tidscap.',
    hvad: 'Gennemfør alt arbejdet så hurtigt og kontrolleret som muligt.',
    naa: 'Uret tæller op. Del gentagelserne op på forhånd, så du ikke går død.',
    faerdig: 'Når sidste gentagelse er nået — eller ved tidscappen.',
  },
  chipper: {
    id: 'chipper', name: 'Chipper', long: 'For Time, én gang igennem',
    da: 'En lang liste, du arbejder dig igennem én gang, på tid.',
    hvad: 'En lang liste, du arbejder dig igennem én gang.',
    naa: 'Tag én øvelse ad gangen. Bryd op i bidder tidligt.',
    faerdig: 'Når listen er tom — eller ved tidscappen.',
  },
  ladder: {
    id: 'ladder', name: 'Ladder', long: 'Stigende eller faldende gentagelser',
    da: 'Trappe: antallet af gentagelser stiger eller falder for hver runde.',
    hvad: 'Samme øvelser hver runde, men antallet ændrer sig efter et fast mønster.',
    naa: 'Hold pausen kort mellem trinnene. Tempoet ligger i overgangene.',
    faerdig: 'Når sidste trin på trappen er kørt — eller ved tidscappen.',
  },
  interval: {
    id: 'interval', name: 'Interval', long: 'Arbejde / pause',
    da: 'Faste arbejdsperioder afbrudt af faste pauser.',
    hvad: 'Faste arbejdsperioder afbrudt af faste pauser.',
    naa: 'Arbejd hårdt i arbejdsintervallet, hvil helt i pausen.',
    faerdig: 'Når alle sæt er kørt.',
  },
  strength: {
    id: 'strength', name: 'Styrke', long: 'Styrkedel med sæt og pauser',
    da: 'Sæt og gentagelser med rigtige pauser imellem. Kvalitet før tempo.',
    hvad: 'Sæt og gentagelser med pause imellem.',
    naa: 'Hold pausen, også når du har lyst til at gå videre.',
    faerdig: 'Når alle sæt er gennemført med god teknik.',
  },
  strength_cond: {
    id: 'strength_cond', name: 'Strength + Conditioning', long: 'Styrke efterfulgt af conditioning',
    da: 'En afgrænset styrkedel og derefter en conditioning-del.',
    hvad: 'Først en styrkedel, derefter et conditioning-stykke.',
    naa: 'Kør styrken frisk. Gå først til del 2, når du har pustet ud.',
    faerdig: 'Når begge dele er kørt.',
  },
  you_go_i_go: {
    id: 'you_go_i_go', name: 'You go, I go', long: 'Skiftevis arbejde mellem to',
    da: 'Én arbejder, mens den anden restituerer og gør stationen klar.',
    hvad: 'I skiftes til at arbejde. Den ene arbejder, den anden hviler.',
    naa: 'Skift efter det viste mål. Gør stationen klar, mens du venter.',
    faerdig: 'Når begge har gennemført alt arbejdet — eller ved tidscappen.',
  },
  partner_shared: {
    id: 'partner_shared', name: 'Partner shared work', long: 'Delt arbejde mellem deltagerne',
    da: 'Det samlede arbejde deles frit mellem jer. I bestemmer selv fordelingen.',
    hvad: 'Ét samlet antal gentagelser, som I deler mellem jer.',
    naa: 'Del op, som I vil, men kun én arbejder ad gangen.',
    faerdig: 'Når det samlede antal er nået — eller ved tidscappen.',
  },
  team_rotation: {
    id: 'team_rotation', name: 'Team rotation', long: 'Stationer med fast rotation',
    da: 'Faste stationer, og I rykker én station frem på signal.',
    hvad: 'Hver deltager starter på sin station og rykker videre på signal.',
    naa: 'Arbejd på din station, til der skiftes. Efterlad den klar til den næste.',
    faerdig: 'Når alle har været hele vejen rundt det aftalte antal gange.',
  },
};

export const FORMAT_LIST: FormatInfo[] = Object.values(FORMATS);

/** Intervallængde i sekunder for E*MOM-familien. */
export const EVERY_SEC: Partial<Record<FormatId, number>> = {
  emom: 60, e2mom: 120, e3mom: 180, e4mom: 240, e5mom: 300,
};

export const isEmomFamily = (f: FormatId): boolean => f in EVERY_SEC;

export const formatName = (f: FormatId): string => FORMATS[f]?.name ?? f;
