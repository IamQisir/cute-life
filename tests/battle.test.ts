import { describe, expect, it, vi } from 'vitest';
import {
  ARENA_PRESETS, ARENA_SIZES, BLUE, DEFAULT_ARENA, EMPTY, RED, deployZone, emptyGrid, neighborCountsGrid,
  paintCells, placeArmies, population, simulateBattle, stepGrid, territory, validateDeployment,
} from '../src/battle/arena';
import type { ArenaConfig, Grid, Pt, Team } from '../src/battle/arena';
import { AI_EFFORT, chooseDeployment } from '../src/battle/ai';
import type { Stars } from '../src/battle/ai';
import {
  fromChallengeHash, fromReplayHash, toChallengeHash, toReplayHash,
} from '../src/battle/challenge';
import { encodeRle } from '../src/share/rle';

const cfg = DEFAULT_ARENA;
const sorted = (points: Pt[]): Pt[] => points.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
function colored(width: number, height: number, red: Pt[], blue: Pt[] = []): Grid {
  const grid = emptyGrid({ ...cfg, width, height });
  for (const [x, y] of red) grid[y * width + x] = RED;
  for (const [x, y] of blue) grid[y * width + x] = BLUE;
  return grid;
}
function cells(grid: Grid, width: number, team: Team): Pt[] {
  const points: Pt[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === team) points.push([i % width, Math.floor(i / width)]);
  return points;
}

