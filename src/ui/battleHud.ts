// Battle HUD. Wide screens: structure palette on the left, controls on the
// right, title and scoreboard on top, so the arena gets the whole middle.
// Narrow screens stack palette and controls below the arena (see style.css).
// Pure DOM; BattleMode owns the state, main.ts wires actions.

import type { Stars } from '../battle/ai';
import type { BattleMode } from '../battle/mode';
import type { AiArenaSize } from '../battle/arenaPreference';
import { t } from '../i18n';

export interface BattleActions {
  ready(): void;
  random(): void;
  clear(): void;
  setStars(stars: Stars): void;
  setSize(size: AiArenaSize): void;
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
  private head = el('div', 'battle-head');
  private title = el('div', 'battle-title');
  private sub = el('div', 'battle-sub');
  private board = el('div', 'scoreboard');
  private redNum = el('span', 'score red');
  private blueNum = el('span', 'score blue');
  private bar = el('div', 'score-bar');
  private redBar = el('div', 'red');
  private gen = el('div', 'score-gen');
  readonly side = el('div', 'battle-side');
  private card = el('div', 'result-card');
  private nameInput = el('input', 'name-input');
  private lastKey = '';

  /** `palette` is the shared stamp palette (left), used to frame the arena. */
  constructor(parent: HTMLElement, private a: BattleActions, private palette: HTMLElement) {
    this.bar.append(this.redBar);
    const row = el('div', 'score-row');
    row.append(this.redNum, this.bar, this.blueNum);
    this.board.append(row, this.gen);
    this.head.append(this.title, this.sub, this.board);
    this.nameInput.placeholder = t.battle.namePlaceholder;
    this.nameInput.maxLength = 24;
    // Participate in the same grid as the logo, toolbar and menus.
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

  render(b: BattleMode) {
    const o = b.opponent;
    const vs = o.kind === 'ai' ? t.battle.vsAi('★'.repeat(o.stars)) : o.kind === 'challenge' ? t.battle.vsFriend(o.name ?? '') : t.battle.replay;
    // Garden flowers decide the winner (whole-board territory for legacy links).
    const garden = b.cfg.garden !== undefined;
    const { red, blue } = b.sim.points;
    const cells = b.sim.score;

    const titles: Record<typeof b.phase, string> = {
      deploy: b.myTeam === 1 ? t.battle.deployRed : t.battle.deployBlue,
      thinking: t.battle.thinking,
      reveal: t.battle.reveal,
      battle: b.paused ? t.battle.paused : t.battle.fight,
      // Non-breaking space: an empty title would collapse the header and reframe the arena.
      result: '\u00a0',
    };
    this.title.textContent = titles[b.phase];
    this.sub.textContent =
      b.phase === 'deploy'
        ? garden
          ? t.battle.deployGarden(b.budgetLeft, b.cfg.budget, vs)
          : t.battle.deployLegacy(b.budgetLeft, b.cfg.budget, `${b.cfg.width}×${b.cfg.height}`, vs)
        : vs;

    // Hidden panels keep their space (visibility, not display), so the arena
    // is framed the same in every phase and doesn't jump when the battle starts.
    const showBoard = b.phase === 'reveal' || b.phase === 'battle' || b.phase === 'result';
    this.board.style.visibility = showBoard ? 'visible' : 'hidden';
    this.redNum.textContent = t.battle.red(red);
    this.blueNum.textContent = t.battle.blue(blue);
    this.redBar.style.width = `${red + blue ? (100 * red) / (red + blue) : 50}%`;
    this.gen.textContent = t.battle.gen(garden, b.sim.generation, b.cfg.generations, cells.red, cells.blue);

    const key = `${b.phase}|${o.kind}|${o.kind === 'ai' ? o.stars : ''}|${b.paused}|${b.army.length > 0}|${b.myTeam}|${b.size}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.buildControls(b);
    }
  }

  private buildControls(b: BattleMode) {
    const o = b.opponent;
    this.side.replaceChildren();
    this.card.replaceChildren();
    this.card.style.display = 'none';

    if (b.phase === 'deploy') {
      if (o.kind === 'ai') {
        const arena = el('div', 'side-group');
        const sizes = el('div', 'arena-picker');
        sizes.setAttribute('role', 'group');
        sizes.setAttribute('aria-label', t.battle.arenaSize);
        sizes.append(el('span', '', t.battle.arena));
        for (const [size, label] of [['xl', t.battle.big], ['huge', t.battle.huge]] as const) {
          const pick = button(label, () => this.a.setSize(size), b.size === size ? 'on' : '');
          pick.setAttribute('aria-pressed', String(b.size === size));
          pick.title = t.battle.arenaTitle(label, size === 'xl' ? '80×56' : '120×72');
          sizes.append(pick);
        }
        arena.append(sizes);
        this.side.append(arena);
        const stars = el('div', 'stars');
        stars.title = t.battle.difficulty;
        for (let i = 1; i <= 5; i++) {
          const s = el('span', i <= o.stars ? 'on' : '', '★');
          s.addEventListener('click', () => this.a.setStars(i as Stars));
          stars.append(s);
        }
        const ai = el('div', 'side-group');
        ai.append(el('div', 'label', t.battle.ai), stars);
        this.side.append(ai);
      }
      const go = el('div', 'side-group');
      go.append(button(t.battle.ready, this.a.ready, 'big'), button(t.battle.random, this.a.random), button(t.battle.clear, this.a.clear));
      this.side.append(go);
      if (b.myTeam === 1 && o.kind === 'ai' && b.army.length > 0) {
        const share = el('div', 'side-group');
        share.append(this.nameInput, button(t.battle.challenge, () => this.a.challenge(this.nameInput.value)));
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
      speed.append(el('span', '', t.battle.slow), slider, el('span', '', t.battle.fast));
      const g = el('div', 'side-group');
      g.append(button(b.paused ? t.battle.resume : t.battle.pause, this.a.togglePause), speed, button(t.battle.skip, this.a.finishNow));
      this.side.append(g, el('div', 'side-hint', t.battle.zoomHint));
      return;
    }

    if (b.phase === 'result' && b.outcome) {
      const { winner, red, blue, cellsRed, cellsBlue, youWon, extinct } = b.outcome;
      const garden = b.cfg.garden !== undefined;
      const headline =
        youWon === true ? t.battle.youWin : youWon === false ? (o.kind === 'ai' ? t.battle.aiWins : t.battle.theyWin)
          : winner === 'draw' ? t.battle.draw : t.battle.teamWins(winner);
      const h = el('div', `result-title ${winner}`, headline);
      const score = el('div', 'result-score');
      score.append(el('span', 'red', String(red)), el('span', '', ' : '), el('span', 'blue', String(blue)));
      const wilted =
        extinct === 'both' ? t.battle.everyoneWilted : extinct ? t.battle.teamWilted(extinct) : '';
      const detail = el('div', 'result-detail', t.battle.resultDetail(garden, cellsRed, cellsBlue, wilted));
      const actions = el('div', 'controls');
      if (o.kind !== 'replay') actions.append(button(t.battle.editArmy, this.a.editArmy, 'big'));
      if (o.kind === 'replay') actions.append(button(t.battle.playAi, this.a.vsAi, 'big'));
      actions.append(
        button(t.battle.watchAgain, this.a.replay),
        button(t.battle.shareReplay, this.a.shareReplay),
        button(t.battle.postResult, this.a.postResult),
        button(t.battle.recordReplay, this.a.recordReplay),
      );
      if (o.kind === 'challenge') actions.append(button(t.battle.playAi, this.a.vsAi));
      this.card.append(h, score, detail, actions);
      this.card.style.display = '';
    }
  }
}
