// Crystal Siege flow: deploy -> reveal -> battle -> result. Like BattleMode it
// owns the state and has no DOM or Pixi; main.ts routes input and rendering.
// Every visible generation is stepSiege() on the same SiegeState the headless
// simulator uses, and BattleSim only displays its grid (spec §9 replay parity).

import { BLUE, RED, type Team, type Winner, placeArmies } from '../arena';
import { BattleSim } from '../battleSim';
import type { ArenaLayout, ArenaViewState } from '../../render/arenaView';
import { type SampleId, pickSample, sampleArmy } from './opponents';
import { army, type Stamp, type UnitId } from './prefabs';
import { DEFAULT_RULES, type CrystalState, type Rect, type SiegeState, arenaConfig, crystalRect, initialState, simulateGrid, stepSiege } from './siegeSim';
import { type ArmyProblem, PREFABS, UNIT_LIMITS, armyCost, armyProblem, unitAt } from './units';

export type SiegePhase = 'deploy' | 'reveal' | 'battle' | 'result';

export interface SiegeOutcome {
  winner: Winner;
  generation: number;
  red: CrystalState;
  blue: CrystalState;
  /** From the player's point of view; null on a draw. */
  youWon: boolean | null;
}

export interface SiegeHooks {
  /** Phase or numbers changed: redraw the HUD. */
  changed(): void;
  births(points: [number, number][]): void;
  finished(outcome: SiegeOutcome): void;
}

/** What the crystal overlay needs for one crystal. */
export interface CrystalView {
  team: Team;
  box: Rect;
  hp: number;
  maxHp: number;
  /** Deployment exclusion around the hitbox, in cells. */
  halo: number;
}

const REVEAL_MS = 1400;
const FINALE_GENERATIONS = 24;
const FINALE_GEN_PER_SEC = 4;
const MAX_STEPS_PER_FRAME = 4;

export class SiegeMode {
  readonly rules = DEFAULT_RULES;
  readonly prefabs = PREFABS;
  readonly cfg = arenaConfig(this.rules);
  readonly sim = new BattleSim(this.cfg);
  phase: SiegePhase = 'deploy';
  /** The player is red; the opponent's army is hidden until the reveal. */
  readonly myTeam: Team = RED;
  units: Stamp[] = [];
  enemy: Stamp[] = [];
  opponent: SampleId | null = null;
  state: SiegeState = initialState(this.rules);
  genPerSec = 8;
  slowFinale = false;
  paused = false;
  outcome: SiegeOutcome | null = null;
  /** Generation the battle ends on, from the headless run (it is deterministic). */
  endGeneration = Infinity;
  private phaseAt = 0;
  private lastStep = 0;

  constructor(private hooks: SiegeHooks, private random: () => number = Math.random) {}

  get enemyTeam(): Team {
    return this.myTeam === RED ? BLUE : RED;
  }

  get budgetLeft() {
    return this.rules.budget - armyCost(this.prefabs, this.units);
  }

  /** How many more of a unit fit (limit and budget), for the palette. */
  unitsLeft(id: UnitId): number {
    const byBudget = Math.floor(this.budgetLeft / this.prefabs[id].cost);
    const limit = UNIT_LIMITS[id];
    return limit === undefined ? byBudget : Math.min(byBudget, limit - this.units.filter((u) => u.id === id).length);
  }

  layout(): ArenaLayout {
    const { redZone, blueZone } = this.rules;
    return { width: this.cfg.width, height: this.cfg.height, wrapX: false, wrapY: false, zones: { 1: [redZone], 2: [blueZone] } };
  }

  arenaState(): ArenaViewState {
    if (this.phase === 'deploy') return { showZones: [this.myTeam], hiddenZone: this.enemyTeam };
    return { showZones: this.phase === 'reveal' ? [RED, BLUE] : [] };
  }

  crystals(): CrystalView[] {
    return ([RED, BLUE] as const).map((team) => ({
      team, box: crystalRect(this.rules, team), hp: (team === RED ? this.state.red : this.state.blue).hp,
      maxHp: this.rules.hp, halo: this.rules.halo,
    }));
  }

  /** Start a fresh siege (keepArmy: back to deployment with the same units). */
  start(now: number, keepArmy = false) {
    this.outcome = null;
    this.paused = false;
    if (!keepArmy) this.units = [];
    this.enemy = [];
    this.state = initialState(this.rules);
    this.setPhase('deploy', now);
    this.showUnits(now);
  }

  /** Why a unit can't go here, or null. */
  unitProblem(unit: Stamp): ArmyProblem | null {
    if (this.phase !== 'deploy') return 'zone';
    return armyProblem(this.rules, this.prefabs, this.myTeam, [...this.units, unit]);
  }