describe('immigration Life with configurable arena edges', () => {
  it('exports defaults and allocates independent, empty grids', () => {
    expect(cfg).toEqual({
      width: 28, height: 20, budget: 20, generations: 150, buffer: 1, wrapX: false, wrapY: true,
    });
    const a = emptyGrid(cfg);
    const b = emptyGrid(cfg);
    a[0] = RED;
    expect(b.length).toBe(560);
    expect(population(b)).toEqual({ red: 0, blue: 0 });
    expect(b[0]).toBe(EMPTY);
  });

  it('oscillates a red blinker without mutating its input', () => {
    const points: Pt[] = [[3, 4], [4, 4], [5, 4]];
    const grid = colored(9, 9, points);
    const next = stepGrid(grid, 9, 9, true, true);
    expect(next).not.toBe(grid);
    expect(cells(next, 9, RED)).toEqual([[4, 3], [4, 4], [4, 5]]);
    expect(cells(grid, 9, RED)).toEqual(points);
    expect(stepGrid(next, 9, 9, true, true)).toEqual(grid);
  });

  it('oscillates a blinker spanning the horizontal wrap edge', () => {
    const grid = colored(8, 8, [[7, 4], [0, 4], [1, 4]]);
    const next = stepGrid(grid, 8, 8, true, true);
    expect(cells(next, 8, RED)).toEqual([[0, 3], [0, 4], [0, 5]]);
    expect(stepGrid(next, 8, 8, true, true)).toEqual(grid);
  });

  it.each([RED, BLUE] as const)('births use the majority of the three parents (team %i)', (team) => {
    const majority: Pt[] = [[2, 1], [3, 2]];
    const minority: Pt[] = [[2, 3]];
    const grid = team === RED ? colored(6, 6, majority, minority) : colored(6, 6, minority, majority);
    expect(stepGrid(grid, 6, 6, true, true)[2 * 6 + 2]).toBe(team);
  });

  it('survivors retain their colour with two or three opposing neighbours', () => {
    for (const neighbors of [[[2, 1], [3, 2]], [[2, 1], [3, 2], [2, 3]]] as Pt[][]) {
      const grid = colored(6, 6, neighbors, [[2, 2]]);
      expect(stepGrid(grid, 6, 6, true, true)[2 * 6 + 2]).toBe(BLUE);
    }
  });

  it('a red glider crossing the right edge reappears on the left', () => {
    const points: Pt[] = [[7, 1], [0, 2], [6, 3], [7, 3], [0, 3]];
    let grid = colored(8, 8, points);
    for (let i = 0; i < 4; i++) grid = stepGrid(grid, 8, 8, true, true);
    expect(cells(grid, 8, RED)).toEqual(sorted(points.map(([x, y]) => [(x + 1) % 8, (y + 1) % 8])));
    expect(cells(grid, 8, RED).some(([x]) => x === 0)).toBe(true);
  });

  it('counts live neighbours across both axes and corners, without changing the grid', () => {
    const grid = colored(5, 4, [[0, 0]], [[4, 3]]);
    const copy = grid.slice();
    const counts = neighborCountsGrid(grid, 5, 4, true, true);
    expect(counts[0]).toBe(1);
    expect(counts[3 * 5 + 4]).toBe(1);
    expect(counts[3 * 5]).toBe(2);
    expect(counts[4]).toBe(2);
    expect(counts[2 * 5 + 2]).toBe(0);
    expect(grid).toEqual(copy);
  });

  it.each(['left', 'right'])('a glider hitting the %s wall never reappears at the opposite edge', (side) => {
    const points: Pt[] = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]
      .map(([x, y]) => [side === 'right' ? 9 + x : 2 - x, y + 3]);
    let wall = colored(12, 12, points);
    let wrapped: Grid = wall.slice();
    for (let i = 0; i < 16; i++) {
      wall = stepGrid(wall, 12, 12, false, true);
      expect(cells(wall, 12, RED).every(([x]) => side === 'right' ? x >= 7 : x <= 4)).toBe(true);
      if (i < 4) wrapped = stepGrid(wrapped, 12, 12, true, true);
    }
    expect(cells(wrapped, 12, RED).some(([x]) => x === (side === 'right' ? 0 : 11))).toBe(true);
  });

  it.each(['top', 'bottom'])('a glider still crosses the %s seam with horizontal walls', (side) => {
    const points: Pt[] = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]
      .map(([x, y]) => [x + 3, side === 'bottom' ? y + 9 : 2 - y]);
    let grid = colored(12, 12, points);
    for (let i = 0; i < 4; i++) grid = stepGrid(grid, 12, 12, false, true);
    const dy = side === 'bottom' ? 1 : -1;
    expect(cells(grid, 12, RED)).toEqual(sorted(points.map(([x, y]) => [x + 1, (y + dy + 12) % 12])));
  });

  it('counts off-grid wall neighbours as empty independently for each axis', () => {
    const grid = colored(5, 4, [[0, 0]]);
    const wrapped = neighborCountsGrid(grid, 5, 4, true, true);
    const xWall = neighborCountsGrid(grid, 5, 4, false, true);
    const yWall = neighborCountsGrid(grid, 5, 4, true, false);
    const walls = neighborCountsGrid(grid, 5, 4, false, false);
    expect(wrapped[4]).toBe(1);
    expect(xWall[4]).toBe(0);
    expect(xWall[15]).toBe(1);
    expect(yWall[4]).toBe(1);
    expect(yWall[15]).toBe(0);
    expect(walls[19]).toBe(0);
    expect(wrapped[19]).toBe(1);
    expect(neighborCountsGrid(grid, 5, 4)).toEqual(wrapped);
    expect(stepGrid(grid, 5, 4)).toEqual(stepGrid(grid, 5, 4, true, true));
  });

  it('matches a direct reference including narrow and odd sizes with every wrap combination', () => {
    for (const wrapX of [false, true]) for (const wrapY of [false, true])
    for (const [width, height] of [[1, 1], [1, 4], [2, 2], [3, 5], [8, 7], [28, 20]]) {
      let grid: Grid = new Uint8Array(width * height);
      for (let i = 0; i < grid.length; i++) grid[i] = (i * 17 + (i >>> 2)) % 3;
      for (let generation = 0; generation < 6; generation++) {
        const expected = new Uint8Array(grid.length);
        const counts = neighborCountsGrid(grid, width, height, wrapX, wrapY);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          let live = 0;
          let reds = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if ((!wrapX && (nx < 0 || nx >= width)) || (!wrapY && (ny < 0 || ny >= height))) continue;
            const color = grid[((ny + height) % height) * width + (nx + width) % width];
            if (color) live++;
            if (color === RED) reds++;
          }
          const index = y * width + x;
          expect(counts[index]).toBe(live);
          if (live === 3 || (live === 2 && grid[index])) expected[index] = grid[index] || (reds >= 2 ? RED : BLUE);
        }
        grid = stepGrid(grid, width, height, wrapX, wrapY);
        expect(grid).toEqual(expected);
      }
    }
  });

  it('rejects inconsistent grid dimensions', () => {
    expect(() => stepGrid(new Uint8Array(4), 3, 3)).toThrow(RangeError);
    expect(() => neighborCountsGrid(new Uint8Array(4), 0, 4)).toThrow(RangeError);
  });

  it('accumulates paint, preserves empty squares and lets enemies repaint in place', () => {
    const paint = new Uint8Array(20);
    const first = colored(5, 4, [[0, 0], [1, 0]], [[4, 3]]);
    const copy = first.slice();
    expect(paintCells(paint, first)).toBeUndefined();
    expect(territory(paint)).toEqual({ red: 2, blue: 1 });
    paintCells(paint, colored(5, 4, [[2, 1]], [[0, 0]]));
    expect(territory(paint)).toEqual({ red: 2, blue: 2 });
    expect(paint[1]).toBe(RED);
    expect(paint[0]).toBe(BLUE);
    expect(paint[19]).toBe(BLUE);
    expect(first).toEqual(copy);
    expect(() => paintCells(new Uint8Array(1), first)).toThrow(RangeError);
  });
});

