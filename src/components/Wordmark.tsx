import type { CSSProperties } from 'react';

/**
 * WHATWORK?-logoet: to identiske tekstlag, hver klippet til en halvdel og skudt
 * en anelse fra hinanden, så ordet får det "skårne" glitch-udtryk fra brandets
 * splash-skærm. Ren tekst i Archivo 900 — skarpt i enhver størrelse og på
 * enhver skærmtæthed, uden rasterbillede.
 */
export function Wordmark({ size = 22, style }: { size?: number; style?: CSSProperties }) {
  const glyph: CSSProperties = {
    fontFamily: 'Archivo, system-ui, sans-serif',
    fontWeight: 900,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: '-0.01em',
    textTransform: 'uppercase',
    color: 'var(--ww-orange)',
    whiteSpace: 'nowrap',
  };

  return (
    <span
      role="img"
      aria-label="WHATWORK?"
      style={{
        position: 'relative', display: 'inline-block', ...style,
      }}
    >
      <span aria-hidden="true" style={{ ...glyph, opacity: 0 }}>WHATWORK?</span>
      <span
        aria-hidden="true"
        style={{
          ...glyph,
          position: 'absolute', inset: 0,
          clipPath: 'inset(0 0 52% 0)',
          transform: 'translate(-0.028em, -0.05em)',
        }}
      >
        WHATWORK?
      </span>
      <span
        aria-hidden="true"
        style={{
          ...glyph,
          position: 'absolute', inset: 0,
          clipPath: 'inset(48% 0 0 0)',
          transform: 'translate(0.028em, 0.05em)',
        }}
      >
        WHATWORK?
      </span>
    </span>
  );
}
