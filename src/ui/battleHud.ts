// Battle HUD. Wide screens: structure palette on the left, controls on the
// right, title and scoreboard on top, so the arena gets the whole middle.
// Narrow screens stack palette and controls below the arena (see style.css).
// Pure DOM; BattleMode owns the state, main.ts wires actions.

import type { Stars } from '../battle/ai';
import type { BattleMode } from '../battle/mode';
import { BATTLE_PATTERN_NAMES, PATTERNS, type Pattern, cellCount } from '../life/patterns';
import { WorldView } from '../render/world';
import { type CardHandlers, patternCard } from './patternCard';
import { type StampEntry, stampSection } from './stamps';

export interface BattleActions {
  ready(): void;
  random(): void;
  clear(): void;
  setStars(stars: Stars): void;
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
  /** Palette cards: click to select a stamp, or drag onto the arena. */
  cards: CardHandlers;
}

const BATTLE_PATTERNS: Pattern[] = BATTLE_PATTERN_NAMES.map((n) => PATTERNS.find((p) => p.name === n)!);

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
  private head = el('div', 'battle-head');
  private title = el('div', 'battle-title');
  private sub = el('div', 'battle-sub');
  private board = el('div', 'scoreboard');
  private redNum = el('span', 'score red');
  private blueNum = el('span', 'score blue');
  private bar = el('div', 'score-bar');
  private redBar = el('div', 'red');
  private gen = el('div', 'score-gen');
  readonly palette = el('div', 'battle-palette');
  readonly side = el('div', 'battle-side');
  private card = el('div', 'result-card');
  private nameInput = el('input', 'name-input');
  private cards = new Map<Pattern, HTMLElement>();
  private paletteTeam = 0;
  private stamps: StampEntry[] = [];
  private lastKey = '';

  constructor(parent: HTMLElement, private a: BattleActions) {
    this.bar.append(this.redBar);
    const row = el('div', 'score-row');
    row.append(this.redNum, this.bar, this.blueNum);
    this.board.append(row, this.gen);
    this.head.append(this.title, this.sub, this.board);
    this.nameInput.placeholder = 'your name (optional)';
    this.nameInput.maxLength = 24;
    this.root.append(this.head, this.palette, this.side, this.card);
    parent.append(this.root);
  }

  show(on: boolean) {
    this.root.style.display = on ? '' : 'none';
  }

  /** Custom stamps shown after the built-in structures (usable, not editable, here). */
  setStamps(entries: StampEntry[]) {
    this.stamps = entries;
    this.paletteTeam = 0; // force a rebuild on the next render
  }

  /** Highlight the card whose pattern is currently the stamp. */
  setPicked(p: Pattern | null) {
    for (const [q, c] of this.cards) c.classList.toggle('on', q === p);
  }

  /** Free screen area for the arena, between the HUD panels (CSS pixels). */
  freeArea(w: number, h: number): { left: number; top: number; right: number; bottom: number } {
    const pad = 14;
    const area = { left: pad, top: this.head.getBoundingClientRect().bottom + pad, right: w - pad, bottom: h - pad };
    const wide = w >= 900;
    for (const panel of [this.palette, this.side]) {
      const r = panel.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (wide) {
        if (r.right < w / 2) area.left = Math.max(area.left, r.right + pad);
        else area.right = Math.min(area.right, r.left - pad);
      } else {
        area.bottom = Math.min(area.bottom, r.top - pad);
      }
    }
    return area;
  }

  render(b: BattleMode) {
    const o = b.opponent;
    const vs = o.kind === 'ai' ? `vs AI ${'★'.repeat(o.stars)}` : o.kind === 'challenge' ? `vs ${o.name || 'a friend'}` : 'replay';
    // Garden flowers decide the winner (whole-board territory for legacy links).
    const garden = b.cfg.garden !== undefined;
    const unit = garden ? 'flowers' : 'territory';
    const { red, blue } = b.sim.points;
    const cells = b.sim.score;

    const titles: Record<typeof b.phase, string> = {
      deploy: b.myTeam === 1 ? 'deploy your red army' : 'deploy your blue army',
      thinking: 'the AI is thinking...',
      reveal: 'ready... fight!',
      battle: b.paused ? 'paused' : 'fight!',
      // Non-breaking space: an empty title would collapse the header and reframe the arena.
      result: '\u00a0',
    };
    this.title.textContent = titles[b.phase];
    this.sub.textContent =
      b.phase === 'deploy'
        ? garden
          ? `${b.budgetLeft} of ${b.cfg.budget} cells left · grow into the garden: more flowers wins · ${vs}`
          : `${b.budgetLeft} of ${b.cfg.budget} cells left · ${b.cfg.width}×${b.cfg.height} · ${vs}`
        : vs;

    // Hidden panels keep their space (visibility, not display), so the arena
    // is framed the same in every phase and doesn't jump when the battle starts.
    const showBoard = b.phase === 'reveal' || b.phase === 'battle' || b.phase === 'result';
    this.board.style.visibility = showBoard ? 'visible' : 'hidden';
    this.redNum.textContent = `red ${red}`;
    this.blueNum.textContent = `${blue} blue`;
    this.redBar.style.width = `${red + blue ? (100 * red) / (red + blue) : 50}%`;
    this.gen.textContent = `${unit} · generation ${b.sim.generation} / ${b.cfg.generations} · cells ${cells.red} : ${cells.blue}`;

    this.renderPalette(b);

    const key = `${b.phase}|${o.kind}|${o.kind === 'ai' ? o.stars : ''}|${b.paused}|${b.army.length > 0}|${b.myTeam}|${b.size}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.buildControls(b);
    }
  }

  private renderPalette(b: BattleMode) {
    const deploying = b.phase === 'deploy';
    this.palette.style.visibility = deploying ? 'visible' : 'hidden';
    if (this.paletteTeam !== b.myTeam) {
      // Cards are drawn with the player's team colour.
      this.paletteTeam = b.myTeam;
      this.palette.replaceChildren(el('div', 'label', 'your army'));
      this.cards.clear();
      const cell = WorldView.teamPortrait(b.myTeam);
      for (const p of BATTLE_PATTERNS) {
        const card = patternCard(p, cell, this.a.cards, true);
        this.cards.set(p, card);
        this.palette.append(card);
      }
      const custom = stampSection(this.stamps, cell, { cards: this.a.cards }, true);
      this.palette.append(...custom.nodes);
      for (const [p, card] of custom.cards) this.cards.set(p, card);
    }
    if (deploying) for (const [p, card] of this.cards) card.classList.toggle('off', cellCount(p) > b.budgetLeft);
  }

  private buildControls(b: BattleMode) {
    const o = b.opponent;
    this.side.replaceChildren();
    this.card.replaceChildren();
    this.card.style.display = 'none';

    if (b.phase === 'deploy') {
      if (o.kind === 'ai') {
        const stars = el('div', 'stars');
        stars.title = 'AI difficulty';
        for (let i = 1; i <= 5; i++) {
          const s = el('span', i <= o.stars ? 'on' : '', '★');
          s.addEventListener('click', () => this.a.setStars(i as Stars));
          stars.append(s);
        }
        const ai = el('div', 'side-group');
        ai.append(el('div', 'label', 'AI'), stars);
        this.side.append(ai);
      }
      const go = el('div', 'side-group');
      go.append(button('ready!', this.a.ready, 'big'), button('random', this.a.random), button('clear', this.a.clear));
      this.side.append(go);
      if (b.myTeam === 1 && o.kind === 'ai' && b.army.length > 0) {
        const share = el('div', 'side-group');
        share.append(this.nameInput, button('challenge a friend', () => this.a.challenge(this.nameInput.value)));
        this.side.append(share);
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
      const g = el('div', 'side-group');
      g.append(button(b.paused ? 'resume' : 'pause', this.a.togglePause), speed, button('skip to end', this.a.finishNow));
      this.side.append(g, el('div', 'side-hint', 'scroll to zoom in on the cells'));
      return;
    }

    if (b.phase === 'result' && b.outcome) {
      const { winner, red, blue, cellsRed, cellsBlue, youWon, extinct } = b.outcome;
      const garden = b.cfg.garden !== undefined;
      const headline =
        youWon === true ? 'you win!' : youWon === false ? (o.kind === 'ai' ? 'the AI wins!' : 'they win!') : winner === 'draw' ? "it's a draw!" : `${winner} wins!`;
      const h = el('div', `result-title ${winner}`, headline);
      const score = el('div', 'result-score');
      score.append(el('span', 'red', String(red)), el('span', '', ' : '), el('span', 'blue', String(blue)));
      const wilted =
        extinct === 'both' ? ' · everyone wilted' : extinct ? ` · ${extinct}'s cells all wilted` : '';
      const detail = el(
        'div',
        'result-detail',
        `${garden ? 'flowers' : 'squares painted'} · cells left ${cellsRed} : ${cellsBlue}${wilted}`,
      );
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
