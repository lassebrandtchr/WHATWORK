/**
 * Appmærket: en tyk, sammenflettet "W" i orange på en afrundet flise. Flisen bruger
 * de samme temafarver som resten af appen (`--ww-surface`/`--ww-line`), så den skifter
 * automatisk mellem mørkegrå (Dark Mode) og hvid (Light Mode) uden noget ekstra logik.
 */
export function WwMark({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="WHATWORK"
      style={{ display: 'block', flex: 'none' }}
    >
      <rect
        x="4" y="4" width="504" height="504" rx="112"
        fill="var(--ww-surface)"
        stroke="var(--ww-line)"
        strokeWidth="4"
      />
      <polyline
        points="128,176 208,338 256,238 304,338 384,176"
        fill="none"
        stroke="var(--ww-orange)"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
