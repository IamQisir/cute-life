import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOG } from '../src/life/catalog';
import { fromList, step, toList } from '../src/life/engine';
import { compressRle } from '../src/share/compress';
import { PATTERNS, placePattern } from '../src/life/patterns';
import { decodeRle, encodeRle } from '../src/share/rle';
import { fromHash, LINK_VERSION, toHash, type SharedState } from '../src/share/link';

const asSet = (points: [number, number][]) => new Set(points.map(([x, y]) => `${x},${y}`));

/** The original v=1 encoder, kept here to verify backwards compatibility. */
function legacyHash(state: SharedState): string {
  const { rle, x, y } = encodeRle(state.points);
  const params = new URLSearchParams({ v: '1', p: rle, ox: String(x), oy: String(y) });
  if (state.cam && [state.cam.x, state.cam.y, state.cam.zoom].every(Number.isFinite)) {
    params.set('cx', String(Number(state.cam.x.toFixed(2))));
    params.set('cy', String(Number(state.cam.y.toFixed(2))));
    params.set('z', String(Number(state.cam.zoom.toFixed(2))));
  }
  return `#${params}`;
}

function seededSoup(): [number, number][] {
  let seed = 0x12345678;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 16;
  };
  const soup = new Map<string, [number, number]>();
  while (soup.size < 1000) {
    const point: [number, number] = [next() % 128 - 64, next() % 128 - 64];
    soup.set(point.join(','), point);
  }
  return [...soup.values()];
}

async function compressedHash(rle: string, ox = 0, oy = 0): Promise<string> {
  return `#v=2&d=${await compressRle(rle)}&ox=${ox}&oy=${oy}`;
}

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
  afterEach(() => vi.unstubAllGlobals());

  it('decodes a hard-coded link from the original encoder identically', async () => {
    const fixture = '#v=1&p=bo%242bo%243o%21&ox=-21&oy=-41&cx=-12.35&cy=8.77&z=24.12';
    const state = { points, cam: { x: -12.3456, y: 8.7654, zoom: 24.1234 } };
    expect(legacyHash(state)).toBe(fixture);
    expect(await fromHash(fixture)).toEqual({
      points: [[-20, -41], [-19, -40], [-21, -39], [-20, -39], [-19, -39]],
      cam: { x: -12.35, y: 8.77, zoom: 24.12 },
    });
  });

  it.each(PATTERNS)('decodes legacy $name links', async (pattern) => {
    const cells = placePattern(pattern, -37, -23);
    expect(asSet((await fromHash(legacyHash({ points: cells })))!.points)).toEqual(asSet(cells));
  });

  it.each([
    ['empty', []], ['single cell', [[0, 0]]], ['negative coordinates', points],
    ['seeded 1000-cell soup', seededSoup()],
  ] as [string, [number, number][]][])('round-trips v=2 %s', async (_name, cells) => {
    const { rle, x, y } = encodeRle(cells);
    // Explicit v=2 fixtures exercise decoding even when the encoder prefers v=1.
    const hash = await compressedHash(rle, x, y);
    const restored = (await fromHash(hash))!;
    expect(asSet(restored.points)).toEqual(asSet(cells));
    expect(await fromHash(hash.slice(1))).toEqual(restored);
  });

  it('round-trips a v=2 pattern near the 200000-cell cap', async () => {
    const cells = Array.from({ length: 199999 }, (_, i): [number, number] =>
      [i % 500 - 250, Math.floor(i / 500) - 200]);
    const hash = await toHash({ points: cells });
    expect(hash).toMatch(/^#v=2&d=[A-Za-z0-9_-]+&ox=/);
    expect((await fromHash(hash))?.points).toEqual(cells);
  });

  it('makes the 1000-cell soup link at least 50% shorter, including a camera', async () => {
    const state = { points: seededSoup(), cam: { x: -12.3456, y: 8.7654, zoom: 24.1234 } };
    const old = legacyHash(state);
    const hash = await toHash(state);
    console.info(`1000-cell soup: v=1 ${old.length}, v=2 ${hash.length} characters`);
    expect(hash).toMatch(/^#v=2&d=[A-Za-z0-9_-]+&ox=/);
    expect(hash.length).toBeLessThanOrEqual(old.length / 2);
    const restored = (await fromHash(hash))!;
    expect(asSet(restored.points)).toEqual(asSet(state.points));
    expect(restored.cam).toEqual({ x: -12.35, y: 8.77, zoom: 24.12 });
  });

  it('measures catalog links and keeps the shorter format', async () => {
    const acorn = CATALOG.find((pattern) => pattern.id === 'acorn')!;
    let evolved = fromList(placePattern(acorn, 0, 0));
    for (let i = 0; i < 500; i++) evolved = step(evolved);
    const examples: [string, [number, number][]][] = [
      ...['glider', 'gosperglidergun'].map((id): [string, [number, number][]] => {
        const pattern = CATALOG.find((entry) => entry.id === id)!;
        return [pattern.name, placePattern(pattern, 0, 0)];
      }),
      ['acorn after 500 generations', toList(evolved)],
    ];
    for (const [name, cells] of examples) {
      const old = legacyHash({ points: cells });
      const { rle, x, y } = encodeRle(cells);
      const v2 = await compressedHash(rle, x, y);
      const selected = await toHash({ points: cells });
      console.info(`${name}: v=1 ${old.length}, v=2 ${v2.length}, selected ${selected.length} characters`);
      expect(selected).toBe(v2.length < old.length ? v2 : old);
      expect(asSet((await fromHash(selected))!.points)).toEqual(asSet(cells));
    }
  });

  it('falls back to the exact v=1 encoder when CompressionStream is unavailable', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const state = { points: seededSoup(), cam: { x: 3, y: -4, zoom: 20 } };
    expect(await toHash(state)).toBe(legacyHash(state));
    expect(asSet((await fromHash(await toHash(state)))!.points)).toEqual(asSet(state.points));
  });

  it('falls back to v=1 if raw deflate is unsupported', async () => {
    vi.stubGlobal('CompressionStream', class {
      constructor() { throw new TypeError('Unsupported format'); }
    });
    expect(await toHash({ points })).toBe(legacyHash({ points }));
  });

  it('round-trips points without a camera', async () => {
    const hash = await toHash({ points });
    expect(hash.startsWith('#')).toBe(true);
    expect(['1', String(LINK_VERSION)]).toContain(new URLSearchParams(hash.slice(1)).get('v'));
    const restored = (await fromHash(hash))!;
    expect(asSet(restored.points)).toEqual(asSet(points));
    expect(restored).not.toHaveProperty('cam');
    expect(await fromHash(hash.slice(1))).toEqual(restored);
    expect(await fromHash(await toHash({ points: [] }))).toEqual({ points: [] });
  });

  it('round-trips and rounds a camera to two decimals', async () => {
    const state: SharedState = { points, cam: { x: -12.3456, y: 8.7654, zoom: 24.1234 } };
    const restored = (await fromHash(await toHash(state)))!;
    expect(asSet(restored.points)).toEqual(asSet(points));
    expect(restored.cam).toEqual({ x: -12.35, y: 8.77, zoom: 24.12 });
  });

  it.each(['', '#', '#foo=bar', '#v=2&p=o!', '#v=1', '#p=o!'])('rejects %j', async (hash) => {
    expect(await fromHash(hash)).toBeNull();
  });

  it.each(['NaN', 'Infinity', '-Infinity', 'abc', '', ' '])('drops invalid camera numbers %j', async (bad) => {
    for (const name of ['cx', 'cy', 'z']) {
      const params = new URLSearchParams({ v: '1', p: 'o!', cx: '0', cy: '0', z: '10' });
      params.set(name, bad);
      expect(await fromHash(`#${params}`)).toEqual({ points: [[0, 0]] });
    }
  });

  it('drops an incomplete camera and defaults invalid origins to zero', async () => {
    expect(await fromHash('#v=1&p=o!&cx=1&cy=2')).toEqual({ points: [[0, 0]] });
    expect(await fromHash('#v=1&p=o!&ox=bad&oy=1.5')).toEqual({ points: [[0, 0]] });
    expect(await fromHash(await toHash({ points, cam: { x: NaN, y: 0, zoom: 20 } }))).not.toHaveProperty('cam');
  });

  it.each([[-10, 2], [1, 2], [141, 140], [1000, 140], [42, 42]])('clamps zoom %s to %s', async (zoom, expected) => {
    expect((await fromHash(`#v=1&p=o!&cx=3&cy=-4&z=${zoom}`))?.cam).toEqual({ x: 3, y: -4, zoom: expected });
  });

  it('truncates oversized runs at 200000 points in decoding order', async () => {
    const restored = (await fromHash('#v=1&p=1000000000o!&ox=-10&oy=-20'))!;
    expect(restored.points).toHaveLength(200000);
    expect(restored.points[0]).toEqual([-10, -20]);
    expect(restored.points[199999]).toEqual([199989, -20]);
  });
});

