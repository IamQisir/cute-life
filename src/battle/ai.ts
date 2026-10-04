import { BLUE, RED, deployZone, simulateBattle, validateDeployment } from './arena';
import type { ArenaConfig, Pt, Team } from './arena';

export type Stars = 1 | 2 | 3 | 4 | 5;

/** UI-visible work limits. A hill-climbing pass tests twelve single-cell moves. */
export const AI_EFFORT = {
  1: { candidates: 1, opponents: 0, hillClimbPasses: 0 },
  2: { candidates: 6, opponents: 2, hillClimbPasses: 0 },
  3: { candidates: 20, opponents: 3, hillClimbPasses: 0 },
  4: { candidates: 50, opponents: 4, hillClimbPasses: 0 },
  5: { candidates: 100, opponents: 4, hillClimbPasses: 3 },
} as const;

type Random = () => number;
function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const integer = (random: Random, size: number): number => Math.floor(random() * size);
const GLIDER: Pt[] = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
const BLINKER: Pt[] = [[0, 0], [1, 0], [2, 0]];
const BLOCK: Pt[] = [[0, 0], [1, 0], [0, 1], [1, 1]];
const R_PENTOMINO: Pt[] = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]];
const DIRECTIONS: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function candidate(cfg: ArenaConfig, team: Team, random: Random, clumpsOnly = false): Pt[] {
  const zone = deployZone(cfg, team);
  const width = zone.x1 - zone.x0 + 1;
  const points: Pt[] = [];
  const occupied = new Set<number>();
  const center: Pt = [zone.x0 + integer(random, width), integer(random, cfg.height)];
  const compact = clumpsOnly || random() < 0.55;
  const radius = 3 + integer(random, 5);
  const growthBias = random() < 0.3;

  function add(x: number, y: number): boolean {
    if (x < zone.x0 || x > zone.x1 || y < 0 || y >= cfg.height) return false;
    const key = y * cfg.width + x;
    if (occupied.has(key) || points.length >= cfg.budget) return false;
    occupied.add(key);
    points.push([x, y]);
    return true;
  }

  for (let attempt = 0; attempt < 100 && points.length < cfg.budget; attempt++) {
    let pattern: Pt[];
    const choice = random();
    if (clumpsOnly || choice < 0.15) {
      // A connected, irregular clump rather than independent uniform noise.
      pattern = [[1, 1]];
      const keys = new Set([5]);
      const size = 3 + integer(random, 6);
      for (let tries = 0; tries < 50 && pattern.length < size; tries++) {
        const [px, py] = pattern[integer(random, pattern.length)];
        const [dx, dy] = DIRECTIONS[integer(random, 4)];
        const x = px + dx;
        const y = py + dy;
        const key = y * 4 + x;
        if (x >= 0 && x < 4 && y >= 0 && y < 4 && !keys.has(key)) {
          keys.add(key);
          pattern.push([x, y]);
        }
      }
    } else if (choice < (growthBias ? 0.75 : 0.42)) {
      pattern = R_PENTOMINO;
    } else if (choice < 0.72) {
      pattern = GLIDER;
    } else if (choice < 0.87) {
      pattern = BLOCK;
    } else {
      pattern = BLINKER;
    }
    if (pattern.length > cfg.budget - points.length) continue;
    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of pattern) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const transpose = pattern === BLINKER && random() < 0.5;
    if (transpose) [maxX, maxY] = [maxY, maxX];
    if (maxX >= width || maxY >= cfg.height) continue;
    const x = compact
      ? Math.max(zone.x0, Math.min(zone.x1 - maxX, center[0] + integer(random, radius * 2 + 1) - radius))
      : zone.x0 + integer(random, width - maxX);
    const y = compact
      ? Math.max(0, Math.min(cfg.height - maxY - 1, center[1] + integer(random, radius * 2 + 1) - radius))
      : integer(random, cfg.height - maxY);
    // With a horizontal seam, the outer edge can be the shortest enemy route.
    // At walls, aim across the centre toward the enemy deployment zone.
    const towardRight = cfg.wrapX ? x > (zone.x0 + zone.x1) / 2 : team === RED;
    const flipX = pattern === GLIDER ? (random() < 0.8 ? !towardRight : towardRight) : random() < 0.5;
    const flipY = random() < 0.5;
    const placed = pattern.map(([px, py]): Pt => {
      if (transpose) [px, py] = [py, px];
      return [x + (flipX ? maxX - px : px), y + (flipY ? maxY - py : py)];
    });
    if (placed.some(([px, py]) => occupied.has(py * cfg.width + px))) continue;
    for (const [px, py] of placed) add(px, py);
  }

  // Leftovers grow beside existing cells, respecting the configured vertical edge.
  for (let tries = 0; tries < cfg.budget * 32 + 32 && points.length < cfg.budget; tries++) {
    if (!points.length) {
      add(center[0], center[1]);
    } else {
      const [x, y] = points[integer(random, points.length)];
      const [dx, dy] = DIRECTIONS[integer(random, 4)];
      add(x + dx, cfg.wrapY ? (y + dy + cfg.height) % cfg.height : y + dy);
    }
  }
  // Guaranteed termination for narrow zones and near-capacity deployments.
  const capacity = width * cfg.height;
  const start = integer(random, capacity);
  for (let i = 0; i < capacity && points.length < cfg.budget; i++) {
    const cell = (start + i) % capacity;
    add(zone.x0 + cell % width, Math.floor(cell / width));
  }
  return points;
}

