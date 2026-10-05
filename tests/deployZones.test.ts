import { describe, expect, it } from 'vitest';
import {
  ARENA_PRESETS, ARENA_SIZES, BLUE, LEGACY_PRESETS, RED,
  deployZone, deployZoneRects, inDeployZone, simulateBattle, validateDeployment,
} from '../src/battle/arena';
import { chooseDeployment } from '../src/battle/ai';
import {
  fromChallengeHash, fromReplayHash, toChallengeHash, toReplayHash,
} from '../src/battle/challenge';
import type { Pt } from '../src/battle/arena';

const columns = {
  small: [11, 16], medium: [17, 22], large: [25, 30], xl: [37, 42], huge: [57, 62],
} as const;

describe('garden deployment halves', () => {
  it.each(ARENA_SIZES)('covers exactly the half minus garden in %s, preserving every old deployment cell', (size) => {
    const cfg = ARENA_PRESETS[size];
    const g = cfg.garden!;
    const [redLast, blueFirst] = columns[size];
    expect(deployZone(cfg, RED)).toEqual({ x0: 0, x1: redLast, y0: 0, y1: cfg.height - 1 });
    expect(deployZone(cfg, BLUE)).toEqual({ x0: blueFirst, x1: cfg.width - 1, y0: 0, y1: cfg.height - 1 });
    expect(blueFirst - redLast - 1).toBe(4);
    for (const team of [RED, BLUE] as const) {
      const rects = deployZoneRects(cfg, team);
      for (let y = 0; y < cfg.height; y++) for (let x = 0; x < cfg.width; x++) {
        const inGarden = x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1;
        const allowed = (team === RED ? x <= redLast : x >= blueFirst) && !inGarden;
        expect(inDeployZone(cfg, team, x, y)).toBe(allowed);
        // Rectangles must be disjoint as well as match the predicate (no double shading).
        expect(rects.filter((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1).length)
          .toBe(allowed ? 1 : 0);
        const previouslyAllowed = team === RED ? x < cfg.width / 2 - cfg.buffer : x >= cfg.width / 2 + cfg.buffer;
        if (previouslyAllowed) expect(allowed).toBe(true);
      }
      for (const [x, y] of [[-1, 0], [cfg.width, 0], [0, -1], [0, cfg.height], [0.5, 0], [NaN, 0]]) {
        expect(inDeployZone(cfg, team, x, y)).toBe(false);
      }
    }
  });

  it.each(ARENA_SIZES)('validates newly available cells, garden edges and all four neutral columns in %s links', (size) => {
    const cfg = ARENA_PRESETS[size];
    const g = cfg.garden!;
    const [redLast, blueFirst] = columns[size];
    const red: Pt[] = [[redLast, g.y0 - 1], [redLast, g.y1 + 1], [g.x0 - 1, g.y0]];
    const blue: Pt[] = [[blueFirst, g.y0 - 1], [blueFirst, g.y1 + 1], [g.x1 + 1, g.y1]];
    for (const [team, army] of [[RED, red], [BLUE, blue]] as const) {
      expect(validateDeployment(cfg, team, army)).toEqual({ ok: true });
      expect(validateDeployment(cfg, team === RED ? BLUE : RED, army).ok).toBe(false);
      for (let y = g.y0; y <= g.y1; y++) for (let x = g.x0; x <= g.x1; x++) {
        expect(validateDeployment(cfg, team, [[x, y]]).ok).toBe(false);
      }
      for (let x = redLast + 1; x < blueFirst; x++) for (const y of [0, g.y0, g.y1, cfg.height - 1]) {
        expect(validateDeployment(cfg, team, [[x, y]]).ok).toBe(false);
      }
    }
    expect(fromChallengeHash(toChallengeHash({ army: red, size }))?.army).toHaveLength(red.length);
    expect(fromReplayHash(toReplayHash({ red, blue, size }))).not.toBeNull();
    for (const point of [[redLast, g.y0], [redLast, g.y1], [blueFirst, g.y0], [blueFirst, g.y1],
      ...Array.from({ length: 4 }, (_, i) => [redLast + 1 + i, 0])] as Pt[]) {
      expect(fromChallengeHash(toChallengeHash({ army: [point], size }))).toBeNull();
      expect(fromReplayHash(toReplayHash({ red: [point], blue, size }))).toBeNull();
      expect(fromReplayHash(toReplayHash({ red, blue: [point], size }))).toBeNull();
    }
    expect(fromChallengeHash(toChallengeHash({ army: blue, size }))).toBeNull();
    expect(fromReplayHash(toReplayHash({ red: blue, blue: red, size }))).toBeNull();
  });

  it('subtracts an off-centre garden without extending or overlapping the bounding rectangle', () => {
    const cfg = { ...ARENA_PRESETS.small, garden: { x0: 2, x1: 4, y0: 3, y1: 5 } };
    expect(deployZoneRects(cfg, RED)).toEqual([
      { x0: 0, x1: 11, y0: 0, y1: 2 }, { x0: 0, x1: 11, y0: 6, y1: 19 },
      { x0: 0, x1: 1, y0: 3, y1: 5 }, { x0: 5, x1: 11, y0: 3, y1: 5 },
    ]);
    expect(deployZoneRects(cfg, BLUE)).toEqual([deployZone(cfg, BLUE)]);
  });
});

describe('deployment compatibility', () => {
  it('keeps every legacy preset cell and inclusive zone exactly as before', () => {
    const legacyColumns = { small: [12, 15], medium: [18, 21], large: [26, 29] } as const;
    for (const size of ['small', 'medium', 'large'] as const) {
      const cfg = LEGACY_PRESETS[size];
      const [redLast, blueFirst] = legacyColumns[size];
      for (const team of [RED, BLUE] as const) {
        const expected = { x0: team === RED ? 0 : blueFirst, x1: team === RED ? redLast : cfg.width - 1,
          y0: 0, y1: cfg.height - 1 };
        expect(deployZone(cfg, team)).toEqual(expected);
        expect(deployZoneRects(cfg, team)).toEqual([expected]);
        for (let y = -1; y <= cfg.height; y++) for (let x = -1; x <= cfg.width; x++) {
          const allowed = x >= expected.x0 && x <= expected.x1 && y >= 0 && y < cfg.height;
          expect(inDeployZone(cfg, team, x, y)).toBe(allowed);
          expect(validateDeployment(cfg, team, [[x, y]]).ok).toBe(allowed);
        }
      }
    }
  });

  it('decodes a pre-change xl challenge/replay and preserves the recorded simulation history', () => {
    // Captured from HEAD before changing deployment geometry. Both gliders start
    // at the old zone edges, enter the garden and collide after painting flowers.
    const challenge = fromChallengeHash('#c=2&a=AWhtcW9mTEMADEBXBAhMWgVKTjBUDUhAQkVFRk4&s=xl')!;
    const replay = fromReplayHash('#r=2&a=AWhtcW9mTEMADEBXBAhMWgVKTjBUDUhAQkVFRk4&b=AW9qcW9mTEMADEAKQlQHSEg2Vg8MWURDQxYR&s=xl')!;
    expect(challenge).toEqual({ size: 'xl', rules: 'garden',
      army: [[32, 19], [33, 20], [31, 21], [32, 21], [33, 21]] });
    expect(replay).toEqual({ size: 'xl', rules: 'garden', red: challenge.army,
      blue: [[47, 19], [46, 20], [46, 21], [47, 21], [48, 21]] });
    expect(validateDeployment(ARENA_PRESETS.xl, RED, challenge.army)).toEqual({ ok: true });
    expect(validateDeployment(ARENA_PRESETS.xl, BLUE, replay.blue)).toEqual({ ok: true });
    const { history, ...result } = simulateBattle(ARENA_PRESETS.xl, replay.red, replay.blue, { history: true });
    expect(result).toEqual({ red: 9, blue: 9, generations: 44, territory: { red: 57, blue: 57 },
      score: { red: 42, blue: 42 }, winner: 'draw' });
    expect(history).toHaveLength(45);
    let hash = 0x811c9dc5;
    for (const char of JSON.stringify(history)) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
    expect((hash >>> 0).toString(16)).toBe('a9f42bc6');
  });
});

describe('AI deployment shape', () => {
  it.each(ARENA_SIZES)('fills a valid %s army for both teams at every effort', (size) => {
    const cfg = ARENA_PRESETS[size];
    const g = cfg.garden!;
    const [redLast, blueFirst] = columns[size];
    for (const team of [RED, BLUE] as const) for (const stars of [1, 2, 3, 4, 5] as const) {
      const army = chooseDeployment(cfg, team, stars, 314, 1500);
      expect(army).toHaveLength(cfg.budget);
      expect(validateDeployment(cfg, team, army)).toEqual({ ok: true });
      for (const [x, y] of army) {
        expect(team === RED ? x <= redLast : x >= blueFirst).toBe(true);
        expect(x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1).toBe(false);
      }
    }
  }, 30_000);

  it.each(ARENA_SIZES)('can use the newly available space both above and below the %s garden', (size) => {
    const cfg = ARENA_PRESETS[size];
    const g = cfg.garden!;
    for (const team of [RED, BLUE] as const) {
      const armies = Array.from({ length: 40 }, (_, seed) => chooseDeployment(cfg, team, 1, seed));
      const newlyAvailable = armies.flat().filter(([x]) => team === RED
        ? x >= cfg.width / 2 - cfg.buffer : x < cfg.width / 2 + cfg.buffer);
      expect(newlyAvailable.some(([, y]) => y < g.y0)).toBe(true);
      expect(newlyAvailable.some(([, y]) => y > g.y1)).toBe(true);
    }
  });

  it('uses shape capacity rather than bounding area, even for a nearly full garden half', () => {
    const cfg = { ...ARENA_PRESETS.small, width: 10, height: 6, budget: 16, generations: 2,
      garden: { x0: 2, x1: 7, y0: 2, y1: 3 } };
    for (const team of [RED, BLUE] as const) {
      expect(() => chooseDeployment({ ...cfg, budget: 17 }, team, 1, 1)).toThrow(/capacity/);
      const army = chooseDeployment(cfg, team, 1, 1);
      expect(army).toHaveLength(16);
      expect(validateDeployment(cfg, team, army)).toEqual({ ok: true });
    }
  });
});
