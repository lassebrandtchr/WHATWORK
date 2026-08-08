import { Photo } from '../components/Photo.js';
import { Chip, Kicker, OptionRow } from '../components/ui.js';
import { fmtTime } from '../lib/format.js';
import type { Completion, HistoryStatus, Rpe } from '../types.js';
import type { CompleteContext } from '../state/useWhatwork.js';

const STATUSES: { id: HistoryStatus; name: string; desc: string }[] = [
  { id: 'done', name: 'Gennemført', desc: 'Kørt som programmeret' },
  { id: 'partial', name: 'Ændret undervejs', desc: 'Skaleret eller byttet om' },
  { id: 'stopped', name: 'Afbrudt', desc: 'Stoppet før tid' },
];

const RPES: { id: Rpe; name: string }[] = [
  { id: 'easy', name: 'For let' },
  { id: 'ok', name: 'Passende' },
  { id: 'hard', name: 'For hård' },
];

export function Complete({
  context, completion, onChange, onSave,
}: {
  context: CompleteContext;
  completion: Completion;
  onChange: (patch: Partial<Completion>) => void;
  onSave: () => void;
}) {
  return (
    <main
      style={{
        position: 'fixed', inset: 0, zIndex: 72, background: 'var(--ww-bg)', overflowY: 'auto',
        padding: 'calc(env(safe-area-inset-top) + 28px) 20px calc(env(safe-area-inset-bottom) + 28px)',
      }}
    >
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <Kicker accent style={{ marginBottom: 10 }}>
          {completion.status === 'done' ? 'Færdig' : 'Afsluttet'}
        </Kicker>
        <h1 className="ww-display" style={{ marginBottom: 8 }}>{context.workout.title}</h1>
        <p className="ww-lede" style={{ marginBottom: completion.progressPct !== undefined && completion.status === 'stopped' ? 10 : 30 }}>
          {fmtTime(context.secs)} på uret
          {context.rounds ? ` · ${context.rounds} runder` : ''}
          {' · '}{context.workout.estimatedMinutes} min planlagt
        </p>

        {completion.status === 'stopped' && completion.progressPct !== undefined ? (
          <p style={{ margin: '0 0 30px', fontSize: 14, color: 'var(--ww-orange)', lineHeight: 1.55 }}>
            Du nåede automatisk registreret {completion.progressPct}%
            {completion.lastExercise ? ` — stoppede ved ${completion.lastExercise}` : ''}.
            Du kan genoptage workouten senere fra Historik, hvis du er stoppet ved en fejl.
          </p>
        ) : null}

        <Photo
          name="high-five"
          sizes="min(100vw - 40px, 540px)"
          style={{ marginBottom: 28 }}
        />

        <section aria-labelledby="ww-how" style={{ marginBottom: 26 }}>
          <h2 id="ww-how" style={{ fontSize: 15, fontWeight: 650, margin: '0 0 12px' }}>Hvordan gik det?</h2>
          <div className="ww-stack">
            {STATUSES.map((s) => (
              <OptionRow
                key={s.id}
                name={s.name}
                desc={s.desc}
                on={completion.status === s.id}
                onClick={() => onChange({ status: s.id })}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="ww-rpe" style={{ marginBottom: 26 }}>
          <h2 id="ww-rpe" style={{ fontSize: 15, fontWeight: 650, margin: '0 0 12px' }}>Belastning</h2>
          <div className="ww-wrap">
            {RPES.map((r) => (
              <Chip key={r.id} on={completion.rpe === r.id} onClick={() => onChange({ rpe: r.id })}>
                {r.name}
              </Chip>
            ))}
          </div>
        </section>

        <div style={{ marginBottom: 30 }}>
          <label htmlFor="ww-note" style={{ display: 'block', fontSize: 15, fontWeight: 650, marginBottom: 10 }}>
            Resultat eller note
          </label>
          <input
            id="ww-note"
            className="ww-input"
            type="text"
            value={completion.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="fx 7 runder + 12 gentagelser"
          />
        </div>

        <button type="button" className="ww-btn ww-btn--primary ww-btn--lg ww-btn--block" onClick={onSave}>
          Gem i historik
        </button>
      </div>
    </main>
  );
}
