import { useEffect, useRef, useState } from 'react';
import * as eng from '../engine/index.js';
import type {
  Movement, Program as ProgramData, ProgramDay, ProgramWeek, Workout,
} from '../engine/index.js';
import { Photo } from '../components/Photo.js';
import {
  Chip, Counter, Dialog, Glyph, Kicker, Note, OptionRow, PageHeader,
} from '../components/ui.js';
import { plural } from '../lib/format.js';
import type { ProgramDraft, ProgramRef } from '../types.js';

const WEEK_OPTIONS = [2, 4, 6, 8, 12];
const DAY_OPTIONS = [2, 3, 4, 5, 6];

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
  program, draft, onDraft, onBuild, onDrop, onOpenDay, onSkipDay, onRegenerateDay, onMoveDay,
}: {
  program: ProgramData | null;
  draft: ProgramDraft;
  onDraft: (patch: Partial<ProgramDraft>) => void;
  onBuild: () => void;
  onDrop: () => void;
  onOpenDay: (workout: Workout, ref: ProgramRef) => void;
  onSkipDay: (ref: ProgramRef) => void;
  onRegenerateDay: (ref: ProgramRef) => void;
  onMoveDay: (ref: ProgramRef, delta: number) => void;
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
          <ProgramSetup draft={draft} onDraft={onDraft} onBuild={onBuild} />
        </>
      )}
    </div>
  );
}

function ProgramSetup({
  draft, onDraft, onBuild,
}: {
  draft: ProgramDraft;
  onDraft: (patch: Partial<ProgramDraft>) => void;
  onBuild: () => void;
}) {
  return (
    <div className="ww-program-setup">
      <div style={{ minWidth: 0 }}>
        <h2 className="ww-kicker" style={{ marginBottom: 10 }}>Mål</h2>
        <div className="ww-stack" style={{ marginBottom: 26 }}>
          {eng.PROGRAM_GOALS.map((goal) => (
            <OptionRow
              key={goal.id}
              name={goal.name}
              desc={goal.desc}
              on={draft.goal === goal.id}
              onClick={() => onDraft({ goal: goal.id })}
            />
          ))}
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
            Volumen stiger let uge for uge. Er programmet på seks uger eller mere, lægges hver
            fjerde uge som en roligere uge med lavere volumen. En gennemført dag skriver sin status
            tilbage, så du kan se, hvor du er.
          </Note>
        </div>

        <button type="button" className="ww-btn ww-btn--primary ww-btn--lg" style={{ maxWidth: 340 }} onClick={onBuild}>
          Byg programmet
        </button>
      </div>

      <aside className="ww-program-preview">
        <Photo name="program-phone" frame="portrait" sizes="(min-width: 1024px) 340px, min(100vw - 40px, 340px)" />
        <p>Sådan ser programmet ud, når det er bygget: uge for uge, pas for pas, klar til at åbne.</p>
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
  program, onDrop, onBuild, onOpenDay, onSkipDay, onRegenerateDay, onMoveDay,
}: {
  program: ProgramData;
  onDrop: () => void;
  onBuild: () => void;
  onOpenDay: (workout: Workout, ref: ProgramRef) => void;
  onSkipDay: (ref: ProgramRef) => void;
  onRegenerateDay: (ref: ProgramRef) => void;
  onMoveDay: (ref: ProgramRef, delta: number) => void;
}) {
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
            {isCurrent ? <span className="ww-badge ww-badge--accent">Nu</span> : null}
            {week.deload ? <span className="ww-badge ww-badge--warn">Roligere uge</span> : null}
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
          <span className="ww-day__title">{workout ? workout.title : 'Kunne ikke bygges'}</span>
          <span className="ww-day__meta">
            {workout ? (
              <>
                <span>{workout.estimatedMinutes} min</span>
                <span aria-hidden="true">·</span>
                <span>{workout.formatName}</span>
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
