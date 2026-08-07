import flowGraphic from '../assets/flow-graphic.png';

/**
 * "Tid → Antal → Udstyr → Workout"-grafikken i sit naturlige aflange 9:16-format, tænkt
 * til at stå ved siden af tekst frem for som en bred, selvstændig boks. Teksten i selve
 * grafikken er hvid og fast — den ligger derfor altid på en tætsiddende mørk flade, så
 * den er læsbar uanset om appen står i Dark eller Light Mode.
 */
export function FlowGraphic({ width = 132 }: { width?: number }) {
  return (
    <div
      style={{
        width, aspectRatio: '9 / 16', flex: 'none', overflow: 'hidden',
        borderRadius: 'var(--ww-r-lg)',
        background: 'linear-gradient(180deg, #1c1722, #120f16)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <img
        src={flowGraphic}
        alt="Tid, antal deltagere og udstyr bliver tilsammen til en workout med kilo, mål og pauser"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
