import { useState } from 'react';
import * as eng from '../engine/index.js';
import type { Block, Exercise, LoadKind, LoadPrescription, Movement, Workout } from '../engine/index.js';
import { Photo } from '../components/Photo.js';
import { Glyph, Kicker, Meter, Note } from '../components/ui.js';
import { groupByProfile } from '../lib/format.js';
import type { UserProfile } from '../types.js';

/** Blokkens overskrift afhænger af, om der også er en styrkedel. */
function blockLabel(block: Block, hasStrength: boolean): string {
  switch (block.kind) {
    case 'warmup': return 'Opvarmning';
    case 'strength': return 'Del 1 — Styrke';
    case 'conditioning': return hasStrength ? 'Del 2 — Kondition' : 'Hovedworkout';
    default: return '';
  }
}

export function ResultError({ message, onAdjust }: { message: string; onAdjust: () => void }) {
  return (
    <div className="ww-card" style={{ padding: 24, borderColor: 'var(--ww-red)' }}>
      <Kicker style={{ color: 'var(--ww-red-soft)', marginBottom: 10 }}>Kunne ikke bygges</Kicker>
      <p style={{ margin: '0 0 20px', fontSize: 17, lineHeight: 1.5 }}>{message}</p>
      <button type="button" className="ww-btn ww-btn--lg" onClick={onAdjust}>Tilpas valgene</button>
    </div>
  );
}

