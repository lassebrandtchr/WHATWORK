import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/* Små byggeklodser, der går igen på tværs af skærmene. */

export function Chip({
  on = false, onClick, children, style, label, tone = 'accent',
}: {
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  style?: CSSProperties;
  label?: string;
  /** `danger` bruges, hvor et valgt chip betyder "fravalgt" — orange ville læses
   *  som tilvalgt, ligesom alle andre steder i appen. */
  tone?: 'accent' | 'danger';
}) {
  return (
    <button
      type="button"
      className={`ww-chip${tone === 'danger' ? ' ww-chip--off' : ''}`}
      aria-pressed={on}
      onClick={onClick}
      style={style}
      aria-label={label}
    >
      {children}
    </button>
  );
}

/** Fuldbredde-valg med navn til venstre og forklaring til højre. */
export function OptionRow({
  on = false, onClick, name, desc,
}: {
  on?: boolean;
  onClick: () => void;
  name: string;
  desc?: string;
}) {
  return (
    <button type="button" className="ww-row" aria-pressed={on} onClick={onClick}>
      <span className="ww-row__name">{name}</span>
      {desc ? <span className="ww-row__desc">{desc}</span> : null}
    </button>
  );
}

/** −/+ omkring en værdi. */
export function Counter({
  label, hint, value, onDown, onUp, minWidth = 44,
}: {
  label: string;
  hint?: string;
  value: ReactNode;
  onDown: () => void;
  onUp: () => void;
  minWidth?: number;
}) {
  return (
    <div className="ww-counter-row">
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
        {hint ? <span style={{ fontSize: 12.5, color: 'var(--ww-text-3)' }}>{hint}</span> : null}
      </span>
      <span className="ww-counter-controls">
        <button type="button" className="ww-step-btn" onClick={onDown} aria-label={`${label}: én færre`}>−</button>
        <span className="ww-num" style={{ fontSize: 18, fontWeight: 700, minWidth, textAlign: 'center' }}>
          {value}
        </span>
        <button type="button" className="ww-step-btn" onClick={onUp} aria-label={`${label}: én mere`}>+</button>
      </span>
    </div>
  );
}

/** Fremdriftslinje. `value` er 0–1. */
export function ProgressBar({
  value, linear = false, height, label,
}: {
  value: number;
  linear?: boolean;
  height?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      className="ww-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      aria-label={label}
      style={height ? { height } : undefined}
    >
      <div
        className={`ww-progress__fill${linear ? ' ww-progress__fill--linear' : ''}`}
        style={{ transform: `scaleX(${pct})` }}
      />
    </div>
  );
}

/** Vandret måler til delscorer og DNA-akser. */
export function Meter({ value, max = 10, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <span className="ww-meter" role="img" aria-label={label ?? `${value} af ${max}`}>
      <span className="ww-meter__fill" style={{ transform: `scaleX(${pct})` }} />
    </span>
  );
}

/** Trinhoved med tilbageknap, fremdrift og tæller. */
export function StepHeader({
  onBack, value, counter, maxWidth,
}: {
  onBack: () => void;
  value: number;
  counter: string;
  maxWidth?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26, maxWidth }}>
      <button type="button" className="ww-icon-btn" onClick={onBack} aria-label="Tilbage">
        <Glyph name="back" />
      </button>
      <ProgressBar value={value} label="Fremdrift i generatoren" />
      <div className="ww-num" style={{ fontSize: 13, color: 'var(--ww-text-3)', whiteSpace: 'nowrap' }}>{counter}</div>
    </div>
  );
}

/** Versal-etiket over en sektion. */
export function Kicker({ children, accent, style }: { children: ReactNode; accent?: boolean; style?: CSSProperties }) {
  return <div className={`ww-kicker${accent ? ' ww-kicker--accent' : ''}`} style={style}>{children}</div>;
}

