import * as eng from '../engine/index.js';
import type { Profile } from '../engine/index.js';
import { EquipmentIcon } from '../components/EquipmentIcon.js';
import { OptionRow, StepHeader } from '../components/ui.js';
import { ONB_STEPS } from '../state/useWhatwork.js';
import type { UserProfile } from '../types.js';

const STEPS = [
  {
    title: 'Hvilket niveau?',
    help: 'Niveau er en programmeringsparameter — ikke en dom. Du kan ændre det når som helst.',
  },
  {
    title: 'Skaleringsprofil',
    help: 'Bruges kun som udgangspunkt for vægtforslag. Du kan altid tilpasse den enkelte belastning.',
  },
  {
    title: 'Din kropsvægt',
    help: 'Valgfrit. Den forklarer, hvordan kropsvægtsøvelser og vægte skaleres til dig.',
  },
  {
    title: 'Hvad har du at arbejde med?',
    help: 'Alt er slået til. Fravælg det, du ikke har adgang til — så holder generatoren sig til resten.',
  },
] as const;

const SEXES: { id: Profile; name: string; desc: string }[] = [
  { id: 'm', name: 'Mand', desc: 'Bruger mandeprofilens vægtforslag' },
  { id: 'f', name: 'Kvinde', desc: 'Bruger kvindeprofilens vægtforslag' },
  { id: 'x', name: 'Ikke angivet', desc: 'Bruger en neutral profil midt imellem' },
];

export function Onboarding({
  step, profile, onPatch, onNext, onBack,
}: {
  step: number;
  profile: UserProfile;
  onPatch: (patch: Partial<UserProfile>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const current = STEPS[Math.min(step, STEPS.length - 1)] ?? STEPS[0];
  const equipment = profile.equipment ?? [];

  const toggleEquipment = (id: string): void => {
    onPatch({
      equipment: equipment.includes(id) ? equipment.filter((x) => x !== id) : [...equipment, id],
    });
  };

  return (
    <main
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: 'calc(env(safe-area-inset-top) + 20px) 20px calc(env(safe-area-inset-bottom) + 20px)',
        maxWidth: 620, margin: '0 auto', width: '100%',
      }}
    >
      <StepHeader onBack={onBack} value={(step + 1) / ONB_STEPS} counter={`${step + 1}/${ONB_STEPS}`} />

      <h1 className="ww-h1" style={{ marginBottom: 10 }}>{current.title}</h1>
      <p className="ww-help">{current.help}</p>

      <div style={{ flex: 1 }}>
        {step === 0 && (
          <div className="ww-stack">
            {eng.LEVELS.map((level) => (
              <OptionRow
                key={level.id}
                name={level.name}
                desc={level.desc}
                on={profile.level === level.id}
                onClick={() => onPatch({ level: level.id })}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="ww-stack">
            {SEXES.map((s) => (
              <OptionRow
                key={s.id}
                name={s.name}
                desc={s.desc}
                on={profile.sex === s.id}
                onClick={() => onPatch({ sex: s.id })}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
              <span className="ww-num" style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em' }}>
                {profile.bodyweight}
              </span>
              <span style={{ fontSize: 20, color: 'var(--ww-text-2)' }}>kg</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="ww-step-btn ww-step-btn--wide"
                aria-label="Kropsvægt: ét kilo mindre"
                onClick={() => onPatch({ bodyweight: Math.max(35, profile.bodyweight - 1) })}
              >
                −
              </button>
              <button
                type="button"
                className="ww-step-btn ww-step-btn--wide"
                aria-label="Kropsvægt: ét kilo mere"
                onClick={() => onPatch({ bodyweight: Math.min(180, profile.bodyweight + 1) })}
              >
                +
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="ww-eq-grid">
            {eng.EQUIPMENT.filter((e) => !e.always).map((e) => {
              const on = equipment.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  className="ww-eq-tile"
                  aria-pressed={on}
                  onClick={() => toggleEquipment(e.id)}
                >
                  <EquipmentIcon id={e.id} />
                  <span className="ww-eq-tile__name">{e.name}</span>
                  <span className="ww-eq-tile__state">{on ? 'Valgt' : 'Fra'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, paddingTop: 24 }}>
        <button type="button" className="ww-btn ww-btn--ghost ww-btn--lg" onClick={onNext}>Spring over</button>
        <button type="button" className="ww-btn ww-btn--primary ww-btn--lg ww-btn--block" onClick={onNext}>
          {step === ONB_STEPS - 1 ? 'Start WHATWORK?' : 'Videre'}
        </button>
      </div>
    </main>
  );
}
