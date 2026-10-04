import { describe, expect, it } from 'vitest';
import { byCategory, CATALOG, CATEGORY_LABELS, type CatalogEntry } from '../src/life/catalog';
import { findClusters } from '../src/life/clusters';
import { fromList, key, keyX, keyY, step, type Cells } from '../src/life/engine';
import { pointsFromRows } from '../src/life/library';
import { cellCount } from '../src/life/patterns';
import { decodeRle } from '../src/share/rle';

type Bounds = [minX: number, minY: number, maxX: number, maxY: number];
type Offset = [dx: number, dy: number];

const sources = import.meta.glob<string>('../src/life/catalog/*.rle', {
  query: '?raw', import: 'default', eager: true,
});
const entries = (category: CatalogEntry['category']) => CATALOG.filter(e => e.category === category);
const seed = (entry: CatalogEntry) => fromList(pointsFromRows(entry.rows));
const same = (a: Cells, b: Cells) => a.size === b.size && [...a].every(k => b.has(k));

function bounds(cells: Cells): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of cells) {
    const x = keyX(k), y = keyY(k);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}

function translate(cells: Cells, [dx, dy]: Offset): Cells {
  return new Set([...cells].map(k => key(keyX(k) + dx, keyY(k) + dy)));
}

function inside(cells: Cells, [minX, minY, maxX, maxY]: Bounds): Cells {
  return new Set([...cells].filter(k => keyX(k) >= minX && keyY(k) >= minY
    && keyX(k) <= maxX && keyY(k) <= maxY));
}

function advance(cells: Cells, generations: number): Cells {
  for (let t = 0; t < generations; t++) cells = step(cells);
  return cells;
}

function displacement(original: Cells, future: Cells): Offset | null {
  if (!original.size || original.size !== future.size) return null;
  const a = bounds(original), b = bounds(future);
  const offset: Offset = [b[0] - a[0], b[1] - a[1]];
  return same(translate(original, offset), future) ? offset : null;
}

function verifyCycle(entry: CatalogEntry, initial = seed(entry)): void {
  expect(entry.period).toBeGreaterThan(0);
  let cells = initial;
  for (let t = 1; t <= entry.period!; t++) {
    cells = step(cells);
    expect(same(initial, cells), `${entry.id} at generation ${t}`).toBe(t === entry.period);
  }
}

