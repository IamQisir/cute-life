// Battle flow: deploy -> (AI thinking) -> reveal -> battle -> result.
// Owns the battle state; main.ts routes input and rendering here while the
// battle mode is active.

import { type Stars, chooseDeployment } from './ai';
import { type AiArenaSize, readArenaSize, rememberArenaSize } from './arenaPreference';
import {
  ARENA_PRESETS,
  type ArenaConfig,
  type ArenaSize,
  BLUE,
  type Pt,
  RED,
  type Team,
  type Winner,
  decideWinner,
  deployZone,
  presetFor,
  placeArmies,
  simulateBattle,
} from './arena';
import { BattleSim } from './battleSim';
import { toChallengeHash, toReplayHash } from './challenge';
import type { ArenaLayout, ArenaViewState } from '../render/arenaView';

export type Opponent =
  | { kind: 'ai'; stars: Stars }
  | { kind: 'challenge'; army: Pt[]; name?: string; size: ArenaSize; rules: Rules }
  | { kind: 'replay'; red: Pt[]; blue: Pt[]; size: ArenaSize; rules: Rules };

/** 'garden' is current; 'legacy' replays links made under the earlier territory rules. */
export type Rules = 'garden' | 'legacy';


export type Phase = 'deploy' | 'thinking' | 'reveal' | 'battle' | 'result';

export interface BattleOutcome {
  winner: Winner;
  /** What decides the winner: garden flowers (or whole-board territory under legacy rules). */
  red: number;
  blue: number;
  /** A side that ran out of cells, which ended the battle. */
  extinct: 'red' | 'blue' | 'both' | null;
  /** Living cells at the end: the tie-break. */
  cellsRed: number;
  cellsBlue: number;
  /** From the player's point of view; null when just watching a replay. */
  youWon: boolean | null;
}

export interface BattleHooks {
  /** Phase or numbers changed: redraw the HUD. */
  changed(): void;
  births(points: [number, number][]): void;
  /** The arena size changed: reframe the camera. */
  resized(): void;
  finished(outcome: BattleOutcome): void;
}

const REVEAL_MS = 1400;
/** When recording, the last generations play slower so the ending lands. */
const FINALE_GENERATIONS = 24;
const FINALE_GEN_PER_SEC = 4;
/** If frames are slow (weak device, recording), catch up at most this many generations per frame. */
const MAX_STEPS_PER_FRAME = 4;

export class BattleMode {
  /** Linked battles never overwrite the player's preferred AI arena. */
  private aiSize = readArenaSize();
  size: ArenaSize = this.aiSize;
  rules: Rules = 'garden';
  cfg: ArenaConfig = ARENA_PRESETS[this.aiSize];
  sim = new BattleSim(this.cfg);
  phase: Phase = 'deploy';
  opponent: Opponent = { kind: 'ai', stars: 3 };
  /** The player's team: red against the AI or when creating a challenge, blue when answering one. */
  myTeam: Team = RED;
  army: Pt[] = [];
  enemy: Pt[] = [];
  genPerSec = 8;

  /** Recording: slow down for the last FINALE_GENERATIONS generations. */
  slowFinale = false;
  /** Generation the current battle will end on (it's deterministic, so we know in advance). */
  private endGeneration = Infinity;
  paused = false;
  outcome: BattleOutcome | null = null;
  private phaseAt = 0;
  private lastStep = 0;

  constructor(private hooks: BattleHooks) {}

  get enemyTeam(): Team {
    return this.myTeam === RED ? BLUE : RED;
  }

  get budgetLeft() {
    return this.cfg.budget - this.army.length;
  }

  layout(): ArenaLayout {
    const z = (t: Team) => {
      const { x0, x1 } = deployZone(this.cfg, t);
      return { x0, x1 };
    };
    return {
      width: this.cfg.width,
      height: this.cfg.height,
      wrapX: this.cfg.wrapX,
      wrapY: this.cfg.wrapY,
      zones: { 1: z(RED), 2: z(BLUE) },
    };
  }

  arenaState(): ArenaViewState {
    if (this.phase === 'deploy') {
      const hidden = this.opponent.kind === 'replay' ? undefined : this.enemyTeam;
      return { showZones: [this.myTeam], hiddenZone: hidden };
    }
    if (this.phase === 'thinking') return { showZones: [this.myTeam], hiddenZone: this.enemyTeam };
    return { showZones: this.phase === 'reveal' ? [RED, BLUE] : [] };
  }

