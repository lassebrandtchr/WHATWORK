import * as eng from '../engine/index.js';
import type { CareId, FocusId } from '../engine/index.js';
import { EquipmentIcon } from '../components/EquipmentIcon.js';
import { Chip, Counter, Glyph, Kicker, Note, OptionRow, StepHeader } from '../components/ui.js';
import { participantsOf } from '../state/useWhatwork.js';
import type { GenDraft, GenStep } from '../types.js';

const TIME_OPTIONS = [10, 15, 20, 25, 30, 40, 45, 60, 75, 90];

/** De øvelser, det giver mening at kunne ønske eller fravælge for én dag. */
const PICKABLE = [
  'push_press', 'strict_press', 'pull_up', 'band_pull_up', 'clean_and_jerk',
  'hang_power_clean', 'power_clean', 'kb_swing', 'devil_press', 'box_jump_over',
  'sled_push', 'sled_pull', 'assault', 'wall_ball', 'row', 'ski', 'bike',
  'sandbag_shoulder', 'walking_lunge', 'db_reverse_lunge', 'thruster', 'burpee',
  'burpee_box_jump_over', 'double_under', 'toes_to_bar',
];

const STEP_COPY: Record<GenStep, [string, string]> = {
  time: ['Hvor lang tid har I?', 'Tiden dækker hele sessionen — opvarmning, hoveddel, cooldown og skiftetid.'],
  people: ['Hvem træner?', 'Fordelingen bestemmer deltagerantallet og de vægte, hver enkelt får foreslået.'],
  weight: ['Kropsvægt', 'Valgfrit. Gennemsnit pr. profil er nok — det styrer skaleringen af belastning.'],
  level: ['Niveau og retning', 'Skru på conditioning og styrke, hvis dagen kalder på noget bestemt.'],
  direction: ['Ønsker og hensyn', 'Vælg det, I gerne vil have med, og det kroppen skal skånes for.'],
  equip: ['Hvad har I at arbejde med?', 'Alt er slået til. Slå fra, hvad salen ikke har — så holder generatoren sig til resten.'],
  summary: ['Klar?', 'Sådan ser sessionen ud, før Smart Mix bygger den.'],
};

export interface SummaryRow { k: string; v: string }

/** Opsummeringen bruges både som eget trin på mobil og som fast sidebar på desktop. */
export function summaryRows(g: GenDraft): SummaryRow[] {
  const focusName = eng.FOCUS_TAGS.find((f) => f.id === g.focus)?.name ?? g.focus;
  const levelName = eng.LEVELS.find((l) => l.id === g.level)?.name ?? String(g.level);
  const careNames = g.care.map((c) => eng.CARE_AREAS.find((a) => a.id === c)?.name ?? c);
  const n = participantsOf(g);
  const mix = [
    g.men ? `${g.men} ${g.men === 1 ? 'mand' : 'mænd'}` : '',
    g.women ? `${g.women} ${g.women === 1 ? 'kvinde' : 'kvinder'}` : '',
    g.neutral ? `${g.neutral} ikke angivet` : '',
  ].filter(Boolean).join(' · ');

  return [
    { k: 'Tid', v: `${g.minutes} min${g.warmup ? ' inkl. opvarmning' : ' uden opvarmning'}` },
    { k: 'Deltagere', v: n === 1 ? 'Solo' : `${n} i alt — ${mix}` },
    { k: 'Afvikling', v: n === 1 ? 'Alt arbejde er dit' : n === 2 ? 'You go, I go foretrækkes' : 'Teamrotation med stationer' },
    { k: 'Niveau', v: levelName },
    { k: 'Retning', v: `${focusName} · conditioning ${g.condition}, styrke ${g.strength}` },
    { k: 'Udstyr', v: `${g.equipment.filter((e) => e !== 'bodyweight').length} typer valgt` },
    {
      k: 'Hensyn',
      v: (careNames.length ? careNames.join(', ') : 'Ingen')
        + (g.included.length ? ` · ${g.included.length} ønsket` : '')
        + (g.excluded.length ? ` · ${g.excluded.length} fravalgt` : ''),
    },
  ];
}

