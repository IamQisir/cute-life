import { describe, expect, it } from 'vitest';
import { fromList, step } from '../src/life/engine';
import { Camera } from '../src/render/camera';
import { Sim } from '../src/sim';
import { borrowSandbox } from '../src/ui/welcomeSandbox';
import {
  buildWelcomeScene, showcaseSeed, WELCOME_CELL_CAP, WELCOME_GEN_PER_SEC, WELCOME_PRE_ADVANCE,
} from '../src/ui/welcomeScene';
import { welcomeBeat, welcomeCamera, WELCOME_SECONDS, WELCOME_ZOOM_START } from '../src/ui/welcomeTimeline';

describe('welcome showcase', () => {
  it('builds a deterministic, already-busy scene from the catalog', () => {
    const first = buildWelcomeScene();
    expect(first).toEqual(buildWelcomeScene());
    expect(first.size).toBeGreaterThan(400);
    expect(first.size).toBeLessThan(WELCOME_CELL_CAP);
    expect(first).not.toEqual(showcaseSeed());
  });

  it('stays below 4000 cells during every warmup and show generation', () => {
    let cells = showcaseSeed();
    let peak = cells.size;
    for (let i = 0; i < WELCOME_PRE_ADVANCE + WELCOME_SECONDS * WELCOME_GEN_PER_SEC; i++) {
      cells = step(cells);
      peak = Math.max(peak, cells.size);
      expect(cells.size).toBeLessThan(WELCOME_CELL_CAP);
      if (i + 1 === WELCOME_PRE_ADVANCE) expect(cells).toEqual(buildWelcomeScene());
    }
    console.info(`Welcome showcase peak: ${peak} live cells`);
  });
});

describe('welcome camera timeline', () => {
  it.each([[1280, 800], [390, 844], [844, 390]])('starts far out and ends on faces at %s × %s', (w, h) => {
    const first = welcomeCamera(0, w, h);
    const last = welcomeCamera(WELCOME_SECONDS, w, h);
    expect(first.zoom).toBeGreaterThan(0);
    expect(first.zoom).toBeLessThan(4);
    expect(last.zoom).toBeGreaterThanOrEqual(40);
    expect(last.x).toBe(-69);
    expect(last.y).toBe(-35);
  });

  it('zooms monotonically and continuously in its final phase', () => {
    let previous = welcomeCamera(WELCOME_ZOOM_START).zoom;
    for (let t = WELCOME_ZOOM_START + 0.01; t <= WELCOME_SECONDS; t += 0.01) {
      const camera = welcomeCamera(t);
      expect(camera.zoom).toBeGreaterThanOrEqual(previous);
      expect(camera.zoom - previous).toBeLessThan(0.25);
      previous = camera.zoom;
    }
    const before = welcomeCamera(WELCOME_ZOOM_START - 0.0001);
    const after = welcomeCamera(WELCOME_ZOOM_START + 0.0001);
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.001);
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.001);
    expect(Math.abs(after.zoom - before.zoom)).toBeLessThan(0.001);
  });

  it('clamps time and syncs three copy beats with the view', () => {
    expect(welcomeCamera(-100)).toEqual(welcomeCamera(0));
    expect(welcomeCamera(100)).toEqual(welcomeCamera(WELCOME_SECONDS));
    expect([0, 3, 9].map(welcomeBeat)).toEqual([0, 1, 2]);
    expect(welcomeCamera(9, 390, 844).zoom).toBeGreaterThan(17);
  });
});

describe('borrowing the sandbox', () => {
  it.each([[true, true], [true, false], [false, true], [false, false]])(
    'restores cells, generation, camera and animation records (playing=%s, following=%s)', (initialPlaying, initialFollowing) => {
    const sim = new Sim(333);
    const cam = new Camera();
    sim.addMany([[1, 1], [2, 1], [3, 1]], 100);
    sim.advance(150);
    Object.assign(cam, { x: 12.5, y: -9, zoom: 31, w: 800, h: 600 });
    const saved = {
      cells: sim.cells, counts: sim.counts, budKeys: sim.budKeys, generation: sim.generation,
      bornAt: sim.bornAt, fading: sim.fading, animMs: sim.animMs,
    };
    const camera = { ...cam };
    let playing = initialPlaying;
    let following = initialFollowing;
    let refreshed = 0;
    const restore = borrowSandbox({
      sim, cam, playing: () => playing, following: () => following,
      setPlaying: (on) => { playing = on; }, setFollowing: (on) => { following = on; },
      refreshStatus: () => { refreshed++; },
    }, fromList([[50, 50], [51, 50], [52, 50]]));
    expect(playing).toBe(false);
    expect(following).toBe(false);
    sim.advance(200);
    Object.assign(cam, welcomeCamera(10));
    const showVersion = sim.version;
    restore();
    for (const prop of Object.keys(saved) as (keyof typeof saved)[]) expect(sim[prop]).toBe(saved[prop]);
    expect(cam).toEqual(camera);
    expect(playing).toBe(initialPlaying);
    expect(following).toBe(initialFollowing);
    expect(sim.version).toBeGreaterThan(showVersion);
    restore();
    expect(refreshed).toBe(1);
  });
});