describe('hostile links', () => {
  it.each(['', '*', 'abc=', 'ab+c', 'ab/c', 'ab c', 'é', 'a', '%', '%FF'])
    ('rejects malformed v=2 base64url %j', async (data) => {
      const params = new URLSearchParams({ v: '2', d: data });
      expect(await fromHash(`#${params}`)).toBeNull();
    });

  it('rejects truncated and corrupt raw deflate data', async () => {
    const data = await compressRle(encodeRle(seededSoup()).rle);
    expect(await fromHash(`#v=2&d=${data.slice(0, -8)}`)).toBeNull();
    expect(await fromHash('#v=2&d=____')).toBeNull();
  });

  it.each(['0', '3', '02', 'unknown'])('rejects unknown version %s', async (version) => {
    expect(await fromHash(`#v=${version}&p=o!&d=AwA`)).toBeNull();
  });

  it('rejects decompression bombs but accepts the 4 MiB boundary', async () => {
    const atCap = ' '.repeat(4 * 1024 * 1024 - 2) + 'o!';
    expect(await fromHash(await compressedHash(atCap))).toEqual({ points: [[0, 0]] });
    expect(await fromHash(await compressedHash(atCap + ' '))).toBeNull();
  });

  it('returns null when decompression is unavailable', async () => {
    const hash = await compressedHash('o!');
    vi.stubGlobal('DecompressionStream', undefined);
    try {
      expect(await fromHash(hash)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('enforces the point cap for v=2 in decoding order', async () => {
    const restored = (await fromHash(await compressedHash('200001o!', -10, -20)))!;
    expect(restored.points).toHaveLength(200000);
    expect(restored.points[0]).toEqual([-10, -20]);
    expect(restored.points[199999]).toEqual([199989, -20]);
  });

  it('applies the coordinate guard at both ends for v=2', async () => {
    expect((await fromHash(await compressedHash('3o$o!', 499999, 500000)))?.points)
      .toEqual([[499999, 500000], [500000, 500000]]);
    expect((await fromHash(await compressedHash('3o$o!', -500001, -500001)))?.points)
      .toEqual([]);
    expect((await fromHash(await compressedHash('3o!', -500001, -500000)))?.points)
      .toEqual([[-500000, -500000], [-499999, -500000]]);
  });

  it('drops cells pushed outside the engine coordinate range', async () => {
    const state = await fromHash('#v=1&p=o999999999$o!&ox=0&oy=0');
    expect(state?.points).toEqual([[0, 0]]);
  });
});
