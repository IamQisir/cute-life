import { PATTERNS, type Pattern } from '../life/patterns';
import { WorldView } from '../render/world';

export interface HudActions {
  togglePlay(): void;
  step(): void;
  shuffle(): void;
  clear(): void;
  setSpeed(genPerSec: number): void;
  toggleSound(): void;
  toggleHand(): void;
  pickPattern(p: Pattern | null): void;
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
    b.blur(); // keep Space for play/pause, not for re-clicking this button
    onClick();
  });
  return b;
}

/** Tiny drawing of a pattern made of happy cells, for the palette cards. */
function patternThumb(p: Pattern): HTMLCanvasElement {
  const cell = WorldView.portrait('happy', 0);
  const h = p.rows.length;
  const w = Math.max(...p.rows.map((r) => r.length));
  const size = 60;
  const unit = Math.min(size / w, size / h, 16);
  const c = el('canvas');
  c.width = c.height = size * 2;
  c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  const ox = (size - w * unit) / 2;
  const oy = (size - h * unit) / 2;
  p.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'O') ctx.drawImage(cell, ox + x * unit - unit * 0.1, oy + y * unit - unit * 0.1, unit * 1.2, unit * 1.2);
    }),
  );
  return c;
}

export class Hud {
  private status = el('div', 'status');
  private playBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
  private handBtn: HTMLButtonElement;
  private hint = el('div', 'hint');
  private toastEl = el('div', 'toast');
  private toastTimer = 0;
  private cards = new Map<Pattern, HTMLElement>();

  constructor(root: HTMLElement, a: HudActions) {
    const title = el('div', 'title');
    const icon = el('img');
    icon.src = WorldView.portrait('happy', 0).toDataURL();
    icon.alt = '';
    title.append(icon, el('span', '', 'cute'), el('span', '', 'life'));

    const topRight = el('div', 'top-right');
    this.soundBtn = button('sound on', a.toggleSound);
    this.handBtn = button('move', a.toggleHand);
    topRight.append(this.handBtn, this.soundBtn);

    const palette = el('div', 'palette');
    palette.append(el('div', 'label', 'stamps'));
    for (const p of PATTERNS) {
      const card = el('div', 'card');
      card.append(patternThumb(p), el('div', '', p.name));
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        a.pickPattern(card.classList.contains('on') ? null : p);
      });
      this.cards.set(p, card);
      palette.append(card);
    }

    const bottom = el('div', 'bottom');
    const controls = el('div', 'controls');
    this.playBtn = button('play', a.togglePlay, 'big');
    const speed = el('label', 'speed');
    const slider = el('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '20';
    slider.value = '4';
    slider.addEventListener('input', () => a.setSpeed(Number(slider.value)));
    speed.append(el('span', '', 'slow'), slider, el('span', '', 'fast'));
    controls.append(this.playBtn, button('step', a.step), speed, button('sprinkle', a.shuffle), button('clear', a.clear));
    bottom.append(this.status, controls);

    this.hint.innerHTML =
      'click to draw a little cell ~ space to play<br/>scroll to zoom ~ right-drag (or hold space) to move';

    const sleepers = ['bl', 'br'].map((side, i) => {
      const s = el('div', `sleeper ${side}`);
      const img = el('img');
      img.src = WorldView.portrait('blink', i + 1).toDataURL();
      img.alt = '';
      s.append(img, el('span', 'z', 'z'), el('span', 'z', 'z'));
      return s;
    });

    root.append(title, topRight, palette, this.hint, bottom, this.toastEl, ...sleepers);
  }

  setStatus(generation: number, population: number) {
    this.status.innerHTML = `generation <b>${generation}</b> · <b>${population}</b> ${population === 1 ? 'cell' : 'cells'}`;
  }

  setPlaying(on: boolean) {
    this.playBtn.textContent = on ? 'pause' : 'play';
  }

  setSound(on: boolean) {
    this.soundBtn.textContent = on ? 'sound on' : 'sound off';
    this.soundBtn.classList.toggle('on', !on);
  }

  setHand(on: boolean) {
    this.handBtn.classList.toggle('on', on);
  }

  setPattern(p: Pattern | null) {
    for (const [q, card] of this.cards) card.classList.toggle('on', q === p);
  }

  dismissHint() {
    this.hint.classList.add('gone');
  }

  toast(msg: string, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
}