  /** Start (or restart) against an opponent. Replays go straight to the reveal. */
  start(opponent: Opponent, now: number, keepArmy = false) {
    this.opponent = opponent;
    // Challenges and replays bring their own arena size and rules; the AI uses current rules.
    const rules: Rules = opponent.kind === 'ai' ? 'garden' : opponent.rules;
    const size = opponent.kind === 'ai' ? this.aiSize : opponent.size;
    const resized = rules !== this.rules || size !== this.size;
    if (resized) this.applySize(size, rules);
    this.outcome = null;
    this.paused = false;
    if (opponent.kind === 'replay') {
      this.myTeam = RED;
      this.army = opponent.red;
      this.enemy = opponent.blue;
      this.reveal(now);
      if (resized) this.hooks.resized();
      return;
    }
    this.myTeam = opponent.kind === 'challenge' ? BLUE : RED;
    if (!keepArmy || resized) this.army = [];
    this.enemy = [];
    this.setPhase('deploy', now);
    this.sim.showArmy(this.myTeam, this.army, now);
    if (resized) this.hooks.resized();
  }

  setSize(size: AiArenaSize, now: number) {
    if (this.opponent.kind !== 'ai' || this.phase !== 'deploy' || size === this.size) return;
    this.aiSize = size;
    rememberArenaSize(size);
    this.start(this.opponent, now);
  }

  /** Toggle/paint a cell during deployment. Returns the painted value, or null if not allowed. */
  paint(x: number, y: number, now: number, value?: boolean): boolean | null {
    if (this.phase !== 'deploy') return null;
    const zone = deployZone(this.cfg, this.myTeam);
    if (x < zone.x0 || x > zone.x1 || y < zone.y0 || y > zone.y1) return null;
    const i = this.army.findIndex(([ax, ay]) => ax === x && ay === y);
    const v = value ?? i < 0;
    if (v && i < 0) {
      if (this.budgetLeft <= 0) return null;
      this.army = [...this.army, [x, y]];
    } else if (!v && i >= 0) {
      this.army = this.army.filter((_, j) => j !== i);
    } else {
      return v;
    }
    this.sim.showArmy(this.myTeam, this.army, now);
    this.hooks.changed();
    return v;
  }

  /** Why a stamp can't be placed, or null if it can. */
  stampProblem(points: Pt[]): 'zone' | 'budget' | null {
    if (this.phase !== 'deploy') return 'zone';
    const zone = deployZone(this.cfg, this.myTeam);
    if (points.some(([x, y]) => x < zone.x0 || x > zone.x1 || y < zone.y0 || y > zone.y1)) return 'zone';
    const have = new Set(this.army.map(([x, y]) => `${x},${y}`));
    const fresh = points.filter(([x, y]) => !have.has(`${x},${y}`));
    return fresh.length > this.budgetLeft ? 'budget' : null;
  }

  /** Add a whole structure to the army (cells already there are kept). */
  placeStamp(points: Pt[], now: number): 'zone' | 'budget' | null {
    const problem = this.stampProblem(points);
    if (problem) return problem;
    const have = new Set(this.army.map(([x, y]) => `${x},${y}`));
    this.army = [...this.army, ...points.filter(([x, y]) => !have.has(`${x},${y}`))];
    this.sim.showArmy(this.myTeam, this.army, now);
    this.hooks.changed();
    return null;
  }

  randomArmy(now: number) {
    if (this.phase !== 'deploy') return;
    this.army = chooseDeployment(this.cfg, this.myTeam, 1, Math.floor(Math.random() * 2 ** 31));
    this.sim.showArmy(this.myTeam, this.army, now);
    this.hooks.changed();
  }

  clearArmy(now: number) {
    if (this.phase !== 'deploy') return;
    this.army = [];
    this.sim.showArmy(this.myTeam, this.army, now);
    this.hooks.changed();
  }

  private applySize(size: ArenaSize, rules: Rules) {
    this.size = size;
    this.rules = rules;
    // Links are validated against an existing preset before they get here.
    this.cfg = presetFor(rules, size) ?? ARENA_PRESETS.xl;
    this.sim = new BattleSim(this.cfg);
  }

  setStars(stars: Stars) {
    if (this.opponent.kind === 'ai') this.opponent = { kind: 'ai', stars };
    this.hooks.changed();
  }

  ready(now: number) {
    if (this.phase !== 'deploy' || this.army.length === 0) return;
    if (this.opponent.kind === 'challenge') {
      this.enemy = this.opponent.army;
      this.reveal(now);
      return;
    }
    if (this.opponent.kind !== 'ai') return;
    const stars = this.opponent.stars;
    this.setPhase('thinking', now);
    // Let the HUD paint "thinking..." before the (synchronous) search runs.
    setTimeout(() => {
      this.enemy = chooseDeployment(this.cfg, this.enemyTeam, stars, Math.floor(Math.random() * 2 ** 31));
      this.reveal(performance.now());
    }, 60);
  }

