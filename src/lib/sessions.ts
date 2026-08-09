/**
 * Broen fra historikposter til sessionsmodellen.
 *
 * Poster gemt af en tidligere version har ingen sessionspost. De får en udledt én
 * her, så statistikken kan regne på dem — men uden at der opfindes detaljer, de
 * aldrig har indeholdt. Et manglende tal forbliver manglende.
 */

import { createSession } from '../domain/history.js';
import type { SessionRecord, SessionState } from '../domain/history.js';
import { DOMAIN_VERSION, ONTOLOGY_VERSION } from '../domain/versions.js';
import type { HistoryEntry, HistoryStatus } from '../types.js';

/** Historikkens fire statusser oversat til sessionsmodellens tilstande. */
export const STATE_FROM_STATUS: Record<HistoryStatus, SessionState> = {
  saved: 'saved',
  done: 'completed',
  partial: 'aborted',
  stopped: 'aborted',
};

/**
 * Udleder en sessionspost for en gammel historikpost.
 *
 * Bemærk at `sets` og `intervals` bevidst står tomme: de gamle poster gemte kun en
 * resultattekst, og det ville være et postulat at udlede enkelte sæt af den.
 */
function derive(entry: HistoryEntry): SessionRecord {
  const base = createSession({
    sourceMode: 'quick-wod',
    state: STATE_FROM_STATUS[entry.status],
    provenance: {
      generatorVersion: entry.workout?.engineVersion ?? 'ukendt',
      domainVersion: DOMAIN_VERSION,
      ontologyVersion: ONTOLOGY_VERSION,
      exerciseLibraryVersion: entry.workout?.exerciseDataVersion ?? 'ukendt',
      rulesVersion: entry.workout?.rulesVersion ?? 'ukendt',
      ruleVersions: {},
      seed: entry.workout?.seed ?? 0,
    },
    wodRef: {
      stimulus: entry.title,
      format: entry.workout?.format ?? entry.format,
      // Uden en sammenligningsnøgle må resultatet kun tælles som træningsmængde.
      comparabilityKey: null,
    },
  });

  return {
    ...base,
    sessionId: entry.id,
    startedAt: entry.date,
    endedAt: entry.date,
    actual: {
      ...base.actual,
      durationSeconds: entry.minutes * 60,
      completionPct: entry.progressPct ?? (entry.status === 'done' ? 100 : 0),
      score: entry.result,
    },
    feedback: {
      ...base.feedback,
      sessionRpe: entry.rpe === 'easy' ? 4 : entry.rpe === 'ok' ? 6 : entry.rpe === 'hard' ? 9 : null,
    },
  };
}

export const sessionsFrom = (history: HistoryEntry[]): SessionRecord[] =>
  history.map((entry) => entry.session ?? derive(entry));
