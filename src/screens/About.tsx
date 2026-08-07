import * as eng from '../engine/index.js';
import { FlowGraphic } from '../components/FlowGraphic.js';
import { Note, PageHeader } from '../components/ui.js';

export function About() {
  const versions = [
    { k: 'Motorversion', v: eng.ENGINE_VERSION },
    { k: 'Regelversion', v: eng.RULES_VERSION },
    { k: 'Øvelsesdata', v: eng.EXERCISE_DATA_VERSION },
    { k: 'Øvelser i kataloget', v: String(eng.EXERCISES.length) },
    { k: 'Formater', v: String(eng.FORMAT_LIST.length) },
    { k: 'Kandidater pr. generering', v: `op til ${eng.MAX_CANDIDATES}` },
  ];

  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 760 }}>
      <PageHeader
        kicker="Om appen"
        title="Om WHATWORK"
        lede="En dansk, local-first træningsapp til funktionel fitness, partnerworkouts og holdtræning."
      />

      <section aria-labelledby="ww-what" style={{ marginBottom: 30 }}>
        <h2 id="ww-what" className="ww-h2" style={{ marginBottom: 12 }}>Hvad appen er</h2>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <FlowGraphic width={124} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 260px', minWidth: 260, maxWidth: '66ch' }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--ww-body)' }}>
              WHATWORK er en regelbaseret træningsgenerator. Den kører lokalt på din enhed og bygger
              en færdig workout ud fra tid, deltagere, niveau, retning og det udstyr, I faktisk har.
            </p>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--ww-body)' }}>
              Der er ingen konto, ingen server og ingen cloud-synk. Kerneflowet virker uden netværk.
              AI bruges kun som et valgfrit variationslag, og kun hvis du selv slår det til og
              lægger en nøgle på serveren.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="ww-isnt" style={{ marginBottom: 30 }}>
        <h2 id="ww-isnt" className="ww-h2" style={{ marginBottom: 12 }}>Hvad appen ikke er</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '66ch' }}>
          {[
            'Den diagnosticerer og behandler ikke skader. Skånehensyn er et filter i programmeringen, ikke en medicinsk vurdering.',
            'Den kender ikke din krop. Kropsvægt og niveau er parametre til skalering — ikke en måling af dig.',
            'Den garanterer ingen resultater.',
            'Workout-DNA er et internt, forklarligt signal. Det er ikke en videnskabeligt valideret score.',
            'Den er ikke real-time i baggrunden på alle platforme. Lyd, haptik, Wake Lock og baggrundsadfærd afhænger af browser og styresystem.',
            'Der er hverken konto eller cloud-synk implementeret. Alt ligger lokalt.',
            'Den er ikke fuldt produktionsklar uden validering på rigtige enheder og af en træningsfaglig person.',
          ].map((line) => (
            <li key={line} style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ww-body)' }}>{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ww-versions" style={{ marginBottom: 30 }}>
        <h2 id="ww-versions" className="ww-h2" style={{ marginBottom: 12 }}>Version</h2>
        <dl className="ww-card" style={{ margin: 0, padding: '6px 20px' }}>
          {versions.map((r, i) => (
            <div
              key={r.k}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: 16,
                padding: '13px 0', borderTop: i === 0 ? 'none' : '1px solid var(--ww-line)',
              }}
            >
              <dt style={{ fontSize: 14, color: 'var(--ww-text-2)' }}>{r.k}</dt>
              <dd className="ww-num" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{r.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Note label="Sikkerhed" tone="danger">
        WHATWORK er en træningsplanlægger — ikke en læge, fysioterapeut eller coach. Tilpas altid
        til din teknik og dagsform. Stop ved skarp smerte eller utryghed, og søg faglig hjælp ved behov.
      </Note>
    </div>
  );
}
