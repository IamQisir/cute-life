// Battle flow: deploy -> (AI thinking) -> reveal -> battle -> result.
// Owns the battle state; main.ts routes input and rendering here while the
// battle mode is active.

import { type Stars, chooseDeployment } from './ai';
import {
  type ArenaConfig,
  BLUE,
  DEFAULT_ARENA,
  type Pt,
  RED,
  type Team,
  type Winner,
  deployZone,
  placeArmies,
} from './arena';
import { BattleSim } from './battleSim';
import { toChallengeHash, toReplayHash } from './challenge';
import type { ArenaLayout, ArenaViewState } from '../render/arenaView';

export type Opponent =
  | { kind: 'ai'; stars: Stars }
  | { kind: 'challenge'; army: Pt[]; name?: string }
  | { kind: 'replay'; red: Pt[]; blue: Pt[] };

export type Phase = 'deploy' | 'thinking' | 'reveal' | 'battle' | 'result';

export interface BattleOutcome {
  winner: Winner;
  red: number;
  blue: number;
  /** From the player's point of view; null when just watching a replay. */
  youWon: boolean | null;
}

export interface BattleHooks {
  /** Phase or numbers changed: redraw the HUD. */
  changed(): void;
  births(points: [number, number][]): void;
  finished(outcome: BattleOutcome): void;
}

const REVEAL_MS = 1400;

export class BattleMode {
  readonly cfg: ArenaConfig = DEFAULT_ARENA;
  sim = new BattleSim(this.cfg);
  phase: Phase = 'deploy';
  opponent: Opponent = { kind: 'ai', stars: 3 };
  /** The player's team: red against the AI or when creating a challenge, blue when answering one. */
  myTeam: Team = RED;
  army: Pt[] = [];
  enemy: Pt[] = [];
  genPerSec = 8;
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
    return { width: this.cfg.width, height: this.cfg.height, zones: { 1: z(RED), 2: z(BLUE) } };
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
    this.outcome = null;
    this.paused = false;
    if (opponent.kind === 'replay') {
      this.myTeam = RED;
      this.army = opponent.red;
      this.enemy = opponent.blue;
      this.reveal(now);
      return;
    }
    this.myTeam = opponent.kind === 'challenge' ? BLUE : RED;
    if (!keepArmy) this.army = [];
    this.enemy = [];
    this.setPhase('deploy', now);
    this.sim.showArmy(this.myTeam, this.army, now);
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
    this.sim.prune(now);
    if (this.phase === 'reveal' && now - this.phaseAt >= REVEAL_MS) {
      this.setPhase('battle', now);
      this.lastStep = now;
    }
    if (this.phase !== 'battle' || this.paused) return;
    if (now - this.lastStep < 1000 / this.genPerSec) return;
    this.lastStep = now;
    this.sim.animMs = Math.min(360, (1000 / this.genPerSec) * 0.9);
    const born = this.sim.advance(now);
    this.hooks.births(born.map(([x, y]) => [x, y]));
    if (this.isOver()) this.finish(now);
    else this.hooks.changed();
  }

  challengeLink(name?: string): string | null {
    if (this.myTeam !== RED || this.army.length === 0) return null;
    return location.origin + location.pathname + toChallengeHash({ army: this.army, name });
  }

  replayLink(): string | null {
    if (this.enemy.length === 0) return null;
    const [red, blue] = this.myTeam === RED ? [this.army, this.enemy] : [this.enemy, this.army];
    return location.origin + location.pathname + toReplayHash({ red, blue });
  }

  private reveal(now: number) {
    const [red, blue] = this.myTeam === RED ? [this.army, this.enemy] : [this.enemy, this.army];
    this.sim.load(placeArmies(this.cfg, red, blue), now);
    this.setPhase('reveal', now);
  }

  private isOver() {
    const { red, blue } = this.sim.score;
    return this.sim.generation >= this.cfg.generations || red === 0 || blue === 0;
  }

  private finish(now: number) {
    const { red, blue } = this.sim.score;
    const winner: Winner = red > blue ? 'red' : blue > red ? 'blue' : 'draw';
    const mine = this.myTeam === RED ? 'red' : 'blue';
    this.outcome = {
      winner,
      red,
      blue,
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
