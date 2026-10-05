import { describe, expect, it } from 'vitest';
import gun from '../src/life/catalog/gosperglidergun.rle?raw';
import eater from '../src/life/catalog/eater1.rle?raw';
import lwss from '../src/life/catalog/lwss.rle?raw';
import glider from '../src/life/catalog/glider.rle?raw';
import block from '../src/life/catalog/block.rle?raw';
import rpentomino from '../src/life/catalog/rpentomino.rle?raw';
import { BLUE, RED, emptyGrid, placeArmies, stepGrid, type Team } from '../src/battle/arena';
import { army, loadPrefabs } from '../src/battle/siege/prefabs';
import { DEFAULT_RULES, arenaConfig, crystalRect, initialState, observe, simulate, stepSiege, type SiegeState } from '../src/battle/siege/siegeSim';
import { HP_RULES, BEST_ESCORT, BREACH_ESCORT, UPPER_EATER, UPPER_GUN, mirrorArmy } from '../src/battle/siege/experiments';
import { CAPTURE_RULES as rules, CAPTURE_ATTACK, CAPTURE_PARAMETERS, captureOutcome } from '../src/battle/siege/captureExperiments';
const prefabs = loadPrefabs({ gosperglidergun: gun, eater1: eater, lwss, glider, block, rpentomino });
// Observer fixtures can place cells in excluded bases to isolate accounting from Life/legality.
function paintObservation(state: SiegeState, generation: number, redBaseEnemies: number, blueBaseEnemies: number) {
  const grid = emptyGrid(arenaConfig(rules));
  for (const [team, count] of [[RED, redBaseEnemies], [BLUE, blueBaseEnemies]] as [Team, number][]) {
    const b = crystalRect(rules, team);
    // Owner live cells repaint every remaining site, allowing an explicit below-threshold flicker.
    for (let i = 0; i < rules.hitbox ** 2; i++) grid[(b.y0 + Math.floor(i / rules.hitbox)) * rules.width + b.x0 + i % rules.hitbox] =
      i < count ? team === RED ? BLUE : RED : team;
  }
  return { ...state, generation, grid };
}