/** Sideoverskrift med kicker og valgfri handling til højre. */
export function PageHeader({
  kicker, title, lede, action, icon,
}: {
  kicker?: string;
  title: string;
  lede?: string;
  action?: ReactNode;
  /** Samme orange ikon som underpunktet har i menuen — genkendelse på tværs af de to. */
  icon?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          {kicker ? <Kicker style={{ marginBottom: 10 }}>{kicker}</Kicker> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon ? <span className="ww-page-icon" aria-hidden="true">{icon}</span> : null}
            <h1 className="ww-h1">{title}</h1>
          </div>
        </div>
        {action}
      </div>
      {lede ? <p className="ww-lede" style={{ marginTop: 12, maxWidth: '60ch' }}>{lede}</p> : null}
    </header>
  );
}

/** Fremhævet note. Etiketten bærer betydningen, så farve aldrig står alene. */
export function Note({
  label, children, tone = 'accent', accent = false,
}: {
  label: string;
  children: ReactNode;
  tone?: 'accent' | 'danger' | 'good' | 'quiet';
  /** Tvinger label-farven til orange, uanset `tone` — bruges hvor kun labelen skal
   * matche appens øvrige orange overskrifter, uden at ændre resten af notens tone. */
  accent?: boolean;
}) {
  const cls = (tone === 'accent' ? '' : ` ww-note--${tone}`) + (accent ? ' ww-note--label-accent' : '');
  return (
    <div className={`ww-note${cls}`}>
      <span className="ww-note__label">{label}</span>
      {children}
    </div>
  );
}

export function EmptyState({
  title, body, action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="ww-card" style={{ padding: '30px 22px' }}>
      <h2 className="ww-h2" style={{ marginBottom: 10 }}>{title}</h2>
      <p className="ww-lede" style={{ marginBottom: action ? 20 : 0, maxWidth: '48ch' }}>{body}</p>
      {action}
    </div>
  );
}

