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
}

export const DEFAULT_ARENA: ArenaConfig = {
  width: 32, height: 24, budget: 20, generations: 150, buffer: 2,
};
export type Grid = Uint8Array;
export type Winner = 'red' | 'blue' | 'draw';
export interface BattleResult {
  red: number;
  blue: number;
  generations: number;
  winner: Winner;
  history?: { red: number; blue: number }[];
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
  return undefined;
}

export function emptyGrid(cfg: ArenaConfig): Grid {
  const error = configError(cfg);
  if (error) throw new RangeError(error);
  return new Uint8Array(cfg.width * cfg.height);
}

// Cache geometry only; grids and scratch space are always local to each caller.
const topologies = new Map<string, Uint32Array>();
function topology(width: number, height: number): Uint32Array {
  dimensions(width, height);
  const key = `${width}:${height}`;
  const cached = topologies.get(key);
  if (cached) return cached;
  const neighbors = new Uint32Array(width * height * 8);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let dy = -1; dy <= 1; dy++) {
        const row = ((y + dy + height) % height) * width;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx || dy) neighbors[offset++] = row + (x + dx + width) % width;
        }
      }
    }
  }
  if (topologies.size >= 8) topologies.delete(topologies.keys().next().value!);
  topologies.set(key, neighbors);
  return neighbors;
}

function checkGrid(grid: Grid, width: number, height: number): Uint32Array {
  dimensions(width, height);
  if (grid.length !== width * height) throw new RangeError('Grid size does not match arena dimensions.');
  return topology(width, height);
}

export function neighborCountsGrid(grid: Grid, width: number, height: number): Uint8Array {
  const neighbors = checkGrid(grid, width, height);
  const counts = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === EMPTY) continue;
    const end = i * 8 + 8;
    for (let j = i * 8; j < end; j++) counts[neighbors[j]]++;
  }
  return counts;
}

// Only cells neighbouring live cells can live next. Each touched cell is visited
// once; the eight toroidal offsets count separately even on very small arenas.
// Return both populations packed into a number to avoid a per-generation object.
function evolve(
  grid: Grid, next: Grid, neighbors: Uint32Array,
  counts: Uint8Array, reds: Uint8Array, touched: Uint32Array,
): number {
  let length = 0;
  for (let i = 0; i < grid.length; i++) {
    const color = grid[i];
    if (color === EMPTY) continue;
    const end = i * 8 + 8;
    for (let j = i * 8; j < end; j++) {
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

export function stepGrid(grid: Grid, width: number, height: number): Grid {
  const neighbors = checkGrid(grid, width, height);
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
  const neighbors = topology(cfg.width, cfg.height);
  const counts = new Uint8Array(grid.length);
  const reds = new Uint8Array(grid.length);
  const touched = new Uint32Array(grid.length);
  let { red, blue } = population(grid);
  let generations = 0;
  const history = opts?.history ? [{ red, blue }] : undefined;
  const base = grid.length + 1;
  while (generations < cfg.generations && red > 0 && blue > 0) {
    const packed = evolve(grid, next, neighbors, counts, reds, touched);
    red = packed % base;
    blue = Math.floor(packed / base);
    const swap = grid;
    grid = next;
    next = swap;
    generations++;
    history?.push({ red, blue });
  }
  const result: BattleResult = {
    red, blue, generations, winner: red === blue ? 'draw' : red > blue ? 'red' : 'blue',
  };
  if (history) result.history = history;
  return result;
}
