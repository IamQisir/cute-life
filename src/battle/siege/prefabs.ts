import { decodeRle } from '../../share/rle';
import { RED, stepGrid, type Pt, type Grid } from '../arena';

export const UNIT_IDS = ['gosperglidergun', 'eater1', 'lwss', 'glider', 'block', 'rpentomino'] as const;
export type UnitId = typeof UNIT_IDS[number];
/** D4: reflect horizontally first, then rotate clockwise in screen coordinates. */
export type Orientation = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface Prefab { id: UnitId; cells: Pt[]; cost: number; width: number; height: number }
export type Prefabs = Record<UnitId, Prefab>;
export interface Stamp { id: UnitId; x: number; y: number; orientation?: Orientation }

export function normalize(cells: Pt[]): Pt[] {
  const x0 = Math.min(...cells.map(([x]) => x));
  const y0 = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - x0, y - y0]);
}
export function orient(cells: Pt[], orientation: Orientation = 0): Pt[] {
  let result = cells.map(([x, y]): Pt => [orientation >= 4 ? -x : x, y]);
  for (let r = 0; r < orientation % 4; r++) result = result.map(([x, y]) => [-y, x]);
  return normalize(result);
}
/** Same trusted RLE assets and decoder as catalog.ts; injected to avoid Vite's glob in tsx. */
export function loadPrefabs(sources: Record<UnitId, string>): Prefabs {
  return Object.fromEntries(UNIT_IDS.map((id) => {
    const cells = normalize(decodeRle(sources[id]));
    return [id, { id, cells, cost: cells.length,
      width: Math.max(...cells.map(([x]) => x)) + 1,
      height: Math.max(...cells.map(([, y]) => y)) + 1 }];
  })) as Prefabs;
}
export function stamp(prefabs: Prefabs, unit: Stamp): Pt[] {
  return orient(prefabs[unit.id].cells, unit.orientation).map(([x, y]) => [x + unit.x, y + unit.y]);
}
export function army(prefabs: Prefabs, units: Stamp[]): Pt[] { return units.flatMap((u) => stamp(prefabs, u)); }

/** Diagnostic phase experiment only: noncanonical phases are NOT deployable at the seed price. */
export function phase(cells: Pt[], generations: number): Pt[] {
  let grid: Grid = new Uint8Array(64 * 64);
  for (const [x, y] of cells) grid[(y + 24) * 64 + x + 24] = RED;
  for (let g = 0; g < generations; g++) grid = stepGrid(grid, 64, 64, false, false);
  const points: Pt[] = [];
  grid.forEach((c, i) => { if (c) points.push([i % 64, Math.floor(i / 64)]); });
  return normalize(points);
}
