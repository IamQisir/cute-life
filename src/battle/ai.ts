import { BLUE, RED, deployZone, deployZoneRects, inDeployZone, simulateBattle, validateDeployment } from './arena';
import type { ArenaConfig, DeployRect, Pt, Team } from './arena';
import { classify } from '../life/clusters';
import { BATTLE_PATTERN_NAMES, PATTERNS } from '../life/patterns';
import { orientPoints } from '../life/orientation';

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
const DIRECTIONS: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Uniformly sample a cell from disjoint deployment rectangles. */
function randomCell(rects: DeployRect[], random: Random): Pt {
  let cell = integer(random, rects.reduce((sum, r) => sum + (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1), 0));
  for (const r of rects) {
    const width = r.x1 - r.x0 + 1;
    const area = width * (r.y1 - r.y0 + 1);
    if (cell < area) return [r.x0 + cell % width, r.y0 + Math.floor(cell / width)];
    cell -= area;
  }
  throw new RangeError('The team deployment zone is empty.');
}

/** One orientation of a palette structure, normalised to start at (0, 0). */
interface Shape {
  points: Pt[];
  maxX: number;
  maxY: number;
  /** Direction of travel for spaceships (-1, 0, 1 per axis); zero otherwise. */
  headingX: number;
  headingY: number;
}

type Role = 'traveller' | 'grower' | 'stationary';
const ROLE: Record<string, Role> = {
  glider: 'traveller', lwss: 'traveller', acorn: 'grower', 'r-pentomino': 'grower',
  block: 'stationary', blinker: 'stationary', toad: 'stationary',
};
/** Share of picks per role: mostly armies that travel toward the objective. */
const ROLE_WEIGHTS: [Role, number][] = [['traveller', 0.5], ['grower', 0.25], ['stationary', 0.25]];
const AIM_AT_TARGET = 0.8;

/** All distinct rotations/mirrors of a pattern, with each one's direction of travel. */
function orientations(rows: string[]): Shape[] {
  const base: Pt[] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c === 'O' && base.push([x, y])));
  const seen = new Set<string>();
  const out: Shape[] = [];
  for (let mirror = 0; mirror < 2; mirror++) {
    for (let rot = 0; rot < 4; rot++) {
      let pts = orientPoints(base, { rot: rot as 0 | 1 | 2 | 3, flip: Boolean(mirror) });
      const minX = Math.min(...pts.map(([x]) => x));
      const minY = Math.min(...pts.map(([, y]) => y));
      pts = pts.map(([x, y]): Pt => [x - minX, y - minY]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const key = pts.join(';');
      if (seen.has(key)) continue;
      seen.add(key);
      const heading = classify(pts).heading;
      out.push({
        points: pts,
        maxX: Math.max(...pts.map(([x]) => x)),
        maxY: Math.max(...pts.map(([, y]) => y)),
        headingX: heading[0],
        headingY: heading[1],
      });
    }
  }
  return out;
}

/** The player's palette, so the AI builds armies from the same structures. */
const PALETTE: { role: Role; shapes: Shape[] }[] = BATTLE_PATTERN_NAMES.map((name) => {
  const p = PATTERNS.find((q) => q.name === name)!;
  return { role: ROLE[name] ?? 'stationary', shapes: orientations(p.rows) };
});

interface Pick { shape: Shape; shapes: Shape[]; aimed: boolean }
function pickShape(random: Random, towardRight: boolean, room: number): Pick | null {
  let r = random();
  let role: Role = 'stationary';
  for (const [name, weight] of ROLE_WEIGHTS) {
    if (r < weight) {
      role = name;
      break;
    }
    r -= weight;
  }
  const options = PALETTE.filter((e) => e.role === role && e.shapes[0].points.length <= room);
  if (!options.length) return null;
  const { shapes } = options[integer(random, options.length)];
  const aimed = role === 'traveller' && random() < AIM_AT_TARGET;
  if (aimed) {
    const horizontal = shapes.filter((s) => (towardRight ? s.headingX > 0 : s.headingX < 0));
    if (horizontal.length) return { shape: horizontal[integer(random, horizontal.length)], shapes, aimed };
  }
  return { shape: shapes[integer(random, shapes.length)], shapes, aimed };
}

/** A connected, irregular clump: only used for the AI's sample opponents. */
function clump(random: Random): Shape {
  const points: Pt[] = [[1, 1]];
  const keys = new Set([5]);
  const size = 3 + integer(random, 6);
  for (let tries = 0; tries < 50 && points.length < size; tries++) {
    const [px, py] = points[integer(random, points.length)];
    const [dx, dy] = DIRECTIONS[integer(random, 4)];
    const x = px + dx;
    const y = py + dy;
    const key = y * 4 + x;
    if (x >= 0 && x < 4 && y >= 0 && y < 4 && !keys.has(key)) {
      keys.add(key);
      points.push([x, y]);
    }
  }
  return { points, maxX: Math.max(...points.map(([x]) => x)), maxY: Math.max(...points.map(([, y]) => y)), headingX: 0, headingY: 0 };
}

