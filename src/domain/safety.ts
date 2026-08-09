/**
 * Sikkerhed, screening og smerteguardrails.
 *
 * WHATWORK diagnosticerer ikke og erstatter ikke læge, fysioterapeut eller coach.
 * Laget her reagerer konservativt på alarmsymptomer og henviser videre — det
 * gætter aldrig på en årsag.
 */

import { BY_ID } from '../engine/data/exercises.js';
import type { CareId } from '../engine/types.js';
import type {
  ConstraintIssue, PainEntry, Screening, ScreeningFlag, ScreeningFlagId, ScreeningStatus,
} from './types.js';

export const SCREENING_FLAGS: ScreeningFlag[] = [
  { id: 'chest_pain', label: 'Brystsmerter under eller efter aktivitet', alarm: true },
  { id: 'syncope', label: 'Besvimelse eller svimmelhed ved anstrengelse', alarm: true },
  { id: 'unusual_breathlessness', label: 'Usædvanlig åndenød ved let anstrengelse', alarm: true },
  { id: 'known_cardiac', label: 'Kendt hjerte-kar-sygdom', alarm: false },
  { id: 'known_metabolic', label: 'Kendt stofskifte- eller sukkersygdom', alarm: false },
  { id: 'known_renal', label: 'Kendt nyresygdom', alarm: false },
  { id: 'pregnancy', label: 'Gravid eller nyligt født', alarm: false },
  { id: 'recent_surgery', label: 'Operation eller større skade inden for de seneste seks måneder', alarm: false },
  { id: 'illness_fever', label: 'Sygdom eller feber lige nu', alarm: false },
];

export const FLAG_BY_ID: Record<ScreeningFlagId, ScreeningFlag> = Object.fromEntries(
  SCREENING_FLAGS.map((f) => [f.id, f]),
) as Record<ScreeningFlagId, ScreeningFlag>;

/** Hvor længe en screening regnes som aktuel. */
export const SCREENING_VALID_DAYS = 180;

export const emptyScreening = (): Screening => ({
  status: 'unknown', flags: [], pain: [], answeredAt: null,
});

/**
 * Afgør screeningens status ud fra de afkrydsede flag.
 *
 * Alarmsymptomer giver altid `refer`. Kendt sygdom giver `restricted`, hvilket
 * betyder, at der programmeres konservativt — ikke at der ikke må trænes.
 */
export function resolveScreeningStatus(flags: ScreeningFlagId[]): ScreeningStatus {
  if (!flags.length) return 'cleared';
  if (flags.some((f) => FLAG_BY_ID[f]?.alarm)) return 'refer';
  return 'restricted';
}

export interface SafetyVerdict {
  /** Sandt når der overhovedet må genereres træning. */
  mayTrain: boolean;
  /** Sandt når høj intensitet og maxtestning er udelukket. */
  allowsHighIntensity: boolean;
  allowsMaxTesting: boolean;
  issues: ConstraintIssue[];
}

/**
 * Den samlede sikkerhedsvurdering før generering.
 *
 * Bemærk at `mayTrain: false` kun optræder ved alarmsymptomer. Alt andet håndteres
 * som begrænsninger på, hvad der programmeres — ikke som en spærring af appen.
 */
export function assessSafety(
  screening: Screening,
  now: string = new Date().toISOString(),
): SafetyVerdict {
  const issues: ConstraintIssue[] = [];
  const alarms = screening.flags.filter((f) => FLAG_BY_ID[f]?.alarm);

  if (alarms.length) {
    alarms.forEach((f) => issues.push({
      code: 'SCREEN_ALARM',
      severity: 'error',
      scope: 'screening',
      message:
        `Du har markeret: ${FLAG_BY_ID[f].label.toLowerCase()}. `
        + 'WHATWORK programmerer ikke træning oven på et alarmsymptom.',
      fix: 'Kontakt din læge, før du træner videre. Appen kan ikke vurdere symptomer.',
    }));
    return { mayTrain: false, allowsHighIntensity: false, allowsMaxTesting: false, issues };
  }

  const ill = screening.flags.includes('illness_fever');
  if (ill) {
    issues.push({
      code: 'SCREEN_ILLNESS',
      severity: 'warning',
      scope: 'screening',
      message: 'Du har markeret sygdom eller feber. Høj intensitet og maxtestning er slået fra.',
      fix: 'Vent, til du er rask, og fjern markeringen i profilen.',
    });
  }

  const restricted = screening.flags.some((f) => (
    f === 'known_cardiac' || f === 'known_metabolic' || f === 'known_renal'
  ));
  if (restricted) {
    issues.push({
      code: 'SCREEN_RESTRICTED',
      severity: 'warning',
      scope: 'screening',
      message:
        'Du har markeret en kendt sygdom. Programmet holdes konservativt, '
        + 'og maxtestning foreslås ikke automatisk.',
      fix: 'Aftal med din læge, hvilken intensitet der er i orden for dig.',
    });
  }

  if (screening.answeredAt) {
    const days = (new Date(now).getTime() - new Date(screening.answeredAt).getTime()) / 86_400_000;
    if (days > SCREENING_VALID_DAYS) {
      issues.push({
        code: 'SCREEN_STALE',
        severity: 'warning',
        scope: 'screening',
        message: `Din screening er ${Math.round(days)} dage gammel.`,
        fix: 'Gennemgå spørgsmålene igen — det tager under et minut.',
      });
    }
  } else {
    issues.push({
      code: 'SCREEN_MISSING',
      severity: 'warning',
      scope: 'screening',
      message: 'Du har ikke besvaret helbredsscreeningen endnu.',
      fix: 'Besvar den i profilen, så programmet kan tage hensyn til det, der er relevant.',
    });
  }

  return {
    mayTrain: true,
    allowsHighIntensity: !ill && !restricted,
    allowsMaxTesting: !ill && !restricted,
    issues,
  };
}

