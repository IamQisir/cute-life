import { describe, expect, it } from 'vitest';
import { fromList, step, key, keyX, keyY, toList, type Cells } from '../src/life/engine';
import { Camera } from '../src/render/camera';
import { Sim } from '../src/sim';
import { borrowSandbox } from '../src/ui/welcomeSandbox';
import {
  buildWelcomeScene, showcaseSeed, SHOWCASE_GUNS, SHOWCASE_BATTERIES, COLLISION_ZONES, LETTERING_RECT, welcomeLetters,
  welcomeLettering, welcomePattern, WELCOME_GENESIS, WELCOME_CELL_CAP, WELCOME_PRE_ADVANCE,
} from '../src/ui/welcomeScene';
import { at, BEAT, HUSH_BLINKER, LETTER_POPS, MONTAGE, trailerFrame, trailerGeneration, TRAILER_SECONDS } from '../src/ui/trailer';

const inTitle = (k: number) => {
  const r = LETTERING_RECT, x = keyX(k), y = keyY(k);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
};
const withGenesis = (cells: Cells) => new Set([...cells, ...fromList(welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y))]);

// Whole-show simulations: well under a second locally, but CI runners are slower.
describe('trailer world', { timeout: 60_000 }, () => {
  it('builds a deterministic, already-busy scene from the catalog, title left out', () => {
    const first = buildWelcomeScene(false, false);
    expect(first).toEqual(buildWelcomeScene(false, false));
    expect(first.size).toBeGreaterThan(5000);
    expect(first.size).toBeLessThan(WELCOME_CELL_CAP);
    expect(first).not.toEqual(showcaseSeed(false, false));
    expect([...showcaseSeed(false, false)].filter(inTitle)).toEqual([]);
  });

  it('writes cute life in isolated still lifes that never change, eight letters in order', () => {
    const letters = welcomeLettering();
    let cells = letters;
    for (let i = 0; i < 200; i++) cells = step(cells);
    expect(cells).toEqual(letters);
    const parts = welcomeLetters();
    expect(parts).toHaveLength(8);
    parts.slice(1).forEach((p, i) => expect(Math.min(...p.map(([x]) => x))).toBeGreaterThan(Math.max(...parts[i].map(([x]) => x))));
    expect([...letters].every(inTitle)).toBe(true);
  });

  it('has genuinely interacting glider streams during the build, and starts genesis on blank paper', () => {
    const scene = buildWelcomeScene(false, false);
    expect([...scene].filter((k) => Math.abs(keyX(k) - WELCOME_GENESIS.x) < 15 && Math.abs(keyY(k) - WELCOME_GENESIS.y) < 10)).toEqual([]);
    let combined = showcaseSeed(false, false);
    let isolated = SHOWCASE_BATTERIES.map((gun) => {
      let cells = fromList(welcomePattern('gosperglidergun', 0, 0));
      for (let i = 0; i < gun.phase; i++) cells = step(cells);
      return fromList(toList(cells).map(([x, y]) => [gun.x + x * (gun.flipX ? -1 : 1), gun.y + y * (gun.flipY ? -1 : 1)]));
    });
    for (let i = 0; i < WELCOME_PRE_ADVANCE + trailerGeneration(at(3)); i++) {
      combined = step(combined); isolated = isolated.map(step);
    }
    const uncollided = new Set(isolated.flatMap((cells) => [...cells]));
    const activeCorridors = COLLISION_ZONES.filter((zone) => [...uncollided].some((k) =>
      !combined.has(k) && Math.hypot(keyX(k) - zone.x, keyY(k) - zone.y) < zone.radius));
    expect(activeCorridors.length).toBeGreaterThanOrEqual(3);
  });

  it('bounds the population and keeps generations cheap for the whole trailer', () => {
    let cells = withGenesis(buildWelcomeScene(false, false));
    const timings: number[] = [];
    let low = Infinity, peak = 0;
    for (let i = 0; i < trailerGeneration(TRAILER_SECONDS); i++) {
      const start = performance.now();
      cells = step(cells);
      timings.push(performance.now() - start);
      low = Math.min(low, cells.size); peak = Math.max(peak, cells.size);
      expect(cells.size).toBeLessThan(WELCOME_CELL_CAP);
    }
    const median = timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)];
    expect(low).toBeGreaterThanOrEqual(7000);
    expect(peak).toBeLessThanOrEqual(10000);
    expect(median).toBeLessThan(Boolean((globalThis as { process?: { env?: { CI?: string } } }).process?.env?.CI) ? 40 : 12);
  });

  it('lands the title on clean paper and keeps it intact to the last frame', () => {
    let cells = withGenesis(buildWelcomeScene(false, false));
    const letters = welcomeLetters();
    let generation = 0, popped = 0;
    const end = trailerGeneration(TRAILER_SECONDS);
    while (generation < trailerGeneration(at(8, 2))) { cells = step(cells); generation++; }
    // The show wipes the footprint (including the hush blinker) right before the first letter.
    cells = new Set([...cells, ...fromList([...HUSH_BLINKER])].filter((k) => !inTitle(k)));
    for (; generation <= end; generation++) {
      const t = LETTER_POPS.findIndex((p) => trailerGeneration(p) > generation);
      const due = t === -1 ? letters.length : t;
      for (; popped < due; popped++) cells = new Set([...cells, ...fromList(letters[popped])]);
      expect(new Set([...cells].filter(inTitle)), `generation ${generation}`).toEqual(new Set(letters.slice(0, popped).flat().map(([x, y]) => key(x, y))));
      cells = step(cells);
    }
  });

  it('keeps the genesis bloom and the magnifier gun undisturbed while they are on screen', () => {
    let cells = withGenesis(buildWelcomeScene(false, false));
    let genesis = fromList(welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y));
    let gun = fromList(welcomePattern('gosperglidergun', SHOWCASE_GUNS[0].x, SHOWCASE_GUNS[0].y));
    for (let i = 0; i < WELCOME_PRE_ADVANCE; i++) gun = step(gun);
    for (let generation = 0; generation <= trailerGeneration(at(5, 2)); generation++) {
      if (generation <= trailerGeneration(at(2))) {
        const onStage = (k: number) => Math.abs(keyX(k) - WELCOME_GENESIS.x) < 15 && Math.abs(keyY(k) - WELCOME_GENESIS.y) < 10;
        expect(new Set([...cells].filter(onStage))).toEqual(new Set([...genesis].filter(onStage)));
      }
      if (generation >= trailerGeneration(at(4))) {
        const core = (k: number) => keyX(k) >= -155 && keyX(k) <= -115 && keyY(k) >= -110 && keyY(k) <= -90;
        expect(new Set([...cells].filter(core))).toEqual(new Set([...gun].filter(core)));
      }
      cells = step(cells); genesis = step(genesis); gun = step(gun);
    }
  });

  it.each([[1920, 1080], [1080, 1920]])('fills every montage shot with life (%s × %s)', (w, h) => {
    const minimum: Record<string, number> = { gun: 36, chaos: 150, fleet: 100, pulsars: 40, armada: 800, bloom: 100 };
    let cells = withGenesis(buildWelcomeScene(false, false));
    let generation = 0;
    for (const shot of MONTAGE) {
      const t = shot.start + BEAT;
      while (generation < trailerGeneration(t)) { cells = step(cells); generation++; }
      const cam = Object.assign(new Camera(), trailerFrame(t, w, h, generation).camera, { w, h });
      const [x0, y0] = cam.toWorld(0, 0), [x1, y1] = cam.toWorld(w, h);
      const visible = [...cells].filter((k) => keyX(k) >= x0 && keyX(k) <= x1 && keyY(k) >= y0 && keyY(k) <= y1).length;
      expect(visible, shot.name).toBeGreaterThanOrEqual(minimum[shot.name]);
    }
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
    Object.assign(cam, { x: -128, y: -97, zoom: 40 });
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
