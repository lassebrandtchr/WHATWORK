import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Service workeren må aldrig overtage en igangværende session.
 *
 * En ny version installeres i baggrunden, men tages først i brug, når brugeren selv
 * siger til — ellers ville en opdatering kunne genindlæse appen midt i en workout.
 */
export function UpdatePrompt() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  // Opdateringsfunktionen er ikke tilstand, kun en reference til noget udenfor React.
  const apply = useRef<(() => void) | null>(null);

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedsUpdate(true);
      },
    });
    apply.current = () => void update(true);
  }, []);

  if (!needsUpdate) return null;

  return (
    <div className="ww-update ww-glass" role="status">
      <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5, minWidth: '18ch' }}>
        Opdatering klar — hent efter din workout.
      </span>
      <button
        type="button"
        className="ww-btn"
        style={{ minHeight: 44, padding: '0 14px', fontSize: 14 }}
        onClick={() => setNeedsUpdate(false)}
      >
        Ikke nu
      </button>
      <button
        type="button"
        className="ww-btn ww-btn--primary"
        style={{ minHeight: 44, padding: '0 16px', fontSize: 14 }}
        onClick={() => apply.current?.()}
      >
        Hent nu
      </button>
    </div>
  );
}
