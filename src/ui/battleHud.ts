// Battle HUD: phase title, red/blue scoreboard, per-phase controls and the
// result card. Pure DOM; BattleMode owns the state, main.ts wires actions.

import type { Stars } from '../battle/ai';
import { ARENA_SIZES, type ArenaSize } from '../battle/arena';
import type { BattleMode } from '../battle/mode';

export interface BattleActions {
  ready(): void;
  random(): void;
  clear(): void;
  setStars(stars: Stars): void;
  setSize(size: ArenaSize): void;
  challenge(name: string): void;
  editArmy(): void;
  replay(): void;
  vsAi(): void;
  shareReplay(): void;
  postResult(): void;
  recordReplay(): void;
  togglePause(): void;
  finishNow(): void;
  setSpeed(genPerSec: number): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), text);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.blur();
    onClick();
  });
  return b;
}

export class BattleHud {
  readonly root = el('div', 'battle-hud');
  private title = el('div', 'battle-title');
  private sub = el('div', 'battle-sub');
  private board = el('div', 'scoreboard');
  private redNum = el('span', 'score red');
  private blueNum = el('span', 'score blue');
  private bar = el('div', 'score-bar');
  private redBar = el('div', 'red');
  private gen = el('div', 'score-gen');
  private bottom = el('div', 'battle-bottom');
  private card = el('div', 'result-card');
  private nameInput = el('input', 'name-input');
  private lastKey = '';

  constructor(parent: HTMLElement, private a: BattleActions) {
    this.bar.append(this.redBar);
    const row = el('div', 'score-row');
    row.append(this.redNum, this.bar, this.blueNum);
    this.board.append(row, this.gen);
    this.nameInput.placeholder = 'your name (optional)';
    this.nameInput.maxLength = 24;
    this.root.append(this.title, this.sub, this.board, this.bottom, this.card);
    parent.append(this.root);
  }

  show(on: boolean) {
    this.root.style.display = on ? '' : 'none';
  }

  /** Re-render from the battle state. Controls are rebuilt only when the phase changes. */
  render(b: BattleMode) {
    const o = b.opponent;
    const vs = o.kind === 'ai' ? `vs AI ${'★'.repeat(o.stars)}` : o.kind === 'challenge' ? `vs ${o.name || 'a friend'}` : 'replay';
    // Territory decides the winner; living cells are shown as context.
    const { red, blue } = b.sim.territory;
    const cells = b.sim.score;

    switch (b.phase) {
      case 'deploy':
        this.title.textContent = b.myTeam === 1 ? 'deploy your red army' : 'deploy your blue army';
        this.sub.textContent = `${b.budgetLeft} of ${b.cfg.budget} cells left · ${b.cfg.width}×${b.cfg.height} · ${vs}`;
        break;
      case 'thinking':
        this.title.textContent = 'the AI is thinking...';
        this.sub.textContent = vs;
        break;
      case 'reveal':
        this.title.textContent = 'ready... fight!';
        this.sub.textContent = vs;
        break;
      case 'battle':
        this.title.textContent = b.paused ? 'paused' : 'fight!';
        this.sub.textContent = vs;
        break;
      case 'result':
        this.title.textContent = '';
        this.sub.textContent = vs;
        break;
    }

    const showBoard = b.phase === 'reveal' || b.phase === 'battle' || b.phase === 'result';
    this.board.style.visibility = showBoard ? 'visible' : 'hidden';
    this.redNum.textContent = `red ${red}`;
    this.blueNum.textContent = `${blue} blue`;
    this.redBar.style.width = `${red + blue ? (100 * red) / (red + blue) : 50}%`;
    this.gen.textContent = `territory · generation ${b.sim.generation} / ${b.cfg.generations} · cells ${cells.red} : ${cells.blue}`;

    const key = `${b.phase}|${o.kind}|${o.kind === 'ai' ? o.stars : ''}|${b.paused}|${b.army.length > 0}|${b.myTeam}|${b.size}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.buildControls(b);
    }
  }

  private buildControls(b: BattleMode) {
    const o = b.opponent;
    this.bottom.replaceChildren();
    this.card.replaceChildren();
    this.card.style.display = 'none';
    const row = el('div', 'controls');

    if (b.phase === 'deploy') {
      if (o.kind === 'ai') {
        const stars = el('div', 'stars');
        stars.title = 'AI difficulty';
        for (let i = 1; i <= 5; i++) {
          const s = el('span', i <= o.stars ? 'on' : '', '★');
          s.addEventListener('click', () => this.a.setStars(i as Stars));
          stars.append(s);
        }
        const sizes = el('div', 'controls sizes');
        for (const size of ARENA_SIZES) {
          sizes.append(button(size, () => this.a.setSize(size), size === b.size ? 'on' : ''));
        }
        this.bottom.append(sizes, stars);
      }
      row.append(
        button('ready!', this.a.ready, 'big'),
        button('random', this.a.random),
        button('clear', this.a.clear),
      );
      this.bottom.append(row);
      if (b.myTeam === 1 && o.kind === 'ai' && b.army.length > 0) {
        const share = el('div', 'controls challenge-row');
        share.append(this.nameInput, button('challenge a friend', () => this.a.challenge(this.nameInput.value)));
        this.bottom.append(share);
      }
      return;
    }

    if (b.phase === 'reveal' || b.phase === 'battle') {
      const speed = el('label', 'speed');
      const slider = el('input');
      slider.type = 'range';
      slider.min = '2';
      slider.max = '30';
      slider.value = String(b.genPerSec);
      slider.addEventListener('input', () => this.a.setSpeed(Number(slider.value)));
      speed.append(el('span', '', 'slow'), slider, el('span', '', 'fast'));
      row.append(button(b.paused ? 'resume' : 'pause', this.a.togglePause), speed, button('skip to end', this.a.finishNow));
      this.bottom.append(row);
      return;
    }

    if (b.phase === 'result' && b.outcome) {
      const { winner, red, blue, cellsRed, cellsBlue, youWon } = b.outcome;
      const headline =
        youWon === true ? 'you win!' : youWon === false ? (o.kind === 'ai' ? 'the AI wins!' : 'they win!') : winner === 'draw' ? "it's a draw!" : `${winner} wins!`;
      const h = el('div', `result-title ${winner}`, headline);
      const score = el('div', 'result-score');
      score.append(el('span', 'red', String(red)), el('span', '', ' : '), el('span', 'blue', String(blue)));
      const detail = el('div', 'result-detail', `squares painted · cells left ${cellsRed} : ${cellsBlue}`);
      const actions = el('div', 'controls');
      if (o.kind !== 'replay') actions.append(button('edit army', this.a.editArmy, 'big'));
      if (o.kind === 'replay') actions.append(button('play the AI', this.a.vsAi, 'big'));
      actions.append(
        button('watch again', this.a.replay),
        button('share replay', this.a.shareReplay),
        button('post result', this.a.postResult),
        button('record replay', this.a.recordReplay),
      );
      if (o.kind === 'challenge') actions.append(button('play the AI', this.a.vsAi));
      this.card.append(h, score, detail, actions);
      this.card.style.display = '';
    }
  }
}
