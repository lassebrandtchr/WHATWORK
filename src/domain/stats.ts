/**
 * Statistik.
 *
 * Alle tal her er afledt af Historik og beregnes forfra hver gang. Statistik er
 * ikke et selvstændigt datalager, og ingen beregning må ændre rådata.
 *
 * Hver metric bærer sin egen definition og en `metricVersion`, så en ændret
 * formel kan kendes fra en ændret præstation. Og der sammenlignes kun tal, der
 * reelt er sammenlignelige — ellers vises lav sikkerhed eller ingenting.
 */

import { METRIC_VERSION } from './versions.js';
import { confidenceBand } from './types.js';
import type { ConfidenceBand } from './types.js';
import { countsAsTraining, isComparable } from './history.js';
import type { SessionRecord } from './history.js';
import { median } from './strength.js';

export interface Metric {
  id: string;
  label: string;
  /** Værdien som tal. `null` når der ikke er data nok. */
  value: number | null;
  /** Færdig visningstekst med enhed. */
  display: string;
  /** Hvad metricen betyder — i hverdagssprog. */
  definition: string;
  metricVersion: string;
  confidence: number;
  band: ConfidenceBand;
  /** Antal datapunkter bag tallet. */
  sampleSize: number;
  /** Formuleret som observation, aldrig som årsag. */
  observation: string;
}

const metric = (input: Omit<Metric, 'metricVersion' | 'band'>): Metric => ({
  ...input,
  metricVersion: METRIC_VERSION,
  band: confidenceBand(input.confidence),
});

const pct = (v: number): string => `${Math.round(v * 100)} %`;

/* ---------- Gennemførelse ---------- */

/**
 * Gennemførelse: gennemførte pas ud af de pas, der reelt kunne gennemføres.
 *
 * Flyttede pas trækkes ud af nævneren. At flytte en træning er ikke at springe den
 * over, og det skal ikke straffes som om det var.
 */
export function adherenceMetric(sessions: SessionRecord[]): Metric {
  const eligible = sessions.filter((s) => s.state !== 'scheduled' && s.state !== 'generated');
  const completed = eligible.filter((s) => countsAsTraining(s.state));

  if (!eligible.length) {
    return metric({
      id: 'adherence',
      label: 'Gennemførelse',
      value: null,
      display: 'Ingen data endnu',
      definition:
        'Hvor mange af dine planlagte pas du har gennemført. Pas, du har flyttet til en '
        + 'anden dag, tæller ikke som sprunget over.',
      confidence: 0,
      sampleSize: 0,
      observation: 'Der er endnu ingen gennemførte pas at regne på.',
    });
  }

  const value = completed.length / eligible.length;
  return metric({
    id: 'adherence',
    label: 'Gennemførelse',
    value,
    display: pct(value),
    definition:
      'Hvor mange af dine planlagte pas du har gennemført. Pas, du har flyttet til en '
      + 'anden dag, tæller ikke som sprunget over.',
    confidence: eligible.length >= 8 ? 0.85 : eligible.length >= 4 ? 0.6 : 0.4,
    sampleSize: eligible.length,
    observation:
      `Du har gennemført ${completed.length} af ${eligible.length} pas i perioden.`
      + (value < 0.6
        ? ' Det tyder på, at planen er skrevet til flere pas, end din uge har plads til.'
        : ''),
  });
}

/* ---------- Mængde ---------- */

/** Hårde sæt: arbejdssæt, der var udfordrende nok til at tælle. */
export const HARD_SET_DEFINITION =
  'Et arbejdssæt, hvor du havde højst tre gentagelser tilbage i tanken. '
  + 'Opvarmningssæt og lette sæt tæller ikke med.';

const isHardSet = (rpe: number | null, rir: number | null): boolean => {
  if (rpe !== null) return rpe >= 7;
  if (rir !== null) return rir <= 3;
  // Uden en vurdering kan sættet ikke tælles som hårdt. Det er bedre at tælle for
  // lidt end at påstå en mængde, der ikke er dokumenteret.
  return false;
};