export function Result({
  workout, profile, saved, isFavorite, aiNotice, scale,
  onBack, onEasier, onHarder, onRegenerate, onSave, onFavorite,
}: {
  workout: Workout;
  profile: UserProfile;
  saved: boolean;
  isFavorite: boolean;
  aiNotice: string | null;
  /** Diffen fra seneste skalering. `null` når workouten ikke er justeret. */
  scale: {
    changes: eng.ScaleChange[];
    atLimit: boolean;
    preserved: string;
    direction: 'easier' | 'harder';
  } | null;
  onBack: () => void;
  onEasier: () => void;
  onHarder: () => void;
  onRegenerate: () => void;
  onSave: () => void;
  onFavorite: () => void;
}) {
  const hasStrength = workout.blocks.some((b) => b.kind === 'strength');
  const info = eng.FORMATS[workout.format];
  const main = workout.blocks.find((b) => b.kind === 'conditioning') ?? workout.blocks.find((b) => b.kind === 'strength');
  const partner = workout.partner;

  // Live "hvad hvis jeg løfter mere/mindre"-justeringer — ikke en del af den gemte
  // workout eller historikken, nulstillet hver gang en ny workout åbnes. Nulstilles
  // under render (React's anbefalede mønster for "state afhænger af et prop-skift"),
  // ikke i en effekt, så det ikke tæller som en synkron setState i en effekt-krop.
  const [overrides, setOverrides] = useState<Record<string, LoadPrescription>>({});
  const [overridesFor, setOverridesFor] = useState(workout.id);
  if (workout.id !== overridesFor) {
    setOverridesFor(workout.id);
    setOverrides({});
  }

  const adjustLoad = (key: string, ex: Exercise, kind: LoadKind, current: LoadPrescription, dir: 1 | -1): void => {
    const next = eng.stepLoad(ex, kind, current.eachKg, dir, {
      plates: profile.plates, bars: profile.bars, sandbags: profile.sandbags,
    });
    setOverrides((o) => ({ ...o, [key]: next }));
  };

  return (
    <div className="ww-rise" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', maxWidth: 860 }}>
      <button type="button" className="ww-btn ww-btn--ghost" style={{ marginBottom: 16, paddingLeft: 8 }} onClick={onBack}>
        <Glyph name="back" size={18} />
        Tilbage
      </button>

      <header style={{ marginBottom: 24 }}>
        <Kicker accent style={{ marginBottom: 10 }}>Workout</Kicker>
        <h1 className="ww-display" style={{ marginBottom: 12 }}>{workout.title}</h1>
        <div className="ww-wrap" style={{ gap: 6, marginBottom: 14 }}>
          <span className="ww-badge">{workout.estimatedMinutes} min i alt</span>
          <span className="ww-badge">
            {workout.participants === 1 ? 'Solo' : `${workout.participants} deltagere`}
          </span>
          {partner.mode === 'solo' ? null : <span className="ww-badge">{partner.title}</span>}
        </div>
        {info ? <p className="ww-lede" style={{ maxWidth: '60ch' }}>{info.da}</p> : null}
      </header>

      <Photo
        name="sandbag-lunge"
        sizes="(min-width: 1024px) 860px, 100vw"
        style={{ marginBottom: 26 }}
      />

      {aiNotice ? (
        <div style={{ marginBottom: 18 }}>
          <Note label="AI Mix" tone="quiet">{aiNotice}</Note>
        </div>
      ) : null}

      {/* Arbejdsmåde, pause og skift */}
      <section aria-labelledby="ww-protocol" style={{ marginBottom: 22 }}>
        <h2 id="ww-protocol" className="ww-kicker ww-kicker--accent" style={{ marginBottom: 12 }}>Sådan afvikles den</h2>
        <div className="ww-card" style={{ padding: '18px 20px' }}>
          <dl style={{ margin: 0, display: 'grid', gap: 12 }}>
            <ProtocolRow k="Hvem arbejder" v={partner.working} />
            <ProtocolRow k="Hvem restituerer" v={partner.resting} />
            <ProtocolRow k="Der skiftes" v={partner.switchOn} />
            <ProtocolRow k="Reel pause" v={partner.realRest ? 'Ja — den ventende hviler.' : 'Nej — der arbejdes videre på en anden station.'} />
            <ProtocolRow
              k="Næste øvelse"
              v={partner.nextStartsImmediately ? 'Starter direkte, når begge har været igennem.' : 'Starter først efter den planlagte pause.'}
            />
            <ProtocolRow
              k="Arbejdet"
              v={partner.workShare === 'shared' ? 'Deles mellem deltagerne — tallene er jeres samlede antal.' : 'Er per person — hver deltager tager de viste tal.'}
            />
          </dl>
          {partner.lines.length ? (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {partner.lines.map((line) => (
                <p key={line} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ww-body)' }}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Blokke — hver sin tydeligt adskilte boks, farvet efter opvarmning/hoveddel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
        {workout.blocks.map((block) => (
          <BlockSection
            key={block.id}
            block={block}
            label={blockLabel(block, hasStrength)}
            participants={workout.participants}
            overrides={overrides}
            onAdjust={adjustLoad}
          />
        ))}
      </div>

      {/* Udstyrslogistik */}
      {partner.logistics.length ? (
        <section aria-labelledby="ww-logistics" style={{ marginBottom: 22 }}>
          <h2 id="ww-logistics" className="ww-kicker ww-kicker--accent" style={{ marginBottom: 12 }}>Udstyrslogistik</h2>
          <div className="ww-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {partner.logistics.map((line) => (
              <p key={line} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ww-body)' }}>{line}</p>
            ))}
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ww-text-3)' }}>
              Regn med op til {Math.max(5, ...(main?.movements ?? []).map((m) => m.transitionSec))} sekunders
              skiftetid mellem stationerne. Den er lagt ind i tidsbudgettet.
            </p>
          </div>
        </section>
      ) : null}

      {/* Hvorfor denne workout */}
      <section aria-labelledby="ww-why" style={{ marginBottom: 22 }}>
        <h2 id="ww-why" className="ww-kicker ww-kicker--accent" style={{ marginBottom: 12 }}>Hvorfor denne workout</h2>
        <div className="ww-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workout.explanation.map((line) => (
            <p key={line} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ww-body)', textWrap: 'pretty' }}>
              {line}
            </p>
          ))}
          {workout.mix.rationale ? (
            <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--ww-text-2)', fontStyle: 'italic' }}>
              AI Mix skrev: «{workout.mix.rationale}»
            </p>
          ) : null}
        </div>
      </section>

      {/* Workout-DNA */}
      <section aria-labelledby="ww-dna" style={{ marginBottom: 22 }}>
        <h2 id="ww-dna" className="ww-kicker ww-kicker--accent" style={{ marginBottom: 12 }}>Workout-DNA</h2>
        <div className="ww-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {eng.DNA_AXES.map((axis) => {
              const value = workout.dna[axis.id] ?? 0;
              return (
                <div key={axis.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--ww-text-2)', width: 88, flex: 'none' }}>{axis.name}</span>
                  <span style={{ flex: 1 }}><Meter value={value} label={`${axis.name}: ${value} af 10`} /></span>
                  <span className="ww-num" style={{ fontSize: 13, color: 'var(--ww-text-3)', width: 22, textAlign: 'right' }}>
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
            Workout-DNA er et internt, forklarligt signal om, hvad workouten belaster. Det er ikke
            en måling af din krop eller din form.
          </p>
        </div>
      </section>

      {/* Handlinger */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
        <button type="button" className="ww-btn ww-btn--lg" onClick={onEasier}>Gør den lettere</button>
        <button type="button" className="ww-btn ww-btn--lg" onClick={onHarder}>Gør den værre</button>
        <button type="button" className="ww-btn ww-btn--lg" onClick={onRegenerate}>Ny workout</button>
        <button type="button" className="ww-btn ww-btn--lg" onClick={onSave} disabled={saved}>
          {saved ? 'Gemt' : 'Gem'}
        </button>
        <button type="button" className="ww-btn ww-btn--lg" onClick={onFavorite} aria-pressed={isFavorite}>
          <Glyph name={isFavorite ? 'star-filled' : 'star'} size={18} />
          {isFavorite ? 'Favorit' : 'Gør til favorit'}
        </button>
      </div>

      {scale ? (
        <div style={{ marginTop: 14 }}>
          <Note
            label={scale.atLimit
              ? 'Kunne ikke justeres mere'
              : scale.direction === 'easier' ? 'Gjort lettere' : 'Gjort hårdere'}
            tone={scale.atLimit ? 'quiet' : 'accent'}
          >
            {scale.atLimit ? (
              <>
                Workouten kan ikke skaleres yderligere, uden at den bliver en anden workout.
                Vil du have noget andet, så tryk «Ny workout».
              </>
            ) : (
              <>
                {scale.preserved}
                <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>
                  {scale.changes.map((c) => (
                    <li key={c.text} style={{ marginBottom: 4 }}>{c.text}</li>
                  ))}
                </ul>
              </>
            )}
          </Note>
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <Note label="Hvad knapperne gør" tone="quiet" accent>
          «Gør den lettere» og «Gør den værre» justerer den workout, du har foran dig: samme
          format, samme øvelser og samme tidsramme, men færre eller flere gentagelser og
          lettere eller tungere vægte. Du får vist præcis, hvad der blev ændret.
          «Ny workout» er den eneste knap, der bygger noget nyt — den beholder dine valg af
          tid, deltagere, udstyr og hensyn og kører resultatet gennem den samme kontrol.
        </Note>
      </div>

      <p style={{ margin: '20px 0 0', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.65 }}>
        Alle kilo er programmeringsforslag. Tilpas til teknik og dagsform, stop ved skarp smerte
        eller utryghed, og søg faglig hjælp ved behov.
      </p>
    </div>
  );
}

function ProtocolRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <dt style={{ fontSize: 13, color: 'var(--ww-text-3)', whiteSpace: 'nowrap' }}>{k}</dt>
      <dd style={{ margin: 0, fontSize: 14.5, textAlign: 'right', flex: '1 1 60%', minWidth: '16ch' }}>{v}</dd>
    </div>
  );
}

