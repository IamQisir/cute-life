import { describe, expect, it } from 'vitest';
import { buds, fromList, key, keyX, keyY, neighborCount, step, toList } from '../src/life/engine';
import { PATTERNS, placePattern } from '../src/life/patterns';

const sorted = (pts: [number, number][]) =>
  [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

describe('key packing', () => {
  it('round-trips negative and positive coordinates', () => {
    for (const [x, y] of [[0, 0], [-5, 7], [123456, -654321], [-1, -1]]) {
      const k = key(x, y);
      expect([keyX(k), keyY(k)]).toEqual([x, y]);
    }
  });
});

describe('step', () => {
  it('keeps a block still', () => {
    const block = fromList([[0, 0], [1, 0], [0, 1], [1, 1]]);
    expect(sorted(toList(step(block)))).toEqual(sorted(toList(block)));
  });

  it('flips a blinker with period 2', () => {
    const h = fromList([[-1, 0], [0, 0], [1, 0]]);
    const v = step(h);
    expect(sorted(toList(v))).toEqual(sorted([[0, -1], [0, 0], [0, 1]]));
    expect(sorted(toList(step(v)))).toEqual(sorted(toList(h)));
  });

  it('moves a glider one cell diagonally every 4 generations', () => {
    const glider = PATTERNS.find((p) => p.name === 'glider')!;
    let cells = fromList(placePattern(glider, 0, 0));
    const start = toList(cells);
    for (let i = 0; i < 4; i++) cells = step(cells);
    expect(sorted(toList(cells))).toEqual(sorted(start.map(([x, y]) => [x + 1, y + 1])));
  });

  it('kills lonely and crowded cells', () => {
    expect(step(fromList([[0, 0]])).size).toBe(0);
    const plus = fromList([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]);
    expect(step(plus).has(key(0, 0))).toBe(false);
  });
});

describe('helpers', () => {
  it('counts neighbours', () => {
    const cells = fromList([[0, 0], [1, 0], [1, 1]]);
    expect(neighborCount(cells, 0, 1)).toBe(3);
    expect(neighborCount(cells, 0, 0)).toBe(2);
  });

  it('finds cells about to be born', () => {
    const cells = fromList([[-1, 0], [0, 0], [1, 0]]);
    expect(buds(cells).map((k) => [keyX(k), keyY(k)]).sort()).toEqual([[0, -1], [0, 1]].sort());
  });
});
