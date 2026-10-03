import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { Camera } from '../src/render/camera';

describe('Sim', () => {
  it('tracks births and fades across a blinker step', () => {
    const sim = new Sim(400);
    sim.addMany([[-1, 0], [0, 0], [1, 0]], 0);
    expect(sim.budKeys.length).toBe(2);
    const born = sim.advance(1000);
    expect(born.length).toBe(2);
    expect(sim.fading.length).toBe(2);
    expect(sim.generation).toBe(1);
    sim.prune(2000);
    expect(sim.fading.length).toBe(0);
    expect(sim.bornAt.size).toBe(0);
  });

  it('set reports whether it changed anything', () => {
    const sim = new Sim();
    expect(sim.set(2, 3, true, 0)).toBe(true);
    expect(sim.set(2, 3, true, 0)).toBe(false);
    expect(sim.has(2, 3)).toBe(true);
  });
});

describe('Camera', () => {
  it('keeps the point under the cursor fixed while zooming', () => {
    const cam = new Camera();
    cam.w = 800;
    cam.h = 600;
    const before = cam.toWorld(100, 50);
    cam.zoomAt(100, 50, 1.7);
    const after = cam.toWorld(100, 50);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });
});