describe('Crystal Siege capture scoring', { timeout: 60_000 }, () => {
  it('keeps capture opt-in and paints each base in its owner colour at generation zero', () => {
    expect(DEFAULT_RULES.scoring).not.toBe('capture');
    const grid = emptyGrid(arenaConfig(rules));
    grid[48 * 128 + 88] = RED; // Even a diagnostic enemy seed cannot override owner initialization.
    const s = initialState(rules, grid);
    for (const team of [RED, BLUE] as const) {
      const b = crystalRect(rules, team);
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) expect(s.paint![y * 128 + x]).toBe(team);
    }
    expect(s.blue).toMatchObject({ captureFraction: 0, captureHistory: [0], firstContact: null, captureGen: null });
    expect(s.paint![0]).toBe(0);
    expect(initialState(DEFAULT_RULES).paint).toBeUndefined();
  });
  it('keeps Immigration evolution identical with HP, capture, and direct Life over the full horizon', () => {
    const grid = placeArmies(arenaConfig(rules), army(prefabs, [UPPER_GUN, ...BEST_ESCORT]), army(prefabs, [UPPER_EATER]));
    let hp = initialState(HP_RULES, grid), capture = initialState(rules, grid), reference = grid;
    for (let g = 1; g <= 640; g++) {
      hp = stepSiege(HP_RULES, hp); capture = stepSiege(rules, capture);
      reference = stepGrid(reference, 128, 96, false, false);
      // Typed-array equality without thousands of per-cell assertions.
      expect(hp.grid.every((cell, i) => cell === reference[i])).toBe(true);
      expect(capture.grid.every((cell, i) => cell === reference[i])).toBe(true);
    }
  });
  it('counts enemy paint over all tiles, keeps empty paint, and does not mutate previous state', () => {
    const before = initialState(rules);
    const after = observe(rules, paintObservation(before, 1, 0, 20));
    expect(after.blue.captureFraction).toBe(20 / 144);
    expect(after.blue.captureHistory).toEqual([0, 20 / 144]);
    expect(after.blue.firstContact).toBe(1);
    expect(before.blue.captureHistory).toEqual([0]);
    expect(before.paint![42 * 128 + 82]).toBe(BLUE);
    const empty = observe(rules, { ...after, generation: 2, grid: emptyGrid(arenaConfig(rules)) });
    expect(empty.blue.captureFraction).toBe(20 / 144);
    expect(empty.blue.firstContact).toBe(1);
    expect(empty.blue.hp).toBe(rules.hp);
  });
  it('counts H consecutive qualifying observations, resetting on a below-threshold repaint', () => {
    const r = { ...rules, threshold: 0.5, hold: 3 };
    let s = initialState(r);
    for (const [g, n] of [[1, 72], [2, 72], [3, 71], [4, 72], [5, 72]]) s = observe(r, paintObservation(s, g, 0, n));
    expect(s.blue).toMatchObject({ holdCount: 2, captureGen: null });
    s = observe(r, paintObservation(s, 6, 0, 72));
    expect(s.blue.captureGen).toBe(6);
    expect(s.winner).toBe('red');
    expect(s.blue.firstContact).toBe(1);
    const continued = observe(r, paintObservation(s, 7, 144, 0));
    expect(continued.blue).toMatchObject({ holdCount: 0, captureGen: 6 });
    expect(continued.winner).toBe('red');
  });
  it('H=0 is immediate and simultaneous capture is a draw regardless of fractions', () => {
    const r = { ...rules, hold: 0 };
    const s = observe(r, paintObservation(initialState(r), 1, 60, 144));
    expect(s).toMatchObject({ winner: 'draw', red: { captureGen: 1 }, blue: { captureGen: 1 } });
    expect(observe(r, paintObservation(initialState(r), 1, 0, 0)).winner).toBeNull();
  });
  it('compares own-base fractions at timeout, with equal fractions drawing and no population tiebreak', () => {
    const r = { ...rules, generations: 1, threshold: 1 };
    expect(observe(r, paintObservation(initialState(r), 1, 5, 10)).winner).toBe('red');
    expect(observe(r, paintObservation(initialState(r), 1, 10, 5)).winner).toBe('blue');
    expect(observe(r, paintObservation(initialState(r), 1, 5, 5)).winner).toBe('draw');
    expect(initialState({ ...r, generations: 0 }).winner).toBe('draw');
  });
  it('validates capture parameters and scorer selection', () => {
    for (const threshold of [0, -1, 1.01, NaN]) expect(() => initialState({ ...rules, threshold })).toThrow(RangeError);
    for (const hold of [-1, 1.5, Infinity]) expect(() => initialState({ ...rules, hold })).toThrow(RangeError);
  });
  it('reports a gun-only timeout win, not a capture, at the recommended parameters', () => {
    const s = simulate(rules, prefabs, [UPPER_GUN], []);
    expect(s).toMatchObject({ generation: 640, winner: 'red', blue: { captureGen: null, firstContact: 108, captureFraction: 22 / 144 } });
    expect(Math.max(...s.blue.captureHistory!)).toBe(22 / 144);
  });
  it('the aligned eater completely blocks the gun under capture', () => {
    const s = simulate(rules, prefabs, [UPPER_GUN], [UPPER_EATER]);
    expect(s).toMatchObject({ generation: 640, winner: 'draw', blue: { firstContact: null, captureGen: null, captureFraction: 0 } });
    expect(s.blue.captureHistory!.every(f => f === 0)).toBe(true);
  });
  it('the fastest searched combined recipe captures empty and eater bases at gen86', () => {
    expect(army(prefabs, CAPTURE_ATTACK)).toHaveLength(72);
    for (const blue of [[], [UPPER_EATER]]) {
      const s = simulate(rules, prefabs, CAPTURE_ATTACK, blue);
      expect(s).toMatchObject({ generation: 86, winner: 'red', blue: { firstContact: 47, captureGen: 86 } });
    }
    // The gun is a passenger in this fastest recipe; preserve this limitation as evidence.
    expect(simulate(rules, prefabs, CAPTURE_ATTACK.slice(1), [UPPER_EATER]).blue.captureGen).toBe(86);
  });
  it('the existing gun-preserving mixed escort captures the defended base at gen330', () => {
    const s = simulate(rules, prefabs, [UPPER_GUN, ...BREACH_ESCORT], [UPPER_EATER]);
    expect(s).toMatchObject({ generation: 330, winner: 'red', blue: { firstContact: 294, captureGen: 330 } });
  });
  it('the old fastest HP breach stops at 31.25% paint, with no capture or cumulative ash damage', () => {
    const s = simulate(rules, prefabs, [UPPER_GUN, ...BEST_ESCORT], [UPPER_EATER]);
    expect(s.blue.captureGen).toBeNull();
    expect(s.blue.captureFraction).toBe(45 / 144);
    expect(s.blue.captureHistory!.slice(268).every(f => f === 45 / 144)).toBe(true);
    expect(s.winner).toBe('red'); // Residual territory still wins at timeout, as proposed.
  });
  it('owner gliders repaint an already contacted base during a legal gun attack', () => {
    const s = simulate(rules, prefabs, [UPPER_GUN], [{ id: 'glider', x: 120, y: 81, orientation: 2 }], true);
    const h = s.blue.captureHistory!;
    expect(h.slice(1).filter((f, i) => f < h[i]).length).toBe(1);
    expect(Math.max(...h)).toBe(25 / 144);
    expect(h[640]).toBe(24 / 144);
  });
  it('has reflection and recolouring parity across all hitboxes for moving and settled attack fixtures', () => {
    for (const hitbox of [10, 12, 14]) {
      const r = { ...rules, hitbox };
      const red = [UPPER_GUN, ...BEST_ESCORT], blue = [UPPER_EATER];
      const a = simulate(r, prefabs, red, blue, true);
      const b = simulate(r, prefabs, mirrorArmy(prefabs, blue), mirrorArmy(prefabs, red), true);
      expect(a.blue.captureHistory).toEqual(b.red.captureHistory);
      expect(a.red.captureHistory).toEqual(b.blue.captureHistory);
      for (const parameter of CAPTURE_PARAMETERS.filter(p => p.hitbox === hitbox)) {
        const left = captureOutcome(parameter, { red: a.red.captureHistory!, blue: a.blue.captureHistory! });
        const right = captureOutcome(parameter, { red: b.red.captureHistory!, blue: b.blue.captureHistory! });
        expect([left.redGen, left.blueGen, left.end]).toEqual([right.blueGen, right.redGen, right.end]);
        expect(right.winner).toBe(left.winner === 'red' ? 'blue' : left.winner === 'blue' ? 'red' : 'draw');
      }
    }
  });
  it('sweep replay matches the actual simulator for all 48 sets, including flicker and both-base outcomes', () => {
    // Generate observation-only histories with genuine repaint drops and simultaneous qualification.
    for (const parameter of CAPTURE_PARAMETERS) {
      const r = { ...parameter, generations: 40 };
      let s = initialState({ ...r, generations: 40 });
      for (let g = 1; g <= 40; g++) {
        const grid = emptyGrid(arenaConfig(r));
        for (const team of [RED, BLUE] as const) {
          const b = crystalRect(r, team), count = g < 4 || g === 10 ? 0 : g < 20 ? Math.floor(r.hitbox ** 2 / 2) : r.hitbox ** 2;
          for (let i = 0; i < r.hitbox ** 2; i++) grid[(b.y0 + Math.floor(i / r.hitbox)) * r.width + b.x0 + i % r.hitbox] = i < count ? team === RED ? BLUE : RED : team;
        }
        s = observe(r, { ...s, grid, generation: g });
      }
      const expected = captureOutcome({ ...r, generations: 40 }, { red: s.red.captureHistory!, blue: s.blue.captureHistory! });
      expect(s.winner).toBe(expected.winner);
      expect(s.red.captureGen).toBe(expected.redGen);
      expect(s.blue.captureGen).toBe(expected.blueGen);
    }
  });
});
