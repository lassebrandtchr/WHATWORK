import * as eng from '../engine/index.js';
import { PageHeader } from '../components/ui.js';
import { fmtDuration, relDate } from '../lib/format.js';
import type { HistoryEntry, Screen, UserProfile } from '../types.js';

const SEX_LABEL: Record<string, string> = { f: 'Kvinde', m: 'Mand', x: 'Ikke angivet' };

export function Profile({
  profile, history, favorites, onGo, onRedoOnboarding, onPatch,
}: {
  profile: UserProfile;
  history: HistoryEntry[];
  favorites: HistoryEntry[];
  onGo: (s: Screen) => void;
  onRedoOnboarding: () => void;
  onPatch: (patch: Partial<UserProfile>) => void;
}) {
  const completed = history.filter((h) => h.status === 'done').length;
  const last = history[0];

  const rows = [
    { k: 'Niveau', v: eng.LEVELS.find((l) => l.id === profile.level)?.name ?? String(profile.level) },
    { k: 'Skaleringsprofil', v: SEX_LABEL[profile.sex] ?? 'Ikke angivet' },
    { k: 'Kropsvægt', v: `${profile.bodyweight} kg` },
    { k: 'Udstyr', v: `${(profile.equipment ?? []).filter((e) => e !== 'bodyweight').length} typer registreret` },
    { k: 'Skiver', v: profile.plates.length ? `${profile.plates.length} størrelser` : 'Ingen valgt' },
    { k: 'Samlet tid', v: fmtDuration(history.reduce((a, b) => a + b.minutes, 0)) },
    { k: 'Favoritter', v: `${favorites.length}` },
    { k: 'Sidste træning', v: last ? relDate(last.date) : 'Ingen endnu' },
    { k: 'Data', v: 'Kun på denne enhed' },
  ];

  const links: { id: Screen; label: string }[] = [
    { id: 'equipment', label: 'Udstyr og skiver' },
    { id: 'favorites', label: 'Favoritter' },
    { id: 'stats', label: 'Statistik' },
    { id: 'settings', label: 'Indstillinger' },
    { id: 'transfer', label: 'Import og eksport' },
    { id: 'help', label: 'Hjælp' },
    { id: 'about', label: 'Om WHATWORK' },
  ];

  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 760 }}>
      <PageHeader kicker="Profil" title={profile.name || 'Gæst'} />

      <div style={{ marginBottom: 24 }}>
        <label htmlFor="ww-profile-name" style={{ display: 'block', fontSize: 13, color: 'var(--ww-text-2)', marginBottom: 8 }}>
          Navn eller initialer
        </label>
        <input
          id="ww-profile-name"
          className="ww-input"
          type="text"
          value={profile.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Gæst"
          maxLength={40}
        />
      </div>

      <div style={{ padding: '0 0 28px', borderBottom: '1px solid var(--ww-line)', marginBottom: 24 }}>
        <div className="ww-num" style={{ fontSize: 'clamp(56px,16vw,88px)', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.9 }}>
          {completed}
        </div>
        <div style={{ fontSize: 15, color: 'var(--ww-text-2)', marginTop: 10 }}>workouts gennemført</div>
      </div>

      <dl style={{ margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map((r) => (
          <div
            key={r.k}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 20, padding: '15px 0', borderBottom: '1px solid var(--ww-line)',
            }}
          >
            <dt style={{ fontSize: 15, color: 'var(--ww-text-2)' }}>{r.k}</dt>
            <dd style={{ margin: 0, fontSize: 15, textAlign: 'right', fontWeight: 550 }}>{r.v}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Mere i WHATWORK" style={{ marginBottom: 24 }}>
        {links.map((l) => (
          <button key={l.id} type="button" className="ww-line-btn" onClick={() => onGo(l.id)}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{l.label}</span>
            <span style={{ fontSize: 13, color: 'var(--ww-text-3)' }}>Åbn</span>
          </button>
        ))}
      </nav>

      <button type="button" className="ww-btn ww-btn--lg" onClick={onRedoOnboarding}>
        Ret mine oplysninger
      </button>

      <p style={{ margin: '24px 0 0', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.65, maxWidth: '60ch' }}>
        WHATWORK er en træningsplanlægger — ikke en læge, fysioterapeut eller coach. Appen kender
        ikke din krop, stiller ingen diagnose og garanterer ingen resultater. Tilpas altid til
        din teknik og dagsform.
      </p>
    </div>
  );
}
