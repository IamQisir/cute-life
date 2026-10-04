import { describe, expect, it, vi } from 'vitest';
import { findClusters } from '../src/life/clusters';
import { fromList, key, keyX, keyY, neighborCounts, step } from '../src/life/engine';
import { rasterDots } from '../src/render/dotBitmap';
import { percentile, perf } from '../src/render/perf';
import { cellsInRect, VisibleClusterCache } from '../src/render/visibleClusters';
import { Sim } from '../src/sim';
import { applyBakedFrame, bakeWelcome, decodeFrame, frameBytes } from '../src/ui/welcomeBake';
import { buildWelcomeScene, welcomePattern, WELCOME_GENESIS, WELCOME_PRE_ADVANCE } from '../src/ui/welcomeScene';
import { WelcomeQuality } from '../src/ui/welcomeQuality';
import { welcomeCamera, welcomeGeneration, WELCOME_SECONDS } from '../src/ui/welcomeTimeline';

const samples = new Set([0, 1, 12, 57, 81, 111, 123, 153]);
describe('welcome bake and performance', { timeout: 30_000 }, () => {
  it.each([false, true])('replays every generation including counts and animation bookkeeping (small=%s)', (small) => {
    const live = new Sim(75), playback = new Sim(75);
    live.cells = buildWelcomeScene(small);
    live.counts = neighborCounts(live.cells);
    live.generation = WELCOME_PRE_ADVANCE;
    const iterator = bakeWelcome(small);
    let bakeMs = 0, bytes = 0;
    const liveMs: number[] = [], playbackMs: number[] = [];
    let generation = 0;
    for (;;) {
      let start = performance.now();
      const item = iterator.next();
      bakeMs += performance.now() - start;
      if (item.done) break;
      const frame = item.value;
      bytes += frameBytes(frame);
      const now = generation * 83;
      if (generation === 1) {
        const genesis = welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y);
        live.addMany(genesis, 0); playback.addMany(genesis, 0);
      }
      start = performance.now();
      const liveBirths = generation ? live.advance(now) : [];
      if (generation) liveMs.push(performance.now() - start);
      start = performance.now();
      const births = applyBakedFrame(playback, frame, now, !generation);
      if (generation) playbackMs.push(performance.now() - start);
      expect(playback.cells.size, `generation ${generation}`).toBe(live.cells.size);
      expect(playback.generation).toBe(live.generation);
      expect(births.length).toBe(liveBirths.length);
      if (samples.has(generation)) {
        expect(playback.cells).toEqual(live.cells);
        expect(playback.counts).toEqual(live.counts);
        if (generation) {
          expect(births).toEqual(liveBirths);
          expect(playback.bornAt).toEqual(live.bornAt);
          expect(playback.fading).toEqual(live.fading);
        }
      }
      generation++;
    }
    expect(generation).toBe(welcomeGeneration(WELCOME_SECONDS) + 1);
    // Includes every full neighbour map, not just cell keys. Combined bound < 33 MiB.
    expect(bytes).toBeLessThan((small ? 10 : 23) * 1048576);
    console.info(`Bake ${small ? 'small' : 'full'}: ${bytes} bytes (${(bytes / 1048576).toFixed(2)} MiB), ${bakeMs.toFixed(0)} ms; Sim.advance median ${percentile(liveMs, 0.5).toFixed(3)} ms; playback ${percentile(playbackMs, 0.5).toFixed(3)} ms`);
  });

  it('packs signed coordinates without truncating the engine’s 42-bit keys', () => {
    const frame = bakeWelcome(true).next().value!;
    const cells = decodeFrame(frame).cells;
    expect([...cells].some((k) => keyX(k) < 0 && keyY(k) < 0)).toBe(true);
    expect([...cells].every((k) => k > 2 ** 31)).toBe(true);
  });

  it('caches the identical padded visible clusters once per version', () => {
    const cells = fromList([[0, 0], [1, 0], [0, 1], [1, 1], [12, 0], [13, 0], [14, 0], [100, 0]]);
    const rect = { x0: -2, y0: -2, x1: 7, y1: 5 };
    const cache = new VisibleClusterCache();
    const clustered = cache.get(cells, 1, rect);
    expect(clustered).toEqual(findClusters(cellsInRect(cells, rect)));
    expect(cache.get(cells, 1, { ...rect, x0: -1 })).toBe(clustered);
    expect(clustered.flatMap((c) => c.cells)).not.toContain(key(100, 0));
    expect(cache.get(cells, 2, rect)).toEqual(clustered);
    expect(cache.get(cells, 2, rect)).not.toBe(clustered);
  });

  it('retains the full classification and geometry of fleet travellers inside the viewport', () => {
    let cells = buildWelcomeScene();
    const genesis = fromList(welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y));
    cells = new Set([...cells, ...genesis]);
    const ms: number[] = [], fullMs: number[] = [], rasterMs: number[] = [];
    let generation = 0;
    for (const seconds of [6, 6.5, 7, 7.5, 7.99]) {
      while (generation < welcomeGeneration(seconds)) { cells = step(cells); generation++; }
      const pose = welcomeCamera(seconds, 1280, 800);
      const rect = { x0: pose.x - 640 / pose.zoom, y0: pose.y - 400 / pose.zoom,
        x1: pose.x + 640 / pose.zoom, y1: pose.y + 400 / pose.zoom };
      let start = performance.now();
      const all = findClusters(cells);
      fullMs.push(performance.now() - start);
      start = performance.now();
      const visible = new VisibleClusterCache().get(cells, generation, rect);
      ms.push(performance.now() - start);
      // Match every compact creature intersecting the actual camera, including its full body/heading.
      const travellers = all.filter((c) => c.cells.length <= 16 && c.maxX >= rect.x0 && c.minX <= rect.x1 && c.maxY >= rect.y0 && c.minY <= rect.y1);
      expect(travellers.length).toBeGreaterThan(5);
      for (const c of travellers) expect(visible.find((v) => v.cells.includes(c.cells[0]))).toEqual(c);
      start = performance.now();
      rasterDots(cells, () => ({ outline: 0x3f7f6a, nucleus: 0x5fb894 }), 2.8);
      rasterMs.push(performance.now() - start);
    }
    console.info(`Clusters full/visible median ${percentile(fullMs, 0.5).toFixed(3)}/${percentile(ms, 0.5).toFixed(3)} ms; dot raster ${percentile(rasterMs, 0.5).toFixed(3)} ms/generation`);
  });
});

