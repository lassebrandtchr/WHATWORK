import { useState } from 'react';
import { Photo } from '../components/Photo.js';
import { Glyph, Kicker } from '../components/ui.js';
import { plural, relDate } from '../lib/format.js';
import type { HistoryEntry } from '../types.js';
import type { Screen } from '../types.js';

const QUICK_TIMES = [10, 15, 20, 25, 30, 40, 45, 60, 75, 90];

export interface HomeProps {
  name: string;
  history: HistoryEntry[];
  onGenerate: () => void;
  onQuickTime: (minutes: number) => void;
  onGo: (s: Screen) => void;
  onSurprise: () => void;
  onOpenLast: () => void;
  hasTimer: boolean;
  onResume: () => void;
}

export function Home({
  name, history, onGenerate, onQuickTime, onGo, onSurprise, onOpenLast, hasTimer, onResume,
}: HomeProps) {
  const last = history[0];
  // Uret aflæses én gang ved montering. At kalde Date.now() under render ville gøre
  // komponenten afhængig af hvornår React tilfældigvis gentegner den.
  const [now] = useState(() => Date.now());
  const thisWeek = history.filter((h) => now - new Date(h.date).getTime() < 7 * 86_400_000);
  const minutes = thisWeek.reduce((a, b) => a + b.minutes, 0);

  return (
    <div className="ww-rise" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 22px)', maxWidth: 760 }}>
      <Kicker style={{ marginBottom: 12 }}>{name === 'Gæst' ? 'Velkommen tilbage' : name}</Kicker>
      <h1 className="ww-display" style={{ marginBottom: 10 }}>Hvad skal vi træne?</h1>
      <p className="ww-lede" style={{ marginBottom: 28, maxWidth: '40ch' }}>
        Tid, deltagere og udstyr. Så bygger WHATWORK resten — med kilo, skiver, mål og pauser.
      </p>

      {hasTimer ? (
        <button
          type="button"
          className="ww-tile"
          onClick={onResume}
          style={{ marginBottom: 16, borderColor: 'var(--ww-orange-line)', background: 'var(--ww-orange-dim)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ww-orange)' }}>
            <Glyph name="bolt" size={18} />
            Du har en workout i gang
          </span>
          <span style={{ fontSize: 13, color: 'var(--ww-text-2)', fontWeight: 400 }}>
            Tryk for at fortsætte, hvor du slap.
          </span>
        </button>
      ) : null}

      <section aria-labelledby="ww-quick-time" style={{ marginBottom: 20 }}>
        <h2 id="ww-quick-time" className="ww-kicker" style={{ marginBottom: 10 }}>I dag har vi</h2>
        <div className="ww-wrap">
          {QUICK_TIMES.map((m) => (
            <button
              key={m}
              type="button"
              className="ww-chip"
              onClick={() => onQuickTime(m)}
              style={{ minWidth: 88 }}
            >
              {m} min
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="ww-hero-cta" onClick={onGenerate}>
        <Glyph name="bolt" size={34} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em' }}>Generér workout</span>
          <span style={{ fontSize: 13.5, fontWeight: 500, opacity: 0.82 }}>
            Smart Mix bygger op til 64 sikre variationer og vælger den bedste
          </span>
        </span>
      </button>

      <Photo
        name="sled-push"
        sizes="(min-width: 1024px) 760px, 100vw"
        style={{ marginTop: 22 }}
        eager
      />

      <div style={{ marginTop: 26, borderTop: '1px solid var(--ww-line)' }}>
        <button type="button" className="ww-line-btn" onClick={onSurprise}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Overrask mig</span>
          <span style={{ fontSize: 13, color: 'var(--ww-text-3)' }}>Ét tryk, dine standardvalg</span>
        </button>
        <button type="button" className="ww-line-btn" onClick={() => onGo('program')}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Lav træningsprogram</span>
          <span style={{ fontSize: 13, color: 'var(--ww-text-3)' }}>2–12 uger</span>
        </button>
        <button type="button" className="ww-line-btn" onClick={() => onGo('favorites')}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Favoritter</span>
          <span style={{ fontSize: 13, color: 'var(--ww-text-3)' }}>Kør en igen</span>
        </button>
      </div>

      {last ? (
        <section aria-labelledby="ww-last" style={{ marginTop: 30 }}>
          <h2 id="ww-last" className="ww-kicker" style={{ marginBottom: 12 }}>Seneste</h2>
          <button
            type="button"
            className="ww-card"
            onClick={onOpenLast}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16, padding: 18, cursor: 'pointer', color: 'var(--ww-text)', textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span className="ww-h2">{last.title}</span>
              <span style={{ fontSize: 13, color: 'var(--ww-text-2)' }}>
                {relDate(last.date)} · {last.minutes} min · {last.result || 'ikke registreret'}
              </span>
            </span>
            <span style={{ color: 'var(--ww-orange)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              Se igen
              <Glyph name="chevron" size={16} />
            </span>
          </button>
        </section>
      ) : null}

      <p style={{ margin: '26px 0 0', color: 'var(--ww-text-3)', fontSize: 14, lineHeight: 1.6 }}>
        {thisWeek.length
          ? `Denne uge: ${thisWeek.length} ${plural(thisWeek.length, 'session', 'sessioner')} · ${minutes} minutter.`
          : 'Ingen sessioner denne uge endnu. Det er let at ændre.'}
      </p>
    </div>
  );
}
