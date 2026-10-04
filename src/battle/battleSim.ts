// Adapts the battle grid (dense, toroidal, two colours) to the renderer's
// SimView, and keeps the birth/fade bookkeeping the animations need.

import { type TeamCluster, findTeamClusters } from '../life/clusters';
import { key, keyX, keyY } from '../life/engine';
import type { Fading, SimView } from '../sim';
import {
  type ArenaConfig,
  EMPTY,
  type Grid,
  type Paint,
  type Pt,
  type Team,
  emptyGrid,
  neighborCountsGrid,
  paintCells,
  population,
  scoreOf,
  stepGrid,
  territory,
} from './arena';

const sameGrid = (a: Grid, b: Grid) => a.length === b.length && a.every((v, i) => v === b[i]);

export class BattleSim implements SimView {
  cells = new Set<number>();
  counts = new Map<number, number>();
  budKeys: number[] = [];
  bornAt = new Map<number, number>();
  fading: Fading[] = [];
  version = 0;
  generation = 0;
  readonly organisms = false;
  /** Set by BattleMode: show team creatures (reveal, battle, result) or cells (deploying). */
  creatures = false;
  private clusterCache: { version: number; clusters: TeamCluster[] } | null = null;
  grid: Grid;
  /** Territory: which team last stood on each square. */
  paint: Paint;
  /** Bumps whenever paint changes, so the territory layer knows to redraw. */
  paintVersion = 0;
  /** True once the board can no longer change (still life or period 2). */
  settled = false;
  private prev: Grid | null = null;

  constructor(readonly cfg: ArenaConfig, public animMs = 360) {
    this.grid = emptyGrid(cfg);
    this.paint = emptyGrid(cfg);
  }

  teamOf(k: number): Team | undefined {
    const v = this.grid[keyY(k) * this.cfg.width + keyX(k)];
    return v === EMPTY ? undefined : (v as Team);
  }

  teamClusters(): TeamCluster[] {
    if (this.clusterCache?.version !== this.version) {
      const { width, height, wrapX, wrapY } = this.cfg;
      this.clusterCache = { version: this.version, clusters: findTeamClusters(this.grid, width, height, wrapX, wrapY) };
    }
    return this.clusterCache.clusters;
  }

  get score() {
    return population(this.grid);
  }

  get territory() {
    return territory(this.paint);
  }

  /** What decides the winner: garden flowers, or whole-board territory under legacy rules. */
  get points() {
    return scoreOf(this.cfg, this.paint);
  }

  /** Replace the whole board (e.g. revealing armies). Every cell pops in. */
  load(grid: Grid, now: number) {
    for (const k of this.cells) this.fading.push({ k, t0: now, team: this.teamOf(k) });
    this.grid = grid;
    this.generation = 0;
    this.prev = null;
    this.settled = false;
    this.paint = emptyGrid(this.cfg);
    paintCells(this.paint, grid);
    this.paintVersion++;
    this.bornAt.clear();
    this.refresh();
    for (const k of this.cells) this.bornAt.set(k, now);
  }

  /** Show one team's deployment while it is being edited. */
  showArmy(team: Team, army: Pt[], now: number) {
    const g = emptyGrid(this.cfg);
    for (const [x, y] of army) g[y * this.cfg.width + x] = team;
    const before = this.cells;
    this.grid = g;
    // No territory while deploying: the zones are shown instead.
    this.paint = emptyGrid(this.cfg);
    this.paintVersion++;
    this.refresh();
    for (const k of this.cells) if (!before.has(k)) this.bornAt.set(k, now);
    for (const k of before) if (!this.cells.has(k)) this.fading.push({ k, t0: now, team });
  }

  /** One generation. Returns the newborn cells with their team. */
  advance(now: number): [number, number, Team][] {
    const prev = this.grid;
    const next = stepGrid(prev, this.cfg.width, this.cfg.height, this.cfg.wrapX, this.cfg.wrapY);
    this.settled = sameGrid(next, prev) || (this.prev !== null && sameGrid(next, this.prev));
    this.prev = prev;
    const born: [number, number, Team][] = [];
    const w = this.cfg.width;
    for (let i = 0; i < next.length; i++) {
      if (prev[i] === next[i]) continue;
      const k = key(i % w, Math.floor(i / w));
      if (prev[i] !== EMPTY) this.fading.push({ k, t0: now, team: prev[i] as Team });
      if (next[i] !== EMPTY) born.push([i % w, Math.floor(i / w), next[i] as Team]);
    }
    this.grid = next;
    this.generation++;
    paintCells(this.paint, next);
    this.paintVersion++;
    this.prune(now);
    this.refresh();
    for (const [x, y] of born) this.bornAt.set(key(x, y), now);
    return born;
  }

  prune(now: number) {
    for (const [k, t] of this.bornAt) if (now - t > this.animMs) this.bornAt.delete(k);
    this.fading = this.fading.filter((f) => now - f.t0 < this.animMs);
  }

  private refresh() {
    const { width: w } = this.cfg;
    const n = neighborCountsGrid(this.grid, w, this.cfg.height, this.cfg.wrapX, this.cfg.wrapY);
    this.cells = new Set();
    this.counts = new Map();
    this.budKeys = [];
    for (let i = 0; i < this.grid.length; i++) {
      const k = key(i % w, Math.floor(i / w));
      if (this.grid[i] !== EMPTY) {
        this.cells.add(k);
        this.counts.set(k, n[i]);
      } else if (n[i] === 3) {
        this.budKeys.push(k);
      }
    }
    this.version++;
  }
}