function BlockSection({
  block, label, participants, overrides, onAdjust,
}: {
  block: Block;
  label: string;
  participants: number;
  overrides: Record<string, LoadPrescription>;
  onAdjust: (key: string, ex: Exercise, kind: LoadKind, current: LoadPrescription, dir: 1 | -1) => void;
}) {
  const accent = block.kind === 'warmup'
    ? { line: 'var(--ww-green-line)', dim: 'var(--ww-green-dim)', fg: 'var(--ww-green)' }
    : { line: 'var(--ww-red-line)', dim: 'var(--ww-red-dim)', fg: 'var(--ww-red)' };
  return (
    <section
      className="ww-card"
      style={{ padding: '22px 20px', borderColor: accent.line, background: accent.dim }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <h2 className="ww-kicker ww-kicker--accent" style={{ margin: 0 }}>{label}</h2>
        <span className="ww-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ww-green)', whiteSpace: 'nowrap' }}>
          ca. {block.minutes} min
        </span>
      </div>

      <div className="ww-h2" style={{ marginBottom: 6 }}>{block.title}</div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ww-text-2)', lineHeight: 1.55 }}>
        {block.prescription}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {block.movements.map((m, i) => (
          <MovementRow
            key={`${m.exerciseId}-${i}`}
            movement={m}
            participants={participants}
            blockId={block.id}
            index={i}
            overrides={overrides}
            onAdjust={onAdjust}
          />
        ))}
      </div>
    </section>
  );
}