export function hardSetsMetric(sessions: SessionRecord[]): Metric {
  const trained = sessions.filter((s) => countsAsTraining(s.state));
  const sets = trained.flatMap((s) => s.actual.sets);
  const hard = sets.filter((x) => isHardSet(x.rpe, x.rir));
  const unrated = sets.filter((x) => x.rpe === null && x.rir === null).length;

  return metric({
    id: 'hard-sets',
    label: 'Hårde sæt',
    value: hard.length,
    display: `${hard.length}`,
    definition: HARD_SET_DEFINITION,
    confidence: sets.length === 0 ? 0 : 1 - unrated / sets.length,
    sampleSize: sets.length,
    observation: unrated
      ? `${hard.length} hårde sæt registreret. ${unrated} sæt mangler en vurdering af `
        + 'anstrengelsen og er ikke talt med.'
      : `${hard.length} hårde sæt registreret i perioden.`,
  });
}

/* ---------- Styrke ---------- */

/**
 * Udvikling i beregnet maksimal styrke for én præcis øvelsesvariant.
 *
 * Der sammenlignes kun sæt af samme variant. Conventional og axle dødløft er ikke
 * den samme øvelse og får derfor hver sin kurve.
 */
export function strengthTrend(
  sessions: SessionRecord[],
  variantId: string,
): { points: { date: string; e1rmKg: number }[]; metric: Metric } {
  const points: { date: string; e1rmKg: number }[] = [];

  sessions
    .filter((s) => countsAsTraining(s.state))
    .forEach((s) => {
      s.actual.sets
        .filter((set) => (set.variantId ?? set.exerciseId) === variantId)
        // Sæt med teknikbrud, smerte eller uden anstrengelsesvurdering må ikke styre
        // en styrkekurve — de siger mere om dagen end om styrken.
        .filter((set) => !set.technicalFailure && (set.painScore ?? 0) < 4)
        .filter((set) => set.rpe !== null && set.loadKg !== null && set.reps <= 10)
        .forEach((set) => {
          const load = set.loadKg as number;
          const rpe = set.rpe as number;
          // Samme omregning som i belastningsmodellen: reps og anstrengelse til et
          // bud på den tungeste enkelte gentagelse.
          const rir = 10 - rpe;
          const estimate = load * (1 + (set.reps + rir) / 30);
          points.push({ date: s.endedAt ?? s.startedAt ?? '', e1rmKg: Math.round(estimate * 10) / 10 });
        });
    });

  points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Med under tre datapunkter overlapper "først" og "sidst" hinanden, og resultatet
  // ville blive en udvikling på nul procent — hvilket ville se ud som et målt
  // stilstand frem for som manglende data.
  const MIN_POINTS_FOR_TREND = 3;
  const first = points.slice(0, 3).map((p) => p.e1rmKg);
  const last = points.slice(-3).map((p) => p.e1rmKg);
  const change = points.length >= MIN_POINTS_FOR_TREND
    ? (median(last) - median(first)) / median(first)
    : null;

  return {
    points,
    metric: metric({
      id: `strength-${variantId}`,
      label: 'Beregnet maksimal styrke',
      value: change,
      display: change === null
        ? 'For lidt data'
        : `${change >= 0 ? '+' : ''}${Math.round(change * 100)} %`,
      definition:
        'Et beregnet bud på den tungeste vægt, du kan løfte én gang, udregnet af dine '
        + 'egne sæt. Kun sæt med god teknik og en vurdering af anstrengelsen tæller med.',
      confidence: points.length >= 6 ? 0.75 : points.length >= 3 ? 0.5 : 0.25,
      sampleSize: points.length,
      observation: points.length < 3
        ? 'Der er for få registrerede sæt til at vise en udvikling.'
        : `Baseret på de seneste ${Math.min(points.length, 3)} sammenlignelige sæt `
          + `ud af ${points.length} i alt.`,
    }),
  };
}

