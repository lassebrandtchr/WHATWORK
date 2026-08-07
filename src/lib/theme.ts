import { THEME_KEY } from './storage.js';
import type { ThemeId } from '../types.js';

/**
 * Dark Mode er standard. Temaet ligger i localStorage frem for i IndexedDB, fordi det
 * skal kunne læses synkront, før der males første gang — ellers blinker appen lys,
 * inden den bliver mørk igen.
 */
export const DEFAULT_THEME: ThemeId = 'dark';

export function readTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f5f3' : '#101215');
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignoreres bevidst */ }
}
