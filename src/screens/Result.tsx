import * as eng from '../engine/index.js';
import type { Block, Movement, Workout } from '../engine/index.js';
import { Glyph, Kicker, Meter, Note } from '../components/ui.js';
import { groupByProfile } from '../lib/format.js';

/** Blokkens overskrift afhænger af, om der også er en styrkedel. */
function blockLabel(block: Block, hasStrength: boolean): string {
  switch (block.kind) {
    case 'warmup': return 'Opvarmning';
    case 'strength': return 'Del 1 — Styrke';
    case 'conditioning': return hasStrength ? 'Del 2 — Conditioning' : 'Hoveddel';
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
  workout, saved, isFavorite, aiNotice,
  onBack, onEasier, onHarder, onRegenerate, onSave, onFavorite,
}: {
  workout: Workout;
  saved: boolean;
  isFavorite: boolean;
  aiNotice: string | null;
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

      {aiNotice ? (
        <div style={{ marginBottom: 18 }}>
          <Note label="AI Mix" tone="quiet">{aiNotice}</Note>
        </div>
      ) : null}

      {/* Arbejdsmåde, pause og skift */}
      <section aria-labelledby="ww-protocol" style={{ marginBottom: 22 }}>
        <h2 id="ww-protocol" className="ww-kicker" style={{ marginBottom: 12 }}>Sådan afvikles den</h2>
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
          />
        ))}
      </div>

      {/* Udstyrslogistik */}
      {partner.logistics.length ? (
        <section aria-labelledby="ww-logistics" style={{ marginBottom: 22 }}>
          <h2 id="ww-logistics" className="ww-kicker" style={{ marginBottom: 12 }}>Udstyrslogistik</h2>
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
        <h2 id="ww-why" className="ww-kicker" style={{ marginBottom: 12 }}>Hvorfor denne workout</h2>
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
        <h2 id="ww-dna" className="ww-kicker" style={{ marginBottom: 12 }}>Workout-DNA</h2>
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

      <div style={{ marginTop: 14 }}>
        <Note label="Hvad knapperne gør" tone="quiet">
          «Gør den lettere» skruer conditioning og styrke to trin ned, «Gør den værre» skruer op.
          «Ny workout» henter en ny variation. Alle tre beholder dine valg af tid, deltagere,
          udstyr og hensyn, genberegner kilo og tid og kører workouten gennem den samme kontrol —
          et ugyldigt resultat bliver aldrig vist.
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
  block, label, participants,
}: {
  block: Block;
  label: string;
  participants: number;
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
        <h2 className="ww-kicker" style={{ margin: 0, color: accent.fg }}>{label}</h2>
        <span className="ww-num" style={{ fontSize: 13, color: 'var(--ww-text-3)', whiteSpace: 'nowrap' }}>
          ca. {block.minutes} min
        </span>
      </div>

      <div className="ww-h2" style={{ marginBottom: 6 }}>{block.title}</div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ww-text-2)', lineHeight: 1.55 }}>
        {block.prescription}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {block.movements.map((m, i) => (
          <MovementRow key={`${m.exerciseId}-${i}`} movement={m} participants={participants} />
        ))}
      </div>
    </section>
  );
}

function MovementRow({ movement, participants }: { movement: Movement; participants: number }) {
  const solo = participants === 1;
  const showTargets = movement.targets.some((t) => t.load) || movement.individualTargets;
  const groups = groupByProfile(movement.targets);

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
                {g.items.map((t) => (
                  <div
                    key={t.label}
                    style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 14 }}
                  >
                    <span style={{ color: 'var(--ww-text-3)', minWidth: solo ? 0 : '9ch' }}>
                      {solo ? '' : `${t.label}:`}
                    </span>
                    <span style={{ color: 'var(--ww-orange)', fontWeight: 600 }}>
                      {movement.individualTargets ? `${t.amountText}${t.load ? ' · ' : ''}` : ''}
                      {t.load?.text ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <span style={{ fontSize: 13.5, color: 'var(--ww-text-2)', lineHeight: 1.55 }}>{movement.cue}</span>
    </div>
  );
}
