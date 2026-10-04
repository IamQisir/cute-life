import { fromList, step, toList, type Cells } from '../life/engine';
import { welcomePattern } from './welcomePatterns';
export { welcomePattern } from './welcomePatterns';

export const WELCOME_CELL_CAP = 12000;
export const WELCOME_SMALL_CAP = 5000;
export const WELCOME_PRE_ADVANCE = 120;
export const WELCOME_GEN_PER_SEC = 12;
export const WELCOME_GENESIS = { x: 0, y: -128 };
export const WELCOME_WORLD = { width: 390, height: 300 };

/** The four foreground guns also provide the score's original staggered ticks. */
export const SHOWCASE_GUNS = [
  { x: -136, y: -100, period: 30, phase: 0, flipX: false, flipY: false },
  { x: -48, y: -100, period: 30, phase: 15, flipX: true, flipY: false },
  { x: 48, y: 120, period: 30, phase: 0, flipX: false, flipY: true },
  { x: 136, y: 120, period: 30, phase: 15, flipX: true, flipY: true },
] as const;
/** Mirrored batteries aim their streams into six collision corridors, outside the lettering. */
export const SHOWCASE_BATTERIES = [
  ...SHOWCASE_GUNS,
  ...[-250, 250].flatMap((y) => [-136, -48, 48, 136].map((x, i) => ({
    x, y, period: 30, phase: i % 2 * 15, flipX: i % 2 === 1, flipY: y > 0,
  }))),
] as const;
export const COLLISION_ZONES = [
  { x: -85, y: -55, radius: 28 }, { x: 99, y: 55, radius: 28 },
  ...[-205, 205].flatMap((y) => [-85, 99].map((x) => ({ x, y, radius: 28 }))),
];
export const SHOWCASE_STAMPS: readonly [string, number, number][] = [
  ['spacerake', -175, -145], ['puffer2', -160, 130],
  ['pulsar', -165, -38], ['pulsar', -165, 5], ['pulsar', -165, 48],
  ['pulsar', 165, -12], ['pulsar', 165, 35],
  ['pentadecathlon', 55, -70], ['pentadecathlon', 95, -70],
  ...Array.from({ length: 11 }).flatMap((_, i): [string, number, number][] => [
    ['lwss', -56 + i * 24, 60], ['lwss', -44 + i * 24, 72],
    ['mwss', -56 + i * 24, 84], ['hwss', -44 + i * 24, 96],
  ]),
];


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
  // The small cast keeps the focus battery and half of the distant emitters.
  for (const gun of SHOWCASE_BATTERIES.filter((_, i) => !small || i < 2 || (i >= 4 && i % 2 === 0))) {
    let cells = fromList(welcomePattern('gosperglidergun', 0, 0));
    for (let i = 0; i < gun.phase; i++) cells = step(cells);
    points.push(...toList(cells).map(([x, y]): [number, number] => [gun.x + x * (gun.flipX ? -1 : 1), gun.y + y * (gun.flipY ? -1 : 1)]));
  }
  const stamps = small ? SHOWCASE_STAMPS.filter(([id, x, y]) =>
    id !== 'puffer2' && (!id.endsWith('wss') || (x >= 16 && x <= 160 && y >= 72 && y <= 96))) : SHOWCASE_STAMPS;
  for (const [id, x, y] of stamps) points.push(...welcomePattern(id, x, y));
  if (!small) {
    // Two more engines write wakes along the outside of the portrait starfield.
    for (const sign of [-1, 1]) {
      points.push(...welcomePattern('puffer2', 0, 0).map(([x, y]): [number, number] => [sign * (200 + x), sign * (200 - y)]));
    }
  }
  // A cross-shaped starfield covers both a landscape sweep and the tall phone reveal.
  // Phase offsets keep the glitter moving without synchronising its population peaks.
  const spacing = small ? 40 : 30;
  const rows = Math.floor(350 / spacing);
  const cols = Math.floor(225 / spacing);
  for (let row = -rows; row <= rows; row++) {
    const y = row * spacing;
    for (let col = -cols; col <= cols; col++) {
      const x = col * spacing;
      if (Math.abs(x) > (Math.abs(y) > 160 ? 150 : 225)) continue;
      // Leave the title moat, genesis bloom, gun corridors, rake and fleet lanes open.
      if (Math.abs(x) < 155 && Math.abs(y) < 44) continue;
      if (y > 40 && y < 145 && x < 180) continue;
      if (y < -35 && y > -190 && x < 30) continue;
      if (x < -130 && y > -45 && y < 150) continue;
      if (Math.abs(y) > 165 && Math.abs(y) < 275 && Math.abs(x) > 15 && Math.abs(x) < 130) continue;
      const index = row + col + 30;
      const pulsar = small ? col === 0 && Math.abs(row) === rows : index % 3 !== 0;
      const id = pulsar ? 'pulsar' : 'pentadecathlon';
      const period = id === 'pulsar' ? 3 : 15;
      let glitter = fromList(welcomePattern(id, 0, 0));
      for (let phase = 0; phase < ((row * 7 + col * 11 + 300) % period); phase++) glitter = step(glitter);
      points.push(...toList(glitter).map(([dx, dy]): [number, number] => [x + dx, y + dy]));
    }
  }
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

export { buildTitleScene } from './welcomeTitleScene';