/* ---------- Smerte ---------- */

/** Grænsen, hvor en bevægelse stoppes frem for at blive skaleret. */
export const PAIN_STOP_THRESHOLD = 4;

export interface PainVerdict {
  /** Sandt når øvelsen skal ud af planen. */
  blocked: boolean;
  /** Sandt når øvelsen kan køres, men med mindre ROM eller load. */
  restricted: boolean;
  reason: string;
}

/**
 * Vurderer én øvelse mod brugerens registrerede smerte.
 *
 * Reglen er specifikationens: ny eller stigende smerte på 4 eller derover stopper
 * bevægelsen. Mild kendt smerte uden forværring giver en godkendt substitution
 * eller reduceret ROM og load — aldrig et automatisk "træn igennem".
 */
export function checkPain(exerciseId: string, pain: PainEntry[]): PainVerdict {
  const ex = BY_ID[exerciseId];
  if (!ex || !pain.length) {
    return { blocked: false, restricted: false, reason: 'Ingen registreret smerte.' };
  }

  const named = pain.find((p) => p.aggravators.includes(exerciseId));
  if (named) {
    return {
      blocked: true,
      restricted: false,
      reason:
        `Du har selv markeret, at ${ex.name.toLowerCase()} forværrer smerten i `
        + `${regionName(named.region)}. Øvelsen er taget ud.`,
    };
  }

  const relevant = pain.filter((p) => ex.avoid.includes(p.region));
  if (!relevant.length) {
    return { blocked: false, restricted: false, reason: 'Øvelsen rammer ikke et smerteområde.' };
  }

  const worst = relevant.reduce((a, b) => (b.score > a.score ? b : a));
  if (worst.score >= PAIN_STOP_THRESHOLD) {
    return {
      blocked: true,
      restricted: false,
      reason:
        `Smerte på ${worst.score} ud af 10 i ${regionName(worst.region)}. `
        + `${ex.name} belaster området og er taget ud.`,
    };
  }

  return {
    blocked: false,
    restricted: true,
    reason:
      `Let smerte på ${worst.score} ud af 10 i ${regionName(worst.region)}. `
      + `${ex.name} køres med mindre belastning og fuld kontrol. Stop, hvis det bliver værre.`,
  };
}

const REGION_NAMES: Record<CareId, string> = {
  shoulder: 'skulderen',
  back: 'lænden',
  knee: 'knæet',
  wrist: 'håndleddet',
  hip: 'hoften',
};

export const regionName = (region: CareId): string => REGION_NAMES[region] ?? region;

/* ---------- Readiness ---------- */

export interface Readiness {
  /** 1-5, hvor 5 er veludhvilet. */
  sleep: number;
  stress: number;
  soreness: number;
  motivation: number;
}

export interface ReadinessVerdict {
  score: number;
  /** Multiplikator til volumen. Aldrig under 0,8 — readiness alene er ikke en dom. */
  volumeFactor: number;
  loadFactor: number;
  message: string;
}

/**
 * Readiness justerer, men dømmer ikke.
 *
 * Specifikationen er tydelig: lav readiness alene skal give en lille reduktion og en
 * revurdering efter opvarmningen — ikke en aflyst træning.
 */
export function assessReadiness(r: Readiness | null): ReadinessVerdict {
  if (!r) {
    return {
      score: 0,
      volumeFactor: 1,
      loadFactor: 1,
      message: 'Ingen readiness-data i dag. Planen køres som skrevet.',
    };
  }
  const score = (r.sleep + (6 - r.stress) + (6 - r.soreness) + r.motivation) / 4;
  if (score >= 4) {
    return { score, volumeFactor: 1, loadFactor: 1, message: 'God readiness. Kør planen som den er.' };
  }
  if (score >= 3) {
    return {
      score, volumeFactor: 0.95, loadFactor: 1,
      message: 'Middel readiness. Volumen er skruet en anelse ned; belastningen holdes.',
    };
  }
  return {
    score,
    volumeFactor: 0.85,
    loadFactor: 0.95,
    message:
      'Lav readiness. Volumen og belastning er sat lidt ned. '
      + 'Revurdér efter opvarmningen — føles det godt, kan du gå tilbage til planen.',
  };
}
