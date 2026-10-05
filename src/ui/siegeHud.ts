// Crystal Siege HUD: same layout and styles as the garden battle HUD (title
// and crystal HP on top, controls on the right, result card), with siege
// numbers. Pure DOM; SiegeMode owns the state, main.ts wires actions.

import type { SiegeMode } from '../battle/siege/siegeMode';
import { SAMPLE_NAMES, SIEGE_TEXT } from '../battle/siege/siegeText';

export interface SiegeActions {
  ready(): void;
  random(): void;
  clear(): void;
  editArmy(): void;
  newOpponent(): void;
  replay(): void;
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

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

export class SiegeHud {
  readonly root = el('div', 'battle-hud');
  private head = el('div', 'battle-head');
  private title = el('div', 'battle-title');
  private sub = el('div', 'battle-sub');
  private board = el('div', 'scoreboard');
  private redNum = el('span', 'score red');
  private blueNum = el('span', 'score blue');
  private redBar = el('div', 'hp-bar red');
  private blueBar = el('div', 'hp-bar blue');
  private redFill = el('div', 'fill');
  private blueFill = el('div', 'fill');
  private gen = el('div', 'score-gen');
  readonly side = el('div', 'battle-side');
  private card = el('div', 'result-card');
  private lastKey = '';

  /** `palette` is the shared stamp palette (left), used to frame the arena. */
  constructor(parent: HTMLElement, private a: SiegeActions, private palette: HTMLElement) {
    this.redBar.append(this.redFill);
    this.blueBar.append(this.blueFill);
    const row = el('div', 'hp-row');
    row.append(this.redNum, this.redBar, this.blueBar, this.blueNum);
    this.board.append(row, this.gen);
    this.head.append(this.title, this.sub, this.board);
    parent.querySelector('.top-area')!.append(this.head);
    this.root.append(this.side, this.card);
    parent.append(this.root);
  }

  show(on: boolean) {
    this.root.style.display = on ? '' : 'none';
    this.head.hidden = !on;
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

  render(s: SiegeMode) {
    const vs = s.phase === 'deploy' || !s.opponent ? SIEGE_TEXT.opponentHidden : `vs ${SAMPLE_NAMES[s.opponent]}`;
    const titles: Record<typeof s.phase, string> = {
      deploy: SIEGE_TEXT.deployTitle,
      reveal: SIEGE_TEXT.revealTitle,
      battle: s.paused ? SIEGE_TEXT.pausedTitle : SIEGE_TEXT.battleTitle,
      // Non-breaking space: an empty title would collapse the header and reframe the arena.
      result: ' ',
    };
    this.title.textContent = titles[s.phase];
    this.sub.textContent = s.phase === 'deploy'
      ? `${fill(SIEGE_TEXT.deploySub, { left: s.budgetLeft, budget: s.rules.budget })} · ${vs}`
      : vs;

    // Hidden panels keep their space (visibility), so the arena doesn't jump.
    this.board.style.visibility = s.phase === 'deploy' ? 'hidden' : 'visible';
    const { red, blue } = s.state;
    const max = s.rules.hp;
    this.redNum.textContent = `red ${red.hp}`;
    this.blueNum.textContent = `${blue.hp} blue`;
    this.redFill.style.width = `${(100 * red.hp) / max}%`;
    this.blueFill.style.width = `${(100 * blue.hp) / max}%`;
    this.gen.textContent = `${SIEGE_TEXT.hpLabel} · generation ${s.state.generation} / ${s.rules.generations}`;

    const key = `${s.phase}|${s.paused}|${s.units.length > 0}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.buildControls(s);
    }
  }

  private buildControls(s: SiegeMode) {
    this.side.replaceChildren();
    this.card.replaceChildren();
    this.card.style.display = 'none';

    if (s.phase === 'deploy') {
      const go = el('div', 'side-group');
      go.append(button('ready!', this.a.ready, 'big'), button('random', this.a.random), button('clear', this.a.clear));
      this.side.append(go, el('div', 'side-hint', SIEGE_TEXT.removeHint));
      return;
    }

    if (s.phase === 'reveal' || s.phase === 'battle') {
      const speed = el('label', 'speed');
      const slider = el('input');
      slider.type = 'range';
      slider.min = '2';
      slider.max = '30';
      slider.value = String(s.genPerSec);
      slider.addEventListener('input', () => this.a.setSpeed(Number(slider.value)));
      speed.append(el('span', '', 'slow'), slider, el('span', '', 'fast'));
      const g = el('div', 'side-group');
      g.append(button(s.paused ? 'resume' : 'pause', this.a.togglePause), speed, button('skip to end', this.a.finishNow));
      this.side.append(g, el('div', 'side-hint', 'scroll to zoom in on the cells'));
      return;
    }

    if (s.phase === 'result' && s.outcome) {
      const { winner, youWon, red, blue, generation } = s.outcome;
      const headline = youWon === true ? SIEGE_TEXT.youWin : youWon === false ? SIEGE_TEXT.youLose : SIEGE_TEXT.draw;
      const h = el('div', `result-title ${winner}`, headline);
      const score = el('div', 'result-score');
      score.append(el('span', 'red', String(red.hp)), el('span', '', ' : '), el('span', 'blue', String(blue.hp)));
      const broken = [red.hp === 0 && 'red', blue.hp === 0 && 'blue'].filter(Boolean) as string[];
      const detail = el('div', 'result-detail', broken.length
        ? fill(SIEGE_TEXT.crystalBroken, { team: broken.join(' and '), gen: generation })
        : fill(SIEGE_TEXT.timeUp, { red: red.hp, blue: blue.hp }));
      const actions = el('div', 'controls');
      actions.append(
        button('edit army', this.a.editArmy, 'big'),
        button('new opponent', this.a.newOpponent),
        button('watch again', this.a.replay),
        button('record replay', this.a.recordReplay),
      );
      this.card.append(h, score, detail, actions);
      this.card.style.display = '';
    }
  }
}
