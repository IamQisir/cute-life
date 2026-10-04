import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/life/catalog';
import { fromList, keyX, keyY, step, type Cells } from '../src/life/engine';
import { INTRO_PICTURES, introPoints } from '../src/life/introArt';
import { PATTERNS, placePattern } from '../src/life/patterns';
import type { FollowTarget } from '../src/render/follow';
import { createFollowState, updateFollow } from '../src/render/followController';

const VIEWPORTS = [[1020, 600], [350, 544], [584, 190]];

function expectContained(cells: Cells, aim: FollowTarget, width: number, height: number) {
  for (const k of cells) {
    expect(keyX(k)).toBeGreaterThanOrEqual(aim.x - width / aim.zoom / 2);
    expect(keyX(k) + 1).toBeLessThanOrEqual(aim.x + width / aim.zoom / 2);
    expect(keyY(k)).toBeGreaterThanOrEqual(aim.y - height / aim.zoom / 2);
    expect(keyY(k) + 1).toBeLessThanOrEqual(aim.y + height / aim.zoom / 2);
  }
}

describe.each(VIEWPORTS)('follow controller in %i × %i free pixels', (width, height) => {
  it.each(INTRO_PICTURES)('holds $name exactly for 120 generations after framing', (picture) => {
    let cells = fromList(introPoints(picture));
    let state = updateFollow(createFollowState(), cells, 0, width, height);
    const initialAim = state.aim;
    for (let gen = 1; gen <= 120; gen++) {
      cells = step(cells);
      state = updateFollow(state, cells, gen, width, height);
      expect(state.aim).toBe(initialAim);
      expectContained(cells, state.aim!, width, height);
    }
  });

  it.each(['pulsar', 'pentadecathlon'])('holds a lone %s through every oscillator phase', (id) => {
    let cells = fromList(placePattern(CATALOG.find((p) => p.id === id)!, 0, 0));
    let state = updateFollow(createFollowState(), cells, 0, width, height);
    const initialAim = state.aim;
    for (let gen = 1; gen <= 120; gen++) {
      cells = step(cells);
      state = updateFollow(state, cells, gen, width, height);
      expect(state.aim).toBe(initialAim);
      expectContained(cells, state.aim!, width, height);
    }
  });

  it.each(['glider', 'lwss'])('follows a %s monotonically and contains every cell for 400 generations', (name) => {
    let cells = fromList(placePattern(PATTERNS.find((p) => p.name === name)!, 0, 0));
    let state = updateFollow(createFollowState(), cells, 0, width, height);
    let reaims = 0;
    for (let gen = 1; gen <= 400; gen++) {
      cells = step(cells);
      const previous = state.aim!;
      state = updateFollow(state, cells, gen, width, height);
      const aim = state.aim!;
      if (aim !== previous) reaims++;
      if (name === 'glider') {
        expect(aim.x).toBeGreaterThanOrEqual(previous.x);
        expect(aim.y).toBeGreaterThanOrEqual(previous.y);
      } else {
        expect(aim.x).toBeLessThanOrEqual(previous.x);
      }
      expectContained(cells, aim, width, height);
    }
    expect(reaims).toBeGreaterThan(0);
    expect(reaims).toBeLessThan(100);
  });

  it('zooms out for R-pentomino growth without repeated in/out cycles over 300 generations', () => {
    let cells = fromList(placePattern(PATTERNS.find((p) => p.name === 'r-pentomino')!, 0, 0));
    let state = updateFollow(createFollowState(), cells, 0, width, height);
    const initialZoom = state.aim!.zoom;
    let previousDirection = 0;
    let reversals = 0;
    for (let gen = 1; gen <= 300; gen++) {
      cells = step(cells);
      const previousZoom = state.aim!.zoom;
      state = updateFollow(state, cells, gen, width, height);
      const direction = Math.sign(state.aim!.zoom - previousZoom);
      if (direction && previousDirection && direction !== previousDirection) reversals++;
      if (direction) previousDirection = direction;
    }
    expect(state.aim!.zoom).toBeLessThan(initialZoom);
    expect(reversals).toBeLessThanOrEqual(2);
  });
});

describe('follow hysteresis and generation clock', () => {
  const square = (size: number) => fromList(Array.from({ length: size * size }, (_, i) =>
    [i % size - size / 2, Math.floor(i / size) - size / 2] as [number, number]));

  it('ignores duplicate render frames, including recording cadence', () => {
    const cells = square(20);
    const state = updateFollow(createFollowState(), cells, 0, 800, 600);
    for (let frame = 0; frame < 500; frame++) {
      expect(updateFollow(state, cells, 0, 800, 600)).toBe(state);
    }
  });

  it('retains 30 generations of bounds, then waits 90 generations before zooming in', () => {
    let state = updateFollow(createFollowState(), square(100), 0, 800, 600);
    const initial = state.aim;
    for (let gen = 1; gen < 120; gen++) {
      state = updateFollow(state, square(20), gen, 800, 600);
      expect(state.aim!.zoom).toBe(initial!.zoom);
      expect(state.history.length).toBeLessThanOrEqual(30);
    }
    state = updateFollow(state, square(20), 120, 800, 600);
    expect(state.aim!.zoom).toBeGreaterThan(initial!.zoom * 1.3);
  });

  it('holds tiny size changes without animating zoom', () => {
    let state = updateFollow(createFollowState(), square(40), 0, 800, 600);
    const initial = state.aim;
    for (let gen = 1; gen <= 150; gen++) {
      state = updateFollow(state, square(gen % 2 ? 38 : 40), gen, 800, 600);
      expect(state.aim).toBe(initial);
    }
  });

  it('rechecks a changed viewport without adding duplicate generations', () => {
    const cells = square(40);
    const state = updateFollow(createFollowState(), cells, 0, 800, 600);
    const resized = updateFollow(state, cells, 0, 350, 300);
    expect(resized.aim!.zoom).toBeLessThan(state.aim!.zoom);
    expect(resized.history).toHaveLength(1);
  });

  it('resets for an empty or restarted simulation without mutating prior state', () => {
    const cells = square(20);
    const state = updateFollow(createFollowState(), cells, 10, 800, 600);
    expect(updateFollow(state, new Set(), 11, 800, 600).aim).toBeNull();
    const restarted = updateFollow(state, cells, 0, 800, 600);
    expect(restarted.history.map((s) => s.generation)).toEqual([0]);
    expect(state.history.map((s) => s.generation)).toEqual([10]);
  });
});
