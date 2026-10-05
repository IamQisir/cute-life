// A palette card for a pattern: click to select it as a stamp, or press and
// drag it straight onto the canvas. Shared by the sandbox and battle palettes.

import { t } from '../i18n';
import { type Pattern, cellCount } from '../life/patterns';

export interface CardHandlers {
  /** A click (no drag): select or deselect this pattern as the stamp. */
  pick(p: Pattern): void;
  /** Called on every move while dragging; the first call starts the drag. */
  drag(p: Pattern, clientX: number, clientY: number): void;
  /** Released after dragging, at this point. */
  drop(p: Pattern, clientX: number, clientY: number): void;
}

/** CJK characters are about twice as wide as Latin letters at the same size. */
const WIDE = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/;

/**
 * Whether a card name needs the smaller font: a word too long to wrap at a
 * space (pentadecathlon, a custom stamp name), or a CJK name too wide for one
 * line (CJK lines break anywhere, so the whole name counts, e.g. イーター 1).
 */
export function longName(label: string): boolean {
  const width = (text: string) => [...text].reduce((n, ch) => n + (WIDE.test(ch) ? 2.4 : 1), 0);
  const parts = WIDE.test(label) ? [label] : label.split(/\s+/);
  return Math.max(...parts.map(width)) > 11;
}

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_SLOP = 6;

/** Tiny drawing of a pattern made of happy cells. */
export function patternThumb(p: Pattern, cell: HTMLCanvasElement, size = 60): HTMLCanvasElement {
  const h = p.rows.length;
  const w = Math.max(...p.rows.map((r) => r.length));
  const unit = Math.min(size / w, size / h, 16);
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  const ox = (size - w * unit) / 2;
  const oy = (size - h * unit) / 2;
  // Big patterns shrink each cell to a couple of pixels: crisp dots read better
  // than tiny blurred cell drawings.
  const dots = unit < 5;
  ctx.fillStyle = '#4f9a80';
  p.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== 'O') return;
      if (dots) {
        ctx.beginPath();
        ctx.arc(ox + (x + 0.5) * unit, oy + (y + 0.5) * unit, Math.max(0.6, unit * 0.45), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.drawImage(cell, ox + x * unit - unit * 0.1, oy + y * unit - unit * 0.1, unit * 1.2, unit * 1.2);
      }
    }),
  );
  return c;
}

export function patternCard(
  p: Pattern,
  cell: HTMLCanvasElement,
  h: CardHandlers,
  showCost = false,
  tooltip?: string,
  label = p.name,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.title = tooltip ?? t.palette.cardHint;
  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = label;
  if (longName(label)) name.classList.add('long');
  card.append(patternThumb(p, cell), name);
  if (showCost) {
    const cost = document.createElement('div');
    cost.className = 'cost';
    cost.textContent = `${cellCount(p)} ●`;
    card.append(cost);
  }

  let start: { x: number; y: number } | null = null;
  let dragging = false;
  card.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    card.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY };
    dragging = false;
  });
  card.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_SLOP) return;
    dragging = true;
    card.classList.add('dragging');
    h.drag(p, e.clientX, e.clientY);
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!start) return;
    card.classList.remove('dragging');
    if (dragging && !cancelled) h.drop(p, e.clientX, e.clientY);
    else if (!dragging && !cancelled) h.pick(p);
    start = null;
    dragging = false;
  };
  card.addEventListener('pointerup', (e) => end(e, false));
  card.addEventListener('pointercancel', (e) => end(e, true));
  return card;
}
