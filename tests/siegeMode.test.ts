import { describe, expect, it, vi } from 'vitest';
import { BLUE, RED } from '../src/battle/arena';
import { CATALOG } from '../src/life/catalog';
import { orientPoints } from '../src/life/orientation';
import { placePattern } from '../src/life/patterns';
import { SAMPLE_IDS, type SampleId, pickSample, sampleArmy } from '../src/battle/siege/opponents';
import { UNIT_IDS, normalize, orient, stamp, type Stamp } from '../src/battle/siege/prefabs';
import { SiegeMode } from '../src/battle/siege/siegeMode';
import { DEFAULT_RULES as rules, simulate, validateArmy } from '../src/battle/siege/siegeSim';
import { PREFABS as prefabs, armyProblem, mirrorStamps, orientationOf, stampAt, unitAt } from '../src/battle/siege/units';

const key = (cells: [number, number][]) => cells.map(([x, y]) => `${x},${y}`).sort().join(';');
const hooks = () => ({ changed: vi.fn(), births: vi.fn(), finished: vi.fn() });
/** A random source that makes the opponent pick this sample first. */
const pick = (id: SampleId) => () => (SAMPLE_IDS.indexOf(id) + 0.5) / SAMPLE_IDS.length;
const UPPER_GUN: Stamp = { id: 'gosperglidergun', x: 51, y: 4, orientation: 7 };
const thrown = (team: 1 | 2, stamps: Stamp[]) => {
  try { validateArmy(rules, prefabs, team, stamps); return null; } catch (e) { return (e as Error).message; }
};

describe('siege units', () => {
  it('palette stamps (rotate/flip) place exactly the oriented prefab', () => {
    for (const id of UNIT_IDS) {
      const pattern = CATALOG.find((p) => p.id === id)!;
      expect(key(normalize(placePattern(pattern, 0, 0)))).toBe(key(prefabs[id].cells));
      for (const rot of [0, 1, 2, 3] as const) for (const flip of [false, true]) {
        const points = orientPoints(placePattern(pattern, 0, 0), { rot, flip }).map(([x, y]): [number, number] => [x + 60, y + 40]);
        const unit = stampAt(id, orientationOf({ rot, flip }), points);
        expect(key(stamp(prefabs, unit))).toBe(key(points));
        expect(key(orient(prefabs[id].cells, unit.orientation))).toBe(key(normalize(points)));
      }
    }
  });

  it('armyProblem agrees with validateArmy', () => {
    const cases: [1 | 2, Stamp[], string | null][] = [
      [RED, [UPPER_GUN], null],
      [RED, [{ id: 'block', x: 2, y: 10 }], 'zone'],
      [RED, [{ id: 'block', x: 70, y: 10 }], 'zone'],
      [RED, [{ id: 'block', x: 32, y: 40 }], 'crystal'],
      [RED, [{ id: 'block', x: 10, y: 10 }, { id: 'block', x: 11, y: 11 }], 'overlap'],
      [RED, [UPPER_GUN, { ...UPPER_GUN, y: 56, orientation: 3 }], 'limit'],
      [RED, [0, 1, 2].map((i): Stamp => ({ id: 'rpentomino', x: 10 + 6 * i, y: 10 })), 'limit'],
      [RED, Array.from({ length: 19 }, (_, i): Stamp => ({ id: 'block', x: 4 + 3 * (i % 9), y: 70 + 3 * Math.floor(i / 9) })), 'budget'],
      [BLUE, [{ id: 'glider', x: 100, y: 10 }], null],
    ];
    for (const [team, stamps, problem] of cases) {
      expect(armyProblem(rules, prefabs, team, stamps)).toBe(problem);
      expect(thrown(team, stamps) === null).toBe(problem === null);
    }
  });

  it('every sample army is legal on both sides and mirrors back to itself', () => {
    for (const id of SAMPLE_IDS) {
      const red = sampleArmy(prefabs, id, RED, 128), blue = sampleArmy(prefabs, id, BLUE, 128);
      expect(thrown(RED, red)).toBeNull();
      expect(thrown(BLUE, blue)).toBeNull();
      expect(key(blue.flatMap((s) => stamp(prefabs, s)))).toBe(key(red.flatMap((s) => stamp(prefabs, s)).map(([x, y]) => [127 - x, y])));
      expect(key(mirrorStamps(prefabs, blue, 128).flatMap((s) => stamp(prefabs, s)))).toBe(key(red.flatMap((s) => stamp(prefabs, s))));
    }
  });

  it('picks a different sample for a rematch', () => {
    for (const previous of SAMPLE_IDS) for (const r of [0, 0.5, 0.999]) expect(pickSample(() => r, previous)).not.toBe(previous);
  });
});

