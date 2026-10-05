import { describe, expect, it } from 'vitest';
import { type Orientation, flipOrientation, orientPoints, rotateOrientation } from '../src/life/orientation';
import { PATTERNS, placePattern } from '../src/life/patterns';

const glider = placePattern(PATTERNS[0], 0, 0);
const identity: Orientation = { rot: 0, flip: false };
const canonical = (points: [number, number][]) => points.sort((a, b) => a[0] - b[0] || a[1] - b[1]).join(';');

describe('stamp orientation', () => {
  it('makes all eight distinct glider orientations without mutating the seed', () => {
    const copy = glider.map(([x, y]) => [x, y]);
    const shapes = new Set<string>();
    for (const flip of [false, true]) for (const rot of [0, 1, 2, 3] as const) {
      shapes.add(canonical(orientPoints(glider, { rot, flip })));
    }
    expect(shapes.size).toBe(8);
    expect(glider).toEqual(copy);
  });

  it('returns to each orientation after two flips or four rotations', () => {
    for (const flip of [false, true]) for (const rot of [0, 1, 2, 3] as const) {
      const initial: Orientation = { rot, flip };
      expect(flipOrientation(flipOrientation(initial))).toEqual(initial);
      let rotated = initial;
      for (let i = 0; i < 4; i++) rotated = rotateOrientation(rotated);
      expect(rotated).toEqual(initial);
      expect(orientPoints(glider, rotated)).toEqual(orientPoints(glider, initial));
    }
  });

  it('keeps the original rotation direction and mirrors horizontally before rotating', () => {
    expect(orientPoints([[2, 3]], identity)).toEqual([[2, 3]]);
    expect(orientPoints([[2, 3]], { rot: 1, flip: false })).toEqual([[-3, 2]]);
    expect(orientPoints([[2, 3]], { rot: 0, flip: true })).toEqual([[-2, 3]]);
    expect(orientPoints([[2, 3]], { rot: 1, flip: true })).toEqual([[-3, -2]]);
    expect(orientPoints([], identity)).toEqual([]);
  });
});