/** Fokus fastholdes i dialogen og gives tilbage, når den lukkes. */
export function Dialog({
  title, children, onClose, labelledBy = 'ww-dialog-title',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const focusable = (): HTMLElement[] => Array.from(
      node?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((el) => !el.hasAttribute('disabled'));

    focusable()[0]?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
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
      className="ww-scrim"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ww-dialog" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panel}>
        <h2 id={labelledBy} className="ww-h2" style={{ marginBottom: 10 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export type GlyphName = 'back' | 'close' | 'menu' | 'bolt' | 'star' | 'star-filled' | 'check' | 'chevron' | 'sun' | 'moon' | 'gear' | 'sound-on' | 'sound-off' | 'search' | 'sparkle' | 'trash' | 'refresh' | 'stats' | 'kit' | 'transfer' | 'help' | 'info';

/** Appens egne glyffer. Ingen emoji, intet eksternt ikonbibliotek. */
export function Glyph({ name, size = 20 }: { name: GlyphName; size?: number }) {
  const common = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<GlyphName, ReactNode> = {
    back: <path d="M15 5 8 12l7 7" {...common} />,
    chevron: <path d="M9 5l7 7-7 7" {...common} />,
    close: <path d="M6 6l12 12M18 6L6 18" {...common} />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" {...common} />,
    bolt: <path d="M13.6 2.6 4.8 13.4h5.6l-.6 7.8 8.8-10.8h-5.6z" {...common} />,
    star: <path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z" {...common} />,
    'star-filled': (
      <path
        d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"
        fill="currentColor" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round"
      />
    ),
    check: <path d="m5 12.6 4.6 4.4L19 7" {...common} />,
    /* Ét stort firetakket glimt med to gnister omkring. Fyldt frem for streget —
       stjernestøv skal læses som lys, ikke som en optegnet form. */
    sparkle: (
      <g fill="currentColor" stroke="none">
        <path d="M11.4 2.2c.85 4.1 1.95 5.2 6.05 6.05-4.1.85-5.2 1.95-6.05 6.05-.85-4.1-1.95-5.2-6.05-6.05 4.1-.85 5.2-1.95 6.05-6.05Z" />
        <path d="M18.3 13.9c.42 2.04.97 2.59 3.01 3.01-2.04.42-2.59.97-3.01 3.01-.42-2.04-.97-2.59-3.01-3.01 2.04-.42 2.59-.97 3.01-3.01Z" />
        <path d="M7.1 16.4c.3 1.44.69 1.83 2.13 2.13-1.44.3-1.83.69-2.13 2.13-.3-1.44-.69-1.83-2.13-2.13 1.44-.3 1.83-.69 2.13-2.13Z" />
      </g>
    ),
    search: (
      <g {...common}>
        <circle cx="11" cy="11" r="6.4" />
        <path d="m15.8 15.8 4 4" />
      </g>
    ),
    sun: (
      <g {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
      </g>
    ),
    moon: <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z" {...common} />,
    'sound-on': (
      <g {...common}>
        <path d="M4 10v4h3.6L13 18V6L7.6 10z" />
        <path d="M16.2 9a4.2 4.2 0 0 1 0 6M18.6 6.6a7.8 7.8 0 0 1 0 10.8" />
      </g>
    ),
    'sound-off': (
      <g {...common}>
        <path d="M4 10v4h3.6L13 18V6L7.6 10z" />
        <path d="M16 10.4l4.4 4.4M20.4 10.4 16 14.8" />
      </g>
    ),
    gear: (
      <g {...common}>
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </g>
    ),
    trash: (
      <g {...common}>
        <path d="M5 7h14" />
        <path d="M9.5 7V5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2" />
        <path d="M7.5 7l1 12.1a1 1 0 0 0 1 .9h5a1 1 0 0 0 1-.9L16.5 7" />
        <path d="M10.3 10.5v6M13.7 10.5v6" />
      </g>
    ),
    refresh: (
      <g {...common}>
        <path d="M12 5a7 7 0 1 1-4.95 2.05" />
        <path d="M4.5 4.5v3.5h3.5" />
      </g>
    ),
    /* Statistik: tre stigende søjler på en grundlinje. */
    stats: (
      <g {...common}>
        <path d="M4 20h16" />
        <rect x="6" y="13" width="3" height="6" rx="0.8" />
        <rect x="10.5" y="9" width="3" height="10" rx="0.8" />
        <rect x="15" y="5" width="3" height="14" rx="0.8" />
      </g>
    ),
    /* Udstyr: kedelklokke med hank, plus en vægtskive ved siden af. */
    kit: (
      <g {...common}>
        <path d="M8.3 9.3V7.6a1.8 1.8 0 0 1 3.6 0v1.7" />
        <path d="M8.1 9.3h3.9" />
        <circle cx="10" cy="13.1" r="3.4" />
        <circle cx="18.3" cy="14.3" r="3" />
        <path d="M18.3 14.3h.01" strokeWidth={2.2} />
      </g>
    ),
    /* Import/eksport: data ind fra venstre, ud til højre — en boks imellem. */
    transfer: (
      <g {...common}>
        <rect x="8.6" y="3.6" width="7.6" height="11" rx="1.3" />
        <path d="M10.4 7.4h4M10.4 10.2h4" />
        <path d="M2.4 9h4.6M4.6 6.6 7 9l-2.4 2.4" />
        <path d="M21.6 17.4h-4.6M19.4 15l2.4 2.4-2.4 2.4" />
      </g>
    ),
    /* Hjælp: rundt spørgsmålstegn — venligt frem for teknisk. */
    help: (
      <g {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.4 9.6a2.6 2.6 0 1 1 3.6 2.4c-1 .5-1.4 1.1-1.4 2.2" />
        <path d="M12 17.4h.01" />
      </g>
    ),
    /* Om WHATWORK?: rundt infotegn. */
    info: (
      <g {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.4" />
        <path d="M12 7.6h.01" />
      </g>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

/** Lille, hurtig skifter mellem Dark og Light Mode — vises i headeren på alle sider. */
export function ThemeToggle({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="ww-icon-btn"
      aria-label={theme === 'dark' ? 'Skift til Light Mode' : 'Skift til Dark Mode'}
      onClick={onToggle}
    >
      <Glyph name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

/** Lille, hurtig lyd-til/fra-knap — samme mønster som ThemeToggle, vises i timerens topbjælke. */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="ww-icon-btn"
      aria-label={on ? 'Slå timerlyd fra' : 'Slå timerlyd til'}
      aria-pressed={on}
      onClick={onToggle}
    >
      <Glyph name={on ? 'sound-on' : 'sound-off'} />
    </button>
  );
}
