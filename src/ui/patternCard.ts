// A palette card for a pattern: click to select it as a stamp, or press and
// drag it straight onto the canvas. Shared by the sandbox and battle palettes.

import { type Pattern, cellCount } from '../life/patterns';

export interface CardHandlers {
  /** A click (no drag): select or deselect this pattern as the stamp. */
  pick(p: Pattern): void;
  /** Called on every move while dragging; the first call starts the drag. */
  drag(p: Pattern, clientX: number, clientY: number): void;
  /** Released after dragging, at this point. */
  drop(p: Pattern, clientX: number, clientY: number): void;
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
  p.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'O') ctx.drawImage(cell, ox + x * unit - unit * 0.1, oy + y * unit - unit * 0.1, unit * 1.2, unit * 1.2);
    }),
  );
  return c;
}

export function patternCard(p: Pattern, cell: HTMLCanvasElement, h: CardHandlers, showCost = false): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.title = 'click to select, or drag onto the board';
  const label = document.createElement('div');
  label.textContent = p.name;
  card.append(patternThumb(p, cell), label);
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
