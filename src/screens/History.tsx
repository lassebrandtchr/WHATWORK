import { useState } from 'react';
import { EmptyState, Glyph, PageHeader } from '../components/ui.js';
import { fmtDuration, relDate } from '../lib/format.js';
import type { HistoryEntry, HistoryStatus } from '../types.js';

/** Kort, konkret liste over hoveddelens øvelser — ikke opvarmningen. */
function exerciseSummary(entry: HistoryEntry): string {
  const names = entry.workout.blocks
    .filter((b) => b.kind === 'conditioning' || b.kind === 'strength')
    .flatMap((b) => b.movements.map((m) => m.name));
  const unique = [...new Set(names)];
  if (!unique.length) return '';
  const shown = unique.slice(0, 4);
  const rest = unique.length - shown.length;
  return `${shown.join(', ')}${rest > 0 ? ` +${rest} mere` : ''}`;
}

/** Formatet, brugeren har kørt flest gange — en lille, sjov statistik, ikke en KPI. */
function favoriteFormat(history: HistoryEntry[]): string | null {
  if (!history.length) return null;
  const counts = new Map<string, number>();
  history.forEach((h) => counts.set(h.format, (counts.get(h.format) ?? 0) + 1));
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top ? top[0] : null;
}

const STATUS: Record<HistoryStatus, { label: string; className: string }> = {
  done: { label: 'Gennemført', className: 'ww-badge ww-badge--good' },
  stopped: { label: 'Afbrudt', className: 'ww-badge ww-badge--warn' },
  saved: { label: 'Gemt', className: 'ww-badge' },
  partial: { label: 'Ændret undervejs', className: 'ww-badge ww-badge--warn' },
};

const FILTERS: { id: HistoryStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'done', label: 'Gennemført' },
  { id: 'stopped', label: 'Afbrudt' },
  { id: 'saved', label: 'Gemt' },
  { id: 'partial', label: 'Ændret' },
];

export function History({
  history, entries, filter, onFilter, onOpen, onRun, onRemove, onGenerate,
  resumableWorkoutId, onResume,
}: {
  history: HistoryEntry[];
  entries: HistoryEntry[];
  filter: HistoryStatus | 'all';
  onFilter: (f: HistoryStatus | 'all') => void;
  onOpen: (entry: HistoryEntry) => void;
  onRun: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onGenerate: () => void;
  /** Workout-id'et på den ene, aktive timer man kan genoptage — eller null. */
  resumableWorkoutId: string | null;
  onResume: () => void;
}) {
  const done = history.filter((h) => h.status === 'done');
  const [now] = useState(() => Date.now());
  const thisWeek = history.filter((h) => now - new Date(h.date).getTime() < 7 * 86_400_000);

  const favFormat = favoriteFormat(history);
  const stats = [
    { value: String(done.length), label: 'Gennemført' },
    { value: fmtDuration(history.reduce((a, b) => a + b.minutes, 0)), label: 'Samlet tid' },
    { value: String(thisWeek.length), label: 'Denne uge' },
    ...(favFormat ? [{ value: favFormat, label: 'Yndlingsformat' }] : []),
  ];

  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 860 }}>
      <PageHeader
        kicker="Log"
        title="Historik"
        lede="Alt du har gemt, gennemført eller afbrudt. Åbn en workout igen, eller kør den forfra."
      />

      {history.length === 0 ? (
        <EmptyState
          title="Ingen workouts endnu"
          body="Når du gemmer eller gennemfører en workout, lander den her — med format, tid og resultat."
          action={<button type="button" className="ww-btn ww-btn--primary ww-btn--lg" onClick={onGenerate}>Generér workout</button>}
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', paddingBottom: 22, borderBottom: '1px solid var(--ww-line)', marginBottom: 18 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  className="ww-num"
                  style={{ fontSize: s.value.length > 4 ? 18 : 28, fontWeight: 700, letterSpacing: '-0.02em' }}
                >
                  {s.value}
                </span>
                <span className="ww-kicker">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="ww-wrap" style={{ marginBottom: 18 }} role="group" aria-label="Filtrér historikken">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="ww-chip"
                aria-pressed={filter === f.id}
                onClick={() => onFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {entries.length === 0 ? (
            <EmptyState title="Ingen poster i dette filter" body="Vælg et andet filter for at se resten af historikken." />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {entries.map((entry) => {
                const status = STATUS[entry.status] ?? STATUS.saved;
                const exercises = exerciseSummary(entry);
                const resumable = entry.status === 'stopped' && resumableWorkoutId === entry.workout.id;
                return (
                  <li key={entry.id} style={{ borderBottom: '1px solid var(--ww-line)', padding: '16px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: '1 1 16ch' }}>
                        <div className="ww-h2" style={{ marginBottom: 4 }}>{entry.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--ww-text-2)' }}>
                          {relDate(entry.date)} · {entry.minutes} min
                          {entry.result ? ` · ${entry.result}` : ''}
                        </div>
                        {entry.progressPct !== undefined ? (
                          <div style={{ fontSize: 13, color: 'var(--ww-orange)', marginTop: 4 }}>
                            Nåede {entry.progressPct}%{entry.lastExercise ? ` — stoppede ved ${entry.lastExercise}` : ''}
                          </div>
                        ) : null}
                        {exercises ? (
                          <div style={{ fontSize: 13, color: 'var(--ww-text-3)', marginTop: 6, lineHeight: 1.5 }}>
                            {exercises}
                          </div>
                        ) : null}
                      </div>
                      <span className={status.className}>{status.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {resumable ? (
                        <button type="button" className="ww-btn ww-btn--primary" onClick={onResume}>
                          <Glyph name="bolt" size={16} />
                          Genoptag
                        </button>
                      ) : null}
                      <button type="button" className="ww-btn" onClick={() => onOpen(entry)}>Åbn</button>
                      <button type="button" className="ww-btn" onClick={() => onRun(entry)}>
                        <Glyph name="bolt" size={16} />
                        Kør igen
                      </button>
                      <button type="button" className="ww-btn ww-btn--danger" onClick={() => onRemove(entry.id)}>
                        Fjern
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
