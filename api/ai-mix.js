/**
 * Serverless-indgang til AI Mix (Vercel, Netlify Functions og lignende).
 *
 * I udvikling og `npm run preview` serveres den samme handler af Vite-pluginnet i
 * `vite.config.ts`. Denne fil findes, så et statisk hostet build også kan få
 * endpointet uden at ændre klientkoden.
 *
 * API-nøglen sættes som en almindelig servermiljøvariabel — `GEMINI_API_KEY` eller
 * `OPENAI_API_KEY`. Aldrig med `VITE_`-prefix, og aldrig i klienten.
 */
import { handleAiMix } from '../server/ai-mix.ts';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'bad_request', message: 'Kun POST er understøttet.' });
    return;
  }
  const result = await handleAiMix(req.body);
  res.status(result.ok ? 200 : result.reason === 'not_configured' ? 503 : 502).json(result);
}
