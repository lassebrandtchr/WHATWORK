import { useEffect, useRef } from 'react';

/**
 * Deler fysikken bag "knapper med levende støv": kettlebells på "Generér workout"
 * og stjerner på "Overrask mig" skal begge vige stille for musen og glide lige så
 * stille tilbage. Anker-positionerne er faste procenter af beholderen; det eneste,
 * der flytter sig, er en `--rx`/`--ry`-transform, som CSS selv overgangsudjævner —
 * så der ikke skal en rAF-løkke til for at få bevægelsen til at føles blød.
 */

export interface RepelAnchor { x: number; y: number }

export function useCursorRepel<T extends HTMLElement>(
  anchors: RepelAnchor[],
  opts: { radius?: number; strength?: number } = {},
) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(T | null)[]>([]);
  const radius = opts.radius ?? 70;
  const strength = opts.strength ?? 16;

  useEffect(() => {
    const field = containerRef.current;
    // Feltet selv har pointer-events:none — knappen skal jo forblive klikbar
    // under det — så det kan aldrig blive mål for et pointer-event. Musen
    // lyttes derfor på den rigtige knap, feltets forælder, mens positionerne
    // stadig regnes ud fra feltets egen (identiske) størrelse.
    const host = field?.parentElement;
    if (!field || !host) return undefined;
    // Berøringsskærme har ikke en svævende markør — uden `hover: hover` ville
    // sidste berøringspunkt stå tilbage som en falsk "musepositon", der aldrig forsvinder.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    const reset = (): void => {
      itemRefs.current.forEach((el) => {
        el?.style.setProperty('--rx', '0px');
        el?.style.setProperty('--ry', '0px');
      });
    };

    const move = (e: PointerEvent): void => {
      const rect = field.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      itemRefs.current.forEach((el, i) => {
        const a = anchors[i];
        if (!el || !a) return;
        const ax = (a.x / 100) * rect.width;
        const ay = (a.y / 100) * rect.height;
        const dx = ax - px;
        const dy = ay - py;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01 && dist < radius) {
          const force = (1 - dist / radius) * strength;
          el.style.setProperty('--rx', `${((dx / dist) * force).toFixed(2)}px`);
          el.style.setProperty('--ry', `${((dy / dist) * force).toFixed(2)}px`);
        } else {
          el.style.setProperty('--rx', '0px');
          el.style.setProperty('--ry', '0px');
        }
      });
    };

    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', reset);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', reset);
    };
  }, [anchors, radius, strength]);

  return { containerRef, itemRefs };
}