  /** Back to deployment with the same army (after a result). */
  editArmy(now: number) {
    if (this.opponent.kind === 'replay') return;
    this.start(this.opponent, now, true);
  }

  /** Watch the same two armies fight again from the start. */
  replay(now: number) {
    if (this.enemy.length === 0) return;
    this.outcome = null;
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
    while (!this.isOver()) this.sim.advance(now);
    this.finish(now);
  }

  update(now: number) {
    // Deploying is done cell by cell. While watching, the framed view shows
    // team creatures and zooming in crossfades to cells, like the sandbox.
    const watching = this.phase === 'reveal' || this.phase === 'battle' || this.phase === 'result';
    const fit = this.sim.fitZoom;
    this.sim.creatures = watching ? { lo: fit * 1.25, hi: fit * 1.6 } : undefined;
    this.sim.prune(now);
    if (this.phase === 'reveal' && now - this.phaseAt >= REVEAL_MS) {
      this.setPhase('battle', now);
      this.lastStep = now;
    }
    if (this.phase !== 'battle' || this.paused) return;
    // Keep game time in step with real time even when frames are slow.
    let steps = 0;
    while (this.phase === 'battle' && steps < MAX_STEPS_PER_FRAME && now - this.lastStep >= 1000 / this.speed()) {
      this.lastStep += 1000 / this.speed();
      steps++;
      this.sim.animMs = Math.min(360, (1000 / this.speed()) * 0.9);
      const born = this.sim.advance(now);
      if (steps === 1) this.hooks.births(born.map(([x, y]) => [x, y]));
      if (this.isOver()) this.finish(now);
    }
    // Too far behind (e.g. the tab was hidden): drop the backlog instead of racing.
    if (now - this.lastStep > 1000) this.lastStep = now;
    if (steps > 0 && this.phase === 'battle') this.hooks.changed();
  }

  challengeLink(name?: string): string | null {
    if (this.myTeam !== RED || this.army.length === 0) return null;
    return location.origin + location.pathname + toChallengeHash({ army: this.army, name, size: this.size, rules: this.rules });
  }

  replayLink(): string | null {
    if (this.enemy.length === 0) return null;
    const [red, blue] = this.myTeam === RED ? [this.army, this.enemy] : [this.enemy, this.army];
    return location.origin + location.pathname + toReplayHash({ red, blue, size: this.size, rules: this.rules });
  }

  private speed() {
    const inFinale = this.slowFinale && this.sim.generation >= this.endGeneration - FINALE_GENERATIONS;
    return inFinale ? Math.min(this.genPerSec, FINALE_GEN_PER_SEC) : this.genPerSec;
  }

  private reveal(now: number) {
    const [red, blue] = this.myTeam === RED ? [this.army, this.enemy] : [this.enemy, this.army];
    this.endGeneration = simulateBattle(this.cfg, red, blue).generations;
    this.sim.load(placeArmies(this.cfg, red, blue), now);
    this.setPhase('reveal', now);
  }

  /** Garden rules end at the first extinction; legacy rules let the survivor keep painting. */
  private isOver() {
    const { red, blue } = this.sim.score;
    const extinct = this.cfg.endOnExtinction ? red === 0 || blue === 0 : red === 0 && blue === 0;
    return this.sim.generation >= this.cfg.generations || this.sim.settled || extinct;
  }

  private finish(now: number) {
    const points = this.sim.points;
    const { red, blue } = points;
    const cells = this.sim.score;
    const winner: Winner = decideWinner(this.cfg, points, cells);
    const extinct = cells.red === 0 && cells.blue === 0 ? 'both' : cells.red === 0 ? 'red' : cells.blue === 0 ? 'blue' : null;
    const mine = this.myTeam === RED ? 'red' : 'blue';
    this.outcome = {
      winner,
      red,
      blue,
      extinct,
      cellsRed: cells.red,
      cellsBlue: cells.blue,
      youWon: this.opponent.kind === 'replay' || winner === 'draw' ? null : winner === mine,
    };
    this.setPhase('result', now);
    this.hooks.finished(this.outcome);
  }

  private setPhase(phase: Phase, now: number) {
    this.phase = phase;
    this.phaseAt = now;
    this.hooks.changed();
  }
}
