import { describe, expect, it } from 'vitest';
import { fromList, step, keyX, keyY, toList } from '../src/life/engine';
import { Camera } from '../src/render/camera';
import { Sim } from '../src/sim';
import { borrowSandbox } from '../src/ui/welcomeSandbox';
import {
  buildWelcomeScene, showcaseSeed, SHOWCASE_GUNS, COLLISION_ZONES, welcomeLettering, welcomePattern, WELCOME_GENESIS, WELCOME_CELL_CAP, WELCOME_SMALL_CAP, WELCOME_PRE_ADVANCE,
} from '../src/ui/welcomeScene';
import { welcomeBeat, welcomeCamera, welcomeGeneration, welcomeWideZoom, WELCOME_SHOTS, welcomeLensTimeline, welcomeSemanticSwitch, welcomeUsesDive, WELCOME_FOCUS, WELCOME_IRIS_START, WELCOME_SECONDS, WELCOME_ZOOM_END } from '../src/ui/welcomeTimeline';

describe('welcome showcase', () => {
  it('builds a deterministic, already-busy scene from the catalog', () => {
    const first = buildWelcomeScene();
    expect(first).toEqual(buildWelcomeScene());
    expect(first.size).toBeGreaterThan(800);
    expect(first.size).toBeLessThan(WELCOME_CELL_CAP);
    expect(first).not.toEqual(showcaseSeed());
  });

  it('writes cute life in isolated still lifes that never change', () => {
    const letters = welcomeLettering();
    let cells = letters;
    for (let i = 0; i < 200; i++) cells = step(cells);
    expect(cells).toEqual(letters);
  });

  it('has genuinely interacting glider streams in the world shot, and starts genesis on blank paper', () => {
    const scene = buildWelcomeScene();
    expect([...scene].filter((k) => Math.abs(keyX(k) - WELCOME_GENESIS.x) < 15 && Math.abs(keyY(k) - WELCOME_GENESIS.y) < 10)).toEqual([]);
    let combined = showcaseSeed();
    let isolated = SHOWCASE_GUNS.map((gun) => {
      let cells = fromList(welcomePattern('gosperglidergun', 0, 0));
      for (let i = 0; i < gun.phase; i++) cells = step(cells);
      return fromList(toList(cells).map(([x, y]) => [gun.x + x * (gun.flipX ? -1 : 1), gun.y + y * (gun.flipY ? -1 : 1)]));
    });
    for (let i = 0; i < WELCOME_PRE_ADVANCE + welcomeGeneration(5); i++) {
      combined = step(combined); isolated = isolated.map(step);
    }
    const uncollided = new Set(isolated.flatMap((cells) => [...cells]));
    const collisionLosses = [...uncollided].filter((k) => !combined.has(k) && COLLISION_ZONES.some((zone) => Math.hypot(keyX(k) - zone.x, keyY(k) - zone.y) < zone.radius));
    expect(collisionLosses.length).toBeGreaterThan(0);
  });

  it.each([false, true])('bounds population, protects the lettering and measures median generation time (small=%s)', (small) => {
    let cells = showcaseSeed(small);
    let peak = cells.size;
    const title = welcomeLettering();
    const timings: number[] = [];
    let warmSize = 0;
    for (let i = 0; i < WELCOME_PRE_ADVANCE + welcomeGeneration(WELCOME_SECONDS); i++) {
      if (i === WELCOME_PRE_ADVANCE) {
        warmSize = cells.size;
        cells = new Set([...cells, ...fromList(welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y))]);
      }
      const start = performance.now();
      cells = step(cells);
      if (i >= WELCOME_PRE_ADVANCE) timings.push(performance.now() - start);
      peak = Math.max(peak, cells.size);
      expect(cells.size).toBeLessThanOrEqual(small ? WELCOME_SMALL_CAP : WELCOME_CELL_CAP);
      const centre = new Set([...cells].filter((k) => keyX(k) >= -130 && keyX(k) <= 130 && Math.abs(keyY(k)) <= 23));
      expect(centre).toEqual(title);
    }
    const median = timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)];
    expect(median).toBeLessThan(Boolean((globalThis as { process?: { env?: { CI?: string } } }).process?.env?.CI) ? 40 : 12);
    console.info(`Welcome ${small ? 'small' : 'full'}: warm ${warmSize}, peak ${peak}, final ${cells.size}, median ${median.toFixed(3)} ms, bounds ${JSON.stringify({ minX: Math.min(...toList(cells).map(([x]) => x)), maxX: Math.max(...toList(cells).map(([x]) => x)), minY: Math.min(...toList(cells).map(([, y]) => y)), maxY: Math.max(...toList(cells).map(([, y]) => y)) })}`);
  });
});

