export const EMPTY = 0;
export const RED = 1;
export const BLUE = 2;
export type Team = 1 | 2;
export type Pt = [number, number];

export interface ArenaConfig {
  width: number;
  height: number;
  budget: number;
  generations: number;
  buffer: number;
  wrapX: boolean;
  wrapY: boolean;
  garden?: { x0: number; y0: number; x1: number; y1: number };
  endOnExtinction?: boolean;
}

/** Arena sizes players can pick. */
export type ArenaSize = 'small' | 'medium' | 'large' | 'xl';
export const ARENA_SIZES: ArenaSize[] = ['small', 'medium', 'large', 'xl'];
type LegacySize = Exclude<ArenaSize, 'xl'>;
/** Original territory rules, retained for version-1 links (there was no xl then). */
export const LEGACY_PRESETS: Record<LegacySize, ArenaConfig> = {
  small: { width: 28, height: 20, budget: 20, generations: 150, buffer: 1, wrapX: false, wrapY: true },
  medium: { width: 40, height: 28, budget: 32, generations: 220, buffer: 1, wrapX: false, wrapY: true },
  large: { width: 56, height: 40, budget: 50, generations: 300, buffer: 1, wrapX: false, wrapY: true },
};
export const ARENA_PRESETS: Record<ArenaSize, ArenaConfig> = {
  small: { ...LEGACY_PRESETS.small, buffer: 3, endOnExtinction: true,
    garden: { x0: 11, x1: 16, y0: 7, y1: 12 } },
  medium: { ...LEGACY_PRESETS.medium, buffer: 4, endOnExtinction: true,
    garden: { x0: 16, x1: 23, y0: 10, y1: 17 } },
  large: { ...LEGACY_PRESETS.large, buffer: 5, endOnExtinction: true,
    garden: { x0: 23, x1: 32, y0: 15, y1: 24 } },
  // The current battle arena: room for big structures (a Gosper gun is 36x9).
  // Zones: red x 0..33, blue x 46..79; the 12x12 garden fills the gap.
  xl: { width: 80, height: 56, budget: 100, generations: 360, buffer: 6, wrapX: false, wrapY: true,
    endOnExtinction: true, garden: { x0: 34, x1: 45, y0: 22, y1: 33 } },
};

/** The preset for a link's rules + size, or null if that combination never existed. */
export function presetFor(rules: 'garden' | 'legacy', size: ArenaSize): ArenaConfig | null {
  if (rules === 'garden') return ARENA_PRESETS[size];
  return size === 'xl' ? null : LEGACY_PRESETS[size];
}
export const DEFAULT_ARENA = ARENA_PRESETS.small;
export type Grid = Uint8Array;
export type Paint = Uint8Array;
export type Winner = 'red' | 'blue' | 'draw';
export interface BattleResult {
  red: number;
  blue: number;
  generations: number;
  winner: Winner;
  territory: { red: number; blue: number };
  score: { red: number; blue: number };
  history?: { red: number; blue: number; territoryRed: number; territoryBlue: number; scoreRed: number; scoreBlue: number }[];
}

function dimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1 || !Number.isSafeInteger(width * height)) {
    throw new RangeError('Arena dimensions must be positive safe integers.');
  }
}

function configError(cfg: ArenaConfig): string | undefined {
  if (!cfg || !Number.isSafeInteger(cfg.width) || cfg.width < 1
    || !Number.isSafeInteger(cfg.height) || cfg.height < 1
    || !Number.isSafeInteger(cfg.width * cfg.height)) return 'Invalid arena dimensions.';
  if (!Number.isSafeInteger(cfg.budget) || cfg.budget < 0) return 'Invalid cell budget.';
  if (!Number.isSafeInteger(cfg.generations) || cfg.generations < 0) return 'Invalid generation limit.';
  if (!Number.isSafeInteger(cfg.buffer) || cfg.buffer < 0) return 'Invalid deployment buffer.';
  if (typeof cfg.wrapX !== 'boolean' || typeof cfg.wrapY !== 'boolean') return 'Invalid arena wrapping flags.';
  if (cfg.endOnExtinction !== undefined && typeof cfg.endOnExtinction !== 'boolean') {
    return 'Invalid extinction flag.';
  }
  if (cfg.garden !== undefined) {
    const g = cfg.garden;
    if (!g || ![g.x0, g.x1, g.y0, g.y1].every(Number.isSafeInteger)
      || g.x0 < 0 || g.y0 < 0 || g.x1 < g.x0 || g.y1 < g.y0
      || g.x1 >= cfg.width || g.y1 >= cfg.height) return 'Invalid garden bounds.';
  }
  return undefined;
}

export function emptyGrid(cfg: ArenaConfig): Grid {
  const error = configError(cfg);
  if (error) throw new RangeError(error);
  return new Uint8Array(cfg.width * cfg.height);
}

