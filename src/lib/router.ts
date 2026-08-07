import { useCallback, useEffect, useState } from 'react';
import type { Screen } from '../types.js';

/**
 * Hash-router. Hver rute har en dansk sti, så en side kan åbnes direkte, deles og
 * bogmærkes — og så browserens tilbageknap virker som forventet. Hash frem for
 * history-API, fordi appen skal kunne serveres fra en hvilken som helst statisk mappe.
 */
export const ROUTES: Record<Screen, string> = {
  welcome: '/velkommen',
  onboard: '/opstart',
  home: '/hjem',
  gen: '/generator',
  loading: '/bygger',
  result: '/workout',
  timer: '/timer',
  program: '/program',
  history: '/historik',
  stats: '/statistik',
  profile: '/profil',
  favorites: '/favoritter',
  equipment: '/udstyr',
  settings: '/indstillinger',
  help: '/hjaelp',
  transfer: '/import-eksport',
  about: '/om',
  complete: '/afsluttet',
};

const BY_PATH: Record<string, Screen> = Object.fromEntries(
  Object.entries(ROUTES).map(([screen, path]) => [path, screen as Screen]),
);

export function screenFromHash(hash: string): Screen | null {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  return BY_PATH[path] ?? null;
}

export function hashFor(screen: Screen): string {
  return `#${ROUTES[screen]}`;
}

export interface RouterApi {
  screen: Screen;
  go: (next: Screen, opts?: { replace?: boolean }) => void;
}

export function useHashRouter(fallback: Screen): RouterApi {
  const [screen, setScreen] = useState<Screen>(
    () => (typeof window === 'undefined' ? fallback : screenFromHash(window.location.hash) ?? fallback),
  );

  useEffect(() => {
    const onHash = (): void => {
      const next = screenFromHash(window.location.hash);
      if (next) setScreen(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((next: Screen, opts?: { replace?: boolean }) => {
    setScreen(next);
    const target = hashFor(next);
    if (typeof window === 'undefined') return;
    if (window.location.hash === target) return;
    if (opts?.replace) window.location.replace(`${window.location.pathname}${window.location.search}${target}`);
    else window.location.hash = target;
    // En ny rute skal altid åbne øverst — ellers arver siden den forrige skrolposition.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return { screen, go };
}
