// Crystal Siege units in the browser: the six canonical prefabs, the per-army
// limits, and a non-throwing version of validateArmy for live placement.

import gun from '../../life/catalog/gosperglidergun.rle?raw';
import eater from '../../life/catalog/eater1.rle?raw';
import lwss from '../../life/catalog/lwss.rle?raw';
import glider from '../../life/catalog/glider.rle?raw';
import block from '../../life/catalog/block.rle?raw';
import rpentomino from '../../life/catalog/rpentomino.rle?raw';
import { BLUE, RED, type Pt, type Team } from '../arena';
import type { Orientation as StampOrientation } from '../../life/orientation';
import { UNIT_IDS, loadPrefabs, normalize, orient, stamp, type Orientation, type Prefabs, type Stamp, type UnitId } from './prefabs';
import { crystalRect, inside, type SiegeRules } from './siegeSim';

export const PREFABS: Prefabs = loadPrefabs({ gosperglidergun: gun, eater1: eater, lwss, glider, block, rpentomino });

/** Units with a cap per army; the rest are limited only by the budget. */
export const UNIT_LIMITS: Partial<Record<UnitId, number>> = { gosperglidergun: 1, eater1: 2, rpentomino: 2 };

export type ArmyProblem = 'zone' | 'crystal' | 'overlap' | 'limit' | 'budget';

/** The sandbox's rotate/flip state as a prefab orientation (both mirror first, then rotate clockwise). */
export function orientationOf(o: StampOrientation): Orientation {
  return (o.rot + (o.flip ? 4 : 0)) as Orientation;
}

/** The stamp whose cells are exactly `points` (an oriented prefab, translated). */
export function stampAt(id: UnitId, orientation: Orientation, points: Pt[]): Stamp {
  return { id, x: Math.min(...points.map(([x]) => x)), y: Math.min(...points.map(([, y]) => y)), orientation };
}

/** Why this army breaks the siege rules, or null. Same checks as validateArmy (siegeSim.ts), without throwing. */
export function armyProblem(rules: SiegeRules, prefabs: Prefabs, team: Team, stamps: Stamp[]): ArmyProblem | null {
  const zone = team === RED ? rules.redZone : rules.blueZone;
  const crystals = [crystalRect(rules, RED), crystalRect(rules, BLUE)];
  const seen = new Set<string>();
  let cells = 0;
  for (const unit of stamps) {
    for (const point of stamp(prefabs, unit)) {
      if (!inside(point, zone)) return 'zone';
      if (crystals.some((box) => inside(point, box, rules.halo))) return 'crystal';
      const key = point.join(',');
      if (seen.has(key)) return 'overlap';
      seen.add(key);
      cells++;
    }
  }
  for (const [id, limit] of Object.entries(UNIT_LIMITS)) {
    if (stamps.filter((s) => s.id === id).length > limit!) return 'limit';
  }
  return cells > rules.budget ? 'budget' : null;
}

export function armyCost(prefabs: Prefabs, stamps: Stamp[]): number {
  return stamps.reduce((sum, s) => sum + prefabs[s.id].cost, 0);
}

/** Index of the unit covering a cell, or -1. */
export function unitAt(prefabs: Prefabs, stamps: Stamp[], x: number, y: number): number {
  return stamps.findIndex((s) => stamp(prefabs, s).some(([px, py]) => px === x && py === y));
}

const shapeKey = (cells: Pt[]) => cells.map(([x, y]) => `${x},${y}`).sort().join(';');

/** The same army reflected left-right across an arena `width` cells wide (red recipes → blue). */
export function mirrorStamps(prefabs: Prefabs, stamps: Stamp[], width: number): Stamp[] {
  return stamps.map((unit) => {
    const points = stamp(prefabs, unit);
    const target = shapeKey(normalize(points.map(([x, y]): Pt => [-x, y])));
    const orientation = Array.from({ length: 8 }, (_, o) => o as Orientation)
      .find((o) => shapeKey(orient(prefabs[unit.id].cells, o)) === target)!;
    return { id: unit.id, x: width - 1 - Math.max(...points.map(([x]) => x)), y: unit.y, orientation };
  });
}

export { UNIT_IDS };
