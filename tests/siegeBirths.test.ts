import { describe, expect, it } from 'vitest';
import gun from '../src/life/catalog/gosperglidergun.rle?raw';
import eater from '../src/life/catalog/eater1.rle?raw';
import lwss from '../src/life/catalog/lwss.rle?raw';
import glider from '../src/life/catalog/glider.rle?raw';
import block from '../src/life/catalog/block.rle?raw';
import rpentomino from '../src/life/catalog/rpentomino.rle?raw';
import { BLUE, RED, emptyGrid, stepGrid, type Grid } from '../src/battle/arena';
import { loadPrefabs, army, type Stamp } from '../src/battle/siege/prefabs';
import { DEFAULT_RULES, arenaConfig, crystalRect, initialState, observe, simulate, simulateGrid, stepSiege } from '../src/battle/siege/siegeSim';
import { BIRTHS_RULES as rules, BIRTHS_BREACH, birthsEqualSpendDefence, BIRTHS_PARAMETERS, birthsOutcome, birthsTrajectory } from '../src/battle/siege/birthsExperiments';
import { BEST_ESCORT, LOWER_GUN, UPPER_EATER, UPPER_GUN, mirrorArmy } from '../src/battle/siege/experiments';
const prefabs = loadPrefabs({ gosperglidergun: gun, eater1: eater, lwss, glider, block, rpentomino });
function seeded(cells: [number, number][], colour = RED): Grid {
  const grid = emptyGrid(arenaConfig(rules)); for (const [x, y] of cells) grid[y * rules.width + x] = colour; return grid;
}