describe('deployment and battles', () => {
  const red: Pt[] = [[3, 10], [4, 10], [5, 10]];
  const blue: Pt[] = [[23, 10], [24, 10], [25, 10]];
  it('returns inclusive deployment zones, flooring the split for odd widths', () => {
    expect(deployZone(cfg, RED)).toEqual({ x0: 0, x1: 12, y0: 0, y1: 19 });
    expect(deployZone(cfg, BLUE)).toEqual({ x0: 15, x1: 27, y0: 0, y1: 19 });
    expect(deployZone({ ...cfg, width: 9, buffer: 1 }, RED).x1).toBe(2);
    expect(deployZone({ ...cfg, width: 9, buffer: 1 }, BLUE).x0).toBe(5);
  });

  it.each([
    [RED, [[13, 0]]], [RED, [[15, 0]]], [BLUE, [[14, 0]]],
    [BLUE, [[28, 0]]], [RED, [[-1, 0]]], [RED, [[0, 20]]],
    [RED, [[0, -1]]], [RED, [[1, 1], [1, 1]]], [RED, [[1.5, 1]]],
    [BLUE, [[18, 0.5]]], [RED, [[NaN, 0]]], [RED, [[Infinity, 0]]],
  ] as [Team, Pt[]][])('rejects invalid deployment %#', (team, points) => {
    expect(validateDeployment(cfg, team, points)).toMatchObject({ ok: false, reason: expect.any(String) });
  });

  it('rejects over-budget armies, permits empty and boundary deployments, and places colours', () => {
    const tooMany: Pt[] = Array.from({ length: 21 }, (_, i) => [i % 13, Math.floor(i / 13)]);
    expect(validateDeployment(cfg, RED, tooMany).ok).toBe(false);
    expect(validateDeployment(cfg, RED, [[0, 0], [12, 19]])).toEqual({ ok: true });
    expect(validateDeployment(cfg, BLUE, [[15, 0], [27, 19]])).toEqual({ ok: true });
    expect(validateDeployment(cfg, RED, [])).toEqual({ ok: true });
    const grid = placeArmies(cfg, red, blue);
    expect(population(grid)).toEqual({ red: 3, blue: 3 });
    expect(grid[10 * cfg.width + 3]).toBe(RED);
    expect(grid[10 * cfg.width + 23]).toBe(BLUE);
    expect(() => placeArmies(cfg, [[18, 0]], [])).toThrow(RangeError);
  });

  it('stops on a still life after elimination, or when both sides become empty', () => {
    const block: Pt[] = [[20, 1], [21, 1], [20, 2], [21, 2]];
    expect(simulateBattle(cfg, [[1, 1]], block, { history: true })).toEqual({
      red: 0, blue: 4, winner: 'blue', generations: 2, territory: { red: 1, blue: 4 },
      history: [
        { red: 1, blue: 4, territoryRed: 1, territoryBlue: 4 },
        { red: 0, blue: 4, territoryRed: 1, territoryBlue: 4 },
        { red: 0, blue: 4, territoryRed: 1, territoryBlue: 4 },
      ],
    });
    expect(simulateBattle(cfg, [], block)).toEqual({
      red: 0, blue: 4, winner: 'blue', generations: 1, territory: { red: 0, blue: 4 },
    });
    expect(simulateBattle(cfg, [[1, 1]], [[20, 1]])).toEqual({
      red: 0, blue: 0, winner: 'draw', generations: 1, territory: { red: 1, blue: 1 },
    });
  });

  it('stops a blinker after two generations and records population and accumulated territory', () => {
    const result = simulateBattle({ ...cfg, generations: 12 }, red, blue, { history: true });
    expect(result).toMatchObject({ red: 3, blue: 3, winner: 'draw', generations: 2, territory: { red: 5, blue: 5 } });
    expect(result.history).toEqual([
      { red: 3, blue: 3, territoryRed: 3, territoryBlue: 3 },
      { red: 3, blue: 3, territoryRed: 5, territoryBlue: 5 },
      { red: 3, blue: 3, territoryRed: 5, territoryBlue: 5 },
    ]);
    expect(simulateBattle(cfg, red, blue)).not.toHaveProperty('history');
    expect(simulateBattle({ ...cfg, generations: 0 }, red, blue).generations).toBe(0);
    expect(simulateBattle(cfg, [], [], { history: true }).history).toEqual([
      { red: 0, blue: 0, territoryRed: 0, territoryBlue: 0 },
    ]);
  });

  it('continues painting with one team eliminated, even when populations stay constant', () => {
    const glider: Pt[] = [[19, 1], [18, 2], [20, 3], [19, 3], [18, 3]];
    const result = simulateBattle({ ...cfg, generations: 12 }, [[1, 1]], glider, { history: true });
    expect(result.generations).toBe(12);
    expect(result.red).toBe(0);
    expect(result.blue).toBe(5);
    expect(result.territory.red).toBe(1);
    expect(result.territory.blue).toBeGreaterThan(5);
    expect(result.history).toHaveLength(13);
    expect(result.history?.slice(1).every((entry) => entry.red === 0)).toBe(true);
    expect(result.history![12].territoryBlue).toBeGreaterThan(result.history![1].territoryBlue);
    expect(simulateBattle({ ...cfg, generations: 12 }, [], glider).generations).toBe(12);
  });

  it('decides by territory before cell counts, breaking territory ties by cells then drawing', () => {
    const redBlock: Pt[] = [[3, 1], [4, 1], [3, 2], [4, 2]];
    const blueBlock: Pt[] = [[20, 1], [21, 1], [20, 2], [21, 2]];
    expect(simulateBattle(cfg, red, blueBlock)).toMatchObject({
      red: 3, blue: 4, territory: { red: 5, blue: 4 }, winner: 'red',
    });
    expect(simulateBattle(cfg, redBlock, blue)).toMatchObject({
      red: 4, blue: 3, territory: { red: 4, blue: 5 }, winner: 'blue',
    });
    expect(simulateBattle(cfg, red, [...blueBlock, [25, 15]])).toMatchObject({
      red: 3, blue: 4, territory: { red: 5, blue: 5 }, winner: 'blue',
    });
    expect(simulateBattle(cfg, [...redBlock, [1, 15]], blue)).toMatchObject({
      red: 4, blue: 3, territory: { red: 5, blue: 5 }, winner: 'red',
    });
    expect(simulateBattle(cfg, red, blue).winner).toBe('draw');
    expect(simulateBattle(cfg, [[1, 1], [5, 5]], [[20, 1]])).toMatchObject({
      red: 0, blue: 0, territory: { red: 2, blue: 1 }, winner: 'red', generations: 1,
    });
  });
});

