import { EXERCISES, FORMAT_LIST, mainPool, normalizeRequest } from '../engine/index.js';
import type { AiPlan, FormatId, WorkoutRequest, WorkoutSignature } from '../engine/index.js';

/**
 * Klientsiden af AI Mix.
 *
 * Der sendes kun det, der skal til for at foreslå en variation: tid, deltagerantal,
 * niveau, dials, fokus, de tilladte formater og øvelses-ID'er samt korte
 * historiksignaturer. Aldrig navn og aldrig kropsvægt.
 *
 * Fejler kaldet — ingen nøgle, ingen netværk, ugyldigt svar — returneres `null`, og
 * Smart Mix kører videre lokalt uden reduceret kernefunktionalitet.
 */

export const AI_ENDPOINT = '/api/ai-mix';
const TIMEOUT_MS = 6000;

export type AiMixOutcome =
  | { plan: AiPlan; provider: string }
  | { plan: null; reason: string };

const ALLOWED_IDS = new Set(EXERCISES.map((e) => e.id));
const ALLOWED_FORMATS = new Set(FORMAT_LIST.map((f) => f.id));

export async function requestAiPlan(
  raw: WorkoutRequest,
  recent: WorkoutSignature[],
): Promise<AiMixOutcome> {
  const req = normalizeRequest(raw);
  const body = {
    minutes: req.minutes,
    participants: req.participants,
    level: req.level,
    condition: req.condition,
    strength: req.strength,
    focus: req.focus,
    formats: FORMAT_LIST.map((f) => f.id),
    exerciseIds: mainPool(req).map((e) => e.id),
    recent: recent.slice(0, 6).map((s) => s.key),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null) as {
      ok?: boolean; plan?: unknown; message?: string;
    } | null;
    if (!res.ok || !json) {
      // Serveren svarer med en dansk forklaring; statuskoden er ikke noget, brugeren
      // skal læse. Findes beskeden ikke, bruges en neutral formulering.
      return { plan: null, reason: json?.message ?? 'AI Mix er ikke tilgængelig lige nu.' };
    }
    if (!json.ok || !json.plan) {
      return { plan: null, reason: json.message ?? 'AI Mix svarede ikke med en plan.' };
    }
    const plan = json.plan as { format?: unknown; exerciseIds?: unknown; rationale?: unknown; signature?: unknown };

    // Serveren har allerede filtreret, men klienten stoler ikke på det: ID'er og
    // format tjekkes igen mod appens eget katalog, før planen får lov at påvirke noget.
    const format = typeof plan.format === 'string' && ALLOWED_FORMATS.has(plan.format as FormatId)
      ? plan.format as FormatId : null;
    const ids = Array.isArray(plan.exerciseIds)
      ? plan.exerciseIds.filter((id): id is string => typeof id === 'string' && ALLOWED_IDS.has(id))
      : [];
    if (!format || ids.length < 2) return { plan: null, reason: 'AI-planen bestod ikke skemakontrollen.' };

    return {
      plan: {
        format,
        exerciseIds: ids,
        rationale: typeof plan.rationale === 'string' ? plan.rationale : '',
        signature: typeof plan.signature === 'string' ? plan.signature : `${format}|${ids.join(',')}`,
      },
      provider: 'ai',
    };
  } catch (err) {
    const reason = err instanceof DOMException && err.name === 'AbortError'
      ? 'AI Mix svarede ikke i tide.'
      : 'AI Mix kunne ikke kontaktes.';
    return { plan: null, reason };
  } finally {
    clearTimeout(timer);
  }
}