// Cache geometry only; grids and scratch space are always local to each caller.
interface Topology { neighbors: Uint32Array; starts: Uint32Array }
const topologies = new Map<string, Topology>();
function topology(width: number, height: number, wrapX: boolean, wrapY: boolean): Topology {
  dimensions(width, height);
  const key = `${width}:${height}:${wrapX}:${wrapY}`;
  const cached = topologies.get(key);
  if (cached) return cached;
  const neighbors = new Uint32Array(width * height * 8);
  const starts = new Uint32Array(width * height + 1);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      starts[y * width + x] = offset;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (!wrapY && (ny < 0 || ny >= height)) continue;
        const row = ((ny + height) % height) * width;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((!dx && !dy) || (!wrapX && (nx < 0 || nx >= width))) continue;
          neighbors[offset++] = row + (nx + width) % width;
        }
      }
    }
  }
  starts[width * height] = offset;
  const result = { neighbors, starts };
  if (topologies.size >= 8) topologies.delete(topologies.keys().next().value!);
  topologies.set(key, result);
  return result;
}

function checkGrid(grid: Grid, width: number, height: number, wrapX: boolean, wrapY: boolean): Topology {
  dimensions(width, height);
  if (grid.length !== width * height) throw new RangeError('Grid size does not match arena dimensions.');
  return topology(width, height, wrapX, wrapY);
}

export function neighborCountsGrid(
  grid: Grid, width: number, height: number, wrapX = true, wrapY = true,
): Uint8Array {
  const { neighbors, starts } = checkGrid(grid, width, height, wrapX, wrapY);
  const counts = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === EMPTY) continue;
    const end = starts[i + 1];
    for (let j = starts[i]; j < end; j++) counts[neighbors[j]]++;
  }
  return counts;
}

// Only cells neighbouring live cells can live next. Each touched cell is visited
// once; wrapped offsets count separately even on very small arenas. Off-grid
// offsets at walls are excluded from the cached geometry altogether.
// Return both populations packed into a number to avoid a per-generation object.
function evolve(
  grid: Grid, next: Grid, geometry: Topology,
  counts: Uint8Array, reds: Uint8Array, touched: Uint32Array,
): number {
  const { neighbors, starts } = geometry;
  let length = 0;
  for (let i = 0; i < grid.length; i++) {
    const color = grid[i];
    if (color === EMPTY) continue;
    const end = starts[i + 1];
    for (let j = starts[i]; j < end; j++) {
      const cell = neighbors[j];
      if (counts[cell]++ === 0) touched[length++] = cell;
      if (color === RED) reds[cell]++;
    }
  }
  next.fill(EMPTY);
  let red = 0;
  let blue = 0;
  for (let j = 0; j < length; j++) {
    const cell = touched[j];
    const count = counts[cell];
    const old = grid[cell];
    if (count === 3 || (count === 2 && old !== EMPTY)) {
      const color = old || (reds[cell] >= 2 ? RED : BLUE);
      next[cell] = color;
      if (color === RED) red++;
      else blue++;
    }
    counts[cell] = 0;
    reds[cell] = 0;
  }
  return red + blue * (grid.length + 1);
}

export function stepGrid(
  grid: Grid, width: number, height: number, wrapX = true, wrapY = true,
): Grid {
  const neighbors = checkGrid(grid, width, height, wrapX, wrapY);
  const next = new Uint8Array(grid.length);
  evolve(grid, next, neighbors, new Uint8Array(grid.length),
    new Uint8Array(grid.length), new Uint32Array(grid.length));
  return next;
}

export function population(grid: Grid): { red: number; blue: number } {
  let red = 0;
  let blue = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === RED) red++;
    else if (grid[i] === BLUE) blue++;
  }
  return { red, blue };
}

/** Live cells repaint their squares; empty cells leave earlier paint intact. */
export function paintCells(paint: Paint, grid: Grid): void {
  if (paint.length !== grid.length) throw new RangeError('Paint size does not match grid size.');
  for (let i = 0; i < grid.length; i++) if (grid[i] !== EMPTY) paint[i] = grid[i];
}

export function territory(paint: Paint): { red: number; blue: number } {
  return population(paint);
}

/** Painted garden flowers, or whole-board territory under legacy rules. */
export function scoreOf(cfg: ArenaConfig, paint: Paint): { red: number; blue: number } {
  if (!cfg.garden) return territory(paint);
  let red = 0;
  let blue = 0;
  const { x0, x1, y0, y1 } = cfg.garden;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const color = paint[y * cfg.width + x];
    if (color === RED) red++;
    else if (color === BLUE) blue++;
  }
  return { red, blue };
}

