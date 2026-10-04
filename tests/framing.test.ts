import { describe, expect, it } from 'vitest';
import { pointBounds, shouldFrameStamp } from '../src/render/framing';

describe('stamp framing', () => {
  const view = { left: -50, top: -40, right: 50, bottom: 40 };

  it('uses full cell squares, including rotated/negative stamp coordinates', () => {
    expect(pointBounds([[-3, 2], [1, -2], [0, 0]]))
      .toEqual({ left: -3, top: -2, right: 2, bottom: 3 });
    expect(pointBounds([])).toBeNull();
  });

  it.each([
    { left: -51, top: -20, right: 0, bottom: 20 },
    { left: 0, top: -20, right: 51, bottom: 20 },
    { left: -20, top: -41, right: 20, bottom: 0 },
    { left: -20, top: 0, right: 20, bottom: 41 },
    { left: 100, top: 100, right: 150, bottom: 150 },
  ])('frames a large stamp clipped at any edge (or entirely outside)', (bounds) => {
    expect(shouldFrameStamp(bounds, view)).toBe(true);
  });

  it('frames a fully visible stamp just below 15%, but holds at the boundary', () => {
    expect(shouldFrameStamp({ left: -20, top: -10, right: 20, bottom: 19 }, view)).toBe(true);
    expect(shouldFrameStamp({ left: -20, top: -10, right: 20, bottom: 20 }, view)).toBe(false);
  });

  it('holds a large stamp whose cell edges exactly touch the view edges', () => {
    expect(shouldFrameStamp(view, view)).toBe(false);
  });

  it('compares bounding-box area rather than live-cell density', () => {
    const sparse = pointBounds([[-30, -25], [29, 24]])!;
    expect(shouldFrameStamp(sparse, view)).toBe(false);
    const tiny = pointBounds([[0, 0]])!;
    expect(shouldFrameStamp(tiny, view)).toBe(true);
  });
});
