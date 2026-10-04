import { decodeRle } from '../share/rle';
import { patternFromRle } from './library';
import { cellCount, type Pattern } from './patterns';

export type Category = 'still' | 'oscillator' | 'spaceship' | 'methuselah' | 'gun' | 'puffer' | 'growth' | 'reflector';

export const CATEGORY_LABELS: Record<Category, string> = {
  still: 'still lifes', oscillator: 'oscillators', spaceship: 'spaceships',
  methuselah: 'methuselahs', gun: 'guns', puffer: 'puffers & rakes',
  growth: 'infinite growth', reflector: 'reflectors',
};

export interface CatalogEntry extends Pattern {
  id: string;
  name: string;
  fullName: string;
  author?: string;
  blurb: string;
  category: Category;
  /** Fundamental cycle; for emitters/reflectors this describes their core. */
  period?: number;
  cells: number;
}

type Description = [id: string, name: string, category: Category, blurb: string, period?: number];

// Explicit order keeps familiar, simple patterns first within each category.
// Classify the supplied seeds: a lone switch engine is a methuselah,
// the supported queen bee is an oscillator, and hivenudger is a spaceship.
// Buckaroo is filed with reflectors; it also oscillates on its own.
const DESCRIPTIONS: Description[] = [
  ['block', 'block', 'still', 'a tiny square that stays put'],
  ['beehive', 'beehive', 'still', 'a little hollow hexagon that stays put'],
  ['loaf', 'loaf', 'still', 'a seven-cell loop that stays put'],
  ['boat', 'boat', 'still', 'a five-cell boat that stays put'],
  ['tub', 'tub', 'still', 'a four-cell diamond that stays put'],
  ['pond', 'pond', 'still', 'an eight-cell ring that stays put'],
  ['ship', 'ship', 'still', 'this little ship stays anchored'],
  ['eater1', 'eater 1', 'still', 'a seven-cell still life'],
  ['eater2', 'eater 2', 'still', 'a nineteen-cell still life'],
  ['blinker', 'blinker', 'oscillator', 'three cells blink back and forth', 2],
  ['toad', 'toad', 'oscillator', 'two rows trade places every two generations', 2],
  ['beacon', 'beacon', 'oscillator', 'two corners blink every two generations', 2],
  ['clock', 'clock', 'oscillator', 'a tiny clock with a two-generation tick', 2],
  ['pulsar', 'pulsar', 'oscillator', 'a symmetric pulse every three generations', 3],
  ['pentadecathlon', 'pentadecathlon', 'oscillator', 'a fifteen-generation dance', 15],
  ['figureeight', 'figure eight', 'oscillator', 'two lobes dance through eight generations', 8],
  ['koksgalaxy', "kok's galaxy", 'oscillator', 'a swirling eight-generation cycle', 8],
  ['tumbler', 'tumbler', 'oscillator', 'tumbles in place every fourteen generations', 14],
  ['queenbeeshuttle', 'queen bee', 'oscillator', 'a supported shuttle with a thirty-generation cycle', 30],
  ['twinbeesshuttle', 'twin bees', 'oscillator', 'a supported shuttle with a forty-six-generation cycle', 46],
  ['glider', 'glider', 'spaceship', 'slides diagonally one cell every four generations', 4],
  ['lwss', 'lwss', 'spaceship', 'cruises two cells every four generations', 4],
  ['mwss', 'mwss', 'spaceship', 'cruises two cells every four generations', 4],
  ['hwss', 'hwss', 'spaceship', 'cruises two cells every four generations', 4],
  ['copperhead', 'copperhead', 'spaceship', 'creeps one cell every ten generations', 10],
  ['bigglider', 'big glider', 'spaceship', 'a larger diagonal traveler at one cell every four ticks', 4],
  ['hivenudger', 'hivenudger', 'spaceship', 'carries its hive two cells every four generations', 4],
  ['rpentomino', 'r-pentomino', 'methuselah', 'five cells grow into a long-lived adventure'],
  ['acorn', 'acorn', 'methuselah', 'seven cells blossom into a busy world'],
  ['diehard', 'diehard', 'methuselah', 'vanishes completely at generation 130'],
  ['rabbits', 'rabbits', 'methuselah', 'nine cells start a sprawling adventure'],
  ['piheptomino', 'pi-heptomino', 'methuselah', 'seven cells open into a lively cloud'],
  ['switchengine', 'switch engine', 'methuselah', 'alone, this eight-cell engine eventually runs out'],
  ['gosperglidergun', 'gosper gun', 'gun', 'fires a glider every thirty generations', 30],
  ['simkinglidergun', 'simkin gun', 'gun', 'fires a glider every 120 generations', 120],
  ['p46gun', 'p46 gun', 'gun', 'fires a glider every forty-six generations', 46],
  ['newgun1', 'new gun 1', 'gun', 'another forty-six-generation glider factory', 46],
  ['puffer1', 'puffer 1', 'puffer', 'moves at half speed, leaving a repeating wake', 128],
  ['puffer2', 'puffer 2', 'puffer', 'moves at half speed with a 140-generation wake', 140],
  ['spacerake', 'space rake', 'puffer', 'a half-speed traveler that sheds gliders', 20],
  ['backrake1', 'backrake 1', 'puffer', 'a half-speed traveler that sheds gliders behind it', 8],
  ['noahsark', "noah's ark", 'puffer', 'two engines leave a growing diagonal wake', 1344],
  ['10cellinfinitegrowth', '10-cell growth', 'growth', 'ten cells seed a steadily growing wake'],
  ['5x5infinitegrowth', '5x5 growth', 'growth', 'a tiny square seed grows a sprawling wake'],
  // This RLE includes an incoming glider alongside the stable reflector.
  ['snark', 'snark', 'reflector', 'a stable reflector shown with an incoming glider', 1],
  ['buckaroo', 'buckaroo', 'reflector', 'a glider reflector with a thirty-generation heartbeat', 30],
];

