import { describe, expect, it } from 'vitest';
import { classify, FAMILY, findClusters, findTeamClusters, type Kind } from '../src/life/clusters';
import { fromList, key, step, toList, type Cells } from '../src/life/engine';
import { PATTERNS, placePattern } from '../src/life/patterns';

/** Wall-clock limits catch big regressions, not exact speed: shared CI machines are ~2x slower. */
const SLOW = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.CI ? 3 : 1;

const cases: [Exclude<Kind, 'blob'>, string[], number][] = [
  ['block', ['OO', 'OO'], 1],
  ['beehive', ['.OO.', 'O..O', '.OO.'], 1],
  ['loaf', ['.OO.', 'O..O', '.O.O', '..O.'], 1],
  ['boat', ['OO.', 'O.O', '.O.'], 1],
  ['tub', ['.O.', 'O.O', '.O.'], 1],
  ['ship', ['OO.', 'O.O', '.OO'], 1],
  ['pond', ['.OO.', 'O..O', 'O..O', '.OO.'], 1],
  ['blinker', ['OOO'], 2],
  ['toad', ['.OOO', 'OOO.'], 2],
  ['beacon', ['OO..', 'OO..', '..OO', '..OO'], 2],
  ['glider', ['.O.', '..O', 'OOO'], 4],
  ['lwss', ['.O..O', 'O....', 'O...O', 'OOOO'], 4],
];

function seed(rows: string[]): Cells {
  return fromList(placePattern({ name: 'test', rows }, 0, 0));
}

function transform(points: [number, number][], rotation: number, mirror: boolean): [number, number][] {
  return points.map(([x, y]) => {
    if (mirror) x = -x;
    for (let i = 0; i < rotation; i++) [x, y] = [-y, x];
    return [x - 37, y + 19];
  });
}

function advance(cells: Cells, generations: number): Cells {
  for (let i = 0; i < generations; i++) cells = step(cells);
  return cells;
}

function sorted(points: [number, number][]): [number, number][] {
  return [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function pattern(name: string, x = 0, y = 0): [number, number][] {
  return placePattern(PATTERNS.find((p) => p.name === name)!, x, y);
}

describe('classification', () => {
  it.each(cases)('recognises every phase and symmetry of %s', (kind, rows, period) => {
    let cells = seed(rows);
    for (let phase = 0; phase < period; phase++) {
      for (const mirror of [false, true]) {
        for (let rotation = 0; rotation < 4; rotation++) {
          const points = transform(toList(cells).reverse(), rotation, mirror);
          const before = sorted(points);
          const match = classify(points);
          expect(match.kind).toBe(kind);
          const clusters = findClusters(fromList(points));
          expect(clusters).toHaveLength(1);
          expect(clusters[0].kind).toBe(kind);
          expect(clusters[0].family).toBe(FAMILY[kind]);
          expect(clusters[0].heading).toEqual(match.heading);
          expect(new Set(clusters[0].cells)).toEqual(fromList(points));
          if (kind !== 'glider' && kind !== 'lwss') expect(match.heading).toEqual([0, 0]);
          expect(sorted(points)).toEqual(before);
        }
      }
      cells = step(cells);
    }
  });

  it.each(['glider', 'lwss'] as const)('reports all four directions for %s in every phase', (kind) => {
    const expected: [number, number][] = kind === 'glider'
      ? [[1, 1], [-1, 1], [-1, -1], [1, -1]]
      : [[-1, 0], [0, -1], [1, 0], [0, 1]];
    const distance = kind === 'glider' ? 1 : 2;
    let cells = fromList(pattern(kind));
    for (let phase = 0; phase < 4; phase++) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const points = transform(toList(cells), rotation, false);
        const { heading } = classify(points);
        expect(heading).toEqual(expected[rotation]);
        const moved = toList(advance(fromList(points), 4));
        expect(sorted(moved)).toEqual(sorted(points.map(([x, y]) => [
          x + distance * heading[0], y + distance * heading[1],
        ])));
      }
      cells = step(cells);
    }
  });

  it('keeps returned headings independent of the lookup table', () => {
    const points = pattern('glider');
    const match = classify(points);
    match.heading[0] = 0;
    expect(classify(points).heading).toEqual([1, 1]);
    const cluster = findClusters(fromList(points))[0];
    cluster.heading[1] = 0;
    expect(classify(points).heading).toEqual([1, 1]);
  });

  it('classifies unknown, empty, and oversized shapes as blobs', () => {
    expect(classify([[0, 0], [2, 0], [1, 1]])).toEqual({ kind: 'blob', heading: [0, 0] });
    expect(classify([])).toEqual({ kind: 'blob', heading: [0, 0] });
    expect(classify(Array.from({ length: 17 }, (_, x) => [x, 0]))).toEqual({ kind: 'blob', heading: [0, 0] });
    expect(FAMILY.blob).toBe('blob');
  });
});

