import { describe, expect, it } from 'vitest';
import { SPORT_LIST, SPORT_MODELS, planPhases, sportModel } from './sport.js';
import {
  CURRENT_HYROX_VERSION, crossfitRules, hyroxRules, powerliftingRules,
  ruleVersionsFor, stationLoad,
} from './ruleSets.js';
import type { Goal, SportId } from './types.js';

const goal = (over: Partial<Goal> = {}): Goal => ({
  sport: 'strength4', primary: '', secondary: [], eventDate: null,
  ruleSet: null, baselineStrategy: 'known', ...over,
});

const ctx = (over: Partial<Parameters<typeof SPORT_MODELS.strength4.anchors>[0]> = {}) => ({
  daysPerWeek: 4, goal: goal(), reduced: false, ...over,
});

describe('sportsmodeller', () => {
  it('findes for alle sportsgrene', () => {
    (['strength4', 'powerlifting', 'crossfit', 'hyrox', 'strongman', 'functional'] as SportId[])
      .forEach((s) => expect(sportModel(s).sport).toBe(s));
    expect(SPORT_LIST).toHaveLength(6);
  });

  it('giver strength4 alle fire løft som obligatoriske anchors', () => {
    const ids = sportModel('strength4').anchors(ctx()).filter((a) => a.mandatory).map((a) => a.liftId);
    expect(ids).toEqual(expect.arrayContaining(['squat', 'bench', 'deadlift', 'ohp']));
  });

  it('holder overhead press ude af officiel powerlifting', () => {
    const ids = sportModel('powerlifting').anchors(ctx()).map((a) => a.liftId);
    expect(ids).not.toContain('ohp');
    expect(ids).toEqual(expect.arrayContaining(['squat', 'bench', 'deadlift']));
    expect(sportModel('strength4').demands).toContain('ikke et officielt IPF-konkurrenceløft');
  });

  it('gør løb obligatorisk for HYROX', () => {
    const anchors = sportModel('hyrox').anchors(ctx());
    const run = anchors.find((a) => a.kind === 'run' && a.mandatory);
    expect(run).toBeDefined();
    expect(anchors.some((a) => a.kind === 'event' && a.mandatory)).toBe(true);
  });

  it('kræver en squat-anchor i et underkropsfokuseret funktionelt program', () => {
    const anchors = sportModel('functional').anchors(ctx());
    expect(anchors.some((a) => a.patterns?.includes('squat') && a.mandatory)).toBe(true);
    expect(anchors.some((a) => a.patterns?.includes('hinge') && a.mandatory)).toBe(true);
  });

  it('tilføjer først en event-anchor for strongman, når eventlisten findes', () => {
    const without = sportModel('strongman').anchors(ctx());
    expect(without.some((a) => a.id === 'sm-event')).toBe(false);

    const withEvents = sportModel('strongman').anchors(ctx({
      goal: goal({
        sport: 'strongman',
        events: [{
          id: 'e1', name: 'Log press', category: 'maxStrength', implement: 'log',
          loadKg: 100, distanceM: null, timeCapSec: 60, reps: null,
        }],
      }),
    }));
    expect(withEvents.some((a) => a.id === 'sm-event')).toBe(true);
  });

  it('viser kun sportsspecifikke intakespørgsmål for den valgte sport', () => {
    const pl = sportModel('powerlifting').intakeFields.map((f) => f.id).join(' ');
    expect(pl).not.toContain('hyrox');
    const hx = sportModel('hyrox').intakeFields.map((f) => f.id).join(' ');
    expect(hx).toContain('hyrox.division');
  });

  it('har en fallback til hvert intakespørgsmål, så "ved ikke" er et gyldigt svar', () => {
    (Object.keys(SPORT_MODELS) as SportId[]).forEach((s) => {
      sportModel(s).intakeFields.forEach((f) => {
        expect(f.fallback.length).toBeGreaterThan(5);
      });
    });
  });
});

describe('planPhases', () => {
  it('fordeler alle uger', () => {
    [4, 6, 8, 12, 19].forEach((weeks) => {
      const plan = planPhases('strength4', weeks, true);
      expect(plan).toHaveLength(weeks);
      expect(plan[plan.length - 1]?.week).toBe(weeks);
    });
  });

  it('dropper peak og taper uden en eventdato', () => {
    const ids = new Set(planPhases('hyrox', 12, false).map((p) => p.phase.id));
    expect(ids.has('taper')).toBe(false);
    expect(ids.has('base')).toBe(true);
  });

  it('lægger taper til sidst, når der er en eventdato', () => {
    const plan = planPhases('hyrox', 12, true);
    expect(plan[plan.length - 1]?.phase.id).toBe('taper');
  });

  it('sænker volumen og intensitetsvolumen gennem forløbet mod peak', () => {
    const plan = planPhases('strength4', 12, true);
    const first = plan[0]?.phase.volumeFactor as number;
    const last = plan[plan.length - 1]?.phase.volumeFactor as number;
    expect(last).toBeLessThan(first);
  });

  it('går fra hypertrofi til realisering for strongman', () => {
    const ids = planPhases('strongman', 19, true).map((p) => p.phase.id);
    expect(ids[0]).toBe('base');
    expect(ids).toContain('realisation');
    expect(ids[ids.length - 1]).toBe('taper');
  });
});

describe('rule sets', () => {
  it('kender den aktuelle HYROX-version og alle otte stationer', () => {
    const rules = hyroxRules();
    expect(rules).not.toBeNull();
    expect(rules?.stations).toHaveLength(8);
    expect(rules?.runSegments).toBe(8);
    expect(rules?.runDistanceM).toBe(1000);
  });

  it('markerer snapshottet som ubekræftet, så appen ikke foregiver autoritet', () => {
    expect(hyroxRules()?.needsRevalidation).toBe(true);
  });

  it('returnerer null for en ukendt version i stedet for at falde tilbage', () => {
    expect(hyroxRules('2099-fantasi')).toBeNull();
  });

  it('giver forskellige stationsloads pr. division', () => {
    const openMen = stationLoad('sled_push', 'open_men');
    const proMen = stationLoad('sled_push', 'pro_men');
    expect((proMen?.loadKg ?? 0)).toBeGreaterThan(openMen?.loadKg ?? 0);
  });

  it('markerer slæden som underlagsfølsom', () => {
    const sled = hyroxRules()?.stations.find((s) => s.id === 'sled_push');
    expect(sled?.surfaceSensitive).toBe(true);
  });

  it('bærer regelversionen med på stationsdata', () => {
    expect(stationLoad('wall_balls', 'open_women')?.ref.version).toBe(CURRENT_HYROX_VERSION);
  });

  it('holder IPF til de tre officielle løft', () => {
    expect(powerliftingRules().competitionLifts).toEqual(['squat', 'bench', 'deadlift']);
  });

  it('kender CrossFits officielle rækkefølge', () => {
    expect(crossfitRules().progression).toEqual(['mechanics', 'consistency', 'intensity']);
  });

  it('samler de anvendte regelversioner', () => {
    const v = ruleVersionsFor([hyroxRules()?.ref, powerliftingRules().ref, null]);
    expect(v.HYROX).toBe(CURRENT_HYROX_VERSION);
    expect(v.IPF).toBeDefined();
  });
});