describe('seeded AI', () => {
  it('exports the effort levels and returns exactly the budget at every level, for both teams and several seeds', () => {
    expect(Object.values(AI_EFFORT).map((effort) => effort.candidates)).toEqual([1, 6, 20, 50, 100]);
    for (const stars of [1, 2, 3, 4, 5] as Stars[]) for (const team of [RED, BLUE] as const) {
      for (const seed of [1, 42, 991]) {
        const points = chooseDeployment(cfg, team, stars, seed);
        expect(points).toHaveLength(cfg.budget);
        expect(validateDeployment(cfg, team, points)).toEqual({ ok: true });
        expect(new Set(points.map(([x, y]) => `${x},${y}`)).size).toBe(cfg.budget);
      }
    }
  }, 30_000);

  it('is deterministic for a seed and never uses Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unseeded randomness'); });
    try {
      for (const stars of [1, 2, 3, 4, 5] as Stars[]) {
        expect(chooseDeployment(cfg, RED, stars, 123)).toEqual(chooseDeployment(cfg, RED, stars, 123));
      }
    } finally {
      random.mockRestore();
    }
  }, 30_000);

  it('supports zero, leftover, narrow, odd-sized, and fully occupied deployment budgets', () => {
    for (const config of [
      { ...cfg, budget: 0 }, { ...cfg, budget: 1 }, { ...cfg, budget: 2 },
      { ...cfg, width: 7, height: 3, buffer: 1, budget: 6, generations: 10 },
      { ...cfg, width: 4, height: 2, buffer: 1, budget: 2, generations: 10 },
    ]) for (const team of [RED, BLUE] as const) for (const stars of [1, 3, 5] as Stars[]) {
      const points = chooseDeployment(config, team, stars, 7);
      expect(points).toHaveLength(config.budget);
      expect(validateDeployment(config, team, points).ok).toBe(true);
    }
    expect(() => chooseDeployment({ ...cfg, budget: 261 }, RED, 1, 1)).toThrow(RangeError);
  });

  it('measures each effort level and keeps three-star search below a second', () => {
    // Warm the simulator before measuring; report median-of-three elapsed times.
    chooseDeployment(cfg, RED, 2, 1234);
    const times: Record<number, number> = {};
    for (const stars of [1, 2, 3, 4, 5] as Stars[]) {
      const measurements: number[] = [];
      for (const seed of [1001, 1002, 1003]) {
        const start = performance.now();
        chooseDeployment(cfg, RED, stars, seed);
        measurements.push(performance.now() - start);
      }
      times[stars] = measurements.sort((a, b) => a - b)[1];
    }
    console.info('Battle AI median elapsed ms:', times);
    expect(times[3]).toBeLessThan(1000);
    expect(times[5]).toBeLessThan(1500);
    const red = chooseDeployment(cfg, RED, 1, 11);
    const blue = chooseDeployment(cfg, BLUE, 1, 19);
    expect(simulateBattle(cfg, red, blue).generations).toBe(150);
    const start = performance.now();
    for (let i = 0; i < 100; i++) simulateBattle(cfg, red, blue);
    const battleMs = (performance.now() - start) / 100;
    console.info('Battle simulation mean elapsed ms:', battleMs);
    expect(battleMs).toBeLessThan(1);
  }, 30_000);

  it('five stars beats one star in at least 60% of 20 seeds, playing each seed as both colours', () => {
    let wins = 0;
    let draws = 0;
    let matches = 0;
    for (let seed = 0; seed < 20; seed++) for (const team of [RED, BLUE] as const) {
      const strong = chooseDeployment(cfg, team, 5, seed);
      const weak = chooseDeployment(cfg, team === RED ? BLUE : RED, 1, seed + 10_000);
      const result = team === RED ? simulateBattle(cfg, strong, weak) : simulateBattle(cfg, weak, strong);
      if (result.winner === (team === RED ? 'red' : 'blue')) wins++;
      if (result.winner === 'draw') draws++;
      matches++;
    }
    console.info(`Five-star vs one-star: ${wins}/${matches} wins, ${draws} draws (${100 * wins / matches}%)`);
    expect(wins / matches).toBeGreaterThanOrEqual(0.6);
  }, 60_000);
});