function MovementRow({
  movement, participants, blockId, index, overrides, onAdjust,
}: {
  movement: Movement;
  participants: number;
  blockId: string;
  index: number;
  overrides: Record<string, LoadPrescription>;
  onAdjust: (key: string, ex: Exercise, kind: LoadKind, current: LoadPrescription, dir: 1 | -1) => void;
}) {
  const solo = participants === 1;
  const showTargets = movement.targets.some((t) => t.load) || movement.individualTargets;
  const groups = groupByProfile(movement.targets);
  const ex = eng.BY_ID[movement.exerciseId];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 0', borderTop: '1px solid var(--ww-line)' }}>
      <span style={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.01em' }}>{movement.display}</span>

      {showTargets ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map((g) => (
            <div key={g.label}>
              {!solo && groups.length > 1 ? (
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ww-text-3)', marginBottom: 4 }}>
                  {g.label}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {g.items.map((t) => {
                  const key = `${blockId}_${index}_${t.label}`;
                  const effective = overrides[key] ?? t.load;
                  return (
                    <div
                      key={t.label}
                      style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 14 }}
                    >
                      <span style={{ color: 'var(--ww-text-3)', minWidth: solo ? 0 : '9ch' }}>
                        {solo ? '' : `${t.label}:`}
                      </span>
                      <span style={{ color: 'var(--ww-orange)', fontWeight: 600 }}>
                        {movement.individualTargets ? `${t.amountText}${t.load ? ' · ' : ''}` : ''}
                      </span>
                      {effective && ex ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="ww-load-step-btn"
                            aria-label={`${movement.name}: mindre vægt til ${t.label}`}
                            onClick={() => onAdjust(key, ex, effective.kind, effective, -1)}
                          >
                            −
                          </button>
                          <span style={{ color: 'var(--ww-orange)', fontWeight: 600 }}>{effective.text}</span>
                          <button
                            type="button"
                            className="ww-load-step-btn"
                            aria-label={`${movement.name}: mere vægt til ${t.label}`}
                            onClick={() => onAdjust(key, ex, effective.kind, effective, 1)}
                          >
                            +
                          </button>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <span style={{ fontSize: 13.5, color: 'var(--ww-text-2)', lineHeight: 1.55 }}>{movement.cue}</span>
    </div>
  );
}