/* ---------- Anstrengelse ---------- */

/** Hvor godt den planlagte anstrengelse ramte den faktiske. */
export function effortAccuracy(sessions: SessionRecord[], plannedRpe: number): Metric {
  const rated = sessions
    .filter((s) => countsAsTraining(s.state))
    .flatMap((s) => s.actual.sets)
    .filter((x) => x.rpe !== null);

  if (!rated.length) {
    return metric({
      id: 'effort-accuracy',
      label: 'Ramte du anstrengelsen?',
      value: null,
      display: 'Ingen data endnu',
      definition:
        'Forskellen på hvor hårdt sættene var planlagt til at føles, og hvor hårdt de '
        + 'faktisk føltes.',
      confidence: 0,
      sampleSize: 0,
      observation: 'Registrér, hvor hårde sættene føltes, så kan planen tilpasses.',
    });
  }

  const overshoots = rated.filter((x) => (x.rpe as number) > plannedRpe + 0.5).length;
  const value = overshoots / rated.length;

  return metric({
    id: 'effort-accuracy',
    label: 'Sæt hårdere end planlagt',
    value,
    display: pct(value),
    definition:
      'Andelen af sæt, der føltes mere anstrengende end planlagt. En høj andel tyder '
      + 'på, at belastningen ligger for højt, eller at restitutionen ikke slår til.',
    confidence: rated.length >= 10 ? 0.8 : 0.5,
    sampleSize: rated.length,
    observation: `${overshoots} af ${rated.length} sæt lå over det planlagte.`,
  });
}

/* ---------- Sammenlignelighed ---------- */

export interface ComparableGroup {
  key: string;
  sessions: SessionRecord[];
  /** Sandt når gruppen må vises som en præstationskurve. */
  comparable: boolean;
  note: string;
}

/**
 * Grupperer sessioner efter, hvad der reelt kan sammenlignes.
 *
 * Workouts uden en sammenligningsnøgle samles i én gruppe, som kun må vises som
 * træningsmængde. Det er den regel, der forhindrer, at to tilfældige AMRAP-scores
 * bliver præsenteret som fremgang.
 */
export function groupByComparability(sessions: SessionRecord[]): ComparableGroup[] {
  const groups = new Map<string, SessionRecord[]>();
  const uncomparable: SessionRecord[] = [];

  sessions.filter((s) => countsAsTraining(s.state)).forEach((s) => {
    const key = s.wodRef?.comparabilityKey;
    if (!key) { uncomparable.push(s); return; }
    groups.set(key, [...(groups.get(key) ?? []), s]);
  });

  const out: ComparableGroup[] = [...groups.entries()].map(([key, list]) => {
    // Selv med samme nøgle skal regelversionerne stemme.
    const first = list[0] as SessionRecord;
    const consistent = list.every((s) => isComparable(first, s));
    return {
      key,
      sessions: list,
      comparable: consistent && list.length >= 2,
      note: !consistent
        ? 'Resultaterne er kørt på forskellige regelversioner og kan ikke stilles direkte op mod hinanden.'
        : list.length < 2
          ? 'Der er kun ét resultat endnu. Kør workouten igen for at se en udvikling.'
          : `${list.length} sammenlignelige gennemførelser.`,
    };
  });

  if (uncomparable.length) {
    out.push({
      key: 'uncomparable',
      sessions: uncomparable,
      comparable: false,
      note:
        'De her workouts er forskellige fra gang til gang. De vises som træningsmængde '
        + 'og dækning — ikke som en præstationskurve, for scorerne måler ikke det samme.',
    });
  }

  return out;
}

/* ---------- Dækning ---------- */

