import { useEffect, useRef, useState } from 'react';
import type {
  Movement, Program as ProgramData, ProgramDay, ProgramWeek, Workout,
} from '../engine/index.js';
import { GoalCard } from '../components/GoalCard.js';
import { LiftEntry } from '../components/LiftEntry.js';
import { Photo } from '../components/Photo.js';
import { Term } from '../components/Term.js';
import {
  Chip, Counter, Dialog, Glyph, Kicker, Note, PageHeader,
} from '../components/ui.js';
import { plural } from '../lib/format.js';
import { SPORT_LIST } from '../domain/sport.js';
import { HYROX_DIVISION_LABELS, hyroxRules } from '../domain/ruleSets.js';
import { e1rmFor } from '../domain/benchmarks.js';
import { STRENGTH4_LIFTS } from '../domain/types.js';
import type { LiftId } from '../domain/types.js';
import type { ProgramDraft, ProgramRef, UserProfile } from '../types.js';

const WEEK_OPTIONS = [4, 6, 8, 12, 16];
const DAY_OPTIONS = [2, 3, 4, 5, 6];

/**
 * Udgangspunktet for belastningerne.
 *
 * "Ved ikke" er et gyldigt svar og fører til en indkøringsuge — appen gætter aldrig
 * på kilo, brugeren ikke har løftet.
 */
const BASELINE_OPTIONS: { id: ProgramDraft['baseline']; name: string; desc: string }[] = [
  {
    id: 'known', name: 'Jeg kender mine tal',
    desc: 'Du har vægte, du ved du kan løfte. Programmet regner ud fra dem.',
  },
  {
    id: 'assessment', name: 'Mål dem for mig',
    desc: 'Første uge er en let indkøringsuge, hvor tallene findes. Så er de dine egne.',
  },
  {
    id: 'conservative', name: 'Start forsigtigt',
    desc: 'Programmet starter lavt og bygger op. Du kan altid justere undervejs.',
  },
];

const DAY_STATUS: Record<ProgramDay['status'], { label: string; className: string }> = {
  planned: { label: 'Planlagt', className: 'ww-badge' },
  done: { label: 'Gennemført', className: 'ww-badge ww-badge--good' },
  partial: { label: 'Ændret', className: 'ww-badge ww-badge--warn' },
  skipped: { label: 'Sprunget over', className: 'ww-badge' },
};

/** Første uge med et pas, der hverken er gennemført eller sprunget over — der er brugeren. */
function currentWeekIndex(program: ProgramData): number {
  for (const week of program.weeks) {
    if (week.days.some((d) => d.status === 'planned')) return week.index;
  }
  return program.weeks[program.weeks.length - 1]?.index ?? 1;
}

/** Vægt/skalering for øvelsens ene deltager — programmer er altid solo. */
function loadSummary(m: Movement): string {
  return m.targets[0]?.load?.text ?? '';
}

/**
 * `inert` fjerner sammenklappet indhold fra tabuleringsrækkefølgen og skærmlæsere,
 * uden at forstyrre CSS-højdetransitionen (grid-template-rows 0fr → 1fr). Sat via
 * ref/effekt frem for et JSX-prop, fordi denne @types/react-version endnu ikke
 * kender attributten.
 */
function useInertRef<T extends HTMLElement>(inert: boolean) {
  const node = useRef<T | null>(null);
  useEffect(() => {
    if (node.current) node.current.inert = inert;
  }, [inert]);
  return node;
}

