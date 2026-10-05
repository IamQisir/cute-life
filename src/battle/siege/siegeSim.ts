import { BLUE, RED, emptyGrid, paintCells, placeArmies, stepGrid, type ArenaConfig, type Grid, type Paint, type Pt, type Team, type Winner } from '../arena';
import { army, type Prefabs, type Stamp } from './prefabs';

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface SiegeRules {
  width: number; height: number; generations: number; budget: number;
  scoring: 'hp' | 'capture' | 'births'; threshold: number; hold: number;
  hitbox: number; hp: number; cap: number; unitsPerHP: number; halo: number;
  redCrystal: Pt; blueCrystal: Pt; redZone: Rect; blueZone: Rect;
}
export const DEFAULT_RULES: SiegeRules = {
  width: 128, height: 96, generations: 640, budget: 72,
  scoring: 'births', threshold: 0.4, hold: 16,
  hitbox: 12, hp: 48, cap: 8, unitsPerHP: 8, halo: 2,
  redCrystal: [40, 48], blueCrystal: [88, 48],
  redZone: { x0: 4, x1: 59, y0: 4, y1: 91 },
  blueZone: { x0: 68, x1: 123, y0: 4, y1: 91 },
};
export interface CrystalState {
  hp: number; accumulator: number; units: number; firstContact: number | null; killGen: number | null;
  /** Capture-only observations; absent in damage modes to preserve their state contract. History starts at gen 0. */
  captureFraction?: number; captureHistory?: number[]; holdCount?: number; captureGen?: number | null;
}
export interface SiegeState { paint?: Paint; grid: Grid; generation: number; red: CrystalState; blue: CrystalState; winner: Winner | null }
export function validateRules(rules: SiegeRules): void {
  if (rules.scoring !== 'hp' && rules.scoring !== 'capture' && rules.scoring !== 'births') throw new RangeError('Invalid siege scoring');
  if (!Number.isFinite(rules.threshold) || rules.threshold <= 0 || rules.threshold > 1) throw new RangeError('Invalid siege threshold');
  if (!Number.isSafeInteger(rules.hold) || rules.hold < 0) throw new RangeError('Invalid siege hold');
  for (const key of ['width', 'height', 'hitbox', 'hp', 'cap', 'unitsPerHP'] as const) {
    if (!Number.isSafeInteger(rules[key]) || rules[key] < 1) throw new RangeError(`Invalid siege ${key}`);
  }
  for (const key of ['generations', 'budget', 'halo'] as const) {
    if (!Number.isSafeInteger(rules[key]) || rules[key] < 0) throw new RangeError(`Invalid siege ${key}`);
  }
  for (const box of [rules.redZone, rules.blueZone, crystalRect(rules, RED), crystalRect(rules, BLUE)]) {
    if (![box.x0, box.x1, box.y0, box.y1].every(Number.isSafeInteger)
      || box.x0 < 0 || box.y0 < 0 || box.x1 >= rules.width || box.y1 >= rules.height
      || box.x0 > box.x1 || box.y0 > box.y1) throw new RangeError('Invalid siege bounds');
  }
}
export function arenaConfig(rules: SiegeRules): ArenaConfig {
  return { width: rules.width, height: rules.height, budget: rules.budget, generations: rules.generations,
    buffer: 4, wrapX: false, wrapY: false, endOnExtinction: false };
}
export function crystalRect(rules: SiegeRules, team: Team): Rect {
  const [x, y] = team === RED ? rules.redCrystal : rules.blueCrystal;
  const half = Math.floor(rules.hitbox / 2);
  return { x0: x - half, y0: y - half, x1: x - half + rules.hitbox - 1, y1: y - half + rules.hitbox - 1 };
}
export function inside([x, y]: Pt, box: Rect, halo = 0): boolean {
  return x >= box.x0 - halo && x <= box.x1 + halo && y >= box.y0 - halo && y <= box.y1 + halo;
}
export function validateArmy(rules: SiegeRules, prefabs: Prefabs, team: Team, stamps: Stamp[]): void {
  validateRules(rules);
  const points = army(prefabs, stamps);
  if (points.length > rules.budget) throw new RangeError('Over siege budget');
  for (const [id, limit] of [['gosperglidergun', 1], ['eater1', 2], ['rpentomino', 2]] as const) {
    if (stamps.filter((s) => s.id === id).length > limit) throw new RangeError('Over siege unit limit');
  }
  const seen = new Set<string>();
  for (const point of points) {
    if (!point.every(Number.isSafeInteger) || !inside(point, team === RED ? rules.redZone : rules.blueZone)) throw new RangeError('Outside siege zone');
    if ([RED, BLUE].some((t) => inside(point, crystalRect(rules, t as Team), rules.halo))) throw new RangeError('Crystal exclusion');
    const key = point.join(',');
    if (seen.has(key)) throw new RangeError('Overlapping prefabs');
    seen.add(key);
  }
}
export function initialState(rules: SiegeRules, grid = emptyGrid(arenaConfig(rules))): SiegeState {
  validateRules(rules);
  if (grid.length !== rules.width * rules.height) throw new RangeError('Invalid siege grid length');
  const fresh = (): CrystalState => ({ hp: rules.hp, accumulator: 0, units: 0, firstContact: null, killGen: null });
  const state: SiegeState = { grid, generation: 0, red: fresh(), blue: fresh(), winner: rules.generations === 0 ? 'draw' : null };
  if (rules.scoring === 'capture') {
    state.paint = new Uint8Array(grid.length);
    paintCells(state.paint, grid);
    for (const team of [RED, BLUE] as const) {
      const box = crystalRect(rules, team);
      for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) state.paint[y * rules.width + x] = team;
    }
    for (const crystal of [state.red, state.blue]) Object.assign(crystal, { captureFraction: 0, captureHistory: [0], holdCount: 0, captureGen: null });
  }
  return state;
}
/** Observe only; both updates finish before deciding. Births requires the preceding grid.
 * Units track capped exposure or births, even after HP is zero in diagnostic continuation. */
