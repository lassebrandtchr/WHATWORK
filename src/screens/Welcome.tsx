import { Wordmark } from '../components/Wordmark.js';

export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top) + 36px) 24px calc(env(safe-area-inset-bottom) + 28px)',
        maxWidth: 560, margin: '0 auto', width: '100%',
      }}
    >
      <Wordmark size={30} />

      <div style={{ padding: '44px 0 8px' }}>
        <h1 className="ww-display" style={{ marginBottom: 18 }}>
          Bygget til
          <br />
          funktionel fitness.
        </h1>
        <p className="ww-lede" style={{ maxWidth: '34ch' }}>
          Fortæl hvor lang tid I har, hvem der træner, og hvilket udstyr der står i salen.
          Så bygger WHATWORK en workout med konkrete kilo, mål og pauser.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" className="ww-btn ww-btn--primary ww-btn--lg ww-btn--block" onClick={onStart}>
          Fortsæt uden bruger
        </button>
        <p style={{ margin: '10px 2px 0', color: 'var(--ww-text-3)', fontSize: 13.5, lineHeight: 1.6 }}>
          Der er ingen konto og ingen cloud. Alt — profil, workouts, timer og historik — ligger
          lokalt på denne enhed og virker uden netværk.
        </p>
      </div>
    </div>
  );
}