export function Program({
  program, draft, profile, onDraft, onBuild, onDrop, onOpenDay, onSkipDay,
  onRegenerateDay, onMoveDay, onLogLift,
}: {
  program: ProgramData | null;
  draft: ProgramDraft;
  profile: UserProfile;
  onDraft: (patch: Partial<ProgramDraft>) => void;
  onBuild: () => void;
  onDrop: () => void;
  onOpenDay: (workout: Workout, ref: ProgramRef) => void;
  onSkipDay: (ref: ProgramRef) => void;
  onRegenerateDay: (ref: ProgramRef) => void;
  onMoveDay: (ref: ProgramRef, delta: number) => void;
  /** Registrerer et sæt for et hovedløft, så programmet kan regne med rigtige kilo. */
  onLogLift: (lift: LiftId, loadKg: number, reps: number, rpe: number) => void;
}) {
  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: program ? 1120 : 940 }}>
      <div style={{ marginBottom: 22 }}>
        <Note label="Beta version">
          Programdelen er stadig under udvikling. Ting kan ændre sig, og der kommer flere
          justeringer løbende.
        </Note>
      </div>
      {program ? (
        <ProgramPlan
          program={program}
          profile={profile}
          onDrop={onDrop}
          onBuild={onBuild}
          onOpenDay={onOpenDay}
          onSkipDay={onSkipDay}
          onRegenerateDay={onRegenerateDay}
          onMoveDay={onMoveDay}
        />
      ) : (
        <>
          <PageHeader
            kicker="Plan"
            title="Program"
            lede="Vælg mål, længde og hvor mange dage du kan. Programmet bygges lokalt, uge for uge, klar til at åbne."
          />
          <ProgramSetup
            draft={draft}
            profile={profile}
            onDraft={onDraft}
            onBuild={onBuild}
            onLogLift={onLogLift}
          />
        </>
      )}
    </div>
  );
}

/**
 * Indtastning af de fire hovedløft, direkte i programbyggeren.
 *
 * Uden det her ville "jeg kender mine tal" være et valg uden konsekvens: brugeren
 * ville trykke Byg og få en indkøringsuge, hun lige har sagt nej til.
 */
