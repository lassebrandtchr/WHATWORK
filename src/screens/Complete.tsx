import { useState } from 'react';
import { Photo } from '../components/Photo.js';
import { Chip, Kicker, OptionRow } from '../components/ui.js';
import { fmtTime } from '../lib/format.js';
import type { Completion, HistoryStatus, LoggedSet, Rpe } from '../types.js';
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

/**
 * Logning af de faktisk udførte sæt.
 *
 * Sættene er udfyldt på forhånd fra planen, og "Alt gik som planlagt" bekræfter dem
 * med ét tryk. Kun det, der afveg, skal rettes — det er forskellen på en log, folk
 * bruger, og en log, folk springer over.
 */
function SetLog({
  sets, onChange,
}: {
  sets: LoggedSet[];
  onChange: (sets: LoggedSet[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allConfirmed = sets.every((s) => s.asPlanned);

  const patch = (index: number, next: Partial<LoggedSet>): void => {
    onChange(sets.map((s, i) => (i === index ? { ...s, ...next, asPlanned: false } : s)));
  };

  return (
    <section aria-labelledby="ww-sets" style={{ marginBottom: 26 }}>
      <h2 id="ww-sets" style={{ fontSize: 15, fontWeight: 650, margin: '0 0 4px' }}>Dine sæt</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.55 }}>
        Gemmer du sættene, kan appen regne din styrke ud af rigtig træning i stedet for
        af en enkelt test. Det er frivilligt.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: open ? 16 : 0 }}>
        <button
          type="button"
          className={`ww-btn${allConfirmed ? ' ww-btn--primary' : ''}`}
          aria-pressed={allConfirmed}
          onClick={() => onChange(sets.map((s) => ({ ...s, asPlanned: true })))}
        >
          Alt gik som planlagt
        </button>
        <button type="button" className="ww-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Skjul sættene' : 'Ret et sæt'}
        </button>
      </div>

      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sets.map((set, i) => (
            <div key={`${set.exerciseId}-${i}`} className="ww-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 12 }}>{set.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 12 }}>
                {set.loadKg !== null ? (
                  <div>
                    <label htmlFor={`ww-set-load-${i}`} style={{ display: 'block', fontSize: 12.5, color: 'var(--ww-text-2)', marginBottom: 5 }}>
                      Kilo
                    </label>
                    <input
                      id={`ww-set-load-${i}`}
                      className="ww-input"
                      type="number"
                      inputMode="decimal"
                      step={2.5}
                      value={set.loadKg}
                      onChange={(e) => patch(i, { loadKg: Number(e.target.value) })}
                    />
                  </div>
                ) : null}
                <div>
                  <label htmlFor={`ww-set-reps-${i}`} style={{ display: 'block', fontSize: 12.5, color: 'var(--ww-text-2)', marginBottom: 5 }}>
                    Gentagelser
                  </label>
                  <input
                    id={`ww-set-reps-${i}`}
                    className="ww-input"
                    type="number"
                    inputMode="numeric"
                    value={set.reps}
                    onChange={(e) => patch(i, { reps: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ww-text-2)', marginBottom: 6 }}>
                Hvor mange havde du tilbage?
              </div>
              <div className="ww-wrap" style={{ gap: 4 }}>
                {[0, 1, 2, 3, 4].map((rir) => (
                  <Chip key={rir} on={set.rpe === 10 - rir} onClick={() => patch(i, { rpe: 10 - rir })}>
                    {rir === 0 ? 'Ingen' : `${rir}`}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

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

        <section aria-labelledby="ww-pain" style={{ marginBottom: 26 }}>
          <h2 id="ww-pain" style={{ fontSize: 15, fontWeight: 650, margin: '0 0 4px' }}>Gjorde noget ondt?</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.55 }}>
            0 betyder ingenting. Fra 4 og opefter tager appen den bevægelse ud af næste pas.
          </p>
          <div className="ww-wrap" style={{ gap: 4 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Chip
                key={n}
                on={completion.painAfter === n}
                onClick={() => onChange({ painAfter: n })}
                style={{ minWidth: 44 }}
              >
                {n}
              </Chip>
            ))}
          </div>
        </section>

        {completion.sets.length ? (
          <SetLog sets={completion.sets} onChange={(sets) => onChange({ sets })} />
        ) : null}

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
