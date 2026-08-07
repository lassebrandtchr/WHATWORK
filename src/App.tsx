import { useState } from 'react';
import { BottomBar, DesktopHeader, Drawer, MobileNav } from './components/Navigation.js';
import { EmptyState, Glyph } from './components/ui.js';
import { Wordmark } from './components/Wordmark.js';
import { WwMark } from './components/WwMark.js';
import { freshGen, useWhatwork } from './state/useWhatwork.js';
import { About } from './screens/About.js';
import { Complete } from './screens/Complete.js';
import { Equipment } from './screens/Equipment.js';
import { Favorites } from './screens/Favorites.js';
import { Generator } from './screens/Generator.js';
import { Help } from './screens/Help.js';
import { History } from './screens/History.js';
import { Home } from './screens/Home.js';
import { Loading } from './screens/Loading.js';
import { Onboarding } from './screens/Onboarding.js';
import { Profile } from './screens/Profile.js';
import { Program } from './screens/Program.js';
import { Result, ResultError } from './screens/Result.js';
import { Settings } from './screens/Settings.js';
import { Stats } from './screens/Stats.js';
import { Timer } from './screens/Timer.js';
import { Transfer } from './screens/Transfer.js';
import { Welcome } from './screens/Welcome.js';
import type { Screen } from './types.js';

/** Ruter med bundnavigation på mobil. */
const TABBED: Screen[] = [
  'home', 'gen', 'result', 'history', 'program', 'profile', 'stats',
  'favorites', 'equipment', 'settings', 'help', 'transfer', 'about',
];