export function decideWinner(
  cfg: ArenaConfig, score: { red: number; blue: number }, cells: { red: number; blue: number },
): Winner {
  const difference = score.red - score.blue || (cfg.garden ? 0 : cells.red - cells.blue);
  return difference === 0 ? 'draw' : difference > 0 ? 'red' : 'blue';
}

function equalGrid(a: Grid, b: Grid): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function deployZone(cfg: ArenaConfig, team: Team): { x0: number; x1: number; y0: number; y1: number } {
  const error = configError(cfg);
  if (error) throw new RangeError(error);
  if (team !== RED && team !== BLUE) throw new RangeError('Unknown team.');
  const middle = Math.floor(cfg.width / 2);
  return {
    x0: team === RED ? 0 : middle + cfg.buffer,
    x1: team === RED ? middle - cfg.buffer - 1 : cfg.width - 1,
    y0: 0, y1: cfg.height - 1,
  };
}

export function validateDeployment(
  cfg: ArenaConfig, team: Team, points: Pt[],
): { ok: true } | { ok: false; reason: string } {
  const error = configError(cfg);
  if (error) return { ok: false, reason: error };
  if (team !== RED && team !== BLUE) return { ok: false, reason: 'Unknown team.' };
  if (!Array.isArray(points)) return { ok: false, reason: 'Deployment must be an array of points.' };
  if (points.length > cfg.budget) return { ok: false, reason: 'Deployment exceeds the cell budget.' };
  const zone = deployZone(cfg, team);
  const seen = new Set<number>();
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2
      || !Number.isSafeInteger(point[0]) || !Number.isSafeInteger(point[1])) {
      return { ok: false, reason: 'Coordinates must be integer pairs.' };
    }
    const [x, y] = point;
    if (x < zone.x0 || x > zone.x1 || y < zone.y0 || y > zone.y1) {
      return { ok: false, reason: 'Cell is outside the team deployment zone.' };
    }
    const key = y * cfg.width + x;
    if (seen.has(key)) return { ok: false, reason: 'Deployment contains duplicate cells.' };
    seen.add(key);
  }
  return { ok: true };
}

export function placeArmies(cfg: ArenaConfig, red: Pt[], blue: Pt[]): Grid {
  for (const [team, points] of [[RED, red], [BLUE, blue]] as const) {
    const result = validateDeployment(cfg, team, points);
    if (!result.ok) throw new RangeError(result.reason);
  }
  const grid = emptyGrid(cfg);
  for (const [x, y] of red) grid[y * cfg.width + x] = RED;
  for (const [x, y] of blue) grid[y * cfg.width + x] = BLUE;
  return grid;
}

export function simulateBattle(
  cfg: ArenaConfig, redArmy: Pt[], blueArmy: Pt[], opts?: { history?: boolean },
): BattleResult {
  let grid = placeArmies(cfg, redArmy, blueArmy);
  let next: Grid = new Uint8Array(grid.length);
  let previous: Grid = new Uint8Array(grid.length);
  let hasPrevious = false;
  const neighbors = topology(cfg.width, cfg.height, cfg.wrapX, cfg.wrapY);
  const counts = new Uint8Array(grid.length);
  const reds = new Uint8Array(grid.length);
  const touched = new Uint32Array(grid.length);
  let { red, blue } = population(grid);
  const paint: Paint = new Uint8Array(grid.length);
  paintCells(paint, grid);
  let generations = 0;
  const initialScore = scoreOf(cfg, paint);
  const history = opts?.history ? [{ red, blue, territoryRed: red, territoryBlue: blue,
    scoreRed: initialScore.red, scoreBlue: initialScore.blue }] : undefined;
  const base = grid.length + 1;
  while (generations < cfg.generations && (cfg.endOnExtinction ? red > 0 && blue > 0 : red > 0 || blue > 0)) {
    const packed = evolve(grid, next, neighbors, counts, reds, touched);
    red = packed % base;
    blue = Math.floor(packed / base);
    paintCells(paint, next);
    generations++;
    if (history) {
      const painted = territory(paint);
      const score = scoreOf(cfg, paint);
      history.push({ red, blue, territoryRed: painted.red, territoryBlue: painted.blue,
        scoreRed: score.red, scoreBlue: score.blue });
    }
    if (cfg.endOnExtinction && (red === 0 || blue === 0)) break;
    // Compare full coloured grids: equal populations alone do not imply a cycle.
    if (equalGrid(next, grid) || (hasPrevious && equalGrid(next, previous))) break;
    const spare = previous;
    previous = grid;
    grid = next;
    next = spare;
    hasPrevious = true;
  }
  const painted = territory(paint);
  const score = scoreOf(cfg, paint);
  const result: BattleResult = {
    red, blue, generations, territory: painted, score,
    winner: decideWinner(cfg, score, { red, blue }),
  };
  if (history) result.history = history;
  return result;
}
