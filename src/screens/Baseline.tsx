import { Term } from '../components/Term.js';
import { LiftEntry } from '../components/LiftEntry.js';
import { Chip, Glyph, Note, PageHeader } from '../components/ui.js';
import { BY_ID } from '../engine/data/exercises.js';
import { benchmarkFromSet } from '../domain/benchmarks.js';
import { COMPETENCE_LABELS, COMPETENCE_ORDER, STRENGTH4_LIFTS } from '../domain/types.js';
import type { CompetenceEntry, CompetenceLevel, LiftId, PainEntry } from '../domain/types.js';
import { HIGH_SKILL_IDS } from '../domain/ontology.js';
import { setCompetence } from '../domain/competence.js';
import { SCREENING_FLAGS, assessSafety, resolveScreeningStatus } from '../domain/safety.js';
import type { ScreeningFlagId } from '../domain/types.js';
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

export function Baseline({
  profile, onPatch, onBack,
}: {
  profile: UserProfile;
  onPatch: (patch: Partial<UserProfile> | ((prev: UserProfile) => Partial<UserProfile>)) => void;
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
    onPatch((prev) => ({ benchmarks: [...prev.benchmarks, benchmark] }));
  };

  const toggleFlag = (id: ScreeningFlagId): void => {
    onPatch((prev) => {
      const flags = prev.screening.flags.includes(id)
        ? prev.screening.flags.filter((f) => f !== id)
        : [...prev.screening.flags, id];
      return {
        screening: {
          ...prev.screening,
          flags,
          status: resolveScreeningStatus(flags),
          answeredAt: new Date().toISOString(),
        },
      };
    });
  };

  const setPain = (region: CareId, score: number): void => {
    onPatch((prev) => {
      const rest = prev.screening.pain.filter((p) => p.region !== region);
      const pain: PainEntry[] = score === 0
        ? rest
        : [...rest, { region, score, aggravators: [], updatedAt: new Date().toISOString() }];
      return { screening: { ...prev.screening, pain } };
    });
  };

  const setSkill = (exerciseId: string, level: CompetenceLevel): void => {
    onPatch((prev) => ({
      competence: setCompetence(prev.competence, exerciseId, level) as CompetenceEntry[],
    }));
  };

  const toggleWeakPoint = (id: WeakPointId): void => {
    onPatch((prev) => ({
      weakPoints: prev.weakPoints.includes(id)
        ? prev.weakPoints.filter((w) => w !== id)
        : [...prev.weakPoints, id],
    }));
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
            <LiftEntry key={lift} lift={lift} benchmarks={profile.benchmarks} onLog={logSet} />
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
