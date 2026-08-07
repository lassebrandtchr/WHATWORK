import { EQUIPMENT_BY_ID } from './data/equipment.js';
import { BY_ID } from './data/exercises.js';
import type {
  FormatId, Movement, NormalizedRequest, PartnerProtocol, Unit,
} from './types.js';

/** Det udstyr, der er for lidt af til at alle kan arbejde samtidig. */
export interface Bottleneck {
  exerciseId: string;
  exerciseName: string;
  equipmentId: string;
  equipmentName: string;
  have: number;
  need: number;
}

export function findBottlenecks(movements: Movement[], req: NormalizedRequest): Bottleneck[] {
  const out: Bottleneck[] = [];
  const seen = new Set<string>();
  for (const m of movements) {
    const ex = BY_ID[m.exerciseId];
    if (!ex) continue;
    for (const eqId of ex.eq) {
      if (eqId === 'bodyweight' || seen.has(eqId)) continue;
      const eq = EQUIPMENT_BY_ID[eqId];
      if (!eq || eq.countable !== true) continue;
      const have = req.inventory[eqId] ?? 0;
      // Håndvægte og kettlebells tælles i stykker: to deltagere kan dele fire håndvægte.
      const perPerson = ex.pair ? 2 : 1;
      const need = req.participants * perPerson;
      if (have < need) {
        out.push({
          exerciseId: ex.id, exerciseName: ex.name,
          equipmentId: eqId, equipmentName: eq.name,
          have, need,
        });
        seen.add(eqId);
      }
    }
  }
  return out;
}

function switchUnitOf(movements: Movement[]): { unit: PartnerProtocol['switchUnit']; text: string } {
  const units = new Set<Unit>(movements.map((m) => m.unit));
  if (units.size === 1) {
    const only = [...units][0] as Unit;
    if (only === 'reps') return { unit: 'reps', text: 'efter det viste antal gentagelser' };
    if (only === 'cal') return { unit: 'cal', text: 'efter det viste antal kalorier' };
    if (only === 'm') return { unit: 'm', text: 'efter den viste distance i meter' };
    return { unit: 'sec', text: 'efter det viste antal sekunder' };
  }
  return { unit: 'reps', text: 'efter det viste mål på hver øvelse' };
}

function logisticsFor(bottlenecks: Bottleneck[], req: NormalizedRequest, shared: boolean): string[] {
  if (!bottlenecks.length) {
    return req.participants > 1
      ? [`Der er udstyr nok til alle ${req.participants}. Ingen skal vente på et redskab.`]
      : ['Sæt stationerne op, før du starter, så du ikke bruger tid på at lede.'];
  }
  return bottlenecks.map((b) => {
    if (b.have === 0) {
      return `${b.equipmentName} mangler helt — øvelsen er byttet til en variant, I har udstyr til.`;
    }
    if (b.have === 1) {
      return shared
        ? `Én ${b.equipmentName} til ${req.participants}. Kun én arbejder ad gangen — den, der venter, nulstiller displayet og gør klar.`
        : `Én ${b.equipmentName} til ${req.participants}. Kør den som fast station: én ad gangen, resten arbejder videre på næste station.`;
    }
    return `${b.have} × ${b.equipmentName} til ${req.participants} deltagere. Lav faste par om hvert redskab og skift på signal.`;
  });
}

/**
 * Vælger afviklingsformen.
 *
 * Ved to deltagere er "You go, I go" det foretrukne format — det er den form, der
 * fungerer i en almindelig sal med ét sæt udstyr, og den eneste, hvor begge kan
 * køre hårdt uden at stå i vejen for hinanden.
 */
