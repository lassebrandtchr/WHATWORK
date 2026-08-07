import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetConnection } from '../lib/storage.js';

beforeEach(() => {
  // jsdom har ingen matchMedia; appen bruger den til at skifte mellem mobil og desktop.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  // jsdom implementerer ikke scrollTo. Routeren kalder den for at åbne nye ruter øverst.
  vi.stubGlobal('scrollTo', () => {});
  localStorage.clear();
  resetConnection();
  // jsdom deler ét window på tværs af tests. Uden en nulstilling ville en test, der
  // navigerer, bestemme hvilken rute den næste starter på.
  window.location.hash = '';
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
