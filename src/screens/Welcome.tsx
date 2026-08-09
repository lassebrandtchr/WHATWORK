import { HeroPhoto } from '../components/Photo.js';
import { Glyph, ThemeToggle } from '../components/ui.js';
import { Wordmark } from '../components/Wordmark.js';
import { WwMark } from '../components/WwMark.js';

export function Welcome({
  onStart, theme, onToggleTheme,
}: {
  onStart: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  return (
    <div className="ww-hero">
      <HeroPhoto />
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: 'calc(env(safe-area-inset-top) + 36px) 24px calc(env(safe-area-inset-bottom) + 28px)',
          maxWidth: 560, margin: '0 auto', width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <WwMark size={44} />
            <Wordmark size={30} />
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>

        <div className="ww-hero-copy">
          <h1 className="ww-display">
            Træning, bygget om dig.
          </h1>
          <p className="ww-lede ww-lede--strong">
            Du fortæller WHATWORK, hvad du har at arbejde med — WHATWORK bygger træningen.
          </p>
          <p className="ww-lede">
            Fortæl os <strong>din tid</strong>, hvor mange I er, og <strong>dit niveau</strong> —
            fra begynder til erfaren. Så sætter WHATWORK et program med <strong>konkrete kilo</strong>,
            øvelser og <strong>pauser</strong>, tilpasset præcis <strong>dit udstyr</strong> i salen.
          </p>
          <p className="ww-lede">
            Løb, ro, SkiErg, kettlebells, clean &amp; jerk, presses og bæreøvelser — sat sammen som
            en rigtig funktionel <strong>workout</strong>. Alene, eller som partner- og holdtræning
            med vægte skaleret til både mænd og kvinder.
          </p>
          <p className="ww-lede">
            Ingen generiske programmer — kun træning bygget til den tid, du faktisk har.
            <strong> Klar til træning?</strong> Generér din første workout herunder.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="ww-btn ww-btn--primary ww-btn--lg ww-btn--block" onClick={onStart}>
            <Glyph name="check" size={18} />
            <span>Fortsæt som gæstebruger</span>
          </button>
          <p style={{ margin: '10px 2px 0', color: 'var(--ww-text-3)', fontSize: 13.5, lineHeight: 1.6 }}>
            Der er ingen konto og ingen cloud. Alt — profil, workouts, timer og historik — ligger
            lokalt på denne enhed og virker uden netværk.
          </p>
        </div>
      </div>
    </div>
  );
}