  placeUnit(unit: Stamp, now: number): ArmyProblem | null {
    const problem = this.unitProblem(unit);
    if (problem) return problem;
    this.units = [...this.units, unit];
    this.showUnits(now);
    this.hooks.changed();
    return null;
  }

  /** Pick a placed unit back up. Returns whether one was there. */
  removeAt(x: number, y: number, now: number): boolean {
    if (this.phase !== 'deploy') return false;
    const i = unitAt(this.prefabs, this.units, x, y);
    if (i < 0) return false;
    this.units = this.units.filter((_, j) => j !== i);
    this.showUnits(now);
    this.hooks.changed();
    return true;
  }

  /** A random sample army for the player. */
  randomArmy(now: number) {
    if (this.phase !== 'deploy') return;
    this.units = sampleArmy(this.prefabs, pickSample(this.random), this.myTeam, this.cfg.width);
    this.showUnits(now);
    this.hooks.changed();
  }

  clearArmy(now: number) {
    if (this.phase !== 'deploy') return;
    this.units = [];
    this.showUnits(now);
    this.hooks.changed();
  }

  /** Lock in the army; the opponent picks a sample without seeing it. */
  ready(now: number) {
    if (this.phase !== 'deploy' || this.units.length === 0) return;
    this.opponent = pickSample(this.random, this.opponent ?? undefined);
    this.enemy = sampleArmy(this.prefabs, this.opponent, this.enemyTeam, this.cfg.width);
    this.reveal(now);
  }

  editArmy(now: number) {
    this.start(now, true);
  }

  /** Same army against a different sample. */
  newOpponent(now: number) {
    if (this.phase !== 'result') return;
    this.start(now, true);
    this.ready(now);
  }

  /** Watch the same two armies again from the start. */
  replay(now: number) {
    if (this.enemy.length === 0) return;
    this.outcome = null;
    this.paused = false;
    this.reveal(now);
  }

  togglePause() {
    if (this.phase === 'battle') {
      this.paused = !this.paused;
      this.hooks.changed();
    }
  }

  /** Skip the rest of the animation and jump to the result. */
  finishNow(now: number) {
    if (this.phase !== 'battle' && this.phase !== 'reveal') return;
    if (this.phase === 'reveal') this.setPhase('battle', now);
    while (this.state.winner === null) this.step(now);
    this.finish(now);
  }

  update(now: number) {
    const watching = this.phase !== 'deploy';
    const fit = this.sim.fitZoom;
    this.sim.creatures = watching ? { lo: fit * 1.25, hi: fit * 1.6 } : undefined;
    this.sim.prune(now);
    if (this.phase === 'reveal' && now - this.phaseAt >= REVEAL_MS) {
      this.setPhase('battle', now);
      this.lastStep = now;
    }
    if (this.phase !== 'battle' || this.paused) return;
    let steps = 0;
    while (this.phase === 'battle' && steps < MAX_STEPS_PER_FRAME && now - this.lastStep >= 1000 / this.speed()) {
      this.lastStep += 1000 / this.speed();
      steps++;
      this.sim.animMs = Math.min(360, (1000 / this.speed()) * 0.9);
      const born = this.step(now);
      if (steps === 1) this.hooks.births(born.map(([x, y]) => [x, y]));
      if (this.state.winner !== null) this.finish(now);
    }
    if (now - this.lastStep > 1000) this.lastStep = now;
    if (steps > 0 && this.phase === 'battle') this.hooks.changed();
  }

  /** The one place a visible generation happens. */
  private step(now: number) {
    this.state = stepSiege(this.rules, this.state);
    return this.sim.advanceTo(this.state.grid, now);
  }

  private speed() {
    const inFinale = this.slowFinale && this.state.generation >= this.endGeneration - FINALE_GENERATIONS;
    return inFinale ? Math.min(this.genPerSec, FINALE_GEN_PER_SEC) : this.genPerSec;
  }

  private showUnits(now: number) {
    this.sim.showArmy(this.myTeam, army(this.prefabs, this.units), now);
  }

  private reveal(now: number) {
    const [red, blue] = this.myTeam === RED ? [this.units, this.enemy] : [this.enemy, this.units];
    const grid = placeArmies(this.cfg, army(this.prefabs, red), army(this.prefabs, blue));
    this.endGeneration = simulateGrid(this.rules, grid).generation;
    this.state = initialState(this.rules, grid);
    this.sim.load(grid, now);
    this.setPhase('reveal', now);
  }

  private finish(now: number) {
    const { winner, generation, red, blue } = this.state;
    const mine = this.myTeam === RED ? 'red' : 'blue';
    this.outcome = { winner: winner!, generation, red, blue, youWon: winner === 'draw' ? null : winner === mine };
    this.setPhase('result', now);
    this.hooks.finished(this.outcome);
  }

  private setPhase(phase: SiegePhase, now: number) {
    this.phase = phase;
    this.phaseAt = now;
    this.hooks.changed();
  }
}
