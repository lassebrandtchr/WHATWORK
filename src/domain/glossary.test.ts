import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LABELS, CATEGORY_ORDER, GLOSSARY, GLOSSARY_BY_ID,
  REQUIRES_EXPLANATION, glossaryInCategory, isExplained, lookup,
} from './glossary.js';

describe('ordlisten', () => {
  it('har unikke id-er', () => {
    const ids = GLOSSARY.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('forklarer hvert eneste fagudtryk, appen bruger', () => {
    REQUIRES_EXPLANATION.forEach((term) => {
      expect(isExplained(term), `"${term}" mangler en forklaring i ordlisten`).toBe(true);
    });
  });

  it('kan slå op på id, navn og alternative skrivemåder', () => {
    expect(lookup('1rm')?.id).toBe('1rm');
    expect(lookup('1RM')?.id).toBe('1rm');
    expect(lookup('one rep max')?.id).toBe('1rm');
    expect(lookup('findes ikke')).toBeNull();
  });

  it('har en kort forklaring, alle kan læse', () => {
    GLOSSARY.forEach((g) => {
      expect(g.short.length, `${g.id}: for kort`).toBeGreaterThan(15);
      // Den korte forklaring skal kunne stå ved siden af ordet uden at fylde en skærm.
      expect(g.short.length, `${g.id}: for lang til en enkelt linje`).toBeLessThan(120);
      expect(g.short.endsWith('.'), `${g.id}: mangler punktum`).toBe(true);
    });
  });

  it('har en fuld forklaring og en begrundelse for hvert udtryk', () => {
    GLOSSARY.forEach((g) => {
      expect(g.long.length, `${g.id}: mangler fuld forklaring`).toBeGreaterThan(60);
      expect(g.why.length, `${g.id}: mangler begrundelse`).toBeGreaterThan(30);
    });
  });

  /**
   * Kernen i kravet: en forklaring må ikke selv indføre nyt uforklaret fagsprog.
   * Forklarer man 1RM med "din maksimale e1RM", er man ikke kommet videre.
   */
  it('forklarer ikke fagsprog med nyt uforklaret fagsprog', () => {
    const jargon = [
      'e1RM', '1RM', 'RPE', 'RIR', 'AMRAP', 'EMOM',
      'critical speed', 'compromised running', 'max unbroken', 'training max',
    ];
    GLOSSARY.forEach((g) => {
      const text = `${g.short} ${g.long} ${g.why}`;
      jargon.forEach((term) => {
        // Et udtryk må gerne bruge sit eget navn og sine egne alternative former.
        const ownWords = [g.term, ...g.aliases].map((s) => s.toLowerCase());
        if (ownWords.includes(term.toLowerCase())) return;
        if (!text.includes(term)) return;
        // Bruges et andet fagudtryk, skal det have sin egen post i ordlisten.
        expect(isExplained(term), `${g.id} bruger "${term}" uden at det er forklaret`).toBe(true);
      });
    });
  });

  it('bruger dansk med æ, ø og å og aldrig translittereringer', () => {
    const text = GLOSSARY.map((g) => `${g.term} ${g.short} ${g.long} ${g.why}`).join(' ').toLowerCase();
    ['doedloeft', 'baenkpres', 'oevelser', 'kropsvaegt', 'maal', 'traening', 'styrkeloeft', 'vaegt']
      .forEach((bad) => expect(text, `fandt "${bad}"`).not.toContain(bad));
  });

  it('lægger hvert udtryk i en kategori, der findes', () => {
    GLOSSARY.forEach((g) => {
      expect(CATEGORY_ORDER).toContain(g.category);
      expect(CATEGORY_LABELS[g.category]).toBeTruthy();
    });
  });

  it('viser alle udtryk, når kategorierne gennemløbes', () => {
    const shown = CATEGORY_ORDER.flatMap((c) => glossaryInCategory(c));
    expect(shown).toHaveLength(GLOSSARY.length);
  });

  it('slår hvert udtryk op på id', () => {
    GLOSSARY.forEach((g) => expect(GLOSSARY_BY_ID[g.id]).toBe(g));
  });

  it('forklarer de forkortelser, en helt almindelig person ikke kender', () => {
    ['1RM', 'e1RM', 'RPE', 'RIR', 'AMRAP', 'EMOM', 'PR', 'ROM', 'WOD'].forEach((abbr) => {
      const entry = lookup(abbr);
      expect(entry, `${abbr} mangler`).not.toBeNull();
      // Forklaringen skal sige, hvad bogstaverne står for, eller hvad det betyder i praksis.
      expect((entry?.long.length ?? 0), `${abbr} er ikke forklaret ordentligt`).toBeGreaterThan(60);
    });
  });
});
