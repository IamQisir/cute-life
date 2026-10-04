import { describe, expect, it } from 'vitest';
import { key } from '../src/life/engine';
import { followTarget } from '../src/render/follow';

describe('followTarget', () => {
  it('returns null for an empty world', () => {
    expect(followTarget([], 800, 600)).toBeNull();
  });

  it('centres on a cluster and fits it on screen', () => {
    const cells = [];
    for (let x = 100; x < 120; x++) for (let y = -50; y < -40; y++) cells.push(key(x, y));
    const t = followTarget(cells, 800, 600)!;
    expect(t.x).toBeGreaterThan(105);
    expect(t.x).toBeLessThan(115);
    expect(t.y).toBeGreaterThan(-48);
    expect(t.y).toBeLessThan(-42);
    expect(t.zoom * 20).toBeLessThanOrEqual(800);
  });

  it('ignores a few far-away stragglers', () => {
    const cells = [];
    for (let x = 0; x < 30; x++) for (let y = 0; y < 30; y++) cells.push(key(x, y));
    for (let i = 0; i < 20; i++) cells.push(key(5000 + i * 7, 5000));
    const t = followTarget(cells, 800, 600)!;
    expect(t.x).toBeLessThan(40);
    expect(t.y).toBeLessThan(40);
    expect(t.zoom).toBeGreaterThan(10);
  });

  it('fits every cell when framing art or stamps, including a sparse extremity', () => {
    const cells = [];
    for (let x = 0; x < 30; x++) for (let y = 0; y < 30; y++) cells.push(key(x, y));
    cells.push(key(100, -40));
    const t = followTarget(cells, 800, 600, 6, false)!;
    expect(t.x).toBe(50.5);
    expect(t.y).toBe(-5);
    expect((101 + 12) * t.zoom).toBeLessThanOrEqual(800);
    expect((70 + 12) * t.zoom).toBeLessThanOrEqual(600);
  });

  it('does not miss extremities between samples in a large full-picture fit', () => {
    const cells = Array.from({ length: 6001 }, (_, i) => key(i % 80, Math.floor(i / 80)));
    cells[1] = key(-90, -80);
    const t = followTarget(cells, 800, 600, 6, false)!;
    expect(t.x).toBe(-5);
    expect(t.y).toBe(-2);
  });
});
