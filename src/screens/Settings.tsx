import { Glyph, Note, OptionRow, PageHeader } from '../components/ui.js';
import type { Screen, Settings as SettingsData, ThemeId } from '../types.js';

function Toggle({
  name, desc, on, onToggle,
}: {
  name: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="ww-row" aria-pressed={on} onClick={onToggle}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, textAlign: 'left' }}>
        <span className="ww-row__name">{name}</span>
        <span style={{ fontSize: 13, color: 'var(--ww-text-2)', lineHeight: 1.5 }}>{desc}</span>
      </span>
      <span
        className={on ? 'ww-badge ww-badge--accent' : 'ww-badge'}
        style={{ flex: 'none' }}
      >
        {on ? 'Til' : 'Fra'}
      </span>
    </button>
  );
}

export function Settings({
  settings, onChange, onTheme, onGo, wipeArmed, onWipe,
}: {
  settings: SettingsData;
  onChange: (patch: Partial<SettingsData>) => void;
  onTheme: (t: ThemeId) => void;
  onGo: (s: Screen) => void;
  wipeArmed: boolean;
  onWipe: () => void;
}) {
  return (
    <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', maxWidth: 760 }}>
      <PageHeader kicker="Opsætning" title="Indstillinger" />

      <section aria-labelledby="ww-theme" style={{ marginBottom: 30 }}>
        <h2 id="ww-theme" className="ww-kicker" style={{ marginBottom: 12 }}>Udseende</h2>
        <div className="ww-stack">
          <button
            type="button"
            className="ww-row"
            aria-pressed={settings.theme === 'dark'}
            onClick={() => onTheme('dark')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Glyph name="moon" />
              <span className="ww-row__name">Dark Mode</span>
            </span>
            <span className="ww-row__desc">Standard. Dyb charcoal med orange accent.</span>
          </button>
          <button
            type="button"
            className="ww-row"
            aria-pressed={settings.theme === 'light'}
            onClick={() => onTheme('light')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Glyph name="sun" />
              <span className="ww-row__name">Lys tilstand</span>
            </span>
            <span className="ww-row__desc">Til lyse rum og skærme udendørs.</span>
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--ww-text-3)' }}>
          Valget gemmes lokalt og huskes efter genindlæsning.
        </p>
      </section>

      <section aria-labelledby="ww-ai" style={{ marginBottom: 30 }}>
        <h2 id="ww-ai" className="ww-kicker" style={{ marginBottom: 12 }}>AI Mix</h2>
        <div className="ww-stack" style={{ marginBottom: 12 }}>
          <Toggle
            name="Brug AI Mix"
            desc="Lader en AI foreslå format og bevægelseskombination oven på den lokale generator."
            on={settings.aiMix}
            onToggle={() => onChange({ aiMix: !settings.aiMix })}
          />
        </div>
        <Note label="Hvad AI må og ikke må">
          AI Mix er et valgfrit variationslag. Den må kun foreslå format, hvilke øvelser der må
          indgå og en kort begrundelse. Den lokale regelmotor bestemmer stadig selv den endelige
          øvelsesliste, alle kilo og skiver, deltagernes mål, tidsbudgettet, udstyrslogistikken,
          sikkerhedsvalideringen og WW Match. Der sendes hverken navn eller kropsvægt.
          {' '}Er der ingen nøgle på serveren, eller er du offline, bygger Smart Mix workouten
          lokalt uden reduceret funktionalitet. Se opsætningen i README og <code>.env.example</code>.
        </Note>
      </section>

      <section aria-labelledby="ww-device" style={{ marginBottom: 30 }}>
        <h2 id="ww-device" className="ww-kicker" style={{ marginBottom: 12 }}>Under træning</h2>
        <div className="ww-stack" style={{ marginBottom: 12 }}>
          <Toggle
            name="Lyd ved skift"
            desc="Et kort signal, når et segment slutter."
            on={settings.sound}
            onToggle={() => onChange({ sound: !settings.sound })}
          />
          <Toggle
            name="Haptik"
            desc="Vibration ved skift, hvis enheden understøtter det."
            on={settings.haptics}
            onToggle={() => onChange({ haptics: !settings.haptics })}
          />
          <Toggle
            name="Hold skærmen tændt"
            desc="Beder om Wake Lock, mens timeren kører."
            on={settings.keepAwake}
            onToggle={() => onChange({ keepAwake: !settings.keepAwake })}
          />
        </div>
        <Note label="Ærligt om platformen" tone="quiet">
          Lyd, haptik, Wake Lock og hvad der sker, når appen ligger i baggrunden, afhænger af
          browser og styresystem. iOS på Safari giver ikke altid lyd uden en forudgående
          brugerhandling, og Wake Lock findes ikke overalt. Timeren regner tiden ud fra
          uret — ikke fra en tæller, der kan gå i stå — så den er korrekt efter genindlæsning
          eller et skift væk fra appen, også hvor baggrundskørsel ikke er tilladt.
        </Note>
      </section>

      <section aria-labelledby="ww-data">
        <h2 id="ww-data" className="ww-kicker" style={{ marginBottom: 12 }}>Data</h2>
        <div className="ww-stack" style={{ marginBottom: 14 }}>
          <OptionRow name="Import og eksport" desc="Til ny enhed eller sikkerhedskopi" onClick={() => onGo('transfer')} />
          <OptionRow name="Udstyr og skiver" desc="Rediger salens udstyr" onClick={() => onGo('equipment')} />
        </div>
        <button type="button" className="ww-btn ww-btn--lg ww-btn--danger" onClick={onWipe}>
          {wipeArmed ? 'Tryk igen for at slette alt' : 'Slet lokale data'}
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--ww-text-3)', lineHeight: 1.6 }}>
          Sletning fjerner historik, favoritter, program og en igangværende timer fra denne enhed.
          Det kan ikke fortrydes — eksportér først, hvis du vil beholde noget.
        </p>
      </section>
    </div>
  );
}