export function App() {
  const ww = useWhatwork();
  const [drawer, setDrawer] = useState(false);

  if (!ww.ready) {
    // Kort, tavs frame mens den lokale database læses — ingen skærm skal nå at blinke forbi.
    return <div style={{ minHeight: '100dvh', background: 'var(--ww-bg)' }} />;
  }

  if (ww.screen === 'welcome') {
    return <Welcome onStart={ww.startOnboarding} />;
  }

  if (ww.screen === 'onboard') {
    return (
      <Onboarding
        step={ww.onbStep}
        profile={ww.profile}
        onPatch={ww.patchProfile}
        onNext={ww.onbNext}
        onBack={ww.onbBack}
      />
    );
  }

  if (ww.screen === 'loading') {
    return <Loading progress={ww.progress} phaseText={ww.phaseText} />;
  }

  if (ww.screen === 'timer' && ww.timer && ww.plan && ww.view && ww.workout) {
    return (
      <Timer
        timer={ww.timer}
        plan={ww.plan}
        view={ww.view}
        workout={ww.workout}
        confirmDialog={ww.confirmDialog}
        keepAwake={ww.settings.keepAwake}
        onToggle={ww.toggleTimer}
        onNext={() => ww.advance(1)}
        onPrev={() => ww.advance(-1)}
        onRound={ww.addRound}
        onRequestExit={() => ww.setConfirmDialog('exit')}
        onRequestReset={() => ww.setConfirmDialog('reset')}
        onCancelDialog={() => ww.setConfirmDialog(null)}
        onConfirmExit={() => ww.openCompletion('stopped')}
        onConfirmReset={ww.resetTimer}
        onFinish={() => ww.openCompletion('done')}
      />
    );
  }

  if (ww.screen === 'complete' && ww.completeFor) {
    return (
      <Complete
        context={ww.completeFor}
        completion={ww.completion}
        onChange={(patch) => ww.setCompletion({ ...ww.completion, ...patch })}
        onSave={ww.saveCompletion}
      />
    );
  }

  const onGenerator = ww.screen === 'gen';
  const onResultWithWorkout = ww.screen === 'result' && Boolean(ww.workout);
  const atSummary = ww.currentStep === 'summary';

  // På desktop overtager sidebaren "Generér"-knappen på opsummeringstrinnet.
  const showBottomBar = onGenerator ? !(ww.isDesktop && atSummary) : onResultWithWorkout;
  const bottomLabel = onGenerator ? (atSummary ? 'Generér workout' : 'Videre') : 'Start workout';
  const bottomAction = onGenerator ? ww.genNext : ww.startTimer;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {ww.isDesktop ? (
        <DesktopHeader
          screen={ww.screen}
          profileName={ww.profile.name || 'Gæst'}
          onGo={ww.go}
          onGenerate={ww.openGenerator}
        />
      ) : (
        <div
          className="ww-glass"
          style={{
            position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid var(--ww-line)',
            padding: 'calc(env(safe-area-inset-top) + 8px) 16px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <button
            type="button"
            aria-label="WHATWORK — gå til Hjem"
            style={{
              background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer',
              minHeight: 44, display: 'flex', alignItems: 'center', gap: 10,
            }}
            onClick={() => ww.go('home')}
          >
            <WwMark size={28} />
            <Wordmark size={18} />
          </button>
          <button type="button" className="ww-icon-btn" aria-label="Åbn menuen" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <Glyph name="menu" />
          </button>
        </div>
      )}

      <main
        style={{
          flex: 1, width: '100%', maxWidth: 1280, margin: '0 auto',
          padding: `0 20px calc(env(safe-area-inset-bottom) + ${showBottomBar ? 168 : 96}px)`,
        }}
      >
        {ww.screen === 'home' && (
          <Home
            name={ww.profile.name || 'Gæst'}
            history={ww.history}
            hasTimer={Boolean(ww.timer)}
            onResume={() => ww.go('timer')}
            onGenerate={ww.resetGenerator}
            onQuickTime={(minutes) => {
              ww.setGen({ ...freshGen(ww.profile), minutes });
              ww.setGenStep(1);
              ww.go('gen');
            }}
            onGo={ww.go}
            onSurprise={ww.surpriseMe}
            onOpenLast={() => { const last = ww.history[0]; if (last) ww.openWorkout(last.workout); }}
          />
        )}

        {onGenerator && (
          <Generator
            gen={ww.gen}
            patch={ww.patchGen}
            step={ww.genStep}
            steps={ww.steps}
            current={ww.currentStep}
            isDesktop={ww.isDesktop}
            onBack={ww.genBack}
            onGenerate={() => ww.runGenerate()}
          />
        )}

        {ww.screen === 'result' && (
          ww.workout ? (
            <Result
              workout={ww.workout}
              saved={ww.saved}
              isFavorite={ww.isFavorite(ww.workout)}
              aiNotice={ww.aiNotice}
              onBack={() => ww.go(ww.fromProgram ? 'program' : 'home')}
              onEasier={() => ww.nudge('easier')}
              onHarder={() => ww.nudge('harder')}
              onRegenerate={ww.regenerate}
              onSave={ww.saveWorkout}
              onFavorite={() => ww.toggleFavorite(ww.workout)}
            />
          ) : (
            <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', maxWidth: 840 }}>
              <button type="button" className="ww-btn ww-btn--ghost" style={{ marginBottom: 16 }} onClick={() => ww.go('home')}>
                <Glyph name="back" size={18} />
                Tilbage
              </button>
              {ww.genError ? (
                <ResultError message={ww.genError} onAdjust={() => { ww.setGenStep(0); ww.go('gen'); }} />
              ) : (
                /*
                 * Ruten er åbnet direkte — efter en genindlæsning, fra et bogmærke eller
                 * et delt link. Der er ingen workout i hukommelsen, og det er ikke det
                 * samme som at generatoren fejlede.
                 */
                <EmptyState
                  title="Ingen workout åben"
                  body="Der er ikke nogen workout at vise lige nu. Byg en ny, eller åbn en fra din historik."
                  action={(
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="ww-btn ww-btn--primary ww-btn--lg" onClick={ww.resetGenerator}>
                        Generér workout
                      </button>
                      <button type="button" className="ww-btn ww-btn--lg" onClick={() => ww.go('history')}>
                        Åbn historikken
                      </button>
                    </div>
                  )}
                />
              )}
            </div>
          )
        )}

        {ww.screen === 'history' && (
          <History
            history={ww.history}
            entries={ww.filteredHistory}
            filter={ww.historyFilter}
            onFilter={ww.setHistoryFilter}
            onOpen={(entry) => ww.openWorkout(entry.workout)}
            onRun={(entry) => { ww.openWorkout(entry.workout); ww.startTimer(); }}
            onRemove={ww.removeHistory}
            onGenerate={ww.resetGenerator}
          />
        )}

        {ww.screen === 'stats' && <Stats history={ww.history} onGenerate={ww.resetGenerator} />}

        {ww.screen === 'favorites' && (
          <Favorites
            favorites={ww.favorites}
            onOpen={(entry) => ww.openWorkout(entry.workout)}
            onRun={(entry) => { ww.openWorkout(entry.workout); ww.startTimer(); }}
            onRemove={(entry) => ww.toggleFavorite(entry.workout)}
            onGenerate={ww.resetGenerator}
          />
        )}

        {ww.screen === 'program' && (
          <Program
            program={ww.program}
            draft={ww.programDraft}
            onDraft={(patch) => ww.setProgramDraft({ ...ww.programDraft, ...patch })}
            onBuild={ww.buildProgram}
            onDrop={ww.dropProgram}
            onOpenDay={(workout, ref) => ww.openWorkout(workout, ref)}
            onSkipDay={(ref) => ww.patchProgramDay(ref, { status: 'skipped' })}
            onRegenerateDay={ww.regenerateDay}
            onMoveDay={ww.moveProgramDay}
          />
        )}

        {ww.screen === 'profile' && (
          <Profile
            profile={ww.profile}
            history={ww.history}
            favorites={ww.favorites}
            onGo={ww.go}
            onRedoOnboarding={ww.startOnboarding}
            onPatch={ww.patchProfile}
          />
        )}

        {ww.screen === 'equipment' && <Equipment profile={ww.profile} onPatch={ww.patchProfile} />}

        {ww.screen === 'settings' && (
          <Settings
            settings={ww.settings}
            onChange={(patch) => ww.setSettings({ ...ww.settings, ...patch })}
            onTheme={ww.setTheme}
            onGo={ww.go}
            wipeArmed={ww.wipeArmed}
            onWipe={ww.wipeData}
          />
        )}

        {ww.screen === 'help' && <Help />}
        {ww.screen === 'about' && <About />}

        {ww.screen === 'transfer' && (
          <Transfer
            onExport={ww.exportData}
            onStage={ww.stageImport}
            preview={ww.importPreview}
            error={ww.importError}
            onCancel={() => ww.setImportPreview(null)}
          />
        )}
      </main>

      {showBottomBar ? <BottomBar label={bottomLabel} onClick={bottomAction} /> : null}
      {!ww.isDesktop && TABBED.includes(ww.screen) ? <MobileNav screen={ww.screen} onGo={ww.go} /> : null}
      {drawer ? <Drawer screen={ww.screen} onGo={ww.go} onClose={() => setDrawer(false)} /> : null}
    </div>
  );
}