export function Generator({
  gen, patch, step, steps, current, isDesktop, onBack, onGenerate,
}: {
  gen: GenDraft;
  patch: (p: Partial<GenDraft>) => void;
  step: number;
  steps: GenStep[];
  current: GenStep;
  isDesktop: boolean;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const [title, help] = STEP_COPY[current];
  const rows = summaryRows(gen);

  const toggle = <T,>(list: T[], value: T): T[] =>
    (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
      <StepHeader
        onBack={onBack}
        value={(step + 1) / steps.length}
        counter={`${step + 1}/${steps.length}`}
        maxWidth={1120}
      />

      <div
        style={{
          display: 'grid', gap: 34, alignItems: 'start',
          gridTemplateColumns: isDesktop ? 'minmax(0,1fr) 340px' : 'minmax(0,1fr)',
        }}
      >
        <div style={{ maxWidth: 660, minWidth: 0 }}>
          <h1 className="ww-h1" style={{ marginBottom: 10 }}>{title}</h1>
          <p className="ww-help">{help}</p>

          {current === 'time' && <TimeStep gen={gen} patch={patch} />}
          {current === 'people' && <PeopleStep gen={gen} patch={patch} />}
          {current === 'weight' && <WeightStep gen={gen} patch={patch} />}
          {current === 'level' && <LevelStep gen={gen} patch={patch} />}
          {current === 'direction' && <DirectionStep gen={gen} patch={patch} toggle={toggle} />}
          {current === 'equip' && <EquipStep gen={gen} patch={patch} toggle={toggle} />}
          {current === 'summary' && <SummaryList rows={rows} />}
        </div>

        {isDesktop ? (
          <aside className="ww-card" style={{ position: 'sticky', top: 88, padding: 22 }}>
            <Kicker style={{ marginBottom: 16 }}>Jeres session</Kicker>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {rows.map((r) => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: 'var(--ww-text-3)', whiteSpace: 'nowrap' }}>{r.k}</span>
                  <span style={{ fontSize: 14, textAlign: 'right' }}>{r.v}</span>
                </div>
              ))}
            </div>
            <button type="button" className="ww-btn ww-btn--primary ww-btn--lg ww-btn--block" onClick={onGenerate}>
              <Glyph name="bolt" size={20} />
              Generér workout
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function SummaryList({ rows }: { rows: SummaryRow[] }) {
  return (
    <div className="ww-card" style={{ overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div
          key={r.k}
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 20, padding: '15px 18px',
            borderTop: i === 0 ? 'none' : '1px solid var(--ww-line)',
          }}
        >
          <span className="ww-kicker" style={{ whiteSpace: 'nowrap' }}>{r.k}</span>
          <span style={{ fontSize: 15, textAlign: 'right', lineHeight: 1.45 }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Trin ---------- */

type StepProps = { gen: GenDraft; patch: (p: Partial<GenDraft>) => void };
type ToggleFn = <T,>(list: T[], value: T) => T[];

function TimeStep({ gen, patch }: StepProps) {
  return (
    <>
      <div className="ww-wrap">
        {TIME_OPTIONS.map((m) => (
          <Chip key={m} on={gen.minutes === m} onClick={() => patch({ minutes: m })} style={{ minWidth: 74 }}>
            {m} min
          </Chip>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, color: 'var(--ww-text-2)' }}>Eller vælg selv</span>
        <button
          type="button"
          className="ww-step-btn"
          aria-label="Færre minutter"
          onClick={() => patch({ minutes: Math.max(8, gen.minutes - 5) })}
        >
          −
        </button>
        <span className="ww-num" style={{ fontSize: 20, fontWeight: 700, minWidth: 80, textAlign: 'center' }}>
          {gen.minutes} min
        </span>
        <button
          type="button"
          className="ww-step-btn"
          aria-label="Flere minutter"
          onClick={() => patch({ minutes: Math.min(120, gen.minutes + 5) })}
        >
          +
        </button>
      </div>
      <div className="ww-wrap" style={{ marginTop: 22 }}>
        <Chip on={gen.warmup} onClick={() => patch({ warmup: !gen.warmup })}>Opvarmning</Chip>
        <Chip on={gen.cooldown} onClick={() => patch({ cooldown: !gen.cooldown })}>Cooldown</Chip>
      </div>
      <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
        Opvarmningen bygges ud fra selve workouten og fylder 5–10 minutter inden for den tid,
        du vælger her. Den lægges ikke oveni.
      </p>
    </>
  );
}

function PeopleStep({ gen, patch }: StepProps) {
  const total = participantsOf(gen);
  const bump = (key: 'men' | 'women' | 'neutral', delta: number): void => {
    const next = Math.max(0, gen[key] + delta);
    if (delta > 0 && total >= 12) return;
    if (delta < 0 && total <= 1) return;
    patch({ [key]: next });
  };

  return (
    <>
      <div className="ww-stack">
        <Counter label="Mænd" value={gen.men} onDown={() => bump('men', -1)} onUp={() => bump('men', 1)} />
        <Counter label="Kvinder" value={gen.women} onDown={() => bump('women', -1)} onUp={() => bump('women', 1)} />
        <Counter
          label="Ikke angivet"
          hint="Neutral skaleringsprofil"
          value={gen.neutral}
          onDown={() => bump('neutral', -1)}
          onUp={() => bump('neutral', 1)}
        />
      </div>

      <div
        className="ww-card"
        style={{ marginTop: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
      >
        <span style={{ fontSize: 15, color: 'var(--ww-text-2)' }}>Deltagere i alt</span>
        <span className="ww-num" style={{ fontSize: 28, fontWeight: 700 }}>{total}</span>
      </div>

      <div style={{ marginTop: 16 }}>
        <Note label={total === 1 ? 'Solo' : total === 2 ? 'Partner' : 'Hold'}>
          {total === 1
            ? 'Alle mål på listen er dine egne.'
            : total === 2
              ? 'Ved to deltagere foretrækker WHATWORK "You go, I go": én arbejder, mens den anden '
                + 'restituerer og gør stationen klar.'
              : `Med ${total} deltagere lægges der en tydelig rotation eller stationsmodel, `
                + 'så flere aldrig skal bruge den samme maskine samtidig.'}
        </Note>
      </div>
    </>
  );
}

function WeightStep({ gen, patch }: StepProps) {
  const rows: {
    key: 'M' | 'F' | 'X';
    genderLabel: string;
    avgLabel: string;
    bwField: 'bwM' | 'bwF' | 'bwX';
    weightsField: 'weightsM' | 'weightsF' | 'weightsX';
    count: number;
  }[] = [
    { key: 'M', genderLabel: 'Mand', avgLabel: 'Gennemsnit mænd', bwField: 'bwM', weightsField: 'weightsM', count: gen.men },
    { key: 'F', genderLabel: 'Kvinde', avgLabel: 'Gennemsnit kvinder', bwField: 'bwF', weightsField: 'weightsF', count: gen.women },
    { key: 'X', genderLabel: 'Ikke angivet', avgLabel: 'Gennemsnit ikke angivet', bwField: 'bwX', weightsField: 'weightsX', count: gen.neutral },
  ];
  const active = rows.filter((r) => r.count > 0);
  const solo = participantsOf(gen) === 1;
  const showIndividual = !solo && gen.individualWeights;

  const setPerson = (weightsField: 'weightsM' | 'weightsF' | 'weightsX', index: number, value: number): void => {
    const next = gen[weightsField].slice();
    next[index] = Math.max(35, Math.min(200, value));
    patch({ [weightsField]: next });
  };

  return (
    <div className="ww-stack">
      {!solo && (
        <div className="ww-wrap" style={{ marginBottom: 4 }}>
          <Chip on={!gen.individualWeights} onClick={() => patch({ individualWeights: false })}>Gennemsnit</Chip>
          <Chip on={gen.individualWeights} onClick={() => patch({ individualWeights: true })}>Individuel</Chip>
        </div>
      )}

      {!showIndividual && active.map((r) => (
        <Counter
          key={r.key}
          label={solo ? 'Din vægt' : r.avgLabel}
          hint={solo ? 'Bruges til skalering af kropsvægtsøvelser og vægte' : `${r.count} ${r.count === 1 ? 'deltager' : 'deltagere'}`}
          value={`${gen[r.bwField]} kg`}
          minWidth={72}
          onDown={() => patch({ [r.bwField]: Math.max(35, gen[r.bwField] - 1) })}
          onUp={() => patch({ [r.bwField]: Math.min(200, gen[r.bwField] + 1) })}
        />
      ))}

      {showIndividual && active.flatMap((r) => Array.from({ length: r.count }, (_, i) => {
        const value = gen[r.weightsField][i] ?? gen[r.bwField];
        return (
          <Counter
            key={`${r.key}-${i}`}
            label={`${r.genderLabel} ${i + 1}`}
            value={`${value} kg`}
            minWidth={72}
            onDown={() => setPerson(r.weightsField, i, value - 1)}
            onUp={() => setPerson(r.weightsField, i, value + 1)}
          />
        );
      }))}

      <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
        Kropsvægten bruges kun til at foreslå belastninger. Alle kilo er programmeringsforslag —
        tilpas dem efter teknik og dagsform.
      </p>
    </div>
  );
}

/** Startpunkt for Conditioning/Styrke-skalaerne, når et fokus vælges. Brugeren kan
 * altid flytte skalaerne bagefter — det er kun et fornuftigt udgangspunkt, ikke en lås. */
const FOCUS_PRESETS: Record<FocusId, { condition: number; strength: number }> = {
  allround: { condition: 6, strength: 5 },
  pulse: { condition: 9, strength: 3 },
  heavy: { condition: 3, strength: 9 },
  legs: { condition: 5, strength: 7 },
  upper: { condition: 5, strength: 7 },
  engine: { condition: 9, strength: 2 },
  fast: { condition: 8, strength: 5 },
  long: { condition: 6, strength: 3 },
};

function LevelStep({ gen, patch }: StepProps) {
  return (
    <>
      <div className="ww-stack" style={{ marginBottom: 26 }}>
        {eng.LEVELS.map((l) => (
          <OptionRow
            key={l.id}
            name={l.name}
            desc={l.desc}
            on={gen.level === l.id}
            onClick={() => patch({ level: l.id })}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Scale label="Conditioning" value={gen.condition} onPick={(v) => patch({ condition: v })} />
        <Scale label="Styrke" value={gen.strength} onPick={(v) => patch({ strength: v })} />
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 10px' }}>Fokus</h2>
          <div className="ww-wrap">
            {eng.FOCUS_TAGS.map((f) => (
              <Chip
                key={f.id}
                on={gen.focus === f.id}
                onClick={() => patch({ focus: f.id, ...FOCUS_PRESETS[f.id] })}
                label={`${f.name}: ${f.desc}`}
              >
                {f.name}
              </Chip>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--ww-text-3)' }}>
            {eng.FOCUS_TAGS.find((f) => f.id === gen.focus)?.desc}
          </p>
        </div>
      </div>
    </>
  );
}

function Scale({ label, value, onPick }: { label: string; value: number; onPick: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 650 }}>{label}</span>
        <span className="ww-num" style={{ fontSize: 15, color: 'var(--ww-orange)', fontWeight: 650 }}>{value} / 10</span>
      </div>
      <div className="ww-scale" role="group" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`ww-scale-cell${i < value ? ' is-on' : ''}`}
            aria-label={`${label} ${i + 1} af 10`}
            aria-pressed={i < value}
            onClick={() => onPick(i + 1)}
          />
        ))}
      </div>
    </div>
  );
}

function DirectionStep({ gen, patch, toggle }: StepProps & { toggle: ToggleFn }) {
  const pickable = PICKABLE.map((id) => eng.BY_ID[id]).filter((e) => e !== undefined);

  return (
    <>
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 6px' }}>Ønskede øvelser</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--ww-text-3)', fontSize: 13.5 }}>
          Vælg det, I gerne vil have med. Generatoren tager dem med, hvis de kan afvikles forsvarligt.
        </p>
        <div className="ww-wrap">
          {pickable.map((e) => (
            <Chip
              key={`in-${e.id}`}
              on={gen.included.includes(e.id)}
              onClick={() => patch({
                included: toggle(gen.included, e.id),
                excluded: gen.excluded.filter((x) => x !== e.id),
              })}
            >
              {e.name}
            </Chip>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 6px' }}>Udelukkede øvelser</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--ww-text-3)', fontSize: 13.5 }}>
          Tryk på det, I ikke vil se i dag.
        </p>
        <div className="ww-wrap">
          {pickable.map((e) => (
            <Chip
              key={`ex-${e.id}`}
              on={gen.excluded.includes(e.id)}
              onClick={() => patch({
                excluded: toggle(gen.excluded, e.id),
                included: gen.included.filter((x) => x !== e.id),
              })}
            >
              {e.name}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 6px' }}>Skånehensyn</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--ww-text-3)', fontSize: 13.5 }}>
          Øvelser, der belaster området, sorteres fra, før der vælges. WHATWORK behandler
          ikke skader og stiller ingen diagnose.
        </p>
        <div className="ww-wrap">
          {eng.CARE_AREAS.map((c) => (
            <Chip
              key={c.id}
              on={gen.care.includes(c.id)}
              onClick={() => patch({ care: toggle<CareId>(gen.care, c.id) })}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </section>
    </>
  );
}

function EquipStep({ gen, patch, toggle }: StepProps & { toggle: ToggleFn }) {
  const countable = eng.EQUIPMENT.filter((e) => e.countable && gen.equipment.includes(e.id));
  const hasBarbell = gen.equipment.includes('barbell');
  const total = participantsOf(gen);

  return (
    <>
      <div className="ww-eq-grid" style={{ marginBottom: 24 }}>
        {eng.EQUIPMENT.filter((e) => !e.always).map((e) => {
          const on = gen.equipment.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              className="ww-eq-tile"
              aria-pressed={on}
              onClick={() => patch({ equipment: toggle(gen.equipment, e.id) })}
            >
              <EquipmentIcon id={e.id} />
              <span className="ww-eq-tile__name">{e.name}</span>
              <span className="ww-eq-tile__state">{on ? 'Valgt' : 'Fra'}</span>
            </button>
          );
        })}
      </div>

      {countable.length > 0 ? (
        <section style={{ marginBottom: 24 }}>
          <Kicker style={{ marginBottom: 6 }}>Hvor mange?</Kicker>
          <p style={{ margin: '0 0 12px', color: 'var(--ww-text-3)', fontSize: 13.5 }}>
            Antallet afgør logistikken. {total > 1
              ? `${total} deltagere og én RowERG bliver til en planlagt rotation.`
              : 'Med flere maskiner kan der programmeres flere stationer.'}
          </p>
          <div className="ww-stack">
            {countable.map((e) => {
              const value = gen.counts[e.id] ?? e.def ?? 1;
              return (
                <Counter
                  key={e.id}
                  label={e.name}
                  value={value}
                  minWidth={32}
                  onDown={() => patch({ counts: { ...gen.counts, [e.id]: Math.max(1, value - 1) } })}
                  onUp={() => patch({ counts: { ...gen.counts, [e.id]: Math.min(20, value + 1) } })}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {hasBarbell ? (
        <section>
          <Kicker style={{ marginBottom: 6 }}>Skiver, I har</Kicker>
          <p style={{ margin: '0 0 12px', color: 'var(--ww-text-3)', fontSize: 13.5 }}>
            Vægtforslagene bruger kun de skivestørrelser, I faktisk har.
          </p>
          <div className="ww-wrap">
            {eng.PLATE_SIZES.map((p) => (
              <Chip
                key={p}
                on={gen.plates.includes(p)}
                onClick={() => patch({ plates: toggle(gen.plates, p) })}
              >
                {String(p).replace('.', ',')} kg
              </Chip>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
