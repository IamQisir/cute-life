import { t } from '../i18n';
import { en } from '../i18n/en';
import { decodeRle } from '../share/rle';
import { patternFromRle } from './library';
import { cellCount, type Pattern } from './patterns';

export type Category = 'still' | 'oscillator' | 'spaceship' | 'methuselah' | 'gun' | 'puffer' | 'growth' | 'reflector';

export const CATEGORY_LABELS: Record<Category, string> = t.categories;

export interface CatalogEntry extends Pattern {
  id: string;
  /** English name, stable across languages (identity, tests). */
  name: string;
  /** Card name in the current language. */
  label: string;
  fullName: string;
  author?: string;
  blurb: string;
  category: Category;
  /** Fundamental cycle; for emitters/reflectors this describes their core. */
  period?: number;
  cells: number;
}

type Description = [id: PatternId, category: Category, period?: number];
type PatternId = keyof typeof en.patterns;

// Explicit order keeps familiar, simple patterns first within each category.
// Classify the supplied seeds: a lone switch engine is a methuselah,
// the supported queen bee is an oscillator, and hivenudger is a spaceship.
// Buckaroo is filed with reflectors; it also oscillates on its own.
const DESCRIPTIONS: Description[] = [
  ['block', 'still'],
  ['beehive', 'still'],
  ['loaf', 'still'],
  ['boat', 'still'],
  ['tub', 'still'],
  ['pond', 'still'],
  ['ship', 'still'],
  ['eater1', 'still'],
  ['eater2', 'still'],
  ['blinker', 'oscillator', 2],
  ['toad', 'oscillator', 2],
  ['beacon', 'oscillator', 2],
  ['clock', 'oscillator', 2],
  ['pulsar', 'oscillator', 3],
  ['pentadecathlon', 'oscillator', 15],
  ['figureeight', 'oscillator', 8],
  ['koksgalaxy', 'oscillator', 8],
  ['tumbler', 'oscillator', 14],
  ['queenbeeshuttle', 'oscillator', 30],
  ['twinbeesshuttle', 'oscillator', 46],
  ['glider', 'spaceship', 4],
  ['lwss', 'spaceship', 4],
  ['mwss', 'spaceship', 4],
  ['hwss', 'spaceship', 4],
  ['copperhead', 'spaceship', 10],
  ['bigglider', 'spaceship', 4],
  ['hivenudger', 'spaceship', 4],
  ['rpentomino', 'methuselah'],
  ['acorn', 'methuselah'],
  ['diehard', 'methuselah'],
  ['rabbits', 'methuselah'],
  ['piheptomino', 'methuselah'],
  ['switchengine', 'methuselah'],
  ['gosperglidergun', 'gun', 30],
  ['simkinglidergun', 'gun', 120],
  ['p46gun', 'gun', 46],
  ['newgun1', 'gun', 46],
  ['puffer1', 'puffer', 128],
  ['puffer2', 'puffer', 140],
  ['spacerake', 'puffer', 20],
  ['backrake1', 'puffer', 8],
  ['noahsark', 'puffer', 1344],
  ['10cellinfinitegrowth', 'growth'],
  ['5x5infinitegrowth', 'growth'],
  // This RLE includes an incoming glider alongside the stable reflector.
  ['snark', 'reflector', 1],
  ['buckaroo', 'reflector', 30],
];

const sources = import.meta.glob<string>('./catalog/*.rle', {
  query: '?raw', import: 'default', eager: true,
});

function load([id, category, period]: Description): CatalogEntry {
  const [name] = en.patterns[id];
  const [label, localBlurb] = t.patterns[id];
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
  return { ...pattern, id, label, fullName, ...(author ? { author } : {}), blurb: localBlurb,
    category, ...(period === undefined ? {} : { period }), cells: cellCount(pattern) };
}

export const CATALOG: CatalogEntry[] = DESCRIPTIONS.map(load);

export function byCategory(): { category: Category; label: string; entries: CatalogEntry[] }[] {
  return (Object.keys(CATEGORY_LABELS) as Category[]).map((category) => ({
    category, label: CATEGORY_LABELS[category],
    entries: CATALOG.filter((entry) => entry.category === category),
  }));
}
