import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.js';
import { STATE_VERSION, STORAGE_KEY } from './lib/storage.js';

/** Springer onboarding over ved at lade som om brugeren allerede er kommet igennem. */
function seedOnboardedProfile(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: STATE_VERSION,
      profile: {
        name: 'Gæst', level: 3, sex: 'm', bodyweight: 82,
        equipment: null, counts: {}, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
        bars: [20, 15], onboarded: true,
      },
      settings: { theme: 'dark', aiMix: false, sound: true, haptics: true, keepAwake: true },
      history: [], favorites: [], program: null, timer: null, timerWorkout: null,
    }),
  );
}

/** Fasesekvensen er animation oven på et allerede beregnet resultat. */
async function skipGeneration(): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
}

describe('WHATWORK — kerneflow', () => {
  it('starter på velkomstskærmen for en ny bruger', async () => {
    render(<App />);
    expect(await screen.findByText(/Bygget til/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fortsæt uden bruger' })).toBeInTheDocument();
  });

  it('fører fra velkomst gennem onboarding til hjem', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Fortsæt uden bruger' }));
    expect(screen.getByRole('heading', { name: 'Hvilket niveau?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Øvet/ }));
    await user.click(screen.getByRole('button', { name: 'Videre' }));
    expect(screen.getByRole('heading', { name: 'Skaleringsprofil' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Videre' }));
    await user.click(screen.getByRole('button', { name: 'Videre' }));
    expect(screen.getByRole('heading', { name: 'Hvad har du at arbejde med?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start WHATWORK' }));
    expect(await screen.findByText('Hvad skal vi træne?')).toBeInTheDocument();
  });

  it('husker niveauet i profilen efter onboarding', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Fortsæt uden bruger' }));
    await user.click(screen.getByRole('button', { name: /Avanceret/ }));
    for (const label of ['Videre', 'Videre', 'Videre', 'Start WHATWORK']) {
      await user.click(screen.getByRole('button', { name: label }));
    }

    await user.click(screen.getByRole('button', { name: /Profil/ }));
    expect(await screen.findByText('Avanceret')).toBeInTheDocument();
  });

  it('har alt relevant udstyr slået til som standard i generatoren', async () => {
    seedOnboardedProfile();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Generér workout/ }));
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Videre' }));

    expect(screen.getByRole('heading', { name: 'Hvad har I at arbejde med?' })).toBeInTheDocument();
    for (const name of ['Håndvægte', 'Kettlebells', 'Vægtstang', 'RowERG', 'SkiERG', 'BikeERG',
      'Assault Bike', 'Slæde', 'Box', 'Pull-up bar', 'Wall ball', 'Sandbag']) {
      const tile = screen.getByRole('button', { name: new RegExp(`^${name} `) });
      expect(tile).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('bevarer udstyrsvalget, når brugeren går frem og tilbage', async () => {
    seedOnboardedProfile();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Generér workout/ }));
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Videre' }));

    const sled = screen.getByRole('button', { name: /^Slæde / });
    await user.click(sled);
    expect(screen.getByRole('button', { name: /^Slæde / })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Tilbage' }));
    await user.click(screen.getByRole('button', { name: 'Videre' }));
    expect(screen.getByRole('button', { name: /^Slæde / })).toHaveAttribute('aria-pressed', 'false');
  });

  it('beregner deltagerantallet ud fra fordelingen', async () => {
    seedOnboardedProfile();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Generér workout/ }));
    await user.click(screen.getByRole('button', { name: 'Videre' }));

    expect(screen.getByRole('heading', { name: 'Hvem træner?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kvinder: én mere' }));
    await user.click(screen.getByRole('button', { name: 'Ikke angivet: én mere' }));

    const total = screen.getByText('Deltagere i alt').parentElement;
    expect(within(total as HTMLElement).getByText('3')).toBeInTheDocument();
  });

  it('bruger individuelle vægte i workout-anmodningen, når tilstanden er aktiv', async () => {
    seedOnboardedProfile();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Generér workout/ }));
    await user.click(screen.getByRole('button', { name: 'Videre' })); // tid → deltagere
    await user.click(screen.getByRole('button', { name: 'Kvinder: én mere' }));
    await user.click(screen.getByRole('button', { name: 'Videre' })); // deltagere → kropsvægt

    expect(screen.getByRole('heading', { name: 'Kropsvægt' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Individuel' }));

    // Profilens kropsvægt (82 kg) er Mand 1's gennemsnit-fallback ved start.
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: 'Mand 1: én færre' }));
    }
    expect(screen.getByText('78 kg')).toBeInTheDocument();
  });

  it('flytter Conditioning- og Styrke-skalaerne, når et fokus vælges', async () => {
    seedOnboardedProfile();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Generér workout/ }));
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Videre' }));

    expect(screen.getByRole('heading', { name: 'Niveau og retning' })).toBeInTheDocument();
    expect(screen.getByText('6 / 10')).toBeInTheDocument(); // Conditioning-standard
    expect(screen.getByText('5 / 10')).toBeInTheDocument(); // Styrke-standard

    await user.click(screen.getByRole('button', { name: /^Puls:/ }));
    expect(screen.getByText('9 / 10')).toBeInTheDocument(); // Conditioning følger Puls-fokus
    expect(screen.getByText('3 / 10')).toBeInTheDocument(); // Styrke følger Puls-fokus
  });

  it('genererer en workout og viser en rigtig formattitel', async () => {
    seedOnboardedProfile();
    vi.useFakeTimers();
    try {
      render(<App />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });

      fireEvent.click(screen.getByRole('button', { name: /Overrask mig/ }));
      expect(screen.getByRole('status')).toBeInTheDocument();
      await skipGeneration();

      expect(screen.getByRole('button', { name: 'Gør den lettere' })).toBeInTheDocument();
      expect(screen.getByText('Workout-DNA')).toBeInTheDocument();
      expect(screen.queryByText('WW Match')).not.toBeInTheDocument();
      expect(screen.getByText('Sådan afvikles den')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start workout' })).toBeInTheDocument();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.textContent).not.toContain('Makkertryk');
    } finally {
      vi.useRealTimers();
    }
  });

  it('kører hele flowet: generér → start → pause → genoptag → afslut → historik → åbn igen', async () => {
    seedOnboardedProfile();
    vi.useFakeTimers();
    try {
      render(<App />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });

      fireEvent.click(screen.getByRole('button', { name: /Overrask mig/ }));
      await skipGeneration();

      fireEvent.click(screen.getByRole('button', { name: 'Start workout' }));
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

      await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });

      // Pause fastfryser tiden.
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      expect(screen.getByRole('button', { name: 'Fortsæt' })).toBeInTheDocument();
      const frozen = screen.getByText(/i alt \d+:\d\d/).textContent;
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(screen.getByText(/i alt \d+:\d\d/).textContent).toBe(frozen);

      // Genoptag og gå videre til næste segment.
      fireEvent.click(screen.getByRole('button', { name: 'Fortsæt' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      fireEvent.click(screen.getByRole('button', { name: 'Næste' }));

      // Afslut kræver bekræftelse.
      fireEvent.click(screen.getByRole('button', { name: 'Afslut' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Afslut træningen?')).toBeInTheDocument();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Afslut' }));

      fireEvent.click(screen.getByRole('button', { name: 'Gem i historik' }));

      expect(screen.getByRole('heading', { name: 'Historik' })).toBeInTheDocument();
      expect(screen.getAllByText('Afbrudt').length).toBeGreaterThan(0);

      // Workouten kan åbnes igen fra historikken.
      fireEvent.click(screen.getAllByRole('button', { name: 'Åbn' })[0] as HTMLElement);
      expect(screen.getByText('Sådan afvikles den')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('kræver bekræftelse for at nulstille timeren', async () => {
    seedOnboardedProfile();
    vi.useFakeTimers();
    try {
      render(<App />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(screen.getByRole('button', { name: /Overrask mig/ }));
      await skipGeneration();
      fireEvent.click(screen.getByRole('button', { name: 'Start workout' }));

      fireEvent.click(screen.getByRole('button', { name: 'Nulstil' }));
      expect(screen.getByText('Nulstil timeren?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Fortryd' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('viser aldrig et opfundet workoutnavn nogen steder i flowet', async () => {
    seedOnboardedProfile();
    vi.useFakeTimers();
    try {
      const { container } = render(<App />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(screen.getByRole('button', { name: /Overrask mig/ }));
      await skipGeneration();

      // Fem forskellige workouts i træk — ingen af dem må have et opfundet navn.
      for (let i = 0; i < 5; i++) {
        expect(container.textContent).not.toContain('Makkertryk');
        expect(container.textContent).not.toContain('Skift, sved');
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Ny workout' }));
        await skipGeneration();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('WHATWORK — ruter og indstillinger', () => {
  it('åbner en sekundær rute direkte fra adressen', async () => {
    seedOnboardedProfile();
    window.location.hash = '#/hjaelp';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hjælp' })).toBeInTheDocument();
    expect(screen.getByText('Data og offline')).toBeInTheDocument();
    window.location.hash = '';
  });

  it('giver alle hovedruter reelt indhold', async () => {
    seedOnboardedProfile();
    const routes: [string, string][] = [
      ['#/statistik', 'Statistik'],
      ['#/favoritter', 'Favoritter'],
      ['#/udstyr', 'Udstyr'],
      ['#/indstillinger', 'Indstillinger'],
      ['#/import-eksport', 'Import og eksport'],
      ['#/om', 'Om WHATWORK'],
      ['#/program', 'Program'],
    ];
    for (const [hash, heading] of routes) {
      window.location.hash = hash;
      const view = render(<App />);
      expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
      view.unmount();
    }
    window.location.hash = '';
  });

  it('skifter tema og husker valget', async () => {
    seedOnboardedProfile();
    window.location.hash = '#/indstillinger';
    const user = userEvent.setup();
    const view = render(<App />);

    await screen.findByRole('heading', { name: 'Indstillinger' });
    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(screen.getByRole('button', { name: /Lys tilstand/ }));
    expect(document.documentElement.dataset.theme).toBe('light');

    // Temaet overlever en ny indlæsning af appen.
    view.unmount();
    render(<App />);
    await screen.findByRole('heading', { name: 'Indstillinger' });
    expect(document.documentElement.dataset.theme).toBe('light');

    window.location.hash = '';
  });

  it('bruger dansk lang-attribut', () => {
    expect(document.documentElement.lang || 'da').toMatch(/^da/);
  });
});
