import { CATALOG } from '../life/catalog';
import { fromList, step, type Cells } from '../life/engine';
import { placePattern } from '../life/patterns';

export const WELCOME_CELL_CAP = 4000;
export const WELCOME_PRE_ADVANCE = 120;
export const WELCOME_GEN_PER_SEC = 8;

/** Separated lanes keep emitters, wakes and blooming seeds from colliding. */
export const SHOWCASE_STAMPS: readonly [string, number, number][] = [
  ['gosperglidergun', -70, -35], ['gosperglidergun', 65, -65],
  ['simkinglidergun', 100, 40], ['spacerake', -75, 100],
  ['pulsar', -115, -85], ['pulsar', 0, 25],
  ['pentadecathlon', -20, -75], ['pentadecathlon', 40, 20],
  ['acorn', 5, 90], ['rpentomino', 85, -120],
  ...[-1, 0, 1].flatMap((i): [string, number, number][] => [
    ['lwss', 80 + i * 22, -15], ['mwss', 80 + i * 22, 0], ['hwss', 80 + i * 22, 15],
  ]),
];

export function showcaseSeed(): Cells {
  return fromList(SHOWCASE_STAMPS.flatMap(([id, x, y]) => {
    const pattern = CATALOG.find((entry) => entry.id === id);
    if (!pattern) throw new Error(`Missing showcase pattern: ${id}`);
    return placePattern(pattern, x, y);
  }));
}

/** Headless warmup: no animation records or renderer work before the first frame. */
export function buildWelcomeScene(): Cells {
  let cells = showcaseSeed();
  for (let i = 0; i < WELCOME_PRE_ADVANCE; i++) {
    cells = step(cells);
    if (cells.size >= WELCOME_CELL_CAP) throw new Error('Showcase exceeds its cell budget');
  }
  return cells;
}
