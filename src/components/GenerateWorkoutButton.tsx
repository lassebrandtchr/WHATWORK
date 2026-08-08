import { KettlebellField } from './KettlebellField.js';

/**
 * Enhver "Generér workout"-knap i appen deler denne markup: kettlebellfeltet
 * bag teksten, og selve etiketten i sin egen span, så feltet aldrig kan skubbe
 * til, hvor teksten står. `className` lægger de resterende `.ww-btn`-modifiers
 * oven i — knappen ser forskellig ud i en empty-state og i generatorens
 * sidebar, men deler den samme animation.
 */
export function GenerateWorkoutButton({
  onClick, className = '',
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`ww-btn ww-btn--primary ww-btn--kb${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <KettlebellField />
      <span className="ww-btn--kb__label">Generér workout</span>
    </button>
  );
}
