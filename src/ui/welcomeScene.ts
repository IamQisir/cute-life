import { CATALOG } from '../life/catalog';
import { fromList, step, toList, type Cells } from '../life/engine';
import { placePattern } from '../life/patterns';

export const WELCOME_CELL_CAP = 12000;
export const WELCOME_SMALL_CAP = 5000;
export const WELCOME_PRE_ADVANCE = 120;
export const WELCOME_GEN_PER_SEC = 12;
export const WELCOME_GENESIS = { x: 0, y: -128 };
export const WELCOME_WORLD = { width: 390, height: 300 };

/** Mirrored batteries aim their streams into two collision corridors, outside the lettering. */
export const SHOWCASE_GUNS = [
  { x: -136, y: -100, period: 30, phase: 0, flipX: false, flipY: false },
  { x: -48, y: -100, period: 30, phase: 15, flipX: true, flipY: false },
  { x: 48, y: 120, period: 30, phase: 0, flipX: false, flipY: true },
  { x: 136, y: 120, period: 30, phase: 15, flipX: true, flipY: true },
] as const;
export const COLLISION_ZONES = [{ x: -85, y: -55, radius: 28 }, { x: 99, y: 55, radius: 28 }];
export const SHOWCASE_STAMPS: readonly [string, number, number][] = [
  ['spacerake', -175, -115], ['puffer2', -160, 130],
  ['pulsar', -165, -38], ['pulsar', -165, 5], ['pulsar', -165, 48],
  ['pulsar', 165, -12], ['pulsar', 165, 35],
  ['pentadecathlon', 55, -70], ['pentadecathlon', 95, -70],
  ...[0, 1, 2].flatMap((i): [string, number, number][] => [
    ['lwss', 160 + i * 24, 72], ['mwss', 160 + i * 24, 84], ['hwss', 160 + i * 24, 96],
  ]),
];

export function welcomePattern(id: string, x: number, y: number): [number, number][] {
  const pattern = CATALOG.find((entry) => entry.id === id);
  if (!pattern) throw new Error(`Missing showcase pattern: ${id}`);
  return placePattern(pattern, x, y);
}

const LETTERS: Record<string, string[]> = {
  c: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  u: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  t: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  e: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  l: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  i: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  f: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
};
/** Each ink pixel is an isolated 2×2 block, with a three-cell moat. Actual B3/S23 lettering. */
export function welcomeLettering(): Cells {
  const points: [number, number][] = [];
  let offset = -125;
  for (const letter of 'cute life') {
    if (letter === ' ') { offset += 15; continue; }
    LETTERS[letter].forEach((row, y) => [...row].forEach((pixel, x) => {
      if (pixel === '1') points.push(...welcomePattern('block', offset + x * 5, -15 + y * 5));
    }));
    offset += 30;
  }
  return fromList(points);
}

export function showcaseSeed(small = false): Cells {
  const points = toList(welcomeLettering());
  for (const gun of SHOWCASE_GUNS.slice(0, small ? 2 : 4)) {
    let cells = fromList(welcomePattern('gosperglidergun', 0, 0));
    for (let i = 0; i < gun.phase; i++) cells = step(cells);
    points.push(...toList(cells).map(([x, y]): [number, number] => [gun.x + x * (gun.flipX ? -1 : 1), gun.y + y * (gun.flipY ? -1 : 1)]));
  }
  const stamps = small ? SHOWCASE_STAMPS.filter(([id, x]) => id !== 'puffer2' && x <= 175) : SHOWCASE_STAMPS;
  for (const [id, x, y] of stamps) points.push(...welcomePattern(id, x, y));
  return fromList(points);
}

/** No renderer work or animation records during warmup. */
export function buildWelcomeScene(small = false): Cells {
  let cells = showcaseSeed(small);
  const cap = small ? WELCOME_SMALL_CAP : WELCOME_CELL_CAP;
  for (let i = 0; i < WELCOME_PRE_ADVANCE; i++) {
    cells = step(cells);
    if (cells.size > cap) throw new Error('Showcase exceeds its cell budget');
  }
  return cells;
}

/** A separate, compact live menu tableau: the real renderer draws its creatures. */
export function buildTitleScene(): Cells {
  return fromList([
    ...welcomePattern('pulsar', -48, -25), ...welcomePattern('pulsar', 48, 25),
    ...welcomePattern('pentadecathlon', -40, 30),
    ...['lwss', 'mwss', 'hwss'].flatMap((id, i) => welcomePattern(id, 35 + i * 20, -20 + i * 20)),
    ...welcomePattern('glider', -10, -35), ...welcomePattern('glider', 10, 35),
  ]);
}