describe('SiegeMode', { timeout: 60_000 }, () => {
  it('deploys whole units: limits, removal by click, budget', () => {
    const h = hooks();
    const m = new SiegeMode(h);
    m.start(0);
    expect(m.placeUnit(UPPER_GUN, 0)).toBeNull();
    expect(m.budgetLeft).toBe(36);
    expect(m.unitsLeft('gosperglidergun')).toBe(0);
    expect(m.unitsLeft('lwss')).toBe(4);
    expect(m.placeUnit({ ...UPPER_GUN, y: 56, orientation: 3 }, 0)).toBe('limit');
    expect(m.placeUnit({ id: 'block', x: 38, y: 46 }, 0)).toBe('crystal');
    const [x, y] = stamp(prefabs, UPPER_GUN)[5];
    expect(unitAt(prefabs, m.units, x, y)).toBe(0);
    expect(m.removeAt(x, y, 0)).toBe(true);
    expect(m.removeAt(x, y, 0)).toBe(false);
    expect(m.units).toEqual([]);
    m.ready(0);
    expect(m.phase).toBe('deploy');
  });

  // Visible play must match the headless simulator exactly (spec §9).
  const fixtures: [string, Stamp[], SampleId][] = [
    ['gun vs rush', [UPPER_GUN], 'rush'],
    ['gun into the artillery eater', [UPPER_GUN], 'artillery'],
    ['gun-dependent breach vs fortress', sampleArmy(prefabs, 'breach', RED, 128), 'fortress'],
    ['wave vs hybrid', sampleArmy(prefabs, 'wave', RED, 128), 'hybrid'],
  ];
  for (const [name, units, sample] of fixtures) {
    it(`replay parity: ${name}`, () => {
      const m = new SiegeMode(hooks(), pick(sample));
      m.start(0);
      for (const u of units) expect(m.placeUnit(u, 0)).toBeNull();
      m.ready(0);
      expect(m.phase).toBe('reveal');
      const expected = simulate(rules, prefabs, units, m.enemy);
      // Uneven frames: normal, slow (catch-up), a pause, and a stalled tab.
      let t = 0;
      for (let frame = 0; m.phase !== 'result' && frame < 20_000; frame++) {
        t += frame % 97 === 0 ? 1500 : frame % 13 === 0 ? 480 : 16.7;
        if (frame === 300) m.togglePause();
        if (frame === 320) m.togglePause();
        m.update(t);
        // The display shows the very grid the siege state holds.
        if (m.phase !== 'deploy') expect(m.sim.grid).toBe(m.state.grid);
      }
      expect(m.phase).toBe('result');
      expect(m.state.generation).toBe(expected.generation);
      expect(m.endGeneration).toBe(expected.generation);
      expect(m.state.red).toEqual(expected.red);
      expect(m.state.blue).toEqual(expected.blue);
      expect(m.outcome!.winner).toBe(expected.winner);
      expect(m.sim.grid).toEqual(expected.grid);

      // Skipping to the end and watching again give the same result too.
      m.replay(t);
      m.finishNow(t);
      expect(m.outcome).toMatchObject({ winner: expected.winner, generation: expected.generation });
      expect(m.state.blue).toEqual(expected.blue);
    });
  }

  it('the undefended gun breaks the blue crystal; an aligned eater blocks it', () => {
    const open = simulate(rules, prefabs, [UPPER_GUN], []);
    expect(open).toMatchObject({ winner: 'red', blue: { hp: 0, killGen: 367 } });
    const m = new SiegeMode(hooks(), pick('artillery'));
    m.start(0);
    m.placeUnit(UPPER_GUN, 0);
    m.ready(0);
    m.finishNow(0);
    expect(m.outcome!.blue.firstContact).toBeNull();
    expect(m.outcome!.blue.hp).toBe(48);
  });
});
