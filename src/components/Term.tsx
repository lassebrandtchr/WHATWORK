import { useId, useState } from 'react';
import { GLOSSARY_BY_ID, lookup } from '../domain/glossary.js';
import type { GlossaryEntry } from '../domain/glossary.js';

/**
 * Et fagudtryk med en forklaring, alle kan læse.
 *
 * Udtrykket vises med en fin understregning og kan foldes ud. Forklaringen ligger
 * i selve dokumentet frem for i en tooltip, fordi en tooltip hverken kan læses på
 * en telefon eller af en skærmlæser på en fornuftig måde.
 */
export function Term({
  id, children, showShort = false,
}: {
  /** Id eller navn på udtrykket i ordlisten. */
  id: string;
  /** Teksten der vises. Udelades den, bruges ordlistens eget navn. */
  children?: string;
  /** Vis den korte forklaring med det samme i stedet for bag et klik. */
  showShort?: boolean;
}) {
  const entry = GLOSSARY_BY_ID[id] ?? lookup(id);
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  // Findes udtrykket ikke i ordlisten, vises teksten som almindelig tekst frem for
  // at fejle. Testen `glossary.test.ts` fanger manglende poster.
  if (!entry) return <>{children ?? id}</>;

  const label = children ?? entry.term;

  if (showShort) {
    return (
      <span className="ww-term ww-term--inline">
        <strong>{label}</strong>
        <span className="ww-term__short"> — {entry.short.toLowerCase()}</span>
      </span>
    );
  }

  return (
    <span className="ww-term">
      <button
        type="button"
        className="ww-term__trigger"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <span className="ww-term__mark" aria-hidden="true">?</span>
        <span className="ww-sr-only">
          {open ? '. Skjul forklaring' : '. Vis forklaring'}
        </span>
      </button>
      {open ? (
        <span className="ww-term__body" id={bodyId} role="note">
          <span className="ww-term__long">{entry.long}</span>
          <span className="ww-term__why"><strong>Derfor betyder det noget: </strong>{entry.why}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Ét opslag i ordlisten på Hjælp-siden. */
export function GlossaryItem({ entry }: { entry: GlossaryEntry }) {
  return (
    <div className="ww-glossary__item">
      <dt className="ww-glossary__term">
        {entry.term}
        {entry.aliases.length ? (
          <span className="ww-glossary__alias"> · også kaldet {entry.aliases.join(', ')}</span>
        ) : null}
      </dt>
      <dd className="ww-glossary__def">
        <p className="ww-glossary__short">{entry.short}</p>
        <p className="ww-glossary__long">{entry.long}</p>
        <p className="ww-glossary__why"><strong>Derfor betyder det noget: </strong>{entry.why}</p>
      </dd>
    </div>
  );
}