describe('Crystal Siege births scoring', { timeout: 60_000 }, () => {
  it('counts only enemy newborns inside the inclusive hitbox, using Immigration colour', () => {
    // Three-parent mixed-colour blinkers: majority red newborns damage blue, majority blue do not.
    const previous = seeded([[86, 46], [87, 46], [88, 46], [86, 50], [87, 50], [88, 50]]);
    previous[46 * 128 + 86] = BLUE;
    previous[50 * 128 + 86] = BLUE; previous[50 * 128 + 88] = BLUE;
    const s = stepSiege(rules, initialState(rules, previous));
    expect(s.grid[45 * 128 + 87]).toBe(RED); expect(s.grid[49 * 128 + 87]).toBe(BLUE);
    expect(s.blue).toMatchObject({ units: 2, accumulator: 2, hp: 48, firstContact: 1 });
    const box = crystalRect(rules, BLUE), old = emptyGrid(arenaConfig(rules)), next = old.slice();
    next[box.y0 * 128 + box.x0] = RED; next[box.y1 * 128 + box.x1] = RED;
    next[(box.y0 - 1) * 128 + box.x0] = RED; next[box.y0 * 128 + box.x0 - 1] = RED;
    next[48 * 128 + 88] = BLUE; // friendly newborn
    old[48 * 128 + 89] = BLUE; next[48 * 128 + 89] = RED; // even synthetic recolouring isn't birth
    old[48 * 128 + 90] = RED; next[48 * 128 + 90] = RED; // survivor
    expect(observe(rules, { ...initialState(rules), grid: next, generation: 1 }, old).blue.units).toBe(2);
    expect(() => observe(rules, initialState(rules))).toThrow('previous generation');
    expect(() => observe(rules, initialState(rules), new Uint8Array(1))).toThrow('previous generation');
  });
  it('a static block inside the box causes zero damage, regardless of duration', () => {
    const grid = seeded([[86, 46], [87, 46], [86, 47], [87, 47]]);
    const s = simulateGrid({ ...rules, generations: 4096 }, grid);
    expect(s).toMatchObject({ generation: 4096, winner: 'draw', blue: { hp: 48, units: 0, accumulator: 0, firstContact: null, killGen: null } });
    expect(s.grid).toEqual(grid);
  });
  it('a blinker produces exactly two births per generation, bounded by the cap', () => {
    const grid = seeded([[86, 46], [87, 46], [88, 46]]);
    const s = simulateGrid({ ...rules, generations: 32 }, grid);
    expect(s.blue).toMatchObject({ hp: 40, units: 64, accumulator: 0, firstContact: 1, killGen: null });
    expect(simulateGrid({ ...rules, generations: 32, cap: 1 }, grid).blue.units).toBe(32);
  });
  it('a real gun glider stream accrues births and kills on both certified diagonal routes', () => {
    for (const mount of [UPPER_GUN, LOWER_GUN]) {
      const s = simulate(rules, prefabs, [mount], []);
      expect(s.blue).toMatchObject({ firstContact: 108, killGen: 367, hp: 0 });
      expect(s.blue.units).toBeGreaterThanOrEqual(rules.hp * rules.unitsPerHP);
      expect(s.generation / 8).toBeGreaterThanOrEqual(30); expect(s.generation / 8).toBeLessThanOrEqual(60);
      expect(s.winner).toBe('red');
    }
    const stopped = simulate(rules, prefabs, [UPPER_GUN], [UPPER_EATER]);
    expect(stopped.blue.units).toBe(0); expect(stopped.winner).toBe('draw');
  });
  it('applies cap once per generation, preserves the remainder and previous state', () => {
    const r = { ...rules, cap: 4, unitsPerHP: 8 }, before = initialState(r);
    before.blue.accumulator = 7;
    const grid = emptyGrid(arenaConfig(r)), b = crystalRect(r, BLUE);
    for (let i = 0; i < 12; i++) grid[b.y0 * 128 + b.x0 + i] = RED;
    const s = observe(r, { ...before, grid, generation: 1 }, before.grid);
    expect(s.blue).toMatchObject({ hp: 47, units: 4, accumulator: 3, firstContact: 1 });
    expect(before.blue).toMatchObject({ hp: 48, units: 0, accumulator: 7 });
    const again = observe(r, { ...s, generation: 2 }, grid);
    expect(again.blue).toEqual(s.blue); // identical sites survive; never charge them twice
  });
  it('decides simultaneous kills together, retaining the first result during continuation', () => {
    const r = { ...rules, hp: 1, unitsPerHP: 1 }, before = initialState(r);
    const next = before.grid.slice(); next[48 * 128 + 40] = BLUE; next[48 * 128 + 88] = RED;
    const s = observe(r, { ...before, generation: 1, grid: next }, before.grid);
    expect(s).toMatchObject({ winner: 'draw', red: { killGen: 1, hp: 0 }, blue: { killGen: 1, hp: 0 } });
    expect(stepSiege(r, s).winner).toBe('draw');
  });
  it('uses integer HP at timeout; remainders and population never break an HP tie', () => {
    const r = { ...rules, generations: 1 }, before = initialState(r), grid = before.grid.slice();
    grid[48 * 128 + 88] = RED;
    expect(observe(r, { ...before, grid, generation: 1 }, before.grid)).toMatchObject({ winner: 'draw', blue: { accumulator: 1 } });
    before.blue.accumulator = 7;
    expect(observe(r, { ...before, grid, generation: 1 }, before.grid).winner).toBe('red');
    expect(initialState({ ...r, generations: 0 }).winner).toBe('draw');
  });
  it('an exact72-vs72 combined assault breaches a functioning gun+eater and requires the gun', () => {
    const defence = birthsEqualSpendDefence(prefabs);
    expect(army(prefabs, defence)).toHaveLength(72); expect(army(prefabs, BIRTHS_BREACH)).toHaveLength(72);
    expect(simulate(DEFAULT_RULES, prefabs, BIRTHS_BREACH, defence)).toMatchObject({
      generation: 217, winner: 'red', red: { hp: 48 }, blue: { firstContact: 152, killGen: 217, hp: 0, units: 386, accumulator: 2 },
    });
    expect(simulate(DEFAULT_RULES, prefabs, BIRTHS_BREACH.filter(u => u.id !== 'gosperglidergun'), defence))
      .toMatchObject({ generation: 640, winner: 'draw', blue: { units: 0, hp: 48 } });
  });
  it('HP, capture and births leave Immigration identical to direct Life', () => {
    let reference = seeded(army(prefabs, [UPPER_GUN, ...BEST_ESCORT]));
    const modes = (['hp', 'capture', 'births'] as const).map(scoring => ({ r: { ...rules, scoring }, s: initialState({ ...rules, scoring }, reference) }));
    for (let g = 1; g <= 640; g++) {
      reference = stepGrid(reference, 128, 96, false, false);
      for (const mode of modes) {
        mode.s = stepSiege(mode.r, mode.s); expect(mode.s.grid.every((c, i) => c === reference[i])).toBe(true);
      }
    }
  });
  it('all 81 parameter replays match actual simulator endings, HP and remainders', () => {
    const seed = seeded([[86, 46], [87, 46], [88, 46]]);
    for (const [x, y] of [[38, 46], [39, 46], [38, 47], [39, 47], [40, 48], [41, 48], [40, 49], [41, 49]]) seed[y * 128 + x] = BLUE;
    const histories = birthsTrajectory(prefabs, [], [], seed);
    for (const r of BIRTHS_PARAMETERS) {
      const o = birthsOutcome(r, histories.get(r.hitbox)!), s = simulateGrid(r, seed);
      expect([s.red.hp, s.blue.hp, s.generation, s.winner, s.red.killGen, s.blue.killGen]).toEqual([o.redHP, o.blueHP, o.end, o.winner, o.redGen, o.blueGen]);
      expect([s.red.units, s.blue.units, s.red.accumulator, s.blue.accumulator]).toEqual([o.redUnits, o.blueUnits, o.redUnits % r.unitsPerHP, o.blueUnits % r.unitsPerHP]);
    }
  });
  it('reproduces reflection/recolouring parity and supports the chosen default fixtures', () => {
    expect(DEFAULT_RULES).toMatchObject({ scoring: 'births', hitbox: 12, hp: 48, cap: 8, unitsPerHP: 8 });
    const red: Stamp[] = [UPPER_GUN, ...BEST_ESCORT], blue = [UPPER_EATER];
    const a = simulate(rules, prefabs, red, blue), b = simulate(rules, prefabs, mirrorArmy(prefabs, blue), mirrorArmy(prefabs, red));
    expect([a.red, a.blue, a.generation]).toEqual([b.blue, b.red, b.generation]);
    expect(a.blue.killGen).toBeNull(); expect(a.blue.units).toBe(140);
    expect(simulate(DEFAULT_RULES, prefabs, [UPPER_GUN], []).winner).toBe('red');
    expect(simulate(DEFAULT_RULES, prefabs, [UPPER_GUN], [UPPER_EATER]).winner).toBe('draw');
  });
});
