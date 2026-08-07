import * as eng from '../engine/index.js';
import { Note, PageHeader } from '../components/ui.js';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Sådan bygger WHATWORK en workout',
    body: [
      'Du fortæller, hvor lang tid I har, hvem der træner, hvilket niveau, hvilken retning og '
      + 'hvilket udstyr der står i salen. Resten er lokal regnekraft.',
      'Smart Mix bygger op til 64 forskellige forslag på én gang. Hvert forslag køres gennem den '
      + 'samme kontrol: udstyr, niveau, skånehensyn, volumen på tekniske løft, tidsbudget og '
      + 'logistik. De forslag, der ikke kan afvikles forsvarligt, kasseres — de bliver aldrig vist.',
      'Til sidst sammenlignes de tilbageværende med dine seneste workouts, så du ikke får samme '
      + 'format, samme startøvelse og samme bevægelseskombination to gange i træk.',
    ],
  },
  {
    title: 'Kilo og skiver',
    body: [
      'Alle belastninger skaleres efter profil, kropsvægt og niveau og snappes derefter til det '
      + 'udstyr, I faktisk har. For vægtstang vises samlet vægt, stangens vægt og hvilke skiver '
      + 'der skal på hver side.',
      'For en trænet profil bruges et sæt minimumsforslag som bund — for eksempel 50 kg for mænd '
      + 'og 30 kg for kvinder på clean-familien. Det er programmeringsforslag, ikke krav til '
      + 'præstation. Begyndere får lavere forslag.',
      'Tilpas altid efter teknik og dagsform.',
    ],
  },
  {
    title: 'Opvarmningen',
    body: [
      'Opvarmningen bygges efter hoveddelen er valgt, så den spejler de bevægelsesmønstre, du '
      + 'faktisk skal lave. Den varer 5–10 minutter, ligger inden for den tid du har valgt, og '
      + 'skifter fra gang til gang.',
      'Den skal give sved på panden og bringe pulsen op mod RPE 5–6 — ikke bruge det, hoveddelen '
      + 'har brug for. Cooldown er en separat, roligere del.',
    ],
  },
  {
    title: 'Timeren',
    body: [
      'Timeren bygges direkte ud fra workoutens blokke og øvelser. Den viser den aktuelle blok, '
      + 'den aktive øvelse, målene, hvem der arbejder ved partnerworkouts, og hvad der kommer '
      + 'som det næste.',
      'Tiden regnes ud fra urets faktiske tidspunkter, ikke fra en tæller der tikker ned. Derfor '
      + 'er den korrekt, selv hvis du genindlæser siden eller skifter væk fra appen undervejs.',
      'Segmenter med fast varighed skifter af sig selv. Åbne segmenter — For Time, Chipper og '
      + 'You go, I go — venter på, at du trykker Næste.',
      'Lyd, haptik, Wake Lock og baggrundsadfærd afhænger af browser og styresystem og er ikke '
      + 'ens på alle platforme.',
    ],
  },
  {
    title: 'Data og offline',
    body: [
      'Alt ligger lokalt på enheden. Der er ingen konto, ingen server og ingen cloud-synk. '
      + 'Kerneflowet — generér, kør, gem, se historik — virker uden netværk.',
      'Du kan tage dine data med som en JSON-fil under Import og eksport. Ved import ser du en '
      + 'preview først, og en fil, der ikke er gyldig, afvises som helhed uden at røre det, du '
      + 'allerede har.',
    ],
  },
];

export function Help() {
  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 780 }}>
      <PageHeader
        kicker="Vejledning"
        title="Hjælp"
        lede="Hvordan WHATWORK vælger, regner og afvikler — og hvad de internationale formatnavne betyder."
      />

      <section aria-labelledby="ww-formats-help" style={{ marginBottom: 32 }}>
        <h2 id="ww-formats-help" className="ww-h2" style={{ marginBottom: 14 }}>Formaterne</h2>
        <p className="ww-lede" style={{ marginBottom: 16 }}>
          Navnene AMRAP, EMOM og For Time bruges i salen over hele verden og er beholdt som de er.
          Her er, hvad hvert af dem betyder på dansk.
        </p>
        <dl style={{ margin: 0 }}>
          {eng.FORMAT_LIST.map((f) => (
            <div key={f.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--ww-line)' }}>
              <dt style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{f.name}</span>
                <span style={{ fontSize: 13, color: 'var(--ww-text-3)' }}>{f.long}</span>
              </dt>
              <dd style={{ margin: 0, fontSize: 14.5, color: 'var(--ww-body)', lineHeight: 1.6 }}>
                {f.da}
                <br />
                <span style={{ color: 'var(--ww-text-2)' }}>Undervejs: {f.naa} Færdig: {f.faerdig}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {SECTIONS.map((s) => (
        <section key={s.title} aria-label={s.title} style={{ marginBottom: 30 }}>
          <h2 className="ww-h2" style={{ marginBottom: 12 }}>{s.title}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {s.body.map((p) => (
              <p key={p} style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--ww-body)', maxWidth: '66ch' }}>
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}

      <Note label="Vigtigt" tone="danger">
        WHATWORK diagnosticerer ikke skader, behandler ikke skader og kender ikke din krop.
        Skånehensyn er et filter i programmeringen — ikke en medicinsk vurdering. Stop ved skarp
        smerte eller utryghed, og søg faglig hjælp ved behov.
      </Note>
    </div>
  );
}