export function planPartner(
  movements: Movement[],
  req: NormalizedRequest,
  format: FormatId,
): PartnerProtocol {
  const p = req.participants;
  const bottlenecks = findBottlenecks(movements, req);
  const sw = switchUnitOf(movements);

  if (p <= 1) {
    return {
      mode: 'solo', title: 'Solo',
      working: 'Du arbejder hele vejen igennem.',
      resting: 'Pauserne er dem, formatet giver.',
      switchOn: 'efter hver øvelse',
      switchUnit: sw.unit,
      realRest: format === 'strength' || format === 'interval',
      nextStartsImmediately: format !== 'strength' && format !== 'interval',
      workShare: 'per_person',
      lines: ['Du træner alene. Alle mål på listen er dine egne.'],
      logistics: logisticsFor(bottlenecks, req, false),
    };
  }

  if (p === 2 && format !== 'partner_shared') {
    return {
      mode: 'you_go_i_go',
      title: 'You go, I go',
      working: 'Én arbejder ad gangen.',
      resting: 'Den anden restituerer og gør stationen klar.',
      switchOn: sw.text,
      switchUnit: sw.unit,
      realRest: true,
      nextStartsImmediately: true,
      workShare: 'per_person',
      lines: [
        'You go, I go: Én arbejder, mens den anden restituerer og gør stationen klar. '
        + `Skift ${sw.text}. Arbejdet er per person.`,
        'Den ventende har en reel pause — brug den på at trække vejret og sætte næste station op.',
        'Når begge har været igennem øvelsen, starter næste øvelse direkte.',
      ],
      logistics: logisticsFor(bottlenecks, req, true),
    };
  }

  if (format === 'partner_shared') {
    return {
      mode: 'shared',
      title: 'Partner shared work',
      working: 'Kun én arbejder ad gangen.',
      resting: 'De øvrige hviler, indtil de tager over.',
      switchOn: 'når I selv vil — I deler det samlede antal',
      switchUnit: sw.unit,
      realRest: true,
      nextStartsImmediately: true,
      workShare: 'shared',
      lines: [
        'Partner shared work: Tallene er det samlede arbejde, I deler mellem jer.',
        'I bestemmer selv fordelingen, men kun én arbejder ad gangen.',
        'Er I ikke lige stærke, så del i ulige bidder frem for at presse den ene.',
      ],
      logistics: logisticsFor(bottlenecks, req, true),
    };
  }

  const singleStation = bottlenecks.some((b) => b.have === 1);
  if (singleStation) {
    return {
      mode: 'relay',
      title: 'Team rotation (relay)',
      working: 'Én arbejder på det delte redskab.',
      resting: 'De øvrige arbejder videre på de frie stationer.',
      switchOn: sw.text,
      switchUnit: sw.unit,
      realRest: false,
      nextStartsImmediately: true,
      workShare: 'per_person',
      lines: [
        `Team rotation: I er ${p}, og der er kun ét af det tungeste redskab. Kør relay.`,
        'Én ad gangen på det delte redskab. De andre kører videre på de øvrige stationer.',
        'Rækkefølgen aftales før start, så ingen står og venter på tur.',
      ],
      logistics: logisticsFor(bottlenecks, req, true),
    };
  }

  return {
    mode: bottlenecks.length ? 'rotation' : 'synchro',
    title: bottlenecks.length ? 'Team rotation' : 'Team rotation (samtidig)',
    working: bottlenecks.length ? 'Alle arbejder — hver på sin station.' : `Alle ${p} arbejder samtidig.`,
    resting: bottlenecks.length ? 'Pausen ligger i skiftet mellem stationerne.' : 'Pauserne er dem, formatet giver.',
    switchOn: 'på signal, når intervallet er slut',
    switchUnit: 'interval',
    realRest: false,
    nextStartsImmediately: true,
    workShare: 'per_person',
    lines: bottlenecks.length
      ? [
        `Team rotation: ${p} deltagere fordelt på faste stationer.`,
        'I rykker én station frem på signal. Efterlad stationen klar til den næste.',
        'Målene på listen er per person — ikke delt.',
      ]
      : [
        `Alle ${p} arbejder samtidig. Der er udstyr nok til, at ingen venter.`,
        'Målene på listen er per person.',
      ],
    logistics: logisticsFor(bottlenecks, req, false),
  };
}
