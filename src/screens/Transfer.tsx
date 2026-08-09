import { useRef, useState } from 'react';
import { Glyph, Note, PageHeader } from '../components/ui.js';
import { fullDate } from '../lib/format.js';
import type { ImportPreview } from '../lib/transfer.js';

export function Transfer({
  onExport, onStage, preview, error, onCancel,
}: {
  onExport: () => void;
  onStage: (text: string) => void;
  preview: { preview: ImportPreview; apply: () => void } | null;
  error: string | null;
  onCancel: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState('');
  const [done, setDone] = useState(false);

  const readFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => onStage(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  };

  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 760 }}>
      <PageHeader
        kicker="Dine data"
        title="Import og eksport"
        lede="WHATWORK har ingen konto og synkroniserer ikke — alt ligger kun i denne browser. Brug
          denne side til at flytte dine data til en ny telefon eller browser, eller til at lave en
          sikkerhedskopi, før du rydder browserdata eller afinstallerer appen."
        icon={<Glyph name="transfer" size={30} />}
      />

      <section aria-labelledby="ww-export" style={{ marginBottom: 34 }}>
        <h2 id="ww-export" className="ww-h2" style={{ marginBottom: 10 }}>Eksportér</h2>
        <p className="ww-lede" style={{ marginBottom: 16, maxWidth: '58ch' }}>
          Henter profil, indstillinger, historik, favoritter og program som en JSON-fil med
          skemaversion. Filen er din — den sendes ingen steder hen.
        </p>
        <button type="button" className="ww-btn ww-btn--lg" onClick={onExport}>
          Hent whatwork-data.json
        </button>
      </section>

      <section aria-labelledby="ww-import">
        <h2 id="ww-import" className="ww-h2" style={{ marginBottom: 10 }}>Importér</h2>
        <p className="ww-lede" style={{ marginBottom: 16, maxWidth: '58ch' }}>
          Filen bliver læst og valideret, før noget ændres. Du får en preview og skal bekræfte.
          Holder filen ikke, afvises den som helhed, og dine nuværende data røres ikke.
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="ww-sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) { setDone(false); readFile(file); }
            e.target.value = '';
          }}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button type="button" className="ww-btn ww-btn--lg" onClick={() => fileInput.current?.click()}>
            Vælg fil
          </button>
          <button
            type="button"
            className="ww-btn ww-btn--lg"
            disabled={!pasted.trim()}
            onClick={() => { setDone(false); onStage(pasted); }}
          >
            Læs indsat tekst
          </button>
        </div>

        <label htmlFor="ww-paste" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Eller indsæt JSON direkte
        </label>
        <textarea
          id="ww-paste"
          className="ww-textarea"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder='{ "schema": "whatwork.export.v2", ... }'
          spellCheck={false}
        />

        {error ? (
          <div style={{ marginTop: 18 }}>
            <Note label="Afvist" tone="danger">{error}</Note>
          </div>
        ) : null}

        {done ? (
          <div style={{ marginTop: 18 }}>
            <Note label="Importeret" tone="good">
              Dine data er lagt ind. Historik, favoritter og program er opdateret.
            </Note>
          </div>
        ) : null}

        {preview ? (
          <div className="ww-card" style={{ marginTop: 18, padding: 20 }}>
            <h3 className="ww-h2" style={{ marginBottom: 12, fontSize: 19 }}>Preview af filen</h3>
            <dl style={{ margin: '0 0 16px' }}>
              {[
                { k: 'Skema', v: preview.preview.schema },
                { k: 'Motorversion', v: preview.preview.engineVersion },
                { k: 'Eksporteret', v: fullDate(preview.preview.exportedAt) || 'ukendt' },
                { k: 'Profil', v: preview.preview.profileName },
                { k: 'Workouts i historik', v: String(preview.preview.workouts) },
                { k: 'Favoritter', v: String(preview.preview.favorites) },
                { k: 'Program', v: preview.preview.hasProgram ? 'Ja' : 'Nej' },
              ].map((r) => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--ww-line)' }}>
                  <dt style={{ fontSize: 14, color: 'var(--ww-text-2)' }}>{r.k}</dt>
                  <dd style={{ margin: 0, fontSize: 14, textAlign: 'right', fontWeight: 550 }}>{r.v}</dd>
                </div>
              ))}
            </dl>

            {preview.preview.warnings.map((w) => (
              <div key={w} style={{ marginBottom: 12 }}>
                <Note label="Bemærk" tone="quiet">{w}</Note>
              </div>
            ))}

            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ww-text-2)', lineHeight: 1.6 }}>
              Importen erstatter din nuværende historik, favoritter og program. Eksportér først,
              hvis du vil kunne gå tilbage.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ww-btn ww-btn--primary ww-btn--lg"
                onClick={() => { preview.apply(); setDone(true); setPasted(''); }}
              >
                Importér nu
              </button>
              <button type="button" className="ww-btn ww-btn--lg" onClick={onCancel}>Fortryd</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
