import { CATALOG } from '../life/catalog';
import { fromList, step, toList, type Cells } from '../life/engine';
import { placePattern } from '../life/patterns';

export const WELCOME_CELL_CAP = 4000;
export const WELCOME_PRE_ADVANCE = 120;
export const WELCOME_GEN_PER_SEC = 8;

/** Local warmup staggers the two period-30 emitters into a gentle rhythm. */
export const SHOWCASE_GUNS = [
  { x: -70, y: -35, period: 30, phase: 0 },
  { x: 65, y: -65, period: 30, phase: 15 },
] as const;

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
    let cells = fromList(placePattern(pattern, x, y));
    const phase = SHOWCASE_GUNS.find((gun) => gun.x === x && gun.y === y)?.phase ?? 0;
    for (let i = 0; i < phase; i++) cells = step(cells);
    return toList(cells);
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
