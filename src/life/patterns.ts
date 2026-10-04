// Classic patterns as row strings: 'O' = live, anything else = empty.

export interface Pattern {
  name: string;
  rows: string[];
}

export const PATTERNS: Pattern[] = [
  { name: 'glider', rows: ['.O.', '..O', 'OOO'] },
  { name: 'blinker', rows: ['OOO'] },
  { name: 'toad', rows: ['.OOO', 'OOO.'] },
  { name: 'beacon', rows: ['OO..', 'OO..', '..OO', '..OO'] },
  { name: 'lwss', rows: ['.O..O', 'O....', 'O...O', 'OOOO.'] },
  { name: 'pulsar', rows: [
    '..OOO...OOO..',
    '.............',
    'O....O.O....O',
    'O....O.O....O',
    'O....O.O....O',
    '..OOO...OOO..',
    '.............',
    '..OOO...OOO..',
    'O....O.O....O',
    'O....O.O....O',
    'O....O.O....O',
    '.............',
    '..OOO...OOO..',
  ] },
  { name: 'r-pentomino', rows: ['.OO', 'OO.', '.O.'] },
  { name: 'acorn', rows: ['.O.....', '...O...', 'OO..OOO'] },
  { name: 'block', rows: ['OO', 'OO'] },
];

/** Cheap structures that move or grow: the useful ones under a cell budget. */
export const BATTLE_PATTERN_NAMES = ['glider', 'lwss', 'acorn', 'r-pentomino', 'block', 'blinker', 'toad'];

export function cellCount(p: Pattern): number {
  return p.rows.join('').split('').filter((c) => c === 'O').length;
}

/** Returns pattern cells centred on (cx, cy). */
export function placePattern(p: Pattern, cx: number, cy: number): [number, number][] {
  const h = p.rows.length;
  const w = Math.max(...p.rows.map((r) => r.length));
  const ox = cx - Math.floor(w / 2);
  const oy = cy - Math.floor(h / 2);
  const out: [number, number][] = [];
  p.rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === 'O') out.push([ox + x, oy + y]);
    });
  });
  return out;
}
