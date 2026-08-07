/**
 * AI Mix — det valgfrie variationslag.
 *
 * Kører udelukkende på serveren. API-nøglen læses fra `process.env` uden `VITE_`-prefix,
 * så den aldrig havner i browserbundlen eller i localStorage. Klienten ser kun det
 * validerede svar.
 *
 * AI må foreslå format, tilladte øvelses-ID'er, en bevægelseskombination, et kort
 * rationale og en variationssignatur. Alt andet — den endelige øvelsesliste, loads,
 * kilo, skiver, deltagermål, tidsbudget, udstyrslogistik, sikkerhedsvalidering og
 * WW Match — ejes af den lokale regelmotor og røres ikke herfra.
 */

export interface AiMixRequestBody {
  /** Kun det, planen skal bygges ud fra. Aldrig navn eller kropsvægt. */
  minutes: number;
  participants: number;
  level: number;
  condition: number;
  strength: number;
  focus: string;
  formats: string[];
  exerciseIds: string[];
  /** Korte signaturer fra de seneste workouts, så AI kan variere væk fra dem. */
  recent: string[];
}

export interface AiMixPlan {
  format: string;
  exerciseIds: string[];
  rationale: string;
  signature: string;
}

export type AiMixResponse =
  | { ok: true; plan: AiMixPlan; provider: string }
  | { ok: false; reason: 'not_configured' | 'upstream_error' | 'bad_request' | 'invalid_plan'; message: string };

const SYSTEM = [
  'Du er en dansk træningsprogrammør for funktionel fitness.',
  'Du foreslår KUN en kreativ plan: format, hvilke øvelses-ID\'er der skal indgå, en kort begrundelse og en variationssignatur.',
  'Du må ALDRIG foreslå kilo, gentagelser, tider, skalering eller sikkerhedsvurderinger — det bestemmer regelmotoren.',
  'Brug kun ID\'er fra den medsendte liste, og kun ét format fra den medsendte formatliste.',
  'Begrundelsen skal være på dansk, højst 200 tegn.',
  'Svar udelukkende med JSON i formen {"format":"...","exerciseIds":["..."],"rationale":"...","signature":"..."}.',
].join(' ');

function userPrompt(body: AiMixRequestBody): string {
  return JSON.stringify({
    opgave: 'Foreslå én kreativ workoutplan.',
    tid_minutter: body.minutes,
    antal_deltagere: body.participants,
    niveau: body.level,
    kondition: body.condition,
    styrke: body.strength,
    fokus: body.focus,
    tilladte_formater: body.formats,
    tilladte_oevelser: body.exerciseIds,
    undgaa_at_ligne: body.recent,
    antal_oevelser: body.participants > 1 ? 3 : Math.min(4, Math.max(2, Math.round(body.minutes / 10))),
  });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('intet JSON i svaret');
  return JSON.parse(raw.slice(start, end + 1));
}

/** AI's svar er utroværdigt indtil det er filtreret mod de lister, vi selv sendte. */
export function validatePlan(raw: unknown, body: AiMixRequestBody): AiMixPlan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const format = typeof r.format === 'string' ? r.format : '';
  if (!body.formats.includes(format)) return null;

  const ids = Array.isArray(r.exerciseIds)
    ? r.exerciseIds.filter((id): id is string => typeof id === 'string' && body.exerciseIds.includes(id))
    : [];
  if (ids.length < 2) return null;

  const rationale = typeof r.rationale === 'string' ? r.rationale.slice(0, 240) : '';
  const signature = typeof r.signature === 'string' ? r.signature.slice(0, 120) : `${format}|${ids.join(',')}`;

  return { format, exerciseIds: ids.slice(0, 6), rationale, signature };
}

async function callGemini(key: string, body: AiMixRequestBody): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt(body) }] }],
      generationConfig: { temperature: 1, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini svarede ${res.status}`);
  const json = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return extractJson(text);
}

async function callOpenAi(key: string, body: AiMixRequestBody): Promise<unknown> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: 1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt(body) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI svarede ${res.status}`);
  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  return extractJson(json.choices?.[0]?.message?.content ?? '');
}

function sane(body: unknown): AiMixRequestBody | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.formats) || !Array.isArray(b.exerciseIds)) return null;
  if (typeof b.minutes !== 'number') return null;
  return {
    minutes: b.minutes,
    participants: typeof b.participants === 'number' ? b.participants : 1,
    level: typeof b.level === 'number' ? b.level : 2,
    condition: typeof b.condition === 'number' ? b.condition : 6,
    strength: typeof b.strength === 'number' ? b.strength : 5,
    focus: typeof b.focus === 'string' ? b.focus : 'allround',
    formats: b.formats.filter((f): f is string => typeof f === 'string').slice(0, 20),
    exerciseIds: b.exerciseIds.filter((f): f is string => typeof f === 'string').slice(0, 120),
    recent: Array.isArray(b.recent) ? b.recent.filter((f): f is string => typeof f === 'string').slice(0, 8) : [],
  };
}

/**
 * Selve håndteringen, uafhængig af hosting. Bruges både af Vite-middlewaren i
 * udvikling og af `api/ai-mix.js` på en serverless-vært.
 */
export async function handleAiMix(rawBody: unknown): Promise<AiMixResponse> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !openAiKey) {
    return {
      ok: false, reason: 'not_configured',
      message: 'AI Mix er ikke sat op på serveren.',
    };
  }

  const body = sane(rawBody);
  if (!body) return { ok: false, reason: 'bad_request', message: 'Forespørgslen kunne ikke læses.' };

  const provider = geminiKey ? 'gemini' : 'openai';
  try {
    const raw = geminiKey
      ? await callGemini(geminiKey, body)
      : await callOpenAi(openAiKey as string, body);
    const plan = validatePlan(raw, body);
    if (!plan) {
      return { ok: false, reason: 'invalid_plan', message: 'AI-forslaget bestod ikke skemakontrollen.' };
    }
    return { ok: true, plan, provider };
  } catch (err) {
    return {
      ok: false, reason: 'upstream_error',
      message: err instanceof Error ? err.message : 'Ukendt fejl mod AI-udbyderen.',
    };
  }
}
