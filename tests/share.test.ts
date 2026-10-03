import { describe, expect, it } from 'vitest';
import { PATTERNS, placePattern } from '../src/life/patterns';
import { decodeRle, encodeRle } from '../src/share/rle';
import { fromHash, LINK_VERSION, toHash, type SharedState } from '../src/share/link';

const asSet = (points: [number, number][]) => new Set(points.map(([x, y]) => `${x},${y}`));

function expectRoundTrip(points: [number, number][]): void {
  const { rle, x, y } = encodeRle(points);
  expect(asSet(decodeRle(rle, x, y))).toEqual(asSet(points));
}

describe('RLE', () => {
  it.each(PATTERNS)('round-trips $name at negative coordinates', (pattern) => {
    expectRoundTrip(placePattern(pattern, -37, -23));
  });

  it('encodes and round-trips an empty pattern', () => {
    expect(encodeRle([])).toEqual({ rle: '!', x: 0, y: 0 });
    expectRoundTrip([]);
  });

  it('round-trips a seeded 2000-cell soup', () => {
    let seed = 0x12345678;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed >>> 16;
    };
    const soup = new Map<string, [number, number]>();
    while (soup.size < 2000) {
      const point: [number, number] = [next() % 128 - 64, next() % 128 - 64];
      soup.set(point.join(','), point);
    }
    expectRoundTrip([...soup.values()]);
  });

  it('collapses blank middle rows and omits trailing dead cells', () => {
    const points: [number, number][] = [[-4, -8], [-2, -5], [-4, -5], [-3, -5]];
    expect(encodeRle(points)).toEqual({ rle: 'o3$3o!', x: -4, y: -8 });
    expectRoundTrip(points);
  });

  it('uses the standard glider encoding', () => {
    const points: [number, number][] = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
    expect(encodeRle(points)).toEqual({ rle: 'bo$2bo$3o!', x: 0, y: 0 });
  });

  it('ignores duplicates and input order without changing the input', () => {
    const points: [number, number][] = [[2, 1], [0, 0], [1, 1], [2, 1], [0, 0]];
    const before = points.map((point) => [...point]);
    expect(encodeRle(points)).toEqual(encodeRle([...points].reverse()));
    expect(encodeRle(points)).toEqual({ rle: 'o$b2o!', x: 0, y: 0 });
    expect(points).toEqual(before);
    expectRoundTrip(points);
  });

  it('reads a standard, wrapped Gosper glider gun file', () => {
    const gun = `#N Gosper glider gun
#C A period 30 gun.
x = 36, y = 9, rule = B3/S23
24bo11b$22bobo11b$12b2o6b2o12b2o$
11bo3bo4b2o12b2o$2o8bo5bo3b2o14b$
2o8bo3bob2o4bobo11b$10bo5bo7bo11b$
11bo3bo20b$12b2o!`;
    const points = decodeRle(gun);
    expect(points).toHaveLength(36);
    expect(Math.max(...points.map(([x]) => x))).toBe(35);
    expect(Math.max(...points.map(([, y]) => y))).toBe(8);
    expectRoundTrip(points);
  });

  it('accepts whitespace, alternate live letters, dead dots, and offsets', () => {
    expect(decodeRle(' 2 . A $ 2 $ 2o ! 99o', -5, -7)).toEqual([
      [-3, -7], [-5, -4], [-4, -4],
    ]);
    expect(decodeRle('1 \n 2o')).toHaveLength(12);
  });

  it('ignores unknown characters and malformed runs while retaining parsed points', () => {
    expect(decodeRle('o?2@o$0o. a!')).toEqual([[0, 0], [1, 0], [2, 0], [1, 1]]);
    expect(decodeRle('o$999999999999999999999o$o!')).toEqual([[0, 0], [0, 2]]);
    expect(decodeRle('')).toEqual([]);
  });
});

describe('share links', () => {
  const points = placePattern(PATTERNS[0], -20, -40);

  it('round-trips points without a camera', () => {
    const hash = toHash({ points });
    expect(hash.startsWith('#')).toBe(true);
    expect(new URLSearchParams(hash.slice(1)).get('v')).toBe(String(LINK_VERSION));
    const restored = fromHash(hash)!;
    expect(asSet(restored.points)).toEqual(asSet(points));
    expect(restored).not.toHaveProperty('cam');
    expect(fromHash(hash.slice(1))).toEqual(restored);
    expect(fromHash(toHash({ points: [] }))).toEqual({ points: [] });
  });

  it('round-trips and rounds a camera to two decimals', () => {
    const state: SharedState = { points, cam: { x: -12.3456, y: 8.7654, zoom: 24.1234 } };
    const restored = fromHash(toHash(state))!;
    expect(asSet(restored.points)).toEqual(asSet(points));
    expect(restored.cam).toEqual({ x: -12.35, y: 8.77, zoom: 24.12 });
  });

  it.each(['', '#', '#foo=bar', '#v=2&p=o!', '#v=1', '#p=o!'])('rejects %j', (hash) => {
    expect(fromHash(hash)).toBeNull();
  });

  it.each(['NaN', 'Infinity', '-Infinity', 'abc', '', ' '])('drops invalid camera numbers %j', (bad) => {
    for (const name of ['cx', 'cy', 'z']) {
      const params = new URLSearchParams({ v: '1', p: 'o!', cx: '0', cy: '0', z: '10' });
      params.set(name, bad);
      expect(fromHash(`#${params}`)).toEqual({ points: [[0, 0]] });
    }
  });

  it('drops an incomplete camera and defaults invalid origins to zero', () => {
    expect(fromHash('#v=1&p=o!&cx=1&cy=2')).toEqual({ points: [[0, 0]] });
    expect(fromHash('#v=1&p=o!&ox=bad&oy=1.5')).toEqual({ points: [[0, 0]] });
    expect(fromHash(toHash({ points, cam: { x: NaN, y: 0, zoom: 20 } }))).not.toHaveProperty('cam');
  });

  it.each([[-10, 2], [1, 2], [141, 140], [1000, 140], [42, 42]])('clamps zoom %s to %s', (zoom, expected) => {
    expect(fromHash(`#v=1&p=o!&cx=3&cy=-4&z=${zoom}`)?.cam).toEqual({ x: 3, y: -4, zoom: expected });
  });

  it('truncates oversized runs at 200000 points in decoding order', () => {
    const restored = fromHash('#v=1&p=1000000000o!&ox=-10&oy=-20')!;
    expect(restored.points).toHaveLength(200000);
    expect(restored.points[0]).toEqual([-10, -20]);
    expect(restored.points[199999]).toEqual([199989, -20]);
  });
});

describe('hostile links', () => {
  it('drops cells pushed outside the engine coordinate range', () => {
    const state = fromHash('#v=1&p=o999999999$o!&ox=0&oy=0');
    expect(state?.points).toEqual([[0, 0]]);
  });
});