/** Hvilke bevægelsesmønstre og tidsdomæner ugen faktisk ramte. */
export function coverage(sessions: SessionRecord[]): {
  patterns: Record<string, number>;
  timeDomains: Record<string, number>;
  metric: Metric;
} {
  const patterns: Record<string, number> = {};
  const timeDomains: Record<string, number> = {};

  const trained = sessions.filter((s) => countsAsTraining(s.state));
  trained.forEach((s) => {
    s.actual.sets.forEach((set) => {
      patterns[set.exerciseId] = (patterns[set.exerciseId] ?? 0) + 1;
    });
    const minutes = s.actual.durationSeconds / 60;
    const domain = minutes <= 10 ? 'kort' : minutes <= 25 ? 'mellem' : 'lang';
    timeDomains[domain] = (timeDomains[domain] ?? 0) + 1;
  });

  return {
    patterns,
    timeDomains,
    metric: metric({
      id: 'coverage',
      label: 'Dækning',
      value: Object.keys(patterns).length,
      display: `${Object.keys(patterns).length} forskellige øvelser`,
      definition:
        'Hvor bredt du har trænet — hvor mange forskellige øvelser og hvor mange '
        + 'forskellige længder af pas der er registreret.',
      confidence: trained.length >= 6 ? 0.8 : 0.5,
      sampleSize: trained.length,
      observation: `Baseret på ${trained.length} gennemførte pas.`,
    }),
  };
}

/* ---------- Datakvalitet ---------- */

/**
 * Hvor meget af statistikken der bygger på registrerede tal frem for antagelser.
 *
 * Vises altid. Brugeren skal kunne se, hvornår et tal er svagt funderet — i stedet
 * for at opdage det, når programmet gætter forkert.
 */
export function dataQuality(sessions: SessionRecord[]): Metric {
  const trained = sessions.filter((s) => countsAsTraining(s.state));
  if (!trained.length) {
    return metric({
      id: 'data-quality',
      label: 'Datakvalitet',
      value: null,
      display: 'Ingen data endnu',
      definition: 'Hvor stor en del af dine pas der har registrerede tal at regne på.',
      confidence: 0,
      sampleSize: 0,
      observation: 'Gennemfør et pas, og gem resultatet, så kommer statistikken i gang.',
    });
  }

  const withDetail = trained.filter((s) => (
    s.actual.sets.length > 0 || s.actual.intervals.length > 0 || s.feedback.sessionRpe !== null
  ));
  const value = withDetail.length / trained.length;

  return metric({
    id: 'data-quality',
    label: 'Datakvalitet',
    value,
    display: pct(value),
    definition: 'Hvor stor en del af dine pas der har registrerede tal at regne på.',
    confidence: 0.9,
    sampleSize: trained.length,
    // Er halvdelen eller mere af passene uden detaljer, er grundlaget tyndt — og
    // det skal siges, i stedet for at brugeren opdager det gennem et forkert forslag.
    observation: value <= 0.5
      ? `Kun ${withDetail.length} af ${trained.length} pas har detaljer. `
        + 'Statistikken bygger derfor på et tyndt grundlag.'
      : `${withDetail.length} af ${trained.length} pas har registrerede detaljer.`,
  });
}

/* ---------- Samlet ---------- */

export interface StatsSummary {
  metrics: Metric[];
  groups: ComparableGroup[];
  metricVersion: string;
  /** Antal sessioner, der reelt talte som træning. */
  trainedSessions: number;
}

export function summarise(sessions: SessionRecord[], plannedRpe = 8): StatsSummary {
  return {
    metrics: [
      adherenceMetric(sessions),
      hardSetsMetric(sessions),
      effortAccuracy(sessions, plannedRpe),
      coverage(sessions).metric,
      dataQuality(sessions),
    ],
    groups: groupByComparability(sessions),
    metricVersion: METRIC_VERSION,
    trainedSessions: sessions.filter((s) => countsAsTraining(s.state)).length,
  };
}