function shortestDelta(delta: number, span: number, wrap: boolean): number {
  if (!wrap) return delta;
  if (delta > span / 2) return delta - span;
  if (delta < -span / 2) return delta + span;
  return delta;
}

/** Re-aim after placement, keeping the bounding box (and therefore placement) valid. */
function aimAtGarden(cfg: ArenaConfig, pick: Pick, x: number, y: number, random: Random): Shape {
  const garden = cfg.garden;
  if (!garden || !pick.aimed) return pick.shape;
  const { maxX, maxY } = pick.shape;
  const horizontalSign = Math.sign(shortestDelta((garden.x0 + garden.x1) / 2 - (x + maxX / 2), cfg.width, cfg.wrapX));
  let verticalSign = 0;
  if (y + maxY < garden.y0 || y > garden.y1) {
    const cy = y + maxY / 2;
    const toTop = shortestDelta(garden.y0 - cy, cfg.height, cfg.wrapY);
    const toBottom = shortestDelta(garden.y1 - cy, cfg.height, cfg.wrapY);
    verticalSign = Math.sign(Math.abs(toTop) <= Math.abs(toBottom) ? toTop : toBottom);
  }
  const horizontal = pick.shapes.filter((shape) => shape.maxX === maxX && shape.maxY === maxY
    && shape.headingX === horizontalSign);
  const both = horizontal.filter((shape) => !verticalSign || shape.headingY === verticalSign);
  const options = both.length ? both : horizontal;
  return options.length ? options[integer(random, options.length)] : pick.shape;
}

function candidate(cfg: ArenaConfig, team: Team, random: Random, clumpsOnly = false): Pt[] {
  const zone = deployZone(cfg, team);
  const width = zone.x1 - zone.x0 + 1;
  const points: Pt[] = [];
  const occupied = new Set<number>();
  const center: Pt = cfg.garden ? randomCell(deployZoneRects(cfg, team), random)
    : [zone.x0 + integer(random, width), integer(random, cfg.height)];
  const compact = clumpsOnly || random() < 0.55;
  const radius = 3 + integer(random, 5);

  function add(x: number, y: number): boolean {
    if (!inDeployZone(cfg, team, x, y)) return false;
    const key = y * cfg.width + x;
    if (occupied.has(key) || points.length >= cfg.budget) return false;
    occupied.add(key);
    points.push([x, y]);
    return true;
  }

  for (let attempt = 0; attempt < 100 && points.length < cfg.budget; attempt++) {
    const room = cfg.budget - points.length;
    const x0 = compact ? center[0] : zone.x0 + integer(random, width);
    // With a horizontal seam, the outer edge can be the shortest enemy route.
    // At walls, aim across the centre toward the enemy deployment zone.
    const towardRight = cfg.wrapX ? x0 > (zone.x0 + zone.x1) / 2 : team === RED;
    const pick = clumpsOnly ? { shape: clump(random), shapes: [], aimed: false }
      : pickShape(random, towardRight, room);
    if (!pick || pick.shape.points.length > room) continue;
    let shape = pick.shape;
    const { maxX, maxY } = shape;
    if (maxX >= width || maxY >= cfg.height) continue;
    const x = compact
      ? Math.max(zone.x0, Math.min(zone.x1 - maxX, center[0] + integer(random, radius * 2 + 1) - radius))
      : zone.x0 + integer(random, width - maxX);
    const y = compact
      ? Math.max(0, Math.min(cfg.height - maxY - 1, center[1] + integer(random, radius * 2 + 1) - radius))
      : integer(random, cfg.height - maxY);
    shape = aimAtGarden(cfg, pick, x, y, random);
    const placed = shape.points.map(([px, py]): Pt => [x + px, y + py]);
    if (placed.some(([px, py]) => !inDeployZone(cfg, team, px, py)
      || occupied.has(py * cfg.width + px))) continue;
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
  const capacity = deployZoneRects(cfg, team).reduce((sum, r) =>
    sum + (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1), 0);
  if (cfg.budget > capacity) {
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
        ? result.score.red - result.score.blue
        : result.score.blue - result.score.red;
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
        points[move] = cfg.garden ? randomCell(deployZoneRects(cfg, team), random)
          : [zone.x0 + integer(random, zone.x1 - zone.x0 + 1), integer(random, cfg.height)];
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