export function observe(rules: SiegeRules, state: SiegeState, previousGrid?: Grid): SiegeState {
  if (rules.scoring === 'births' && (!previousGrid || previousGrid.length !== state.grid.length)) {
    throw new RangeError('Births scoring requires the previous generation grid');
  }
  if (rules.scoring === 'capture') {
    if (!state.paint) throw new RangeError('Missing siege paint');
    const paint = state.paint.slice();
    paintCells(paint, state.grid);
    const capture = (team: Team, old: CrystalState): CrystalState => {
      const box = crystalRect(rules, team);
      let enemies = 0;
      for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
        if (paint[y * rules.width + x] === (team === RED ? BLUE : RED)) enemies++;
      }
      const captureFraction = enemies / (rules.hitbox * rules.hitbox);
      const holdCount = captureFraction >= rules.threshold ? (old.holdCount ?? 0) + 1 : 0;
      return { ...old, captureFraction, captureHistory: [...(old.captureHistory ?? []), captureFraction], holdCount,
        firstContact: old.firstContact ?? (enemies ? state.generation : null),
        captureGen: old.captureGen ?? (holdCount >= Math.max(1, rules.hold) ? state.generation : null) };
    };
    const red = capture(RED, state.red), blue = capture(BLUE, state.blue);
    const redCaptured = red.captureGen !== null, blueCaptured = blue.captureGen !== null;
    const winner: Winner | null = redCaptured || blueCaptured
      ? redCaptured && blueCaptured ? 'draw' : redCaptured ? 'blue' : 'red'
      : state.generation >= rules.generations
        ? red.captureFraction === blue.captureFraction ? 'draw' : red.captureFraction! < blue.captureFraction! ? 'red' : 'blue'
        : null;
    return { ...state, paint, red, blue, winner: state.winner ?? winner };
  }
  const damage = (team: Team, old: CrystalState): CrystalState => {
    const box = crystalRect(rules, team);
    let enemies = 0;
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
      const i = y * rules.width + x;
      if (state.grid[i] === (team === RED ? BLUE : RED)
        && (rules.scoring !== 'births' || previousGrid![i] === 0)) enemies++;
    }
    const units = Math.min(enemies, rules.cap);
    const accumulated = old.accumulator + units;
    const hp = Math.max(0, old.hp - Math.floor(accumulated / rules.unitsPerHP));
    return { hp, accumulator: accumulated % rules.unitsPerHP, units: old.units + units,
      firstContact: old.firstContact ?? (units ? state.generation : null),
      killGen: old.killGen ?? (hp === 0 ? state.generation : null) };
  };
  const red = damage(RED, state.red), blue = damage(BLUE, state.blue);
  const ended = red.hp === 0 || blue.hp === 0 || state.generation >= rules.generations;
  return { ...state, red, blue, winner: state.winner ?? (ended ? red.hp === blue.hp ? 'draw' : red.hp > blue.hp ? 'red' : 'blue' : null) };
}
export function stepSiege(rules: SiegeRules, state: SiegeState): SiegeState {
  return observe(rules, { ...state, generation: state.generation + 1,
    grid: stepGrid(state.grid, rules.width, rules.height, false, false) }, state.grid);
}
export function simulateGrid(rules: SiegeRules, grid: Grid, fullHorizon = false): SiegeState {
  let state = initialState(rules, grid);
  while (state.generation < rules.generations && (fullHorizon || state.winner === null)) state = stepSiege(rules, state);
  return state;
}
export function simulate(rules: SiegeRules, prefabs: Prefabs, red: Stamp[], blue: Stamp[], fullHorizon = false): SiegeState {
  validateArmy(rules, prefabs, RED, red); validateArmy(rules, prefabs, BLUE, blue);
  return simulateGrid(rules, placeArmies(arenaConfig(rules), army(prefabs, red), army(prefabs, blue)), fullHorizon);
}