/** Seeded search; all candidates at a given effort face the same opponent sample. */
export function chooseDeployment(
  cfg: ArenaConfig, team: Team, stars: Stars, seed: number = Date.now(),
): Pt[] {
  const valid = validateDeployment(cfg, team, []);
  if (!valid.ok) throw new RangeError(valid.reason);
  const zone = deployZone(cfg, team);
  if (cfg.budget > Math.max(0, zone.x1 - zone.x0 + 1) * cfg.height) {
    throw new RangeError('The cell budget exceeds the team deployment zone capacity.');
  }
  if (!AI_EFFORT[stars]) throw new RangeError('AI stars must be between 1 and 5.');
  if (!Number.isFinite(seed)) throw new RangeError('AI seed must be finite.');
  if (!cfg.budget) return [];
  const effort = AI_EFFORT[stars];
  const random = mulberry32(seed);
  let best = candidate(cfg, team, random);
  if (stars === 1) return best;
  const enemy = team === RED ? BLUE : RED;
  const sampleRandom = mulberry32(0x51f15e ^ cfg.width ^ (cfg.height << 8) ^ (cfg.budget << 16) ^ enemy);
  const opponents = Array.from({ length: effort.opponents }, (_, i) =>
    candidate(cfg, enemy, sampleRandom, i >= 2));
  const score = (points: Pt[]): number => {
    let total = 0;
    for (const opponent of opponents) {
      const result = team === RED
        ? simulateBattle(cfg, points, opponent)
        : simulateBattle(cfg, opponent, points);
      total += team === RED
        ? result.territory.red - result.territory.blue
        : result.territory.blue - result.territory.red;
    }
    return total / opponents.length;
  };
  let bestScore = score(best);
  for (let i = 1; i < effort.candidates; i++) {
    const points = candidate(cfg, team, random);
    const value = score(points);
    if (value > bestScore) {
      best = points;
      bestScore = value;
    }
  }
  for (let pass = 0; pass < effort.hillClimbPasses; pass++) {
    for (let trial = 0; trial < 12; trial++) {
      const move = integer(random, best.length);
      const points = best.slice();
      if (random() < 0.75) {
        const [dx, dy] = DIRECTIONS[integer(random, 4)];
        const y = best[move][1] + dy;
        points[move] = [best[move][0] + dx, cfg.wrapY ? (y + cfg.height) % cfg.height : y];
      } else {
        points[move] = [zone.x0 + integer(random, zone.x1 - zone.x0 + 1), integer(random, cfg.height)];
      }
      if (!validateDeployment(cfg, team, points).ok) continue;
      const value = score(points);
      if (value > bestScore) {
        best = points;
        bestScore = value;
      }
    }
  }
  return best;
}