describe('welcome camera shot list', () => {
  it.each([[1280, 800], [360, 780], [844, 390]])('starts with faces and ends with a legible whole world at %s × %s', (w, h) => {
    expect(welcomeCamera(0, w, h)).toEqual({ ...WELCOME_GENESIS, zoom: 44 });
    expect(welcomeCamera(WELCOME_SECONDS, w, h)).toEqual({ x: 0, y: 0, zoom: welcomeWideZoom(w, h) });
    expect(welcomeCamera(7, w, h).zoom).toBeGreaterThanOrEqual(4);
    expect(welcomeCamera(7, w, h).zoom).toBeLessThan(13);
    expect(welcomeCamera(12, w, h).zoom).toBe(44);
  });

  it.each(['lens', 'dive'] as const)('has no camera jumps except declared, flashed whip cuts (%s)', (transition) => {
    const eps = 0.00001;
    for (const t of [1.25, ...WELCOME_SHOTS.slice(1).map((shot) => shot.start), 9.6, 15.4, 16]) {
      const before = welcomeLensTimeline(t - eps, 1280, 800, transition);
      const after = welcomeLensTimeline(t + eps, 1280, 800, transition);
      const cut = WELCOME_SHOTS.find((shot) => shot.start === t)?.cut;
      if (cut) {
        expect(welcomeLensTimeline(t, 1280, 800, transition).flashAlpha).toBe(1);
        expect(Math.hypot(after.main.x - before.main.x, after.main.y - before.main.y)).toBeGreaterThan(50);
      } else for (const prop of ['x', 'y', 'zoom'] as const) expect(Math.abs(after.main[prop] - before.main[prop])).toBeLessThan(0.01);
    }
  });

  it('clamps time, stages the genesis and gives each shot its own caption', () => {
    expect(welcomeCamera(-100)).toEqual(welcomeCamera(0));
    expect(welcomeCamera(100)).toEqual(welcomeCamera(WELCOME_SECONDS));
    expect(WELCOME_SHOTS.map((shot) => welcomeBeat(shot.start))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(welcomeGeneration(1.1)).toBe(0);
    expect(welcomeGeneration(2.2)).toBe(12);
    expect(welcomeGeneration(12.5) - welcomeGeneration(11.5)).toBe(4);
    expect(welcomeGeneration(16)).toBe(153);
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
  it.each([[1280, 800], [2560, 1440], [600, 600], [360, 780]])('hands the iris to the identical main camera at %s × %s', (w, h) => {
    const landing = welcomeLensTimeline(WELCOME_ZOOM_END, w, h);
    expect(landing.main).toEqual(landing.lens);
    expect(landing.main).toEqual({ ...WELCOME_FOCUS, zoom: 44 });
    expect(landing.radius).toBeGreaterThanOrEqual(Math.hypot(w / 2, h / 2));
    expect(landing.lensVisible).toBe(false);
    const before = welcomeLensTimeline(WELCOME_ZOOM_END - 0.00001, w, h);
    expect(before.lens.x).toBeCloseTo(landing.main.x, 5);
    expect(before.lens.y).toBeCloseTo(landing.main.y, 5);
  });

  it('keeps the sampled world underneath the lens and grows the iris monotonically', () => {
    let previousRadius = 0;
    for (let t = 8; t <= 10.5; t += 0.002) {
      const frame = welcomeLensTimeline(t, 1280, 800);
      expect(frame.lens.zoom).toBeGreaterThan(17);
      expect(frame.world.x).toBeCloseTo(frame.lens.x + (frame.sx - 640) / frame.lens.zoom);
      expect(frame.world.y).toBeCloseTo(frame.lens.y + (frame.sy - 400) / frame.lens.zoom);
      if (t >= WELCOME_IRIS_START) expect(frame.radius).toBeGreaterThanOrEqual(previousRadius);
      previousRadius = frame.radius;
    }
  });

  it.each([8.35, 9.6, 10.05, 10.5])('keeps circle geometry continuous around %s seconds', (t) => {
    const before = welcomeLensTimeline(t - 0.00001, 1280, 800);
    const after = welcomeLensTimeline(t + 0.00001, 1280, 800);
    for (const prop of ['sx', 'sy', 'radius', 'inkAlpha'] as const) expect(Math.abs(after[prop] - before[prop])).toBeLessThan(0.05);
  });

  it.each([[1280, 800], [360, 780], [844, 390]])('flashes when the dive reaches full faces at %s × %s', (w, h) => {
    const switchAt = welcomeSemanticSwitch(w, h);
    expect(welcomeCamera(switchAt, w, h).zoom).toBeCloseTo(17, 6);
    expect(welcomeLensTimeline(switchAt, w, h, 'dive').flashAlpha).toBe(1);
    expect(welcomeLensTimeline(switchAt - 0.12, w, h, 'dive').flashAlpha).toBe(0);
    expect(welcomeLensTimeline(switchAt + 0.12, w, h, 'dive').flashAlpha).toBe(0);
    expect(welcomeLensTimeline(9, w, h, 'dive').lensVisible).toBe(false);
  });

  it('selects the cheaper dive for touch, small screens or slow measured frames', () => {
    expect(welcomeUsesDive(1280, 800, false, 28)).toBe(false);
    expect(welcomeUsesDive(1280, 800, false, 28.01)).toBe(true);
    expect(welcomeUsesDive(1280, 800, true)).toBe(true);
    expect(welcomeUsesDive(599, 800, false)).toBe(true);
    expect(welcomeUsesDive(800, 599, false)).toBe(true);
  });
});
