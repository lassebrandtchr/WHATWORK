const PROFILE_GROUP_LABEL: Record<'m' | 'f' | 'x', string> = {
  m: 'Mænd', f: 'Kvinder', x: 'Ikke angivet',
};

/**
 * Grupperer per-person-mål efter køn ("Mand 1"/"Mand 2" → "Mænd" osv.), så en workout
 * med flere deltagere kan vises som adskilte sektioner i stedet for én lang klump tekst.
 * Rækkefølgen følger, hvornår hver gruppe først optræder i input-listen.
 */
export function groupByProfile<T extends { profile: 'm' | 'f' | 'x' }>(
  items: T[],
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  const indexOf = new Map<string, number>();
  for (const item of items) {
    const label = PROFILE_GROUP_LABEL[item.profile];
    let i = indexOf.get(label);
    if (i === undefined) {
      i = groups.length;
      indexOf.set(label, i);
      groups.push({ label, items: [] });
    }
    groups[i]?.items.push(item);
  }
  return groups;
}

/** Sekunder som m:ss. Negative værdier vises med fortegn (tid over cap). */
export function fmtTime(totalSeconds: number): string {
  const neg = totalSeconds < 0;
  const s = Math.abs(Math.trunc(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${neg ? '-' : ''}${m}:${String(rest).padStart(2, '0')}`;
}

/** Længere varigheder som "1 t 12 min" — bruges i statistik, ikke i timeren. */
export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} t ${m} min` : `${h} t`;
}

/** Dansk, relativ dato til lister: "I dag", "I går", "3 dage siden", "12. mar". */
export function relDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'I dag';
  if (days === 1) return 'I går';
  if (days < 7) return `${days} dage siden`;
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** Første bogstav i navnet, til avataren i desktop-headeren. */
export const initialsOf = (name: string): string => (name.trim()[0] ?? 'G').toUpperCase();

/** Ugenummer efter ISO 8601 — bruges til at gruppere statistik. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