function KnownNumbers({
  profile, onLogLift,
}: {
  profile: UserProfile;
  onLogLift: (lift: LiftId, loadKg: number, reps: number, rpe: number) => void;
}) {
  const missing = STRENGTH4_LIFTS.filter((lift) => !e1rmFor(profile.benchmarks, lift));

  return (
    <div>
      <Note label={`Mangler ${missing.length} af 4 løft`} accent>
        Skriv et sæt, du har lavet i hvert løft — for eksempel 100 kg gange 3. Ud fra
        vægt, gentagelser og hvor hårdt det føltes, regner appen din maksimale styrke
        og sætter programmets procenter derefter. Mangler et løft, styres det af
        anstrengelse i stedet for kilo.
      </Note>
      <div style={{ marginTop: 6 }}>
        {STRENGTH4_LIFTS.map((lift) => (
          <LiftEntry
            key={lift}
            lift={lift}
            benchmarks={profile.benchmarks}
            onLog={onLogLift}
            compact
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Hvad indkøringsugen konkret går ud på.
 *
 * "Første uge måler dine tal" siger ingenting, hvis man ikke ved, hvad man skal
 * lave. Her står protokollen, så man kan gå i træningscenteret og udføre den.
 */
function AssessmentPreview({ baseline }: { baseline: ProgramDraft['baseline'] }) {
  return (
    <Note label={baseline === 'assessment' ? 'Sådan finder du tallene' : 'Sådan starter programmet'} accent>
      {baseline === 'assessment' ? (
        <>
          Uge 1 er en indkøringsuge. I hvert af de fire løft arbejder du dig op i vægt
          med lette sæt og ender med <strong>ét tungt sæt på 3 gentagelser</strong>, hvor
          du stopper med cirka to gentagelser tilbage i tanken.
          <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>5 gentagelser med noget, der føles let</li>
            <li style={{ marginBottom: 4 }}>3 gentagelser, lidt tungere</li>
            <li style={{ marginBottom: 4 }}>2 gentagelser, tungere igen</li>
            <li style={{ marginBottom: 4 }}>Dagens sæt: 3 gentagelser, hvor du stopper med to tilbage</li>
          </ul>
          <p style={{ margin: '10px 0 0' }}>
            Du registrerer det sidste sæt, når du er færdig. Derefter regner appen dine
            kilo og procenter for resten af forløbet.
          </p>
        </>
      ) : (
        <>
          Programmet starter med bevidst lave vægte og bygger op derfra. Du bliver bedt
          om at registrere, hvordan sættene føltes, og efter et par uger har appen
          tallene fra din rigtige træning.
        </>
      )}
    </Note>
  );
}

function ProgramSetup({
  draft, profile, onDraft, onBuild, onLogLift,
}: {
  draft: ProgramDraft;
  profile: UserProfile;
  onDraft: (patch: Partial<ProgramDraft>) => void;
  onBuild: () => void;
  onLogLift: (lift: LiftId, loadKg: number, reps: number, rpe: number) => void;
}) {
  // Styrkesporene er de eneste, der regner i procent af et maksimum. For HYROX og
  // funktionel fitness giver det ikke mening at kræve fire hovedløft.
  const usesLiftNumbers = draft.goal === 'strength4' || draft.goal === 'powerlifting'
    || draft.goal === 'strongman';
  const needsNumbers = usesLiftNumbers
    && STRENGTH4_LIFTS.some((lift) => !e1rmFor(profile.benchmarks, lift));

  return (
    <div className="ww-program-setup">
      <div style={{ minWidth: 0 }}>
        <h2 className="ww-kicker" style={{ marginBottom: 10 }}>Hvad træner du til?</h2>
        <div className="ww-goal-list" style={{ marginBottom: 26 }}>
          {SPORT_LIST.map((sport) => (
            <GoalCard
              key={sport.id}
              id={sport.id}
              name={sport.name}
              desc={sport.desc}
              on={draft.goal === sport.id}
              onClick={() => onDraft({ goal: sport.id })}
            />
          ))}
        </div>

        <div style={{ marginBottom: 26 }}>
          <h2 className="ww-kicker" style={{ marginBottom: 10 }}>Udgangspunkt</h2>
          <p style={{ margin: '0 0 12px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ww-body)', maxWidth: '58ch' }}>
            For at regne dine kilo ud skal appen kende din styrke. Den behøver ikke en
            maksimal test — et enkelt lidt tungere sæt er nok.
          </p>
          <div className="ww-goal-list">
            {BASELINE_OPTIONS.map((option) => (
              <GoalCard
                key={option.id}
                id={option.id}
                name={option.name}
                desc={option.desc}
                on={draft.baseline === option.id}
                onClick={() => onDraft({ baseline: option.id })}
              />
            ))}
          </div>

          {/*
            Valget skal have en konsekvens med det samme.
            Siger man "jeg kender mine tal", skal felterne stå her — ikke på en anden
            skærm, man selv skal finde. Siger man "mål dem for mig", skal det stå
            præcis hvad man kommer til at lave i uge 1.
          */}
          {needsNumbers ? (
            <div style={{ marginTop: 18 }}>
              {draft.baseline === 'known' ? (
                <KnownNumbers profile={profile} onLogLift={onLogLift} />
              ) : (
                <AssessmentPreview baseline={draft.baseline} />
              )}
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <Note label="Dine tal er på plads" tone="good">
                Alle fire løft har et tal. Programmet regner kilo og procenter ud fra dem —
                og du kan altid rette dem under Mine tal.
              </Note>
            </div>
          )}
        </div>

        {/* Sportsspecifikke spørgsmål vises kun for den valgte sport. */}
        {draft.goal === 'hyrox' ? (
          <div style={{ marginBottom: 26 }}>
            <h2 className="ww-kicker" style={{ marginBottom: 10 }}>Division</h2>
            <div className="ww-wrap" style={{ gap: 6, marginBottom: 12 }}>
              {(hyroxRules()?.divisions ?? []).map((id) => (
                <Chip key={id} on={draft.division === id} onClick={() => onDraft({ division: id })}>
                  {HYROX_DIVISION_LABELS[id] ?? id}
                </Chip>
              ))}
            </div>
            <Note label="Kontrollér vægtene" tone="quiet">
              Stationernes vægte er hentet fra et gemt øjebliksbillede af reglerne og er ikke
              bekræftet mod den nyeste udgave. Tjek dem på hyrox.com/rulebook, før du regner
              dem for endelige.
            </Note>
          </div>
        ) : null}

        {draft.goal === 'strongman' ? (
          <div style={{ marginBottom: 26 }}>
            <Note label="Eventlisten mangler" tone="quiet">
              Strongman har ikke ét fast konkurrenceformat. Uden den konkrete liste over
              events, redskaber, vægte og afstande bygger appen et generelt styrkeforløb —
              ikke en forberedelse til en bestemt konkurrence.
            </Note>
          </div>
        ) : null}

        <div style={{ marginBottom: 26, maxWidth: 380 }}>
          <h2 className="ww-kicker" style={{ marginBottom: 10 }}>Konkurrence eller race</h2>
          <label className="ww-sr-only" htmlFor="ww-event-date">Dato for konkurrence eller race</label>
          <input
            id="ww-event-date"
            type="date"
            className="ww-input"
            value={draft.eventDate}
            onChange={(e) => onDraft({ eventDate: e.target.value })}
          />
          <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ww-text-3)' }}>
            Valgfrit. Sætter du en dato, lægges der en{' '}
            <Term id="taper">nedtrapning</Term> ind i de sidste uger.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 22, marginBottom: 22 }}>
          <div>
            <h2 className="ww-kicker" style={{ marginBottom: 10 }}>Uger</h2>
            <div className="ww-wrap" style={{ gap: 6 }}>
              {WEEK_OPTIONS.map((n) => (
                <Chip key={n} on={draft.weeks === n} onClick={() => onDraft({ weeks: n })} style={{ minWidth: 62 }}>{n}</Chip>
              ))}
            </div>
          </div>
          <div>
            <h2 className="ww-kicker" style={{ marginBottom: 10 }}>Pas om ugen</h2>
            <div className="ww-wrap" style={{ gap: 6 }}>
              {DAY_OPTIONS.map((n) => (
                <Chip key={n} on={draft.days === n} onClick={() => onDraft({ days: n })} style={{ minWidth: 62 }}>{n}</Chip>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 22, maxWidth: 380 }}>
          <Counter
            label="Minutter pr. pas"
            value={`${draft.minutes} min`}
            minWidth={72}
            onDown={() => onDraft({ minutes: Math.max(15, draft.minutes - 5) })}
            onUp={() => onDraft({ minutes: Math.min(90, draft.minutes + 5) })}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <Note label="Sådan bygges programmet" tone="quiet">
            Programmet deles op i blokke, der bygger oven på hinanden. Hver uge indeholder den
            træning, dit mål ikke kan undvære — og ved skiftet mellem to blokke lægges der en{' '}
            <Term id="deload">roligere uge</Term> ind, så kroppen kan indhente. Alle vægte
            regnes ud fra dine egne tal og vises med, hvad de bygger på.
          </Note>
        </div>

        <button type="button" className="ww-btn ww-btn--primary ww-btn--lg" style={{ maxWidth: 340 }} onClick={onBuild}>
          Byg programmet
        </button>
      </div>

      <aside className="ww-program-preview">
        <Photo name="program-info" frame="portrait" sizes="(min-width: 1024px) 340px, min(100vw - 40px, 340px)" />
        <p>Volumen bygges gradvist op, uge for uge — med en roligere uge lagt ind, når programmet kalder på den.</p>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ww-prog-stat">
      <span className="ww-prog-stat__label">{label}</span>
      <span className="ww-prog-stat__value ww-num">{value}</span>
    </div>
  );
}

function ProgramPlan({
  program, profile, onDrop, onBuild, onOpenDay, onSkipDay, onRegenerateDay, onMoveDay,
}: {
  program: ProgramData;
  profile: UserProfile;
  onDrop: () => void;
  onBuild: () => void;
  onOpenDay: (workout: Workout, ref: ProgramRef) => void;
  onSkipDay: (ref: ProgramRef) => void;
  onRegenerateDay: (ref: ProgramRef) => void;
  onMoveDay: (ref: ProgramRef, delta: number) => void;
}) {
  // Sandt når alle fire løft har fået et tal, siden programmet blev bygget.
  const numbersReady = STRENGTH4_LIFTS.every((lift) => e1rmFor(profile.benchmarks, lift));

  const allDays = program.weeks.flatMap((w) => w.days);
  const completed = allDays.filter((d) => d.status === 'done').length;
  const current = currentWeekIndex(program);

  const [openWeeks, setOpenWeeks] = useState<Set<number>>(() => new Set([current]));
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);

  const toggleWeek = (index: number): void => {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const jumpToWeek = (index: number): void => {
    setOpenWeeks((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
    // rAF, så det lige åbnede afsnit har fået sin fulde højde, før vi scroller til det.
    requestAnimationFrame(() => {
      document.getElementById(`ww-week-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div>
      <header className="ww-prog-hero">
        <div>
          <Kicker style={{ marginBottom: 10 }}>Program</Kicker>
          <h1 className="ww-display" style={{ marginBottom: 6 }}>{program.goalName}</h1>
        </div>

        <div className="ww-prog-stats">
          <Stat label="Varighed" value={`${program.weeks.length} ${plural(program.weeks.length, 'uge', 'uger')}`} />
          <Stat label="Pas/uge" value={String(program.daysPerWeek)} />
          <Stat label="Pr. pas" value={`${program.minutes} min`} />
          <Stat label="Uge" value={`${current} af ${program.weeks.length}`} />
          <Stat label="Gennemført" value={`${completed}/${allDays.length}`} />
        </div>

        <div className="ww-prog-actions">
          <button type="button" className="ww-btn ww-btn--primary" onClick={() => setConfirmRebuild(true)}>
            <Glyph name="refresh" size={17} />
            Lav programmet om
          </button>
        </div>
      </header>

      {program.assessment ? (
        <div style={{ marginBottom: 20 }}>
          {numbersReady ? (
            /*
             * Sløjfen lukkes her.
             *
             * Har brugeren registreret sine tal siden programmet blev bygget, står
             * planen stadig med indkøringsugen. Uden det her tilbud ville hun aldrig
             * få de rigtige kilo at se.
             */
            <Note label="Dine tal er kommet ind" tone="good">
              Du har nu registreret alle fire løft. Bygger du programmet om, bliver
              indkøringsugen erstattet af rigtige kilo og procenter, regnet ud fra
              dine egne tal.
              <div style={{ marginTop: 12 }}>
                <button type="button" className="ww-btn ww-btn--primary" onClick={onBuild}>
                  Regn programmet færdigt
                </button>
              </div>
            </Note>
          ) : (
            <Note label="Første uge måler dine tal" accent>
              {program.assessment.explanation}
              <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>
                {program.assessment.missing.map((m) => (
                  <li key={m.label} style={{ marginBottom: 4 }}>
                    <strong>{m.label}:</strong> {m.suggestion}
                  </li>
                ))}
              </ul>
              <p style={{ margin: '10px 0 0' }}>
                Når du har kørt ugen og registreret sættene, kan du regne programmet
                færdigt med dine egne kilo.
              </p>
            </Note>
          )}
        </div>
      ) : null}

      {program.notes?.length ? (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {program.notes.map((note) => (
            <Note
              key={`${note.code}-${note.message}`}
              label={note.severity === 'error' ? 'Skal løses' : 'Værd at vide'}
              tone={note.severity === 'error' ? 'danger' : 'quiet'}
            >
              {note.message}
              {note.fix ? <><br />{note.fix}</> : null}
            </Note>
          ))}
        </div>
      ) : null}

      {program.trainingMaxes?.length ? (
        <section aria-labelledby="ww-tm-heading" style={{ marginBottom: 20 }}>
          <h2 id="ww-tm-heading" className="ww-kicker" style={{ marginBottom: 10 }}>
            Vægtene regnes ud fra
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ww-body)', maxWidth: '62ch' }}>
            Programmet bruger et{' '}
            <Term id="training-max">training max</Term>
            {' '}— et bevidst lavere tal end din maksimale styrke — så vægtene også passer på en
            dag, hvor du ikke er i topform.
          </p>
          <div className="ww-prog-stats">
            {program.trainingMaxes.map((tm) => (
              <Stat key={tm.lift} label={tm.name} value={`${String(tm.kg).replace('.', ',')} kg`} />
            ))}
          </div>
        </section>
      ) : null}

      {program.explanation?.length ? (
        <section aria-labelledby="ww-why-heading" style={{ marginBottom: 22 }}>
          <h2 id="ww-why-heading" className="ww-kicker" style={{ marginBottom: 10 }}>
            Sådan er programmet bygget
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {program.explanation.map((line) => (
              <li key={line} style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ww-body)', maxWidth: '64ch' }}>
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="ww-prog-nav ww-prog-nav--sticky" aria-label="Spring til uge">
        {program.weeks.map((week) => {
          const doneInWeek = week.days.filter((d) => d.status === 'done').length;
          const isCurrent = week.index === current;
          const isDone = doneInWeek === week.days.length;
          return (
            <button
              key={week.index}
              type="button"
              className="ww-prog-nav__seg"
              data-state={isDone ? 'done' : isCurrent ? 'current' : undefined}
              data-deload={week.deload ? 'true' : undefined}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={
                `Uge ${week.index} af ${program.weeks.length}`
                + `${week.deload ? ', roligere uge' : ''} — ${doneInWeek} af ${week.days.length} gennemført`
              }
              onClick={() => jumpToWeek(week.index)}
            >
              <span className="ww-prog-nav__seg-n">{week.index}</span>
              {isDone ? <Glyph name="check" size={13} /> : <span className="ww-prog-nav__seg-dot" />}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 8 }}>
        {program.weeks.map((week) => (
          <WeekSection
            key={week.index}
            week={week}
            isCurrent={week.index === current}
            open={openWeeks.has(week.index)}
            onToggle={() => toggleWeek(week.index)}
            onOpenDay={onOpenDay}
            onSkipDay={onSkipDay}
            onRegenerateDay={onRegenerateDay}
            onMoveDay={onMoveDay}
          />
        ))}
      </div>

      <div className="ww-prog-danger">
        <p>
          Sletter du programmet, forsvinder alle {program.weeks.length} {plural(program.weeks.length, 'uge', 'uger')}
          {' '}permanent fra denne enhed
          {completed > 0 ? ` — inklusive de ${completed} pas du allerede har gennemført` : ''}.
        </p>
        <button type="button" className="ww-btn ww-btn--danger" onClick={() => setConfirmDrop(true)}>
          <Glyph name="trash" size={16} />
          Slet program
        </button>
      </div>

      {confirmRebuild ? (
        <Dialog title="Lav programmet om?" onClose={() => setConfirmRebuild(false)}>
          <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.55, color: 'var(--ww-body)' }}>
            Du får et helt nyt program med samme mål, {program.weeks.length} {plural(program.weeks.length, 'uge', 'uger')} og
            {' '}{program.daysPerWeek} pas om ugen — men ny variation i hvert pas.
            {completed > 0 ? ` De ${completed} pas du har gennemført, bliver overskrevet af den nye plan.` : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ww-btn ww-btn--lg" style={{ flex: 1 }} onClick={() => setConfirmRebuild(false)}>
              Behold nuværende
            </button>
            <button
              type="button"
              className="ww-btn ww-btn--primary ww-btn--lg"
              style={{ flex: 1 }}
              onClick={() => { setConfirmRebuild(false); onBuild(); }}
            >
              Lav programmet om
            </button>
          </div>
        </Dialog>
      ) : null}

      {confirmDrop ? (
        <Dialog title="Slet program?" onClose={() => setConfirmDrop(false)}>
          <div style={{ marginBottom: 20 }}>
            <Note label="Kan ikke fortrydes" tone="danger">
              {completed > 0
                ? `${program.goalName} bliver slettet permanent, inklusive de ${completed} pas du allerede har gennemført.`
                : `${program.goalName} bliver slettet permanent fra denne enhed.`}
            </Note>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ww-btn ww-btn--lg" style={{ flex: 1 }} onClick={() => setConfirmDrop(false)}>
              Behold programmet
            </button>
            <button
              type="button"
              className="ww-btn ww-btn--solid-danger ww-btn--lg"
              style={{ flex: 1 }}
              onClick={() => { setConfirmDrop(false); onDrop(); }}
            >
              Slet program
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function WeekSection({
  week, isCurrent, open, onToggle, onOpenDay, onSkipDay, onRegenerateDay, onMoveDay,
}: {
  week: ProgramWeek;
  isCurrent: boolean;
  open: boolean;
  onToggle: () => void;
  onOpenDay: (workout: Workout, ref: ProgramRef) => void;
  onSkipDay: (ref: ProgramRef) => void;
  onRegenerateDay: (ref: ProgramRef) => void;
  onMoveDay: (ref: ProgramRef, delta: number) => void;
}) {
  const done = week.days.filter((d) => d.status === 'done').length;
  const bodyId = `ww-week-body-${week.index}`;
  const wi = week.index - 1;
  const bodyRef = useInertRef<HTMLDivElement>(!open);

  return (
    <section className="ww-week" id={`ww-week-${week.index}`}>
      <button type="button" className="ww-week__head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="ww-week__chevron"><Glyph name="chevron" size={18} /></span>
        <span className="ww-week__main">
          <span className="ww-week__title-row">
            <span className="ww-week__title">Uge {week.index}</span>
            {week.phaseName ? <span className="ww-badge">{week.phaseName}</span> : null}
            {isCurrent ? <span className="ww-badge ww-badge--accent">Nu</span> : null}
            {week.assessment ? <span className="ww-badge ww-badge--accent">Indkøring</span> : null}
            {week.deload ? <span className="ww-badge ww-badge--warn">Roligere uge</span> : null}
            {week.taper ? <span className="ww-badge ww-badge--warn">Nedtrapning</span> : null}
          </span>
          {open ? <p className="ww-week__rationale">{week.rationale}</p> : null}
        </span>
        <span className="ww-week__progress">{done}/{week.days.length}</span>
      </button>
      <div className="ww-week__body" data-open={open} id={bodyId} ref={bodyRef}>
        <div className="ww-week__body-inner">
          <div className="ww-week__days">
            {week.days.map((day, di) => (
              <DayCard
                key={`${week.index}-${di}`}
                day={day}
                dayRef={{ w: wi, d: di }}
                canMoveUp={di > 0}
                canMoveDown={di < week.days.length - 1}
                onOpenDay={onOpenDay}
                onSkipDay={onSkipDay}
                onRegenerateDay={onRegenerateDay}
                onMoveDay={onMoveDay}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DayCard({
  day, dayRef, canMoveUp, canMoveDown, onOpenDay, onSkipDay, onRegenerateDay, onMoveDay,
}: {
  day: ProgramDay;
  dayRef: ProgramRef;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpenDay: (workout: Workout, ref: ProgramRef) => void;
  onSkipDay: (ref: ProgramRef) => void;
  onRegenerateDay: (ref: ProgramRef) => void;
  onMoveDay: (ref: ProgramRef, delta: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const status = DAY_STATUS[day.status] ?? DAY_STATUS.planned;
  const workout = day.workout;
  const bodyId = `ww-day-body-${dayRef.w}-${dayRef.d}`;
  const blocks = workout ? workout.blocks.filter((b) => b.kind !== 'warmup') : [];
  const bodyRef = useInertRef<HTMLDivElement>(!open);

  return (
    <div className="ww-day" data-status={day.status}>
      <button
        type="button"
        className="ww-day__head"
        aria-expanded={workout ? open : undefined}
        aria-controls={workout ? bodyId : undefined}
        onClick={() => setOpen((o) => !o)}
        disabled={!workout}
      >
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="ww-day__top">
            <span className="ww-kicker">Pas {day.day}</span>
            <span className={status.className}>{status.label}</span>
          </span>
          <span className="ww-day__title">
            {day.stimulus ?? (workout ? workout.title : 'Kunne ikke bygges')}
          </span>
          <span className="ww-day__meta">
            {workout ? (
              <>
                <span>{day.plannedMinutes ?? workout.estimatedMinutes} min</span>
                <span aria-hidden="true">·</span>
                <span>inklusive pauser og skift</span>
              </>
            ) : day.error}
          </span>
        </span>
        {workout ? (
          <span className="ww-day__chevron"><Glyph name="chevron" size={16} /></span>
        ) : null}
      </button>

      {workout ? (
        <div className="ww-day__body" data-open={open} id={bodyId} ref={bodyRef}>
          <div className="ww-day__body-inner">
            <div className="ww-day__blocks">
              {blocks.map((block) => (
                <div key={block.id}>
                  <div className="ww-day__block-title">{block.title}</div>
                  {block.movements.map((m, i) => {
                    const load = loadSummary(m);
                    return (
                      <div className="ww-day__movement" key={`${block.id}-${m.exerciseId}-${i}`}>
                        <span className="ww-day__movement-name">{m.display}</span>
                        {load ? <span className="ww-day__movement-load">{load}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
              <button type="button" className="ww-btn ww-btn--block" onClick={() => onOpenDay(workout, dayRef)}>
                Åbn hele workouten
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ww-day__actions">
        <button type="button" className="ww-btn" style={{ minHeight: 44, fontSize: 14 }} onClick={() => onRegenerateDay(dayRef)}>
          <Glyph name="refresh" size={14} />
          Ny
        </button>
        <button type="button" className="ww-btn" style={{ minHeight: 44, fontSize: 14 }} onClick={() => onSkipDay(dayRef)}>
          Spring over
        </button>
        <span className="ww-day__move">
          <button
            type="button"
            className="ww-btn"
            style={{ minHeight: 44, minWidth: 44, fontSize: 14 }}
            aria-label={`Flyt pas ${day.day} tidligere i ugen`}
            disabled={!canMoveUp}
            onClick={() => onMoveDay(dayRef, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="ww-btn"
            style={{ minHeight: 44, minWidth: 44, fontSize: 14 }}
            aria-label={`Flyt pas ${day.day} senere i ugen`}
            disabled={!canMoveDown}
            onClick={() => onMoveDay(dayRef, 1)}
          >
            ↓
          </button>
        </span>
      </div>
    </div>
  );
}