describe('organism grouping', () => {
  it('finds two gliders separated by more than reach 2', () => {
    const points = [...pattern('glider', -20, -10), ...pattern('glider', 20, 10)];
    const cells = fromList(points);
    const before = new Set(cells);
    const clusters = findClusters(cells);
    expect(clusters.map((cluster) => cluster.kind)).toEqual(['glider', 'glider']);
    expect(clusters.map((cluster) => cluster.cells.length)).toEqual([5, 5]);
    expect(cells).toEqual(before);
  });

  it('groups a glider and a block at distance 2 without touching', () => {
    const glider = toList(seed(['.O.', '..O', 'OOO']));
    const block: [number, number][] = [[3, -1], [4, -1], [3, 0], [4, 0]];
    const gap = Math.min(...glider.flatMap(([x, y]) => block.map(([bx, by]) =>
      Math.max(Math.abs(x - bx), Math.abs(y - by)))));
    expect(gap).toBe(2);
    const clusters = findClusters(fromList([...glider, ...block]));
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('blob');
    expect(clusters[0].heading).toEqual([0, 0]);
    expect(clusters[0].cells).toHaveLength(9);
  });

  it('groups a touching glider and block as a blob', () => {
    const points = [...pattern('glider'), [2, 0], [3, 0], [2, 1], [3, 1]] as [number, number][];
    const clusters = findClusters(fromList(points));
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('blob');
  });

  it('keeps the beacon in one group in both phases', () => {
    let cells = fromList(pattern('beacon', -8, 15));
    for (let phase = 0; phase < 2; phase++) {
      const clusters = findClusters(cells);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].kind).toBe('beacon');
      expect(clusters[0].cells).toHaveLength(phase === 0 ? 8 : 6);
      cells = step(cells);
    }
  });

  it('groups the default pulsar as one blob', () => {
    const cells = fromList(pattern('pulsar'));
    const clusters = findClusters(cells);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('blob');
    expect(clusters[0].cells).toHaveLength(cells.size);
  });

  it('uses reach only for grouping', () => {
    const cells = step(fromList(pattern('beacon')));
    expect(findClusters(cells, 1).map((cluster) => cluster.kind)).toEqual(['blob', 'blob']);
    expect(findClusters(cells, 2).map((cluster) => cluster.kind)).toEqual(['beacon']);
    expect(findClusters(cells, 3).map((cluster) => cluster.kind)).toEqual(['beacon']);
    expect(findClusters(cells, 0)).toHaveLength(cells.size);
    expect(classify(toList(cells)).kind).toBe('beacon');
  });

  it('reports inclusive bounds and mean cell centres', () => {
    const points: [number, number][] = [[-4, -2], [-2, -2], [-3, -1]];
    const clusters = findClusters(fromList(points));
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({
      minX: -4, minY: -2, maxX: -2, maxY: -1,
      kind: 'blob', family: 'blob', heading: [0, 0], cx: -2.5,
    });
    expect(clusters[0].cy).toBeCloseTo(-7 / 6);
    expect(new Set(clusters[0].cells)).toEqual(fromList(points));
  });

  it('handles an empty grid and validates reach', () => {
    expect(findClusters(new Set())).toEqual([]);
    for (const reach of [-1, 0.5, NaN, Infinity]) {
      expect(() => findClusters(new Set(), reach)).toThrow(RangeError);
    }
  });

  it('flood-fills a large component without recursion', () => {
    const cells = new Set(Array.from({ length: 20000 }, (_, x) => key(x, -7)));
    const clusters = findClusters(cells);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].cells).toHaveLength(20000);
    expect(clusters[0].kind).toBe('blob');
    expect(clusters[0].cx).toBe(10000);
  });

  it('processes a seeded 20k-cell soup within 200 ms', () => {
    let state = 0x12345678;
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state >>> 16;
    };
    const cells: Cells = new Set();
    while (cells.size < 20000) cells.add(key(next() % 512 - 256, next() % 512 - 256));
    // Warm up before measuring the flood fill, without timing soup construction.
    findClusters(cells);
    const start = performance.now();
    const clusters = findClusters(cells);
    const elapsed = performance.now() - start;
    console.info(`20k soup (reach 2): ${elapsed.toFixed(2)} ms`);
    expect(clusters.reduce((total, cluster) => total + cluster.cells.length, 0)).toBe(20000);
    expect(elapsed).toBeLessThan(200 * SLOW);
  });
});


