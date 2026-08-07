import { useEffect } from 'react';
import type { TimerPlan, Workout } from '../engine/index.js';
import { Dialog } from '../components/ui.js';
import { fmtTime } from '../lib/format.js';
import type { TimerState, TimerView } from '../types.js';

const KIND_LABEL: Record<string, string> = {
  prep: 'Gør klar', work: 'Arbejde', rest: 'Pause', transition: 'Skift', done: 'Færdig',
};

export function Timer({
  timer, plan, view, workout, confirmDialog, keepAwake,
  onToggle, onNext, onPrev, onRound, onRequestExit, onRequestReset, onCancelDialog,
  onConfirmExit, onConfirmReset, onFinish,
}: {
  timer: TimerState;
  plan: TimerPlan;
  view: TimerView;
  workout: Workout;
  confirmDialog: 'exit' | 'reset' | null;
  keepAwake: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRound: (delta: number) => void;
  onRequestExit: () => void;
  onRequestReset: () => void;
  onCancelDialog: () => void;
  onConfirmExit: () => void;
  onConfirmReset: () => void;
  onFinish: () => void;
}) {
  const { segment, next } = view;
  const isLast = view.index >= view.total - 1;
  const movements = segment.movements ?? (segment.movement ? [segment.movement] : []);
  const hasRounds = segment.kind === 'work' && segment.seconds === null;

  // Wake Lock er ikke tilgængelig alle steder. Fejler den, skal timeren bare køre videre.
  useEffect(() => {
    if (!keepAwake || !timer.running) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => { lock = null; });
    return () => { void lock?.release?.().catch(() => undefined); };
  }, [keepAwake, timer.running, view.index]);

  return (
    <div className="ww-timer">
      {/* Topbjælke */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="ww-kicker ww-kicker--accent" style={{ whiteSpace: 'nowrap' }}>{workout.title}</span>
          <span style={{ fontSize: 12.5, color: 'var(--ww-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {segment.blockTitle} · {KIND_LABEL[segment.kind] ?? segment.kind}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="ww-btn ww-btn--ghost" style={{ minHeight: 44 }} onClick={onRequestReset}>
            Nulstil
          </button>
          <button type="button" className="ww-btn" style={{ minHeight: 44 }} onClick={onRequestExit}>
            Afslut
          </button>
        </div>
      </div>

      {/* Segmentskinne */}
      <div className="ww-timer__rail" role="img" aria-label={`Segment ${view.index + 1} af ${view.total}`}>
        {plan.segments.map((s, i) => (
          <span key={s.id} className={i < view.index ? 'is-done' : i === view.index ? 'is-now' : ''} />
        ))}
      </div>

      {/* Ur, aktiv øvelse og næste — alt tre synligt samtidig */}
      <div
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: 'center', gap: 10, padding: '4px 0', textAlign: 'center',
        }}
      >
        <div className="ww-kicker">{segment.label}</div>

        {/*
          Tiden annonceres ikke pr. sekund til skærmlæsere — det ville gøre skærmen
          ubrugelig. Kun segmentskiftet melder sig.
        */}
        <div
          className={`ww-timer__display${view.tone === 'warn' ? ' is-warn' : view.tone === 'over' ? ' is-over' : ''}`}
          aria-hidden="true"
        >
          {view.display}
        </div>
        <div className="ww-sr-only" role="status" aria-live="polite">
          {segment.label}. {movements[0]?.display ?? ''}
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--ww-text-3)' }} className="ww-num">
          {segment.seconds === null
            ? segment.capSeconds
              ? `Åben tid · cap ${Math.round(segment.capSeconds / 60)} min · i alt ${fmtTime(view.sessionElapsed)}`
              : `Åben tid · i alt ${fmtTime(view.sessionElapsed)}`
            : `af ${fmtTime(segment.seconds)} · i alt ${fmtTime(view.sessionElapsed)}`}
          {segment.round ? ` · runde ${segment.round}${segment.totalRounds ? ` af ${segment.totalRounds}` : ''}` : ''}
        </div>

        {segment.worker ? (
          <div className="ww-badge ww-badge--accent" style={{ fontSize: 13 }}>
            {segment.worker} arbejder{segment.resting && segment.resting !== '—' ? ` · ${segment.resting} restituerer` : ''}
          </div>
        ) : null}

        {movements.length ? (
          <div style={{ maxWidth: '34ch', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {movements.map((m, i) => (
              <div key={`${m.exerciseId}-${i}`}>
                <div className="ww-h2">{m.display}</div>
                {m.targets.some((t) => t.load) || m.individualTargets ? (
                  <div style={{ fontSize: 13.5, color: 'var(--ww-orange)', marginTop: 3 }}>
                    {m.targets.map((t) => (
                      `${workout.participants > 1 ? `${t.label}: ` : ''}${m.individualTargets ? t.amountText : ''}${t.load ? `${m.individualTargets ? ' · ' : ''}${t.load.text}` : ''}`
                    )).filter(Boolean).join('   ·   ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {segment.hint ? (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ww-text-2)', maxWidth: '38ch', lineHeight: 1.55 }}>
            {segment.hint}
          </p>
        ) : null}

        {hasRounds ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
            <button type="button" className="ww-round-btn" aria-label="Én runde færre" onClick={() => onRound(-1)}>−</button>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
              <span className="ww-num" style={{ fontSize: 28, fontWeight: 700 }}>{timer.rounds}</span>
              <span className="ww-kicker">Runder</span>
            </span>
            <button type="button" className="ww-round-btn ww-round-btn--add" aria-label="Én runde mere" onClick={() => onRound(1)}>+</button>
          </div>
        ) : null}

        {next ? (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ww-text-3)', maxWidth: '34ch' }}>
            Næste: {next.movement?.display ?? next.label}
          </p>
        ) : null}
      </div>

      {/* Faste kontroller */}
      <div className="ww-timer__controls">
        <button type="button" className="ww-timer__btn" onClick={onPrev} disabled={view.index === 0}>
          Forrige
        </button>
        <button
          type="button"
          className={`ww-timer__btn ww-timer__btn--main${timer.running ? ' is-running' : ''}`}
          onClick={onToggle}
        >
          {timer.running ? 'Pause' : view.sessionElapsed > 0 ? 'Fortsæt' : 'Start'}
        </button>
        {isLast ? (
          <button type="button" className="ww-timer__btn" onClick={onFinish}>Færdig</button>
        ) : (
          <button type="button" className="ww-timer__btn" onClick={onNext}>Næste</button>
        )}
      </div>

      {confirmDialog === 'exit' ? (
        <Dialog title="Afslut træningen?" onClose={onCancelDialog}>
          <p style={{ margin: '0 0 20px', color: 'var(--ww-text-2)', fontSize: 15, lineHeight: 1.55 }}>
            Tiden stopper, og workouten gemmes som afbrudt i historikken.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ww-btn ww-btn--lg ww-btn--block" onClick={onCancelDialog}>
              Bliv i timeren
            </button>
            <button type="button" className="ww-btn ww-btn--lg ww-btn--block ww-btn--solid-danger" onClick={onConfirmExit}>
              Afslut
            </button>
          </div>
        </Dialog>
      ) : null}

      {confirmDialog === 'reset' ? (
        <Dialog title="Nulstil timeren?" onClose={onCancelDialog}>
          <p style={{ margin: '0 0 20px', color: 'var(--ww-text-2)', fontSize: 15, lineHeight: 1.55 }}>
            Timeren starter forfra på første segment. Workouten og dine runder nulstilles,
            men workouten selv beholdes.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ww-btn ww-btn--lg ww-btn--block" onClick={onCancelDialog}>
              Fortryd
            </button>
            <button type="button" className="ww-btn ww-btn--lg ww-btn--block ww-btn--solid-danger" onClick={onConfirmReset}>
              Nulstil
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
