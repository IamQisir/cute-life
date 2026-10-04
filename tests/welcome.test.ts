import { describe, expect, it } from 'vitest';
import { fromList, step } from '../src/life/engine';
import { Camera } from '../src/render/camera';
import { Sim } from '../src/sim';
import { borrowSandbox } from '../src/ui/welcomeSandbox';
import {
  buildWelcomeScene, showcaseSeed, WELCOME_CELL_CAP, WELCOME_GEN_PER_SEC, WELCOME_PRE_ADVANCE,
} from '../src/ui/welcomeScene';
import { welcomeBeat, welcomeCamera, welcomeLensTimeline, welcomeSemanticSwitch, welcomeUsesDive, WELCOME_FOCUS, WELCOME_IRIS_START, WELCOME_SECONDS, WELCOME_ZOOM_START, WELCOME_ZOOM_END } from '../src/ui/welcomeTimeline';

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
    expect(last.x).toBe(WELCOME_FOCUS.x);
    expect(last.y).toBe(WELCOME_FOCUS.y);
  });

  it('dives continuously then pulls back for the finale', () => {
    let previous = welcomeCamera(WELCOME_ZOOM_START).zoom;
    for (let t = WELCOME_ZOOM_START + 0.01; t <= WELCOME_ZOOM_END; t += 0.01) {
      const camera = welcomeCamera(t);
      expect(camera.zoom).toBeGreaterThanOrEqual(previous);
      expect(camera.zoom - previous).toBeLessThan(0.7);
      previous = camera.zoom;
    }
    expect(welcomeCamera(11).zoom).toBe(44);
    expect(welcomeCamera(12).zoom).toBe(40);
    const before = welcomeCamera(WELCOME_ZOOM_START - 0.0001);
    const after = welcomeCamera(WELCOME_ZOOM_START + 0.0001);
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.001);
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.001);
    expect(Math.abs(after.zoom - before.zoom)).toBeLessThan(0.001);
  });

  it('clamps time and syncs three copy beats with the view', () => {
    expect(welcomeCamera(-100)).toEqual(welcomeCamera(0));
    expect(welcomeCamera(100)).toEqual(welcomeCamera(WELCOME_SECONDS));
    expect([0, 4, 6.5].map(welcomeBeat)).toEqual([0, 1, 2]);
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


describe('magnifying glass and dive', () => {
  it.each([[1280, 800], [2560, 1440], [600, 600], [390, 844]])('hands the iris to the identical main camera at %s × %s', (w, h) => {
    const landing = welcomeLensTimeline(6.5, w, h);
    expect(landing.main).toEqual(landing.lens);
    expect(landing.radius).toBeGreaterThanOrEqual(Math.hypot(w / 2, h / 2));
    expect(landing.lensVisible).toBe(false);
    const before = welcomeLensTimeline(6.5 - 0.00001, w, h);
    expect(before.lens.x).toBeCloseTo(landing.main.x, 5);
    expect(before.lens.y).toBeCloseTo(landing.main.y, 5);
    expect(before.lens.zoom).toBe(landing.main.zoom);
  });

  it('keeps the sampled world underneath the lens and grows the iris monotonically', () => {
    let previousRadius = 0;
    let previous = welcomeLensTimeline(4, 1280, 800);
    for (let t = 4; t <= 6.5; t += 0.002) {
      const frame = welcomeLensTimeline(t, 1280, 800);
      expect(frame.lens.zoom).toBeGreaterThan(17);
      const farthestCorner = Math.max(...[[0, 0], [1280, 0], [0, 800], [1280, 800]]
        .map(([x, y]) => Math.hypot(x - frame.sx, y - frame.sy)));
      if (!frame.landed) expect(frame.radius).toBeLessThan(farthestCorner);
      else expect(frame.main).toEqual(frame.lens);
      expect(frame.world.x).toBeCloseTo(frame.lens.x + (frame.sx - 640) / frame.lens.zoom);
      expect(frame.world.y).toBeCloseTo(frame.lens.y + (frame.sy - 400) / frame.lens.zoom);
      if (t >= WELCOME_IRIS_START) expect(frame.radius).toBeGreaterThanOrEqual(previousRadius);
      expect(Math.abs(frame.lens.x - previous.lens.x)).toBeLessThan(0.15);
      expect(Math.abs(frame.lens.y - previous.lens.y)).toBeLessThan(0.15);
      previous = frame; previousRadius = frame.radius;
    }
  });

  it.each([4, 4.35, 5.6, 6.15])('keeps circle geometry continuous around %s seconds', (t) => {
    const before = welcomeLensTimeline(t - 0.00001, 1280, 800);
    const after = welcomeLensTimeline(t + 0.00001, 1280, 800);
    for (const prop of ['sx', 'sy', 'radius', 'inkAlpha'] as const) expect(Math.abs(after[prop] - before[prop])).toBeLessThan(0.05);
  });

  it.each([[1280, 800], [390, 844], [844, 390]])('flashes exactly when the dive reaches full faces at %s × %s', (w, h) => {
    const switchAt = welcomeSemanticSwitch(w, h);
    expect(welcomeCamera(switchAt, w, h).zoom).toBeCloseTo(17, 6);
    expect(welcomeLensTimeline(switchAt, w, h, 'dive').flashAlpha).toBe(1);
    expect(welcomeLensTimeline(switchAt - 0.12, w, h, 'dive').flashAlpha).toBe(0);
    expect(welcomeLensTimeline(switchAt + 0.12, w, h, 'dive').flashAlpha).toBe(0);
    expect(welcomeLensTimeline(5, w, h, 'dive').lensVisible).toBe(false);
    expect(welcomeLensTimeline(6.5, w, h, 'dive').main).toEqual(welcomeLensTimeline(6.5, w, h, 'lens').main);
  });

  it('selects the cheaper dive for touch, small screens or slow measured frames', () => {
    expect(welcomeUsesDive(1280, 800, false, 28)).toBe(false);
    expect(welcomeUsesDive(1280, 800, false, 28.01)).toBe(true);
    expect(welcomeUsesDive(1280, 800, true)).toBe(true);
    expect(welcomeUsesDive(599, 800, false)).toBe(true);
    expect(welcomeUsesDive(800, 599, false)).toBe(true);
  });
});
