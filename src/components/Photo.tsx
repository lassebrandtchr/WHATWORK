import type { CSSProperties } from 'react';
import { photo } from '../assets/images/index.js';
import type { PhotoName } from '../assets/images/index.js';

/**
 * Fotoerne i appen.
 *
 * Rammen bestemmer højde-bredde-forholdet, og forholdet skifter mellem telefon,
 * tablet og desktop — se `.ww-photo--*` i index.css. Billedet fylder altid rammen
 * helt og beskæres omkring sit fokuspunkt, så det samme motiv virker i alle tre
 * bredder uden et separat udsnit pr. skærmstørrelse.
 */

type Frame =
  /** Bred banner over eller under en sektion. 4:3 på telefon, 3:2 på tablet, 2:1 på desktop. */
  | 'band'
  /** Stående motiv i en smal spalte — sidebar eller enkelt kolonne. Altid 4:5. */
  | 'portrait';

/**
 * Hvor bredt billedet reelt vises. Uden det ville browseren regne med fuld
 * vinduesbredde og hente en for stor fil på desktop.
 */
const DEFAULT_SIZES: Record<Frame, string> = {
  band: '(min-width: 1024px) 860px, 100vw',
  portrait: '(min-width: 1024px) 360px, 100vw',
};

export function Photo({
  name, frame = 'band', sizes, caption, className, style, eager = false,
}: {
  name: PhotoName;
  frame?: Frame;
  sizes?: string;
  /** Kort billedtekst under motivet. Udelades, når billedet er ren stemning. */
  caption?: string;
  className?: string;
  style?: CSSProperties;
  /** Kun til det første billede over folden — resten hentes dovent. */
  eager?: boolean;
}) {
  const asset = photo(name);
  const img = (
    <span className={`ww-photo ww-photo--${frame}${className ? ` ${className}` : ''}`} style={style}>
      <img
        src={asset.src}
        srcSet={asset.srcSet}
        sizes={sizes ?? DEFAULT_SIZES[frame]}
        alt={asset.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        style={{ objectPosition: asset.position }}
      />
    </span>
  );

  if (!caption) return img;
  return (
    <figure className="ww-figure">
      {img}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/**
 * Fuldskærmsbilledet bag velkomstskærmen.
 *
 * Her er ét udsnit ikke nok: en telefon i portræt og en desktop i landskab har
 * hver deres motiv, så `<picture>` skifter kilde ved 1024px i stedet for at
 * beskære det samme billede til ukendelighed.
 */
export function HeroPhoto() {
  const portrait = photo('login-portrait');
  const landscape = photo('login-landscape');
  return (
    <div className="ww-hero-photo" aria-hidden="true">
      <picture>
        <source media="(min-width: 1024px)" srcSet={landscape.srcSet} sizes="100vw" />
        <img
          src={portrait.src}
          srcSet={portrait.srcSet}
          sizes="100vw"
          alt=""
          loading="eager"
          decoding="async"
          style={{ objectPosition: portrait.position }}
        />
      </picture>
    </div>
  );
}
