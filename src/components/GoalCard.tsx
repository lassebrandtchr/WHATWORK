import { useEffect, useRef, useState } from 'react';
import { EquipmentIcon } from './EquipmentIcon.js';
import { Glyph } from './ui.js';

/** Varigheden af spring-transitionen på ikonerne — CSS'ens transition/animation-tid
 * skal matche præcis, ellers venter timeouten enten for kort eller for længe. */
const SHUFFLE_MS = 460;

/**
 * Hvert mål har sin egen farve og sit eget udstyrssæt — seks stykker, der
 * peger direkte på den type træning, målet bygger. Ingen to mål deler samme sæt.
 */
const ALLROUND_VISUAL = { color: 'orange', icons: ['kettlebell', 'rower', 'skierg', 'run', 'rings', 'jumprope'] };

const GOAL_VISUALS: Record<string, { color: string; icons: string[] }> = {
  allround: ALLROUND_VISUAL,
  strength_cond: { color: 'strength', icons: ['barbell', 'plates', 'bench', 'squatrack', 'airrunner', 'stopwatch'] },
  engine: { color: 'engine', icons: ['assaultbike', 'skierg', 'rower', 'track', 'heartrate', 'intervaltimer'] },
  legs: { color: 'legs', icons: ['barbell', 'squatrack', 'platform', 'dumbbell', 'lunge', 'legstrength'] },
  upper: { color: 'upper', icons: ['bench', 'dumbbell', 'pullupbar', 'barbell', 'dipbars', 'shoulderpress'] },
};

export function GoalCard({
  id, name, desc, on, onClick,
}: {
  id: string;
  name: string;
  desc: string;
  on: boolean;
  onClick: () => void;
}) {
  const visual = GOAL_VISUALS[id] ?? ALLROUND_VISUAL;
  // Samme seks redskaber gentaget i to lag ved forskellige størrelser — så kortet
  // føles fyldt af symboler uden at skulle opfinde flere, mindre genkendelige ikoner.
  const renderIcons = [...visual.icons, ...visual.icons];
  const [shuffling, setShuffling] = useState(false);
  const wasOn = useRef(on);

  // Ikonerne glider til en ny opstilling, når kortet lige er blevet valgt —
  // ikke ved hvert render, kun ved selve overgangen fra fra- til tilvalgt.
  useEffect(() => {
    if (on && !wasOn.current) {
      setShuffling(true);
      const t = setTimeout(() => setShuffling(false), SHUFFLE_MS);
      wasOn.current = on;
      return () => clearTimeout(t);
    }
    wasOn.current = on;
    return undefined;
  }, [on]);

  return (
    <button
      type="button"
      className={`ww-goal-card ww-goal-card--${visual.color}${on ? ' is-on' : ''}${shuffling ? ' is-shuffling' : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      <span className="ww-goal-card__icons" aria-hidden="true">
        {renderIcons.map((iconId, i) => (
          <span className="ww-goal-card__icon" key={`${iconId}-${i}`}>
            <span className="ww-goal-card__icon-drift">
              <EquipmentIcon id={iconId} size={[30, 22, 16][i % 3]} />
            </span>
          </span>
        ))}
      </span>
      <span className="ww-goal-card__scrim" aria-hidden="true" />
      <span className="ww-goal-card__text">
        <span className="ww-goal-card__name">{name}</span>
        <span className="ww-goal-card__desc">{desc}</span>
      </span>
      {on ? (
        <span className="ww-goal-card__check" aria-hidden="true">
          <Glyph name="check" size={14} />
        </span>
      ) : null}
    </button>
  );
}
