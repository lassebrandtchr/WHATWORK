import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Skriften bundles i stedet for at hentes fra et CDN, så appen også virker offline.
// Kun latin-subsettet — appen er dansk, og offline-shellen skal holdes let.
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-500.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-700.css';
import '@fontsource/archivo/latin-900.css';

import './index.css';
import { App } from './App.js';
import { UpdatePrompt } from './components/UpdatePrompt.js';
import { applyTheme, readTheme } from './lib/theme.js';

// Temaet sættes før React monterer, så appen ikke blinker lys på vej mod mørk.
applyTheme(readTheme());

const container = document.getElementById('root');
if (!container) throw new Error('Fandt ikke #root i index.html');

createRoot(container).render(
  <StrictMode>
    <App />
    <UpdatePrompt />
  </StrictMode>,
);
