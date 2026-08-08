import * as eng from '../engine/index.js';
import { EquipmentIcon } from '../components/EquipmentIcon.js';
import { Chip, Counter, Note, PageHeader } from '../components/ui.js';
import type { UserProfile } from '../types.js';

export function Equipment({
  profile, onPatch,
}: {
  profile: UserProfile;
  onPatch: (patch: Partial<UserProfile>) => void;
}) {
  const equipment = profile.equipment ?? [];
  const countable = eng.EQUIPMENT.filter((e) => e.countable && equipment.includes(e.id));

  const toggle = (id: string): void => {
    onPatch({ equipment: equipment.includes(id) ? equipment.filter((x) => x !== id) : [...equipment, id] });
  };

  const togglePlate = (kg: number): void => {
    onPatch({ plates: profile.plates.includes(kg) ? profile.plates.filter((x) => x !== kg) : [...profile.plates, kg] });
  };

  const toggleBar = (kg: number): void => {
    const next = profile.bars.includes(kg) ? profile.bars.filter((x) => x !== kg) : [...profile.bars, kg];
    onPatch({ bars: next.length ? next : [20] });
  };

  const toggleSandbag = (kg: number): void => {
    const next = profile.sandbags.includes(kg)
      ? profile.sandbags.filter((x) => x !== kg)
      : [...profile.sandbags, kg];
    onPatch({ sandbags: next.length ? next : [20] });
  };

  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 860 }}>
      <PageHeader
        kicker="Salen"
        title="Udstyr"
        lede="Det, du sætter her, er udgangspunktet hver gang du åbner generatoren. Alt relevant er slået til — fravælg det, du ikke har."
      />

      <section aria-labelledby="ww-eq-types" style={{ marginBottom: 30 }}>
        <h2 id="ww-eq-types" className="ww-kicker" style={{ marginBottom: 12 }}>Redskaber</h2>
        <div className="ww-eq-grid">
          {eng.EQUIPMENT.filter((e) => !e.always).map((e) => {
            const on = equipment.includes(e.id);
            return (
              <button key={e.id} type="button" className="ww-eq-tile" aria-pressed={on} onClick={() => toggle(e.id)}>
                <EquipmentIcon id={e.id} />
                <span className="ww-eq-tile__name">{e.name}</span>
                <span className="ww-eq-tile__state">{on ? 'Valgt' : 'Fra'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {countable.length ? (
        <section aria-labelledby="ww-eq-counts" style={{ marginBottom: 30 }}>
          <h2 id="ww-eq-counts" className="ww-kicker" style={{ marginBottom: 6 }}>Antal stationer</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
            Antallet afgør, om flere kan arbejde samtidig, eller om der skal lægges en rotation.
          </p>
          <div className="ww-stack">
            {countable.map((e) => {
              const value = profile.counts[e.id] ?? e.def ?? 1;
              return (
                <Counter
                  key={e.id}
                  label={e.name}
                  hint={e.hint}
                  value={value}
                  minWidth={32}
                  onDown={() => onPatch({ counts: { ...profile.counts, [e.id]: Math.max(1, value - 1) } })}
                  onUp={() => onPatch({ counts: { ...profile.counts, [e.id]: Math.min(20, value + 1) } })}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="ww-plates" style={{ marginBottom: 30 }}>
        <h2 id="ww-plates" className="ww-kicker" style={{ marginBottom: 6 }}>Skiver</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
          Vægtforslag til vægtstang bruger kun de størrelser, du markerer her.
        </p>
        <div className="ww-wrap" style={{ marginBottom: 20 }}>
          {eng.PLATE_SIZES.map((p) => (
            <Chip key={p} on={profile.plates.includes(p)} onClick={() => togglePlate(p)}>
              {String(p).replace('.', ',')} kg
            </Chip>
          ))}
        </div>

        <h2 className="ww-kicker" style={{ marginBottom: 6 }}>Stænger</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
          Den tungeste stang, der passer under forslaget, bliver valgt.
        </p>
        <div className="ww-wrap" style={{ marginBottom: 20 }}>
          {eng.BAR_SIZES.map((b) => (
            <Chip key={b} on={profile.bars.includes(b)} onClick={() => toggleBar(b)}>{b} kg</Chip>
          ))}
        </div>

        <h2 className="ww-kicker" style={{ marginBottom: 6 }}>Sandbag-vægte</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
          De vægte, du markerer her, er dem motoren vælger imellem — nærmest din
          foreslåede belastning, justeret efter køn og niveau.
        </p>
        <div className="ww-wrap">
          {eng.SANDBAG_SIZES.map((kg) => (
            <Chip key={kg} on={profile.sandbags.includes(kg)} onClick={() => toggleSandbag(kg)}>
              {kg} kg
            </Chip>
          ))}
        </div>
      </section>

      <Note label="Sådan bruges det" tone="quiet">
        Et vægtforslag skrives altid ud som samlet vægt, stangens vægt og hvilke skiver der skal
        på hver side — for eksempel «50 kg i alt — 20 kg stang + 15 kg på hver side». Kan vægten
        ikke rammes præcist med dine skiver, viser appen den vægt, stangen faktisk kommer til at veje.
      </Note>
    </div>
  );
}