describe('challenge and replay links', () => {
  const red: Pt[] = [[1, 1], [2, 1], [3, 2], [12, 19]];
  const blue: Pt[] = [[15, 0], [20, 2], [21, 2], [27, 19]];

  it.each([undefined, 'Ada'])('round-trips a challenge with name %s, independently of point order', (name) => {
    const hash = toChallengeHash({ army: red.slice().reverse(), name });
    expect(hash.startsWith('#c=1&a=')).toBe(true);
    const decoded = fromChallengeHash(hash);
    expect(sorted(decoded!.army)).toEqual(sorted(red));
    expect(decoded?.name).toBe(name);
    expect(fromReplayHash(hash)).toBeNull();
  });

  it('round-trips replays and empty armies, with custom arena support', () => {
    const hash = toReplayHash({ red: red.slice().reverse(), blue: blue.slice().reverse() });
    expect(hash.startsWith('#r=1&a=')).toBe(true);
    const decoded = fromReplayHash(hash);
    expect(sorted(decoded!.red)).toEqual(sorted(red));
    expect(sorted(decoded!.blue)).toEqual(sorted(blue));
    expect(fromChallengeHash(hash)).toBeNull();
    expect(fromReplayHash(toReplayHash({ red: [], blue: [] }))).toEqual({ red: [], blue: [], size: 'small' });
    expect(fromChallengeHash(toChallengeHash({ army: [] }))).toEqual({ army: [], size: 'small' });
    const small: ArenaConfig = { ...cfg, width: 10, height: 8, budget: 4, buffer: 1, generations: 20 };
    const army: Pt[] = [[0, 0], [3, 7]];
    expect(fromChallengeHash(toChallengeHash({ army }), small)?.army).toEqual(army);
    expect(fromChallengeHash(toChallengeHash({ army }), { ...small, budget: 1 })).toBeNull();
  });

  it('obfuscates the plain RLE in payloads', () => {
    const hash = toChallengeHash({ army: red });
    const payload = new URLSearchParams(hash.slice(1)).get('a')!;
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(payload).not.toContain(encodeRle(red).rle);
    expect(hash).not.toContain('!');
  });

  it('trims, truncates and strips control characters from names on encoding and decoding', () => {
    const hash = toChallengeHash({ army: red, name: ' \n A\u0000da\t Lovelace \u007f ' });
    expect(fromChallengeHash(hash)?.name).toBe('Ada Lovelace');
    const params = new URLSearchParams(hash.slice(1));
    params.set('n', '  \u0001ABCDEFGHIJKLMNOPQRSTUVWXYZ\u0085  ');
    expect(fromChallengeHash(`#${params}`)?.name).toBe('ABCDEFGHIJKLMNOPQRSTUVWX');
    expect(fromChallengeHash(toChallengeHash({ army: red, name: ' \t\n ' }))).toEqual({ army: sorted(red), size: 'small' });
    expect(fromChallengeHash(toChallengeHash({ army: red, name: '😀'.repeat(30) }))?.name).toBe('😀'.repeat(24));
  });

  it.each(['', '#v=1&p=o!', '#c=2&a=bad', '#r=2&a=bad&b=bad', '#c=1', '#r=1',
    '#c=1&a=!', '#r=1&a=%%%&b=123', '#c=1&a=A', '#c=1&a=bad&c=1',
    '#c=1&r=1&a=bad', '#c=1&a=bad&v=1'])('rejects malformed, wrong-version and sandbox hashes: %s', (hash) => {
    expect(() => fromChallengeHash(hash)).not.toThrow();
    expect(() => fromReplayHash(hash)).not.toThrow();
    expect(fromChallengeHash(hash)).toBeNull();
    expect(fromReplayHash(hash)).toBeNull();
  });

  it('rejects tampered payloads, swapped teams, out-of-zone and over-budget armies', () => {
    const challenge = new URLSearchParams(toChallengeHash({ army: red }).slice(1));
    const payload = challenge.get('a')!;
    for (let i = 0; i < payload.length; i++) {
      challenge.set('a', payload.slice(0, i) + (payload[i] === 'A' ? 'B' : 'A') + payload.slice(i + 1));
      expect(fromChallengeHash(`#${challenge}`)).toBeNull();
    }
    expect(fromChallengeHash(toChallengeHash({ army: blue }))).toBeNull();
    expect(fromChallengeHash(toChallengeHash({ army: [[14, 0]] }))).toBeNull();
    expect(fromChallengeHash(toChallengeHash({ army: [[-1, 0]] }))).toBeNull();
    expect(fromReplayHash(toReplayHash({ red: blue, blue: red }))).toBeNull();
    expect(fromReplayHash(toReplayHash({ red, blue: [[14, 0]] }))).toBeNull();
    const replay = new URLSearchParams(toReplayHash({ red, blue }).slice(1));
    replay.set('b', `${replay.get('b')}A`);
    expect(fromReplayHash(`#${replay}`)).toBeNull();
    const tooMany: Pt[] = Array.from({ length: 21 }, (_, y) => [0, y]);
    expect(fromChallengeHash(toChallengeHash({ army: tooMany }))).toBeNull();
  });

  it('bounds malicious RLE expansion before decoding and never throws on bad configurations', () => {
    const payload = (rle: string): string => {
      const text = JSON.stringify([0, 0, rle]);
      let hash = 0x811c9dc5;
      for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
      const checked = `${text}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
      let bytes = '';
      for (let i = 0; i < checked.length; i++) bytes += String.fromCharCode(checked.charCodeAt(i) ^ (0x5a + i % 31));
      return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    for (const rle of ['999999999999999o!', '1o999999999999$b!', '0o!', 'O!', 'o!garbage', 'o1b!', 'o$$!']) {
      expect(fromChallengeHash(`#c=1&a=${payload(rle)}`)).toBeNull();
    }
    const bad = { ...cfg, width: 0 };
    expect(fromChallengeHash(toChallengeHash({ army: red }), bad)).toBeNull();
    expect(fromReplayHash(toReplayHash({ red, blue }), bad)).toBeNull();
  });
});

