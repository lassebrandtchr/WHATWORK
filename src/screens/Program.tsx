import * as eng from '../engine/index.js';
import type { Program as ProgramData, ProgramDay, Workout } from '../engine/index.js';
import { Chip, Counter, Note, OptionRow, PageHeader } from '../components/ui.js';
import type { ProgramDraft, ProgramRef } from '../types.js';

const WEEK_OPTIONS = [2, 4, 6, 8, 12];
const DAY_OPTIONS = [2, 3, 4, 5, 6];

const DAY_STATUS: Record<ProgramDay['status'], { label: string; className: string }> = {
  planned: { label: 'Planlagt', className: 'ww-badge' },
  done: { label: 'Gennemført', className: 'ww-badge ww-badge--good' },
  partial: { label: 'Ændret', className: 'ww-badge ww-badge--warn' },
  skipped: { label: 'Sprunget over', className: 'ww-badge' },
};

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
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 940 }}>
      <PageHeader
        kicker="Plan"
        title="Program"
        lede={program
          ? 'Åbn en dag for at se den, flyt den, spring den over eller generér den forfra.'
          : 'Vælg mål, længde og hvor mange dage du kan. Programmet bygges lokalt, dag for dag.'}
      />
      {program ? (
        <ProgramPlan
          program={program}
          onDrop={onDrop}
          onOpenDay={onOpenDay}
          onSkipDay={onSkipDay}
          onRegenerateDay={onRegenerateDay}
          onMoveDay={onMoveDay}
        />
      ) : (
        <ProgramSetup draft={draft} onDraft={onDraft} onBuild={onBuild} />
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
    <div style={{ maxWidth: 620 }}>
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
  );
}

function ProgramPlan({
  program, onDrop, onOpenDay, onSkipDay, onRegenerateDay, onMoveDay,
}: {
  program: ProgramData;
  onDrop: () => void;
  onOpenDay: (workout: Workout, ref: ProgramRef) => void;
  onSkipDay: (ref: ProgramRef) => void;
  onRegenerateDay: (ref: ProgramRef) => void;
  onMoveDay: (ref: ProgramRef, delta: number) => void;
}) {
  const total = program.weeks.flatMap((w) => w.days);
  const completed = total.filter((d) => d.status === 'done').length;

  return (
    <div>
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 16, paddingBottom: 18, borderBottom: '1px solid var(--ww-line)', marginBottom: 24,
        }}
      >
        <div>
          <div className="ww-h2">{program.goalName}</div>
          <div style={{ fontSize: 14, color: 'var(--ww-text-2)', marginTop: 4 }}>
            {program.weeks.length} uger · {program.daysPerWeek} pas om ugen · {program.minutes} min
            {' · '}{completed} af {total.length} gennemført
          </div>
        </div>
        <button type="button" className="ww-btn ww-btn--danger" onClick={onDrop}>Start forfra</button>
      </div>

      {program.weeks.map((week, wi) => (
        <section key={week.index} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h2 className="ww-kicker" style={{ margin: 0 }}>Uge {week.index}</h2>
            {week.deload ? <span className="ww-badge ww-badge--warn">Roligere uge</span> : null}
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--ww-text-2)', lineHeight: 1.55, maxWidth: '62ch' }}>
            {week.rationale}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8 }}>
            {week.days.map((day, di) => {
              const status = DAY_STATUS[day.status] ?? DAY_STATUS.planned;
              const ref: ProgramRef = { w: wi, d: di };
              return (
                <div key={`${week.index}-${di}`} className="ww-day-card" style={{ cursor: 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <span className="ww-kicker">Pas {day.day}</span>
                    <span className={status.className}>{status.label}</span>
                  </div>
                  <div className="ww-h2" style={{ fontSize: 19, marginBottom: 4 }}>
                    {day.workout ? day.workout.title : 'Kunne ikke bygges'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ww-text-2)', marginBottom: 12 }}>
                    {day.workout
                      ? `${day.workout.estimatedMinutes} min · WW Match ${day.workout.score}`
                      : day.error}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="ww-btn"
                      style={{ minHeight: 44, fontSize: 14 }}
                      disabled={!day.workout}
                      onClick={() => { if (day.workout) onOpenDay(day.workout, ref); }}
                    >
                      Åbn
                    </button>
                    <button type="button" className="ww-btn" style={{ minHeight: 44, fontSize: 14 }} onClick={() => onRegenerateDay(ref)}>
                      Ny
                    </button>
                    <button type="button" className="ww-btn" style={{ minHeight: 44, fontSize: 14 }} onClick={() => onSkipDay(ref)}>
                      Spring over
                    </button>
                    <button
                      type="button"
                      className="ww-btn"
                      style={{ minHeight: 44, minWidth: 44, fontSize: 14 }}
                      aria-label={`Flyt pas ${day.day} tidligere i ugen`}
                      disabled={di === 0}
                      onClick={() => onMoveDay(ref, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ww-btn"
                      style={{ minHeight: 44, minWidth: 44, fontSize: 14 }}
                      aria-label={`Flyt pas ${day.day} senere i ugen`}
                      disabled={di === week.days.length - 1}
                      onClick={() => onMoveDay(ref, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
