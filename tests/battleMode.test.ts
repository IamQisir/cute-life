import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleMode } from '../src/battle/mode';
import { ARENA_PRESETS, BLUE, RED, deployZone, deployZoneRects, validateDeployment } from '../src/battle/arena';
import { readArenaSize, rememberArenaSize } from '../src/battle/arenaPreference';
import { fromChallengeHash, fromReplayHash } from '../src/battle/challenge';
import { orientPoints } from '../src/life/orientation';

const hooks = () => ({ changed: vi.fn(), births: vi.fn(), resized: vi.fn(), finished: vi.fn() });
let saved: Map<string, string>;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
  vi.stubGlobal('location', { origin: 'https://example.com', pathname: '/' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AI arena preference and battle flow', () => {
  it('defaults to xl, remembers the picker and clears/reframes a changed deployment', () => {
    const h = hooks();
    const b = new BattleMode(h);
    expect(b.size).toBe('xl');
    b.placeStamp([[1, 1]], 0);
    b.setSize('huge', 1);
    expect(b.cfg).toBe(ARENA_PRESETS.huge);
    expect(b.army).toEqual([]);
    expect(b.sim.score).toEqual({ red: 0, blue: 0 });
    expect(b.enemy).toEqual([]);
    expect(b.phase).toBe('deploy');
    expect(h.resized).toHaveBeenCalledOnce();
    expect(saved.get('cute-life:arena-size')).toBe('huge');
    const next = new BattleMode(hooks());
    next.start({ kind: 'ai', stars: 3 }, 2);
    expect(next.size).toBe('huge');
    next.setSize('xl', 3);
    expect(readArenaSize()).toBe('xl');
  });

  it('retains huge when editing the army and locks size while the battle is playing', () => {
    const b = new BattleMode(hooks());
    b.setSize('huge', 0);
    b.randomArmy(1);
    const army = b.army;
    b.editArmy(2);
    expect(b.size).toBe('huge');
    expect(b.army).toEqual(army);
    b.phase = 'battle';
    b.setSize('xl', 3);
    expect(b.size).toBe('huge');
  });

  it('link sizes override the AI preference and never overwrite it', () => {
    rememberArenaSize('huge');
    const b = new BattleMode(hooks());
    b.start({ kind: 'challenge', army: [[1, 1]], size: 'small', rules: 'legacy' }, 0);
    expect(b.cfg.width).toBe(28);
    expect(b.rules).toBe('legacy');
    b.setSize('huge', 1);
    expect(b.size).toBe('small');
    expect(readArenaSize()).toBe('huge');
    b.start({ kind: 'replay', red: [[1, 1]], blue: [[70, 1]], size: 'xl', rules: 'garden' }, 2);
    expect(b.cfg).toBe(ARENA_PRESETS.xl);
    expect(b.phase).toBe('reveal');
    b.start({ kind: 'ai', stars: 1 }, 3);
    expect(b.size).toBe('huge');
    expect(b.rules).toBe('garden');
    expect(b.army).toEqual([]);
  });

  it('tolerates missing, invalid and throwing storage', () => {
    for (const value of ['small', 'medium', 'large', 'unknown']) {
      saved.set('cute-life:arena-size', value);
      expect(readArenaSize()).toBe('xl');
    }
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    });
    const b = new BattleMode(hooks());
    expect(b.size).toBe('xl');
    expect(() => b.setSize('huge', 0)).not.toThrow();
    expect(b.size).toBe('huge');
    vi.stubGlobal('localStorage', undefined);
    expect(readArenaSize()).toBe('xl');
    expect(() => rememberArenaSize('huge')).not.toThrow();
  });

  it('checks, places and encodes the same oriented cells, including budget/zone boundaries', () => {
    const b = new BattleMode(hooks());
    b.setSize('huge', 0);
    const shape = orientPoints([[0, 0], [1, 0], [2, 0], [2, 1]], { rot: 1, flip: true });
    const points = shape.map(([x, y]): [number, number] => [x + 3, y + 3]);
    expect(b.stampProblem(points)).toBeNull();
    expect(b.placeStamp(points, 1)).toBeNull();
    expect(b.army).toEqual(points);
    const c = fromChallengeHash(b.challengeLink()!.split('#')[1]);
    expect(c?.size).toBe('huge');
    expect(new Set(c!.army.map(String))).toEqual(new Set(points.map(String)));
    expect(b.budgetLeft).toBe(176);
    expect(b.placeStamp(points, 2)).toBeNull();
    expect(b.budgetLeft).toBe(176);
    expect(b.stampProblem(shape.map(([x, y]) => [x + 58, y + 3]))).toBe('zone');
    // A fixed random army, so the replay below is the same every run.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    b.randomArmy(3);
    // One more fresh cell than the budget allows. A fixed row could already be
    // inside the random army, leaving nothing new to place.
    const taken = new Set(b.army.map(String));
    const free = deployZoneRects(b.cfg, RED)
      .flatMap((r) => Array.from({ length: (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) },
        (_, i): [number, number] => [r.x0 + (i % (r.x1 - r.x0 + 1)), r.y0 + Math.floor(i / (r.x1 - r.x0 + 1))]))
      .filter((p) => !taken.has(String(p)))
      .slice(0, b.budgetLeft + 1);
    expect(free).toHaveLength(b.budgetLeft + 1);
    expect(b.stampProblem(free)).toBe('budget');
    expect(b.stampProblem(free.slice(1))).toBeNull();
    b.enemy = [[deployZone(b.cfg, BLUE).x0, 1]];
    expect(validateDeployment(b.cfg, RED, b.army)).toEqual({ ok: true });
    const replay = fromReplayHash(b.replayLink()!.split('#')[1])!;
    expect(replay.size).toBe('huge');
    b.start({ kind: 'replay', red: replay.red, blue: replay.blue, size: 'huge', rules: 'garden' }, 4);
    b.finishNow(5);
    expect(b.phase).toBe('result');
  });
});

describe('garden deployment input and overlay layout', () => {
  it.each([RED, BLUE] as const)('uses the same shape for painting, stamp hover/placement and highlighting (team %i)', (team) => {
    const b = new BattleMode(hooks());
    b.myTeam = team;
    const g = b.cfg.garden!;
    const z = deployZone(b.cfg, team);
    const x = team === RED ? z.x1 : z.x0;
    const accepted: [number, number][] = [[x, g.y0 - 1], [x, g.y1 + 1]];
    expect(b.layout().zones[team]).toEqual(deployZoneRects(b.cfg, team));
    expect(b.arenaState().showZones).toEqual([team]);
    expect(b.stampProblem(accepted)).toBeNull();
    expect(b.paint(...accepted[0], 0)).toBe(true);
    expect(b.placeStamp(accepted, 1)).toBeNull();
    expect(b.army).toEqual(accepted);
    for (const point of [[x, g.y0], [x, g.y1], [x, -1], [x, b.cfg.height],
      ...Array.from({ length: 4 }, (_, i) => [b.cfg.width / 2 - 2 + i, 0]),
      [team === RED ? deployZone(b.cfg, BLUE).x0 : deployZone(b.cfg, RED).x1, 0]] as [number, number][]) {
      const before = b.army;
      expect(b.paint(...point, 2)).toBeNull();
      expect(b.stampProblem([accepted[0], point])).toBe('zone');
      expect(b.placeStamp([accepted[0], point], 3)).toBe('zone');
      expect(b.army).toBe(before);
    }
    b.phase = 'reveal';
    expect(b.arenaState().showZones).toEqual([RED, BLUE]);
  });
});