describe('catalog metadata and source fidelity', () => {
  it('includes all 46 files once, in category order, with friendly metadata', () => {
    const ids = Object.keys(sources).map(path => path.split('/').at(-1)!.replace(/\.rle$/, ''));
    expect(ids).toHaveLength(46);
    expect(CATALOG).toHaveLength(46);
    expect(new Set(CATALOG.map(e => e.id)).size).toBe(46);
    expect(CATALOG.map(e => e.id).sort()).toEqual(ids.sort());
    const groups = byCategory();
    expect(groups.map(g => g.category)).toEqual(Object.keys(CATEGORY_LABELS));
    expect(groups.flatMap(g => g.entries)).toEqual(CATALOG);
    for (const group of groups) {
      expect(group.label).toBe(CATEGORY_LABELS[group.category]);
      expect(group.entries.length).toBeGreaterThan(0);
      expect(group.entries.every(e => e.category === group.category)).toBe(true);
    }
    for (const e of CATALOG) {
      expect(Object.keys(CATEGORY_LABELS)).toContain(e.category);
      expect(e.name).toBe(e.name.toLowerCase());
      expect(e.name.trim()).toBe(e.name);
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.name.length).toBeLessThanOrEqual(16);
      expect(e.blurb.length).toBeGreaterThan(0);
      expect(e.blurb.length).toBeLessThanOrEqual(70);
      expect(e.blurb).not.toMatch(/[\r\n]/);
      expect(e.cells).toBe(cellCount(e));
      if (['oscillator', 'spaceship', 'gun', 'puffer', 'reflector'].includes(e.category)) {
        expect(Number.isInteger(e.period)).toBe(true);
        expect(e.period).toBeGreaterThan(0);
      } else expect(e.period).toBeUndefined();
    }
  });

  it.each(CATALOG)('$id parses without changing the supplied live cells or attribution', e => {
    const text = sources[`../src/life/catalog/${e.id}.rle`];
    expect(text).toBeDefined();
    expect(e.fullName).toBe(/^#N\s+([^\r\n]+)/m.exec(text)![1].trim());
    expect(e.author).toBe(/^#O\s+([^\r\n]+)/m.exec(text)?.[1].trim());
    const header = /^x\s*=\s*(\d+),\s*y\s*=\s*(\d+),\s*rule\s*=\s*([^\r\n]+)/mi.exec(text)!;
    expect(header).not.toBeNull();
    expect(['B3/S23', '23/3']).toContain(header[3].trim().toUpperCase());
    const body = text.split(/\r?\n/).filter(line => !/^\s*(#|x\s*=)/i.test(line))
      .join('').replace(/\s/g, '');
    expect(body).toMatch(/^(?:\d*[bo$])+!$/);
    const points = decodeRle(text);
    expect(points.length).toBeGreaterThan(0);
    expect(points.every(([x, y]) => x >= 0 && y >= 0 && x < +header[1] && y < +header[2])).toBe(true);
    expect(new Set(points.map(([x, y]) => key(x, y))).size).toBe(points.length);
    const parsed = fromList(points);
    const box = bounds(parsed);
    expect(seed(e)).toEqual(translate(parsed, [-box[0], -box[1]]));
    expect(e.cells).toBe(parsed.size);
  });
});

describe('still lifes and oscillators', () => {
  it.each(entries('still'))('$id stays unchanged after one generation', e => {
    const cells = seed(e);
    expect(step(cells)).toEqual(cells);
  });
  it.each(entries('oscillator'))('$id returns at its fundamental period', e => verifyCycle(e));
});

// Offsets are in the source files' orientation. Speed uses the largest axis
// displacement per generation: c/4 diagonal, c/2 or c/10 orthogonal.
const SHIP_OFFSETS: Record<string, Offset> = {
  glider: [1, 1], lwss: [-2, 0], mwss: [-2, 0], hwss: [-2, 0],
  copperhead: [0, -1], bigglider: [-1, -1], hivenudger: [-2, 0],
};

describe('spaceships', () => {
  it.each(entries('spaceship'))('$id repeats only at its period, translated', e => {
    const initial = seed(e);
    let cells = initial;
    for (let t = 1; t <= e.period!; t++) {
      cells = step(cells);
      const offset = displacement(initial, cells);
      if (t < e.period!) expect(offset, `${e.id} prematurely repeated at ${t}`).toBeNull();
      else {
        expect(offset).toEqual(SHIP_OFFSETS[e.id]);
        expect(offset).not.toEqual([0, 0]);
        console.info(`${e.id}: period ${t}, offset ${offset}, speed c/${t / Math.max(...offset!.map(Math.abs))}`);
      }
    }
    expect(advance(cells, e.period!)).toEqual(translate(initial,
      SHIP_OFFSETS[e.id].map(v => 2 * v) as Offset));
  });
});

describe('guns', () => {
  it.each(entries('gun'))('$id restores its core and adds one departing glider per cycle', e => {
    const initial = seed(e), box = bounds(initial);
    let cells = initial;
    for (let t = 1; t <= 5 * e.period!; t++) {
      cells = step(cells);
      // None of these true-period guns has a shorter core cycle.
      if (t < e.period!) expect(same(inside(cells, box), initial)).toBe(false);
      if (t % e.period! !== 0) continue;
      const cycles = t / e.period!;
      expect(inside(cells, box)).toEqual(initial);
      const gliders = findClusters(cells).filter(c => c.kind === 'glider');
      expect(gliders).toHaveLength(cycles);
      for (const glider of gliders) {
        expect(glider.maxX < box[0] || glider.minX > box[2]
          || glider.maxY < box[1] || glider.minY > box[3]).toBe(true);
        const ship = new Set(glider.cells);
        expect(displacement(ship, advance(ship, 4))).toEqual(glider.heading);
      }
      expect(cells.size).toBe(initial.size + 5 * cycles);
    }
  });
});

// A puffer's entire bounding box includes old debris and faster escaping
// gliders. Measure the translating engine and its fresh wake instead.
const PUFFERS: Record<string, { offset: Offset; window: Bounds; glidersPerPeriod?: number }> = {
  puffer1: { offset: [0, -64], window: [-40, -10, 50, 104] },
  puffer2: { offset: [0, -70], window: [-40, -10, 50, 110] },
  spacerake: { offset: [10, 0], window: [-10, -20, 30, 30], glidersPerPeriod: 1 },
  backrake1: { offset: [0, -4], window: [-10, -5, 40, 30], glidersPerPeriod: 1 },
  noahsark: { offset: [-112, -112], window: [-20, -20, 152, 152], glidersPerPeriod: 4 },
};

describe('puffers and rakes', () => {
  it.each(entries('puffer'))('$id advances steadily with a recurring engine and growing wake', e => {
    const { offset, window, glidersPerPeriod } = PUFFERS[e.id];
    const period = e.period!;
    // Allow startup debris to clear the window before comparing fresh wakes.
    const warmup = e.id === 'backrake1' ? 8 * period : 2 * period;
    let cells = advance(seed(e), warmup);
    const inFrame = (state: Cells, t: number) => inside(translate(state,
      offset.map(v => -v * t / period) as Offset), window);
    const reference = inFrame(cells, warmup);
    expect(reference.size).toBeGreaterThan(e.cells);
    let previousPopulation = cells.size;
    let previousGliders = findClusters(cells).filter(c => c.kind === 'glider').length;
    let previousBox = bounds(translate(reference, offset.map(v => v * warmup / period) as Offset));
    for (let t = warmup + 1; t <= warmup + 2 * period; t++) {
      cells = step(cells);
      // Intermediate whole-cell translations check the fundamental wake period.
      const wholeCellOffset = offset.every(v => Number.isInteger(v * t / period));
      if (wholeCellOffset && t < warmup + period) {
        expect(same(inFrame(cells, t), reference), `${e.id} shorter wake period ${t - warmup}`).toBe(false);
      }
      if (t % period !== 0) continue;
      const core = inFrame(cells, t);
      expect(core).toEqual(reference);
      const coreBox = bounds(translate(core, offset.map(v => v * t / period) as Offset));
      expect(coreBox.map((v, i) => v - previousBox[i])).toEqual([offset[0], offset[1], offset[0], offset[1]]);
      expect(cells.size).toBeGreaterThan(previousPopulation);
      if (glidersPerPeriod !== undefined) {
        const gliders = findClusters(cells).filter(c => c.kind === 'glider').length;
        expect(gliders - previousGliders).toBe(glidersPerPeriod);
        previousGliders = gliders;
      }
      previousPopulation = cells.size;
      previousBox = coreBox;
    }
    console.info(`${e.id}: period ${period}, engine offset ${offset}, speed c/${period / Math.max(...offset.map(Math.abs))}`);
  });
});

describe('methuselahs', () => {
  it.each(entries('methuselah'))('$id is a small seed with a long-lived evolution', e => {
    expect(e.cells).toBeLessThanOrEqual(10);
    const initial = seed(e);
    const at100 = advance(initial, 100);
    expect(at100.size).toBeGreaterThan(0);
    expect(same(initial, at100)).toBe(false);
    if (e.id === 'diehard') {
      const at129 = advance(at100, 29);
      expect(at129.size).toBeGreaterThan(0);
      expect(step(at129).size).toBe(0);
    }
  });
});

describe('infinite-growth seeds', () => {
  it.each(entries('growth'))('$id grows well beyond its seed and continues growing', e => {
    let cells = seed(e);
    const populations = new Map<number, number>();
    for (let t = 1; t <= 3000; t++) {
      cells = step(cells);
      if ([100, 1000, 2000, 3000].includes(t)) populations.set(t, cells.size);
    }
    // Early chaotic peaks make raw populations non-monotonic. At 1000 the
    // ten-cell seed is 158 versus 102 at 100; the 5x5 seed is 203 versus 72.
    // Keep those explicit regression measurements, then verify continued
    // growth at two later milestones instead of asserting monotonic ticks.
    expect(populations.get(100)).toBe(e.id === '10cellinfinitegrowth' ? 102 : 72);
    expect(populations.get(1000)).toBe(e.id === '10cellinfinitegrowth' ? 158 : 203);
    expect(populations.get(1000)!).toBeGreaterThan(10 * e.cells);
    expect(populations.get(1000)!).toBeGreaterThan(1.5 * populations.get(100)!);
    expect(populations.get(2000)!).toBeGreaterThan(populations.get(1000)!);
    expect(populations.get(3000)!).toBeGreaterThan(populations.get(2000)!);
    expect(populations.get(3000)!).toBeGreaterThan(3 * populations.get(100)!);
    console.info(`${e.id}: populations at 100, 1000, 2000, 3000 = ${[...populations.values()]}`);
  });
});

describe('reflectors', () => {
  it.each(entries('reflector'))('$id has a stable or periodic standalone reflector', e => {
    const initial = seed(e);
    if (e.id !== 'snark') {
      verifyCycle(e, initial);
      return;
    }
    // The mirrored Snark RLE is a demonstration with a separate incoming
    // glider. Preserve all 57 catalog cells, but test its 52-cell core alone.
    const incoming = findClusters(initial).filter(c => c.kind === 'glider');
    expect(incoming).toHaveLength(1);
    const payload = new Set(incoming[0].cells);
    const core = new Set([...initial].filter(k => !payload.has(k)));
    expect(core.size).toBe(52);
    verifyCycle(e, core);
    // Also verify the actual supplied seed restores its core and reflects
    // the glider through 90 degrees rather than merely surviving startup.
    const future = advance(initial, 80);
    expect(inside(future, bounds(initial))).toEqual(core);
    const outgoing = findClusters(future).filter(c => c.kind === 'glider');
    expect(outgoing).toHaveLength(1);
    expect(incoming[0].heading).toEqual([1, -1]);
    expect(outgoing[0].heading).toEqual([1, 1]);
    expect(future.size).toBe(initial.size);
  });
});