const sources = import.meta.glob<string>('./catalog/*.rle', {
  query: '?raw', import: 'default', eager: true,
});

function load([id, name, category, blurb, period]: Description): CatalogEntry {
  const text = sources[`./catalog/${id}.rle`];
  if (text === undefined) throw new Error(`Missing catalog pattern: ${id}`);
  const fullName = /^#N\s+([^\r\n]+)/m.exec(text)?.[1].trim();
  const author = /^#O\s+([^\r\n]+)/m.exec(text)?.[1].trim();
  if (!fullName) throw new Error(`Missing catalog title: ${id}`);
  const rule = /^x\s*=.*\brule\s*=\s*([^\r\n]+)/mi.exec(text)?.[1].trim().toUpperCase();
  if (rule !== 'B3/S23' && rule !== '23/3') throw new Error(`Unsupported catalog rule: ${id}`);

  let rows = patternFromRle(text, name)?.rows;
  if (!rows) {
    // Catalog assets are trusted local RLEs, independent of custom-stamp limits.
    const points = decodeRle(text);
    if (!points.length) throw new Error(`Empty catalog pattern: ${id}`);
    const minX = Math.min(...points.map(([x]) => x));
    const minY = Math.min(...points.map(([, y]) => y));
    const width = Math.max(...points.map(([x]) => x)) - minX + 1;
    const height = Math.max(...points.map(([, y]) => y)) - minY + 1;
    const grid = Array.from({ length: height }, () => Array<string>(width).fill('.'));
    for (const [x, y] of points) grid[y - minY][x - minX] = 'O';
    rows = grid.map((row) => row.join(''));
  }
  const pattern = { name, rows };
  return { ...pattern, id, fullName, ...(author ? { author } : {}), blurb,
    category, ...(period === undefined ? {} : { period }), cells: cellCount(pattern) };
}

export const CATALOG: CatalogEntry[] = DESCRIPTIONS.map(load);

export function byCategory(): { category: Category; label: string; entries: CatalogEntry[] }[] {
  return (Object.keys(CATEGORY_LABELS) as Category[]).map((category) => ({
    category, label: CATEGORY_LABELS[category],
    entries: CATALOG.filter((entry) => entry.category === category),
  }));
}
