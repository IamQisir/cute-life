// Simulation state plus the bookkeeping the renderer needs for animation:
// when each cell was born and which cells are fading out.

import { type Cells, buds, key, neighborCounts, step } from './life/engine';

export interface Fading {
  k: number;
  t0: number;
}

export class Sim {
  cells: Cells = new Set();
  counts = new Map<number, number>();
  budKeys: number[] = [];
  generation = 0;
  /** Bumps whenever the set of live cells changes. */
  version = 0;
  bornAt = new Map<number, number>();
  fading: Fading[] = [];

  constructor(public animMs = 420) {}

  get population() {
    return this.cells.size;
  }

  has(x: number, y: number) {
    return this.cells.has(key(x, y));
  }

  /** Set one cell by hand. Returns true if anything changed. */
  set(x: number, y: number, alive: boolean, now: number): boolean {
    const k = key(x, y);
    if (alive === this.cells.has(k)) return false;
    if (alive) {
      this.cells.add(k);
      this.bornAt.set(k, now);
    } else {
      this.cells.delete(k);
      this.fading.push({ k, t0: now });
    }
    this.refresh();
    return true;
  }

  /** Add many cells at once (pattern stamps, random soup). */
  addMany(points: [number, number][], now: number) {
    for (const [x, y] of points) {
      const k = key(x, y);
      if (!this.cells.has(k)) {
        this.cells.add(k);
        this.bornAt.set(k, now);
      }
    }
    this.refresh();
  }

  /** Advance one generation. Returns the keys of newborn cells. */
  advance(now: number): number[] {
    const next = step(this.cells);
    const born: number[] = [];
    for (const k of next) if (!this.cells.has(k)) born.push(k);
    for (const k of this.cells) if (!next.has(k)) this.fading.push({ k, t0: now });
    this.cells = next;
    this.generation++;
    this.prune(now);
    for (const k of born) this.bornAt.set(k, now);
    this.refresh();
    return born;
  }

  clear(now: number) {
    for (const k of this.cells) this.fading.push({ k, t0: now });
    this.cells = new Set();
    this.generation = 0;
    this.bornAt.clear();
    this.refresh();
  }

  /** Drop animation records that have finished. */
  prune(now: number) {
    for (const [k, t] of this.bornAt) if (now - t > this.animMs) this.bornAt.delete(k);
    this.fading = this.fading.filter((f) => now - f.t0 < this.animMs);
  }

  private refresh() {
    this.version++;
    this.counts = neighborCounts(this.cells);
    this.budKeys = buds(this.cells, this.counts);
  }
}
