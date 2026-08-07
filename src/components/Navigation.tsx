import { useEffect, useRef } from 'react';
import { initialsOf } from '../lib/format.js';
import { Glyph } from './ui.js';
import { Wordmark } from './Wordmark.js';
import { WwMark } from './WwMark.js';
import type { Screen } from '../types.js';

interface NavItem {
  id: Screen;
  label: string;
  path: string;
}

/** Mobilens bundnavigation: Hjem, Program, Historik og Profil. */
const TABS: NavItem[] = [
  { id: 'home', label: 'Hjem', path: 'M3.4 10 12 3.6 20.6 10v9.2a1 1 0 0 1-1 1h-4.4v-6H8.8v6H4.4a1 1 0 0 1-1-1z' },
  { id: 'program', label: 'Program', path: 'M4 5.6h16M4 12h11M4 18.4h14' },
  { id: 'history', label: 'Historik', path: 'M12 4a8 8 0 1 1-8 8M12 7.6V12l3 2M4 8.4 6.8 11' },
  { id: 'profile', label: 'Profil', path: 'M12 4.4a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8M4.8 19.6a7.2 7.2 0 0 1 14.4 0' },
];

/** De sekundære ruter, der åbnes fra menuen på mobil og fra headeren på desktop. */
export const SECONDARY: { id: Screen; label: string; hint: string }[] = [
  { id: 'stats', label: 'Statistik', hint: 'Volumen, fordeling og streak' },
  { id: 'favorites', label: 'Favoritter', hint: 'Workouts du har gemt som favorit' },
  { id: 'equipment', label: 'Udstyr', hint: 'Redskaber, antal og skiver' },
  { id: 'settings', label: 'Indstillinger', hint: 'Tema, AI Mix, lyd og haptik' },
  { id: 'transfer', label: 'Import og eksport', hint: 'Tag dine data med dig' },
  { id: 'help', label: 'Hjælp', hint: 'Formater og timeren' },
  { id: 'about', label: 'Om WHATWORK', hint: 'Hvad appen er — og ikke er' },
];

export function MobileNav({ screen, onGo }: { screen: Screen; onGo: (s: Screen) => void }) {
  return (
    <nav className="ww-tabbar ww-glass" aria-label="Hovedmenu">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="ww-tab"
            aria-current={screen === tab.id ? 'page' : undefined}
            onClick={() => onGo(tab.id)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={tab.path} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{tab.label}</span>
            <span className="ww-tab__dot" />
          </button>
        ))}
      </div>
    </nav>
  );
}

export function DesktopHeader({
  screen, profileName, onGo, onGenerate,
}: {
  screen: Screen;
  profileName: string;
  onGo: (s: Screen) => void;
  onGenerate: () => void;
}) {
  const links: { id: Screen; label: string; action: () => void }[] = [
    { id: 'home', label: 'Hjem', action: () => onGo('home') },
    { id: 'gen', label: 'Generér workout', action: onGenerate },
    { id: 'program', label: 'Program', action: () => onGo('program') },
    { id: 'history', label: 'Historik', action: () => onGo('history') },
    { id: 'stats', label: 'Statistik', action: () => onGo('stats') },
  ];

  return (
    <header className="ww-header ww-glass">
      <div
        style={{
          maxWidth: 1280, margin: '0 auto', padding: '0 28px',
          height: 64, display: 'flex', alignItems: 'center', gap: 28,
        }}
      >
        <button
          type="button"
          onClick={() => onGo('home')}
          aria-label="WHATWORK — gå til Hjem"
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            lineHeight: 0, display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <WwMark size={30} />
          <Wordmark size={19} />
        </button>
        <nav style={{ display: 'flex', gap: 2, flex: 1 }} aria-label="Hovedmenu">
          {links.map((link) => (
            <button
              key={link.id}
              type="button"
              className="ww-nav-btn"
              aria-current={screen === link.id ? 'page' : undefined}
              onClick={link.action}
            >
              {link.label}
            </button>
          ))}
        </nav>
        <nav style={{ display: 'flex', gap: 2 }} aria-label="Indstillinger og data">
          {SECONDARY.filter((s) => ['settings', 'help'].includes(s.id)).map((s) => (
            <button
              key={s.id}
              type="button"
              className="ww-nav-btn"
              aria-current={screen === s.id ? 'page' : undefined}
              onClick={() => onGo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => onGo('profile')}
          aria-current={screen === 'profile' ? 'page' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, background: 'none',
            border: '1px solid var(--ww-line-2)', borderRadius: 999,
            padding: '5px 14px 5px 5px', cursor: 'pointer', color: 'var(--ww-text)',
            minHeight: 44,
          }}
        >
          <span
            style={{
              width: 30, height: 30, borderRadius: 999, background: 'var(--ww-orange-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: 'var(--ww-orange)',
            }}
          >
            {initialsOf(profileName)}
          </span>
          <span style={{ fontSize: 14, fontWeight: 550 }}>{profileName}</span>
        </button>
      </div>
    </header>
  );
}

/** Den faste primærhandling nederst. */
export function BottomBar({
  label, onClick, secondary,
}: {
  label: string;
  onClick: () => void;
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="ww-bottom-bar ww-glass">
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 8 }}>
        {secondary ? (
          <button type="button" className="ww-btn ww-btn--lg" onClick={secondary.onClick}>
            {secondary.label}
          </button>
        ) : null}
        <button type="button" className="ww-btn ww-btn--primary ww-btn--lg ww-btn--block" onClick={onClick}>
          {label}
        </button>
      </div>
    </div>
  );
}

/**
 * Menuen med de sekundære ruter. Den lukkes med Escape og med klik udenfor, fokus
 * fastholdes indeni, og fokus gives tilbage til knappen, der åbnede den.
 */
export function Drawer({
  screen, onGo, onClose,
}: {
  screen: Screen;
  onGo: (s: Screen) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const items = (): HTMLElement[] =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>('button') ?? []);
    items()[0]?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const first = list[0] as HTMLElement;
      const last = list[list.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="ww-drawer"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ww-drawer__panel ww-glass"
        role="dialog"
        aria-modal="true"
        aria-label="Mere i WHATWORK"
        ref={panel}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="ww-kicker">Mere</span>
          <button type="button" className="ww-icon-btn" onClick={onClose} aria-label="Luk menuen">
            <Glyph name="close" />
          </button>
        </div>
        {SECONDARY.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ww-drawer__link"
            aria-current={screen === item.id ? 'page' : undefined}
            onClick={() => { onGo(item.id); onClose(); }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>{item.label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--ww-text-3)', fontWeight: 400 }}>{item.hint}</span>
            </span>
            <Glyph name="chevron" size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
