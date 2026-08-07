import { defineConfig, loadEnv } from 'vite';
import type { Connect, PluginOption, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Cache-versionen bumpes bevidst ved brud på app-shell eller motorens dataformat.
const CACHE_VERSION = 'whatwork-v2';

/**
 * Server-side endpoint til AI Mix.
 *
 * Håndteringen ligger i `server/ai-mix.ts` og læser nøglen fra `process.env`. Der er
 * ikke noget `VITE_`-prefix nogen steder — nøglen må ikke kunne ende i browserbundlen.
 * I produktion kan den samme handler bruges fra `api/ai-mix.js` på en serverless-vært.
 */
function aiMixEndpoint(): PluginOption {
  const mount = (server: ViteDevServer | { middlewares: Connect.Server }): void => {
    server.middlewares.use('/api/ai-mix', (req, res, next) => {
      if (req.method !== 'POST') { next(); return; }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        void (async () => {
          const { handleAiMix } = await import('./server/ai-mix.js');
          let parsed: unknown = null;
          try { parsed = JSON.parse(body || '{}'); } catch { parsed = null; }
          const result = await handleAiMix(parsed);
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.statusCode = result.ok ? 200 : result.reason === 'not_configured' ? 503 : 502;
          res.end(JSON.stringify(result));
        })();
      });
    });
  };

  return {
    name: 'whatwork-ai-mix',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig(({ mode }) => {
  // Nøglerne læses ind i process.env på serversiden. `loadEnv` med tomt prefix henter
  // også variabler uden VITE_, men de eksponeres aldrig via `define`.
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  if (env.OPENAI_MODEL) process.env.OPENAI_MODEL = env.OPENAI_MODEL;

  return {
    plugins: [
      react(),
      aiMixEndpoint(),
      VitePWA({
        registerType: 'prompt', // Aldrig auto-reload midt i en aktiv session.
        injectRegister: null,
        manifest: {
          id: '/',
          name: 'WHATWORK',
          short_name: 'WHATWORK',
          description: 'Bygget til funktionel fitness.',
          lang: 'da-DK',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#101215',
          theme_color: '#101215',
          icons: [
            { src: 'icons/icon-180.png', sizes: '180x180', type: 'image/png' },
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          cacheId: CACHE_VERSION,
          globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
          navigateFallback: 'index.html',
          // /api/ai-mix må aldrig serveres fra app-shellen.
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          // Motoren kører lokalt — der er ingen runtime-kald at cache.
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
  };
});
