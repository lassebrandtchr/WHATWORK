import { useMemo, useState } from 'react';
import * as eng from '../engine/index.js';
import type { CareId, Exercise, FocusId, MuscleId, MuscleRegion } from '../engine/index.js';
import { EquipmentIcon } from '../components/EquipmentIcon.js';
import { Photo } from '../components/Photo.js';
import { SurpriseButton } from '../components/SurpriseButton.js';
import { Chip, Counter, Glyph, Kicker, Note, OptionRow, StepHeader } from '../components/ui.js';
import { participantsOf } from '../state/useWhatwork.js';
import type { GenDraft, GenStep } from '../types.js';

const TIME_OPTIONS = [10, 15, 20, 25, 30, 40, 45, 60, 75, 90];

/**
 * De øvelser, der kan ønskes eller fravælges for én dag: hele kataloget minus
 * opvarmning og minus det, motoren aldrig programmerer.
 *
 * Listen var før håndplukket, og hver ny øvelse skulle huskes to steder. Nu
 * udledes den, så en øvelse er valgbar i samme sekund den findes i kataloget.
 */
export const PICKABLE: string[] = eng.EXERCISES
  .filter((e) => e.cat !== 'warmup' && e.elig !== 'disabled' && e.elig !== 'coach-only')
  .map((e) => e.id);

