import { useState } from 'react';
import { Term } from '../components/Term.js';
import { Chip, Glyph, Note, PageHeader } from '../components/ui.js';
import { BY_ID } from '../engine/data/exercises.js';
import { benchmarkFromSet, e1rmFor } from '../domain/benchmarks.js';
import { COMPETENCE_LABELS, COMPETENCE_ORDER, LIFT_NAMES, STRENGTH4_LIFTS } from '../domain/types.js';
import type { Benchmark, CompetenceEntry, CompetenceLevel, LiftId, PainEntry } from '../domain/types.js';
import { HIGH_SKILL_IDS } from '../domain/ontology.js';
import { setCompetence } from '../domain/competence.js';
import { SCREENING_FLAGS, assessSafety, resolveScreeningStatus } from '../domain/safety.js';
import type { ScreeningFlagId } from '../domain/types.js';
import { fmt } from '../domain/strength.js';
import { WEAK_POINT_LIST } from '../program/assistance.js';
import type { WeakPointId } from '../program/assistance.js';
import { CARE_AREAS } from '../engine/data/equipment.js';
import type { CareId } from '../engine/types.js';
import type { UserProfile } from '../types.js';

/**
 * "Mine tal".
 *
 * Skærmen findes, fordi programmotoren nægter at gætte kilo. Uden et sted at
 * registrere sin styrke ville brugeren altid ende i en indkøringsuge.
 *
 * Bemærk at der bevidst ikke bedes om en maksimal test. Brugeren indtaster et sæt,
 * hun faktisk har lavet, og hvor hårdt det føltes — resten regner appen.
 */

/** Hvor hårdt sættet føltes, oversat til den skala, beregningen bruger. */
const EFFORT_OPTIONS: { id: number; label: string; hint: string }[] = [
  { id: 10, label: 'Kunne ikke tage flere', hint: 'Den sidste gentagelse var alt, du havde.' },
  { id: 9, label: 'Havde 1 tilbage', hint: 'Du kunne lige have klemt én mere ud.' },
  { id: 8, label: 'Havde 2 tilbage', hint: 'Der var to gentagelser tilbage i tanken.' },
  { id: 7, label: 'Havde 3 tilbage', hint: 'Hårdt, men der var stadig luft.' },
  { id: 6, label: 'Havde 4 eller flere', hint: 'Kontrolleret. Bruges som et forsigtigt udgangspunkt.' },
];

function Section({
  id, title, lede, children,
}: {
  id: string; title: string; lede?: string; children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} style={{ marginBottom: 34 }}>
      <h2 id={id} className="ww-h2" style={{ marginBottom: lede ? 8 : 14 }}>{title}</h2>
      {lede ? (
        <p className="ww-lede" style={{ marginBottom: 16, maxWidth: '62ch' }}>{lede}</p>
      ) : null}
      {children}
    </section>
  );
}

