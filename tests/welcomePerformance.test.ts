import { describe, expect, it, vi } from 'vitest';
import { findClusters } from '../src/life/clusters';
import { fromList, key, step } from '../src/life/engine';
import { rasterDots } from '../src/render/dotBitmap';
import { percentile, perf } from '../src/render/perf';
import { cellsInRect, VisibleClusterCache } from '../src/render/visibleClusters';
import { buildWelcomeScene, welcomePattern, WELCOME_GENESIS } from '../src/ui/welcomeScene';
import { BEAT, MONTAGE, trailerFrame, trailerGeneration } from '../src/ui/trailer';

describe('visible-only creatures', { timeout: 30_000 }, () => {
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

  it('retains the full classification and geometry of the fleet travellers in the trailer shot', () => {
    let cells = new Set([...buildWelcomeScene(false, false), ...fromList(welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y))]);
    const fleet = MONTAGE.find((m) => m.name === 'fleet')!;
    const ms: number[] = [], fullMs: number[] = [], rasterMs: number[] = [];
    let generation = 0;
    for (const seconds of [0.05, 0.5, 1, 1.5, 1.85].map((b) => fleet.start + b * BEAT)) {
      while (generation < trailerGeneration(seconds)) { cells = step(cells); generation++; }
      const pose = trailerFrame(seconds, 1280, 800, generation).camera;
      const rect = { x0: pose.x - 640 / pose.zoom, y0: pose.y - 400 / pose.zoom, x1: pose.x + 640 / pose.zoom, y1: pose.y + 400 / pose.zoom };
      let start = performance.now();
      const all = findClusters(cells);
      fullMs.push(performance.now() - start);
      start = performance.now();
      const visible = new VisibleClusterCache().get(cells, generation, rect);
      ms.push(performance.now() - start);
      // Every compact creature intersecting the camera keeps its full body and heading.
      const travellers = all.filter((c) => c.cells.length <= 16 && c.maxX >= rect.x0 && c.minX <= rect.x1 && c.maxY >= rect.y0 && c.minY <= rect.y1);
      expect(travellers.length).toBeGreaterThan(5);
      for (const c of travellers) expect(visible.find((v) => v.cells.includes(c.cells[0]))).toEqual(c);
      start = performance.now();
      rasterDots(cells, () => ({ outline: 0x3f7f6a, nucleus: 0x5fb894 }), 2.8);
      rasterMs.push(performance.now() - start);
    }
    console.info(`Clusters full/visible median ${percentile(fullMs, 0.5).toFixed(3)}/${percentile(ms, 0.5).toFixed(3)} ms; dot raster ${percentile(rasterMs, 0.5).toFixed(3)} ms/generation`);
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