describe('battle team clustering', () => {
  function grid(width: number, height: number, red: [number, number][], blue: [number, number][] = []) {
    const out = new Uint8Array(width * height);
    for (const [x, y] of red) out[y * width + x] = 1;
    for (const [x, y] of blue) out[y * width + x] = 2;
    return out;
  }

  it('keeps adjacent opposing teams separate and preserves the grid', () => {
    const red: [number, number][] = [[2, 2], [3, 2], [2, 3], [3, 3]];
    const blue: [number, number][] = [[4, 2], [5, 2], [4, 3], [5, 3]];
    const input = grid(10, 10, red, blue);
    const before = input.slice();
    const clusters = findTeamClusters(input, 10, 10, false, true);
    expect(clusters.map((c) => [c.team, c.kind])).toEqual([[1, 'block'], [2, 'block']]);
    expect(new Set(clusters[0].cells)).toEqual(fromList(red));
    expect(new Set(clusters[1].cells)).toEqual(fromList(blue));
    expect(input).toEqual(before);
  });

  it.each([0, 1, 2, 3])('recognises every glider phase across a vertical seam (phase %i)', (phase) => {
    const pts = toList(advance(seed(['.O.', '..O', 'OOO']), phase));
    const red: [number, number][] = pts.map(([x, y]) => [x + 3, (y + 9) % 12]);
    const clusters = findTeamClusters(grid(12, 12, red), 12, 12, false, true);
    expect(clusters).toHaveLength(1);
    const c = clusters[0];
    expect(c).toMatchObject({ team: 1, kind: 'glider', family: 'spaceship', heading: [1, 1] });
    expect(new Set(c.cells)).toEqual(fromList(red));
    expect(c.cx).toBeCloseTo(3.5 + pts.reduce((n, [x]) => n + x, 0) / 5);
    expect(c.cy).toBeCloseTo((9.5 + pts.reduce((n, [, y]) => n + y, 0) / 5) % 12);
    expect(c.minY).toBe(Math.min(...red.map(([, y]) => y)));
    expect(c.maxY).toBe(Math.max(...red.map(([, y]) => y)));
  });

  it('unwraps both axes and retains a mirrored glider heading', () => {
    const pts = toList(seed(['.O.', 'O..', 'OOO']));
    const red: [number, number][] = pts.map(([x, y]) => [(x + 9) % 10, (y + 9) % 10]);
    const c = findTeamClusters(grid(10, 10, red), 10, 10, true, true)[0];
    expect(c).toMatchObject({ kind: 'glider', heading: [-1, 1], minX: 0, maxX: 9, minY: 0, maxY: 9 });
    expect(c.cx).toBeCloseTo((9.5 + pts.reduce((n, [x]) => n + x, 0) / 5) % 10);
  });

  it('never joins cells across a non-wrapping axis and respects reach', () => {
    const input = grid(12, 12, [[0, 0], [11, 0], [0, 11]]);
    expect(findTeamClusters(input, 12, 12, false, false)).toHaveLength(3);
    expect(findTeamClusters(input, 12, 12, false, true)).toHaveLength(2);
    expect(findTeamClusters(input, 12, 12, true, false)).toHaveLength(2);
    expect(findTeamClusters(input, 12, 12, true, true)).toHaveLength(1);
    const separated = grid(12, 12, [[1, 1], [3, 3]]);
    expect(findTeamClusters(separated, 12, 12, true, true, 1)).toHaveLength(2);
    expect(findTeamClusters(separated, 12, 12, true, true)).toHaveLength(1);
    expect(findTeamClusters(separated, 12, 12, true, true, 0)).toHaveLength(2);
  });

  it('returns no clusters for an empty grid and validates dimensions and reach', () => {
    expect(findTeamClusters(new Uint8Array(100), 10, 10, false, true)).toEqual([]);
    expect(() => findTeamClusters(new Uint8Array(99), 10, 10, false, true)).toThrow(RangeError);
    for (const reach of [-1, 0.5, NaN, Infinity]) {
      expect(() => findTeamClusters(new Uint8Array(100), 10, 10, false, true, reach)).toThrow(RangeError);
    }
  });

  it('handles a full large arena well under 5 ms', () => {
    const input = new Uint8Array(56 * 40);
    for (let i = 0; i < input.length; i++) input[i] = i % 2 + 1;
    for (let i = 0; i < 10; i++) findTeamClusters(input, 56, 40, false, true);
    const start = performance.now();
    for (let i = 0; i < 100; i++) findTeamClusters(input, 56, 40, false, true);
    const ms = (performance.now() - start) / 100;
    console.info(`Full battle arena team clustering: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(5 * SLOW);
    const clusters = findTeamClusters(input, 56, 40, false, true);
    expect(clusters).toHaveLength(2);
    expect(clusters.reduce((total, c) => total + c.cells.length, 0)).toBe(input.length);
  });
});
