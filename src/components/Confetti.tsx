import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';

const COLORS = ['#ff6a1f', '#ff8038', '#ffd166', '#06d6a0', '#ffffff'];
const PIECE_COUNT = 46;
const DURATION_MS = 3000;

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  width: number;
  height: number;
  rotate: number;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2.1 + Math.random() * 0.7,
    color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
    width: 5 + Math.random() * 5,
    height: 10 + Math.random() * 8,
    rotate: Math.round(Math.random() * 360),
  }));
}

/**
 * Konfetti-fejring, når en workout lige er blevet bygget — ikke når en gemt workout blot
 * åbnes igen. Falder fra toppen af skærmen og fader både ind og ud undervejs. Fjerner sig
 * selv fra DOM'en efter DURATION_MS, så den aldrig ligger og optager plads bagefter.
 */
export function Confetti({ active, onDone }: { active: boolean; onDone: () => void }) {
  const pieces = useMemo(() => (active ? makePieces() : []), [active]);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(onDone, DURATION_MS);
    return () => window.clearTimeout(t);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 90, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="ww-confetti-piece"
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: 2,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ['--ww-confetti-r' as string]: `${p.rotate + 240}deg`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
