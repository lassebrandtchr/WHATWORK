import { Glyph, ProgressBar } from '../components/ui.js';

export function Loading({ progress, phaseText }: { progress: number; phaseText: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'var(--ww-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 32, textAlign: 'center',
      }}
    >
      <span style={{ color: 'var(--ww-orange)', marginBottom: 36 }} className="ww-pulse">
        <Glyph name="bolt" size={92} />
      </span>
      <div className="ww-num" style={{ fontSize: 'clamp(52px,15vw,80px)', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1 }}>
        {progress} %
      </div>
      <div style={{ width: 'min(420px,80vw)', margin: '26px 0 20px' }}>
        <ProgressBar value={progress / 100} linear height={4} label="Bygger workouten" />
      </div>
      <div style={{ fontSize: 15, color: 'var(--ww-text-2)', minHeight: 46, maxWidth: '34ch', lineHeight: 1.5 }}>
        {phaseText}
      </div>
    </div>
  );
}
