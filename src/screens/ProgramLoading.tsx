import * as eng from '../engine/index.js';
import { ProgressBar } from '../components/ui.js';

type RowState = 'pending' | 'active' | 'done';

function rowState(progress: number, index: number): RowState {
  const phase = eng.PROGRAM_PHASES[index];
  if (!phase) return 'pending';
  const from = eng.PROGRAM_PHASES[index - 1]?.to ?? 0;
  if (progress >= phase.to) return 'done';
  if (progress > from) return 'active';
  return 'pending';
}

/** Fluebenet tegner sig selv ind via `pathLength` — normaliseret sti-længde på 1
 * gør stroke-dasharray/-offset uafhængig af den faktiske geometri. */
function CheckDot({ state }: { state: RowState }) {
  return (
    <span className="ww-doc-dot" data-state={state}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle className="ww-doc-dot__ring" cx="11" cy="11" r="9" fill="none" strokeWidth="1.8" />
        <circle className="ww-doc-dot__fill" cx="11" cy="11" r="9" />
        <path
          className="ww-doc-dot__check"
          d="M6.4 11.3 9.3 14.1l6-6.6"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
      </svg>
    </span>
  );
}

/**
 * Program-generationens loading-skærm. Samme skelet og designsystem som den almindelige
 * workout-loading (fuldskærm, mørk baggrund, stort tabel-tal, fremdriftslinje, fasetekst),
 * men med sin egen animation: et dokument, der progressivt bliver tjekket af — ikke
 * generatorens roterende tandhjul.
 */
export function ProgramLoading({ progress, phaseText }: { progress: number; phaseText: string }) {
  const total = eng.PROGRAM_PHASES.length;
  const done = eng.PROGRAM_PHASES.filter((p) => progress >= p.to).length;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'var(--ww-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '32px 24px', textAlign: 'center', overflowY: 'auto',
      }}
    >
      <div className="ww-doc">
        <div className="ww-doc__head">
          <span className="ww-kicker">Bygger program</span>
          <span className="ww-doc__count ww-num">{done}/{total}</span>
        </div>
        <div className="ww-doc__rows">
          {eng.PROGRAM_PHASES.map((phase, i) => {
            const state = rowState(progress, i);
            return (
              <div className="ww-doc__row" key={phase.label}>
                <CheckDot state={state} />
                <span className="ww-doc__label" data-state={state}>{phase.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="ww-num"
        style={{ fontSize: 'clamp(40px,11vw,64px)', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1, marginTop: 30 }}
      >
        {progress} %
      </div>
      <div style={{ width: 'min(380px,80vw)', margin: '20px 0 18px' }}>
        <ProgressBar value={progress / 100} linear height={4} label="Bygger programmet" />
      </div>
      <div role="status" aria-live="polite" style={{ fontSize: 15, color: 'var(--ww-text-2)', minHeight: 46, maxWidth: '36ch', lineHeight: 1.5 }}>
        {phaseText}
      </div>
    </div>
  );
}