describe('arena sizes in links', () => {
  const largeRed: Pt[] = [[0, 0], [20, 30], [24, 39]]; // only fits the large arena
  const largeBlue: Pt[] = [[31, 0], [55, 39]];

  it('round-trips the size for challenges and replays', () => {
    const c = fromChallengeHash(toChallengeHash({ army: largeRed, size: 'large' }));
    expect(c?.size).toBe('large');
    expect(sorted(c!.army)).toEqual(sorted(largeRed));
    const r = fromReplayHash(toReplayHash({ red: largeRed, blue: largeBlue, size: 'large' }));
    expect(r?.size).toBe('large');
  });

  it('treats a missing size as small and omits it when encoding small', () => {
    const hash = toChallengeHash({ army: [[1, 1]], size: 'small' });
    expect(hash).not.toContain('s=');
    expect(fromChallengeHash(hash)?.size).toBe('small');
  });

  it('rejects unknown sizes and armies that do not fit the stated size', () => {
    const hash = toChallengeHash({ army: largeRed, size: 'large' });
    expect(fromChallengeHash(hash.replace('s=large', 's=huge'))).toBeNull();
    expect(fromChallengeHash(hash.replace('&s=large', ''))).toBeNull();
  });

  it('every preset is a valid arena the AI can deploy on', () => {
    for (const size of ARENA_SIZES) {
      const cfg = ARENA_PRESETS[size];
      for (const team of [RED, BLUE] as const) {
        const army = chooseDeployment(cfg, team, 2, 7);
        expect(army.length).toBe(cfg.budget);
        expect(validateDeployment(cfg, team, army).ok).toBe(true);
      }
    }
  });
});