/** Ét hovedløft med det, brugeren sidst har registreret, og en knap til at rette det. */
function LiftRow({
  lift, benchmarks, onLog,
}: {
  lift: LiftId;
  benchmarks: Benchmark[];
  onLog: (lift: LiftId, loadKg: number, reps: number, rpe: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loadKg, setLoadKg] = useState('');
  const [reps, setReps] = useState('3');
  const [rpe, setRpe] = useState(8);

  const rolling = e1rmFor(benchmarks, lift);
  const canSave = Number(loadKg) > 0 && Number(reps) > 0;

  const save = (): void => {
    if (!canSave) return;
    onLog(lift, Number(loadKg), Number(reps), rpe);
    setLoadKg('');
    setOpen(false);
  };

  return (
    <div style={{ borderBottom: '1px solid var(--ww-line)', padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{LIFT_NAMES[lift]}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ww-text-3)', marginTop: 4 }}>
            {rolling
              ? `Beregnet maksimum ${fmt(rolling.currentKg)} kg · ${rolling.explanation}`
              : 'Ingen tal endnu. Programmet bruger anstrengelse i stedet for kilo.'}
          </div>
        </div>
        <button type="button" className="ww-btn" onClick={() => setOpen((o) => !o)}>
          {rolling ? 'Registrér nyt sæt' : 'Registrér et sæt'}
        </button>
      </div>

      {open ? (
        <div className="ww-card" style={{ padding: 18, marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 16 }}>
            <div>
              <label htmlFor={`ww-load-${lift}`} style={{ display: 'block', fontSize: 13, color: 'var(--ww-text-2)', marginBottom: 6 }}>
                Hvor mange kilo?
              </label>
              <input
                id={`ww-load-${lift}`}
                className="ww-input"
                type="number"
                inputMode="decimal"
                min={1}
                step={2.5}
                value={loadKg}
                onChange={(e) => setLoadKg(e.target.value)}
                placeholder="fx 100"
              />
            </div>
            <div>
              <label htmlFor={`ww-reps-${lift}`} style={{ display: 'block', fontSize: 13, color: 'var(--ww-text-2)', marginBottom: 6 }}>
                Hvor mange gentagelser?
              </label>
              <input
                id={`ww-reps-${lift}`}
                className="ww-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ww-text-2)' }}>
            Hvor hårdt føltes sættet?
          </div>
          <div className="ww-wrap" style={{ gap: 6, marginBottom: 8 }}>
            {EFFORT_OPTIONS.map((o) => (
              <Chip key={o.id} on={rpe === o.id} onClick={() => setRpe(o.id)}>{o.label}</Chip>
            ))}
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.55 }}>
            {EFFORT_OPTIONS.find((o) => o.id === rpe)?.hint}
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ww-btn ww-btn--primary" onClick={save} disabled={!canSave}>
              Gem sættet
            </button>
            <button type="button" className="ww-btn" onClick={() => setOpen(false)}>Fortryd</button>
          </div>

          <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
            Du behøver ikke teste din <Term id="1rm" />. Ud fra vægt, gentagelser og hvor hårdt
            det føltes, regner appen et bud på din maksimale styrke — og bruger et bevidst
            lavere tal, når den sætter dine vægte.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function Baseline({
  profile, onPatch, onBack,
}: {
  profile: UserProfile;
  onPatch: (patch: Partial<UserProfile>) => void;
  onBack: () => void;
}) {
  const safety = assessSafety(profile.screening);

  const logSet = (lift: LiftId, loadKg: number, reps: number, rpe: number): void => {
    const benchmark = benchmarkFromSet({
      subjectId: lift,
      protocol: reps === 1 ? '1rm' : 'topSetRpe',
      loadKg,
      reps,
      rpe,
    });
    onPatch({ benchmarks: [...profile.benchmarks, benchmark] });
  };

  const toggleFlag = (id: ScreeningFlagId): void => {
    const flags = profile.screening.flags.includes(id)
      ? profile.screening.flags.filter((f) => f !== id)
      : [...profile.screening.flags, id];
    onPatch({
      screening: {
        ...profile.screening,
        flags,
        status: resolveScreeningStatus(flags),
        answeredAt: new Date().toISOString(),
      },
    });
  };

  const setPain = (region: CareId, score: number): void => {
    const rest = profile.screening.pain.filter((p) => p.region !== region);
    const pain: PainEntry[] = score === 0
      ? rest
      : [...rest, { region, score, aggravators: [], updatedAt: new Date().toISOString() }];
    onPatch({ screening: { ...profile.screening, pain } });
  };

  const setSkill = (exerciseId: string, level: CompetenceLevel): void => {
    onPatch({ competence: setCompetence(profile.competence, exerciseId, level) as CompetenceEntry[] });
  };

  const toggleWeakPoint = (id: WeakPointId): void => {
    onPatch({
      weakPoints: profile.weakPoints.includes(id)
        ? profile.weakPoints.filter((w) => w !== id)
        : [...profile.weakPoints, id],
    });
  };

  const painFor = (region: CareId): number =>
    profile.screening.pain.find((p) => p.region === region)?.score ?? 0;

  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 760 }}>
      <PageHeader
        kicker="Grundlag"
        title="Mine tal"
        lede="Alt herinde er frivilligt. Men jo mere appen ved, jo mindre gætter den — og jo mere passer dine vægte til dig."
        icon={<Glyph name="stats" size={30} />}
      />

      {!safety.mayTrain ? (
        <div style={{ marginBottom: 26 }}>
          <Note label="Kontakt din læge først" tone="danger">
            Du har markeret et symptom, som bør ses på af en fagperson, før du træner videre.
            WHATWORK vurderer ikke symptomer og bygger ikke træning oven på dem.
          </Note>
        </div>
      ) : null}

      <Section
        id="ww-baseline-strength"
        title="Din styrke"
        lede="Registrér et sæt, du har lavet — ikke et du gætter. Appen regner selv resten om."
      >
        <div>
          {STRENGTH4_LIFTS.map((lift) => (
            <LiftRow key={lift} lift={lift} benchmarks={profile.benchmarks} onLog={logSet} />
          ))}
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.65, maxWidth: '62ch' }}>
          Overhead press er WHATWORKs fjerde hovedløft. Det indgår ikke i officiel powerlifting,
          som består af squat, bænkpres og dødløft.
        </p>
      </Section>

      <Section
        id="ww-baseline-screening"
        title="Helbred"
        lede="Fem sekunder her ændrer, hvad appen tør foreslå. Den stiller ingen diagnose."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SCREENING_FLAGS.map((flag) => {
            const on = profile.screening.flags.includes(flag.id);
            return (
              <button
                key={flag.id}
                type="button"
                className="ww-line-btn"
                aria-pressed={on}
                onClick={() => toggleFlag(flag.id)}
              >
                <span style={{ fontSize: 15, fontWeight: on ? 700 : 500, textAlign: 'left' }}>
                  {flag.label}
                  {flag.alarm ? (
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ww-text-3)', fontWeight: 400, marginTop: 2 }}>
                      Markerer du denne, stopper appen og henviser dig videre.
                    </span>
                  ) : null}
                </span>
                <span className={on ? 'ww-badge ww-badge--warn' : 'ww-badge'}>
                  {on ? 'Ja' : 'Nej'}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        id="ww-baseline-pain"
        title="Smerte lige nu"
        lede="0 betyder ingen smerte. Fra 4 og opefter tager appen bevægelser ud i stedet for at skalere dem."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CARE_AREAS.map((area) => (
            <div key={area.id}>
              <div style={{ fontSize: 14.5, marginBottom: 6 }}>{area.name}</div>
              <div className="ww-wrap" style={{ gap: 4 }}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Chip
                    key={n}
                    on={painFor(area.id) === n}
                    onClick={() => setPain(area.id, n)}
                    style={{ minWidth: 44 }}
                  >
                    {n}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="ww-baseline-skill"
        title="Svære øvelser"
        lede="Et generelt niveau kan ikke fortælle, om du kan tage en håndstands-push-up. Markér kun det, du faktisk kan."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {HIGH_SKILL_IDS.map((id) => {
            const name = BY_ID[id]?.name ?? id;
            const current = profile.competence.find((c) => c.exerciseId === id)?.level ?? 'unknown';
            return (
              <div key={id}>
                <div style={{ fontSize: 14.5, marginBottom: 6 }}>{name}</div>
                <div className="ww-wrap" style={{ gap: 4 }}>
                  {COMPETENCE_ORDER.map((level) => (
                    <Chip key={level} on={current === level} onClick={() => setSkill(id, level)}>
                      {COMPETENCE_LABELS[level]}
                    </Chip>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.65, maxWidth: '62ch' }}>
          <Term id="competence">Teknisk niveau</Term> vurderes for hver øvelse for sig. Er du
          kun stabil, når du er frisk, programmeres øvelsen ikke sidst i et hårdt pas.
        </p>
      </Section>

      <Section
        id="ww-baseline-weak"
        title="Hvor går det galt?"
        lede="Vælg det sted i et løft, hvor det typisk bryder sammen for dig. Det styrer, hvilke hjælpeøvelser du får."
      >
        <div className="ww-wrap" style={{ gap: 6 }}>
          {WEAK_POINT_LIST.map((wp) => (
            <Chip
              key={wp.id}
              on={profile.weakPoints.includes(wp.id)}
              onClick={() => toggleWeakPoint(wp.id)}
            >
              {wp.label}
            </Chip>
          ))}
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.65, maxWidth: '62ch' }}>
          Vælger du ingenting, gætter appen ikke på en svaghed. Så vælges brede hjælpeøvelser
          med dokumenteret overførsel til hovedløftet i stedet.
        </p>
      </Section>

      <button type="button" className="ww-btn ww-btn--lg" onClick={onBack}>
        Tilbage til profilen
      </button>
    </div>
  );
}
