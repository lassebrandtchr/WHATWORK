import * as eng from '../engine/index.js';
import { Photo } from '../components/Photo.js';
import { EmptyState, Meter, PageHeader } from '../components/ui.js';
import { fmtDuration, isoWeek } from '../lib/format.js';
import type { HistoryEntry } from '../types.js';

/** Søjlediagrammets højde i pixels. */
const CHART_HEIGHT = 120;

const CAT_NAMES: Record<string, string> = {
  squat: 'Squat', hinge: 'Hinge', press: 'Pres', pull: 'Træk', fullbody: 'Hele kroppen',
  oly: 'Olympisk', core: 'Core', carry: 'Bæring', cardio: 'Engine',
  warmup: 'Opvarmning', mobility: 'Mobilitet', ukendt: 'Andet',
};

/** Antal sammenhængende uger bagud med mindst én gennemført session. */
function streakWeeks(history: HistoryEntry[]): number {
  const done = history.filter((h) => h.status === 'done');
  if (!done.length) return 0;
  const weeks = new Set(done.map((h) => {
    const d = new Date(h.date);
    return `${d.getFullYear()}-${isoWeek(d)}`;
  }));
  const now = new Date();
  let streak = 0;
  for (let back = 0; back < 60; back++) {
    const d = new Date(now.getTime() - back * 7 * 86_400_000);
    if (weeks.has(`${d.getFullYear()}-${isoWeek(d)}`)) streak += 1;
    else if (back > 0) break;
  }
  return streak;
}

export function Stats({ history, onGenerate }: { history: HistoryEntry[]; onGenerate: () => void }) {
  if (!history.length) {
    return (
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 860 }}>
        <PageHeader kicker="Overblik" title="Statistik" lede="Statistikken bygger på din lokale historik." />
        <Photo
          name="chalk-barbell"
          frame="portrait"
          sizes="(min-width: 640px) 340px, 100vw"
          style={{ marginBottom: 22, maxWidth: 340 }}
        />
        <EmptyState
          title="Ingen data endnu"
          body="Så snart du har gennemført din første workout, kan du følge volumen, fordeling og streak her."
          action={<button type="button" className="ww-btn ww-btn--primary ww-btn--lg" onClick={onGenerate}>Generér workout</button>}
        />
      </div>
    );
  }

  const done = history.filter((h) => h.status === 'done');
  const totalMinutes = history.reduce((a, b) => a + b.minutes, 0);
  const avg = Math.round(totalMinutes / history.length);

  const counts = new Map<string, number>();
  history.forEach((h) => h.patterns.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)));
  const maxCount = Math.max(1, ...counts.values());
  const distribution = [...counts.entries()]
    .filter(([cat]) => cat !== 'warmup' && cat !== 'mobility')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const formats = new Map<string, number>();
  history.forEach((h) => formats.set(h.format, (formats.get(h.format) ?? 0) + 1));

  // Otte uger bagud, ældst først.
  const now = new Date();
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ref = new Date(now.getTime() - (7 - i) * 7 * 86_400_000);
    const key = `${ref.getFullYear()}-${isoWeek(ref)}`;
    const inWeek = history.filter((h) => {
      const d = new Date(h.date);
      return `${d.getFullYear()}-${isoWeek(d)}` === key;
    });
    return { label: `U${isoWeek(ref)}`, sessions: inWeek.length, minutes: inWeek.reduce((a, b) => a + b.minutes, 0) };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.minutes));

  const dnaTotals = new Map<string, number>();
  history.slice(0, 20).forEach((h) => {
    eng.DNA_AXES.forEach((a) => {
      dnaTotals.set(a.id, (dnaTotals.get(a.id) ?? 0) + (h.workout?.dna?.[a.id] ?? 0));
    });
  });
  const dnaMax = Math.max(1, ...dnaTotals.values());

  const stats = [
    { value: String(done.length), label: 'Gennemført' },
    { value: fmtDuration(totalMinutes), label: 'Samlet tid' },
    { value: `${avg} min`, label: 'Gennemsnit' },
    { value: `${streakWeeks(history)} uger`, label: 'Streak' },
  ];

  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 860 }}>
      <PageHeader
        kicker="Overblik"
        title="Statistik"
        lede="Alt er regnet ud af din lokale historik. Der sendes ingenting nogen steder hen."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginBottom: 26 }}>
        {stats.map((s) => (
          <div key={s.label} className="ww-card" style={{ padding: '16px 18px' }}>
            <div className="ww-num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {s.value}
            </div>
            <div className="ww-kicker">{s.label}</div>
          </div>
        ))}
      </div>

      <Photo
        name="row-erg"
        sizes="(min-width: 1024px) 860px, 100vw"
        style={{ marginBottom: 26 }}
      />

      <section aria-labelledby="ww-weeks" style={{ marginBottom: 26 }}>
        <h2 id="ww-weeks" className="ww-kicker" style={{ marginBottom: 12 }}>Otte uger tilbage</h2>
        <div className="ww-card" style={{ padding: '20px' }}>
          {/*
            Søjlernes højde sættes i pixels. En procenthøjde ville blive målt mod en
            kolonne, der selv er auto-høj, og alle søjler ville kollapse til ingenting.
          */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            {weeks.map((w) => (
              <div key={w.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    width: '100%',
                    height: Math.max(4, Math.round((w.minutes / maxWeek) * CHART_HEIGHT)),
                    background: w.minutes ? 'var(--ww-orange)' : 'var(--ww-line)',
                    borderRadius: 6,
                  }}
                  role="img"
                  aria-label={`Uge ${w.label.slice(1)}: ${w.sessions} sessioner, ${w.minutes} minutter`}
                />
                <span className="ww-num" style={{ fontSize: 11, color: 'var(--ww-text-3)' }}>{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="ww-dist" style={{ marginBottom: 26 }}>
        <h2 id="ww-dist" className="ww-kicker" style={{ marginBottom: 12 }}>Bevægelsesfordeling</h2>
        <div className="ww-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {distribution.map(([cat, n]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--ww-text-2)', width: 104, flex: 'none' }}>
                {CAT_NAMES[cat] ?? cat}
              </span>
              <span style={{ flex: 1 }}>
                <Meter value={n} max={maxCount} label={`${CAT_NAMES[cat] ?? cat}: ${n} gange`} />
              </span>
              <span className="ww-num" style={{ fontSize: 13, color: 'var(--ww-text-3)', width: 28, textAlign: 'right' }}>{n}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ww-formats" style={{ marginBottom: 26 }}>
        <h2 id="ww-formats" className="ww-kicker" style={{ marginBottom: 12 }}>Formater du har kørt</h2>
        <div className="ww-wrap">
          {[...formats.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => (
            <span key={name} className="ww-badge">{name} · {n}</span>
          ))}
        </div>
      </section>

      <section aria-labelledby="ww-dnaavg">
        <h2 id="ww-dnaavg" className="ww-kicker" style={{ marginBottom: 12 }}>Samlet DNA, seneste 20</h2>
        <div className="ww-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {eng.DNA_AXES.map((axis) => (
            <div key={axis.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--ww-text-2)', width: 104, flex: 'none' }}>{axis.name}</span>
              <span style={{ flex: 1 }}>
                <Meter value={dnaTotals.get(axis.id) ?? 0} max={dnaMax} label={`${axis.name}`} />
              </span>
            </div>
          ))}
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
            Fordelingen er et internt signal om, hvad du har trænet — ikke en vurdering af din form.
          </p>
        </div>
      </section>
    </div>
  );
}