const STEP_COPY: Record<GenStep, [string, string]> = {
  time: ['Hvor lang tid har I?', 'Tiden dækker hele sessionen — opvarmning, hoveddel og skiftetid.'],
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
  gen, patch, step, steps, current, isDesktop, onBack, onGenerate, onSurprise,
}: {
  gen: GenDraft;
  patch: (p: Partial<GenDraft>) => void;
  step: number;
  steps: GenStep[];
  current: GenStep;
  isDesktop: boolean;
  onBack: () => void;
  onGenerate: () => void;
  onSurprise: (minutes: number) => void;
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
          {current === 'summary' && (
            <>
              <Photo
                name="gen-phone-duo"
                caption="Sådan ser skærmen ud i det sekund, Smart Mix går i gang."
                sizes="(min-width: 1024px) 660px, 100vw"
                style={{ marginBottom: 22 }}
              />
              <SummaryList rows={rows} />
            </>
          )}
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
            {/* Tiden er allerede valgt her, så overraskelsen kan gå direkte i gang. */}
            <div style={{ marginTop: 10 }}>
              <SurpriseButton compact minutes={gen.minutes} onSurprise={onSurprise} />
            </div>
            <Photo
              name="gen-phone-solo"
              frame="portrait"
              sizes="296px"
              style={{ marginTop: 18 }}
            />
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
      </div>
      <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
        Opvarmningen bygges ud fra selve workouten og fylder altid 10–12 minutter inden for den
        tid, du vælger her. Den lægges ikke oveni.
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

      <Photo
        name="gen-phone-par"
        frame="portrait"
        sizes="(min-width: 640px) 340px, 100vw"
        style={{ marginTop: 22, maxWidth: 340 }}
      />
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

/* ---------- Øvelsesvælger ---------- */

/**
 * Filterværdien i dropdownen: hele kataloget, én region eller én muskelgruppe.
 * Regionerne får et præfiks, så de aldrig kan forveksles med et gruppe-id.
 */
type MuscleFilter = 'all' | MuscleId | `region:${MuscleRegion}`;

/**
 * Folder dansk ned til noget, en søgestreng kan sammenlignes på: æøå bliver til
 * ae/oe/aa, accenter falder væk. Så finder "laar" også "lår", og "generer"
 * finder "generér".
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const muscleNames = (e: Exercise): string[] =>
  e.mus.map((m) => eng.MUSCLE_BY_ID[m]?.name ?? m);

const equipmentNames = (e: Exercise): string[] => e.eq
  .filter((id) => id !== 'bodyweight')
  .map((id) => eng.EQUIPMENT_BY_ID[id]?.name ?? id);

/** "Air Runner · Air Runner" hjælper ingen — udstyr, der allerede står i navnet, ryger ud. */
const extraEquipment = (e: Exercise): string[] => {
  const name = fold(e.name);
  return equipmentNames(e).filter((eq) => !name.includes(fold(eq)));
};

/** Alt, en søgning må ramme. Teknikcuen holdes udenfor — den giver kun støj. */
const haystack = (e: Exercise): string =>
  fold([e.name, e.id, ...muscleNames(e), ...equipmentNames(e)].join(' '));

interface PickableExercise { ex: Exercise; search: string; meta: string }

/** Kataloget bygges én gang — det ændrer sig ikke i appens levetid. */
const CATALOG: PickableExercise[] = PICKABLE
  .map((id) => eng.BY_ID[id])
  .filter((e): e is Exercise => e !== undefined)
  .map((ex) => ({
    ex,
    search: haystack(ex),
    meta: [...muscleNames(ex), ...extraEquipment(ex)].join(' · '),
  }))
  .sort((a, b) => a.ex.name.localeCompare(b.ex.name, 'da'));

function matchesFilter(ex: Exercise, filter: MuscleFilter): boolean {
  if (filter === 'all') return true;
  if (filter.startsWith('region:')) {
    const region = filter.slice('region:'.length) as MuscleRegion;
    return ex.mus.some((m) => eng.MUSCLE_BY_ID[m]?.region === region);
  }
  return ex.mus.includes(filter as MuscleId);
}

function ExercisePicker({ gen, patch, toggle }: StepProps & { toggle: ToggleFn }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MuscleFilter>('all');

  const needle = fold(query.trim());
  const results = useMemo(
    () => CATALOG.filter((c) => matchesFilter(c.ex, filter) && (!needle || c.search.includes(needle))),
    [needle, filter],
  );

  const want = (id: string): void => patch({
    included: toggle(gen.included, id),
    excluded: gen.excluded.filter((x) => x !== id),
  });
  const skip = (id: string): void => patch({
    excluded: toggle(gen.excluded, id),
    included: gen.included.filter((x) => x !== id),
  });

  const chosen = (ids: string[]): Exercise[] =>
    ids.map((id) => eng.BY_ID[id]).filter((e): e is Exercise => e !== undefined);

  const filtered = filter !== 'all' || needle.length > 0;

  return (
    <>
      <div className="ww-picker__controls">
        <div className="ww-picker__search">
          <span className="ww-picker__search-icon" aria-hidden="true">
            <Glyph name="search" size={18} />
          </span>
          <input
            className="ww-input ww-picker__field"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg efter en øvelse, fx curl eller squat"
            aria-label="Søg efter en øvelse"
          />
        </div>
        <label className="ww-picker__filter">
          <span className="ww-sr-only">Vis kun én muskelgruppe</span>
          <select
            className="ww-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as MuscleFilter)}
          >
            <option value="all">Alle muskelgrupper</option>
            {eng.MUSCLE_REGIONS.map((r) => (
              <optgroup key={r.id} label={r.name}>
                <option value={`region:${r.id}`}>{r.allName}</option>
                {eng.MUSCLES_IN_REGION(r.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <p className="ww-picker__count" role="status">
        {results.length === CATALOG.length
          ? `${CATALOG.length} øvelser i kataloget`
          : `${results.length} af ${CATALOG.length} øvelser`}
      </p>

      {results.length > 0 ? (
        <ul className="ww-picker__list">
          {results.map(({ ex, meta }) => {
            const isIn = gen.included.includes(ex.id);
            const isEx = gen.excluded.includes(ex.id);
            return (
              <li key={ex.id} className="ww-picker__row">
                <span className="ww-picker__label">
                  <span className="ww-picker__name">{ex.name}</span>
                  <span className="ww-picker__meta">{meta || 'Kropsvægt'}</span>
                </span>
                <span className="ww-picker__actions">
                  <button
                    type="button"
                    className="ww-pick-btn"
                    aria-pressed={isIn}
                    aria-label={`Ønsk ${ex.name}`}
                    onClick={() => want(ex.id)}
                  >
                    Ønsket
                  </button>
                  <button
                    type="button"
                    className="ww-pick-btn ww-pick-btn--off"
                    aria-pressed={isEx}
                    aria-label={`Fravælg ${ex.name}`}
                    onClick={() => skip(ex.id)}
                  >
                    Fravalgt
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="ww-card" style={{ padding: '22px 18px' }}>
          <p style={{ margin: '0 0 14px', color: 'var(--ww-text-2)', fontSize: 15 }}>
            Ingen øvelser matcher søgningen.
          </p>
          <button
            type="button"
            className="ww-btn"
            onClick={() => { setQuery(''); setFilter('all'); }}
          >
            Ryd søgning og filter
          </button>
        </div>
      )}

      {filtered && (gen.included.length > 0 || gen.excluded.length > 0) ? (
        <p className="ww-picker__hint">
          Valgene nedenfor gælder stadig, selvom de er filtreret væk fra listen.
        </p>
      ) : null}

      {gen.included.length > 0 ? (
        <section className="ww-picker__chosen">
          <Kicker style={{ marginBottom: 10 }}>Ønsket ({gen.included.length})</Kicker>
          <div className="ww-wrap">
            {chosen(gen.included).map((e) => (
              <Chip key={`in-${e.id}`} on onClick={() => want(e.id)} label={`Fjern ${e.name} fra ønskede`}>
                {e.name}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      {gen.excluded.length > 0 ? (
        <section className="ww-picker__chosen">
          <Kicker style={{ marginBottom: 10 }}>Fravalgt ({gen.excluded.length})</Kicker>
          <div className="ww-wrap">
            {chosen(gen.excluded).map((e) => (
              <Chip key={`ex-${e.id}`} on tone="danger" onClick={() => skip(e.id)} label={`Fjern ${e.name} fra fravalgte`}>
                {e.name}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function DirectionStep({ gen, patch, toggle }: StepProps & { toggle: ToggleFn }) {
  return (
    <>
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 6px' }}>Ønskede og fravalgte øvelser</h2>
        <p style={{ margin: '0 0 14px', color: 'var(--ww-text-3)', fontSize: 13.5 }}>
          Søg, eller filtrér på muskelgruppe. Ønskede øvelser lægges ind, hvis de passer
          til resten af valgene — fravalgte ses ikke i dag.
        </p>
        <ExercisePicker gen={gen} patch={patch} toggle={toggle} />
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