describe('dot bitmap rasteriser', () => {
  it('maps signed world cells to their centres, preserves palette and leaves gaps transparent', () => {
    const a = key(-3, 2), b = key(1, 4);
    const raster = rasterDots(new Set([a, b]), (k) => k === a
      ? { outline: 0x112233, nucleus: 0xff0000 } : { outline: 0x334455, nucleus: 0x00ff00 }, 4.5);
    const pixel = (x: number, y: number) => {
      const px = Math.floor((x - raster.x + 0.5) * 3), py = Math.floor((y - raster.y + 0.5) * 3);
      return [...raster.data.slice((py * raster.width + px) * 4, (py * raster.width + px) * 4 + 4)];
    };
    expect(pixel(-3, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(1, 4)).toEqual([0, 255, 0, 255]);
    expect(pixel(-1, 3)).toEqual([0, 0, 0, 0]);
    expect(raster.x).toBeLessThan(-3);
  });
  it('retains the 4.5px minimum dot size and has bounded transparent padding', () => {
    const colour = () => ({ outline: 0x112233, nucleus: 0x445566 });
    const normal = rasterDots(new Set([key(0, 0)]), colour, 4.5);
    const far = rasterDots(new Set([key(0, 0)]), colour, 1.5);
    const span = (r: typeof normal) => {
      let min = r.width, max = 0;
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
        if (r.data[(y * r.width + x) * 4 + 3]) { min = Math.min(min, x); max = Math.max(max, x); }
      }
      return max - min + 1;
    };
    expect(span(far)).toBeGreaterThan(span(normal));
    expect(span(far) / 3 * 1.5).toBeCloseTo(span(normal) / 3 * 4.5, 0);
    expect(rasterDots(new Set(), colour, 1).data).toEqual(new Uint8ClampedArray(4));
  });
});

describe('adaptive quality', () => {
  it('degrades in order, changes worlds/lens only at hard cuts, and never upgrades', () => {
    const log = vi.fn(), quality = new WelcomeQuality(log);
    for (let i = 1; i <= 110; i++) {
      const seconds = i / 20;
      const level = quality.update(seconds, 50);
      expect(level).toBe(seconds < 1 ? 0 : 1);
    }
    expect(quality.update(6, 50)).toBe(2);
    for (let i = 121; i < 160; i++) expect(quality.update(i / 20, 50)).toBe(2);
    expect(quality.update(8, 50)).toBe(3);
    for (let i = 161; i <= 320; i++) expect(quality.update(i / 20, 8)).toBe(3);
    expect(log).toHaveBeenCalledTimes(3);
  });
  it('ignores hidden tabs, isolated outliers, and large background gaps', () => {
    const quality = new WelcomeQuality();
    for (let i = 1; i <= 100; i++) quality.update(i / 60, i === 20 ? 100 : 16);
    expect(quality.level).toBe(0);
    for (let i = 101; i <= 180; i++) quality.update(i / 60, 60, true);
    quality.update(6, 3000);
    quality.update(8, 3000);
    expect(quality.level).toBe(0);
  });
  it('does not call clocks when perf is disabled', () => {
    const clock = vi.spyOn(performance, 'now');
    perf.enabled = false;
    const start = perf.start();
    perf.end('clusters', start); perf.log('ignored');
    expect(clock).not.toHaveBeenCalled();
    clock.mockRestore();
  });
});
