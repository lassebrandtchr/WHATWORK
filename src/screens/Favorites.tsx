import { GenerateWorkoutButton } from '../components/GenerateWorkoutButton.js';
import { Photo } from '../components/Photo.js';
import { EmptyState, Glyph, PageHeader } from '../components/ui.js';
import { relDate } from '../lib/format.js';
import type { HistoryEntry } from '../types.js';

export function Favorites({
  favorites, onOpen, onRun, onRemove, onGenerate,
}: {
  favorites: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onRun: (entry: HistoryEntry) => void;
  onRemove: (entry: HistoryEntry) => void;
  onGenerate: () => void;
}) {
  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 860 }}>
      <PageHeader
        kicker="Gemt"
        title="Favoritter"
        lede="De workouts, du vil kunne finde igen. De ligger lokalt sammen med resten af dine data."
      />

      {favorites.length === 0 ? (
        <>
          <Photo
            name="thruster"
            frame="portrait"
            sizes="(min-width: 640px) 340px, 100vw"
            style={{ marginBottom: 22, maxWidth: 340 }}
          />
          <EmptyState
            title="Ingen favoritter endnu"
            body="Tryk «Gør til favorit» på en workout, så lander den her og kan køres igen med ét tryk."
            action={<GenerateWorkoutButton className="ww-btn--lg" onClick={onGenerate} />}
          />
        </>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 8 }}>
          {favorites.map((entry) => (
            <li key={entry.id} className="ww-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <span className="ww-kicker">{entry.format}</span>
                <span className="ww-badge">{entry.minutes} min</span>
              </div>
              <div className="ww-h2" style={{ marginBottom: 4 }}>{entry.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ww-text-2)', marginBottom: 14 }}>
                Gemt {relDate(entry.date)}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="ww-btn" style={{ minHeight: 44 }} onClick={() => onOpen(entry)}>Åbn</button>
                <button type="button" className="ww-btn" style={{ minHeight: 44 }} onClick={() => onRun(entry)}>
                  <Glyph name="bolt" size={16} />
                  Kør igen
                </button>
                <button type="button" className="ww-btn ww-btn--danger" style={{ minHeight: 44 }} onClick={() => onRemove(entry)}>
                  Fjern
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
