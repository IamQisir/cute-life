// Mouse, touch, wheel and keyboard. Drawing is the default gesture; panning
// uses right/middle drag, space+drag, the "move" tool, or two fingers.

import type { Camera } from './render/camera';

export interface InputTarget {
  cam: Camera;
  /** Toggle/paint a cell. `value` undefined means "decide from this cell". Returns the value painted. */
  paint(x: number, y: number, value?: boolean): boolean;
  stamp(x: number, y: number, keep: boolean): boolean;
  hasStamp(): boolean;
  isHand(): boolean;
  onFirstGesture(): void;
  togglePlay(): void;
  step(): void;
  shuffle(): void;
  toggleHand(): void;
  cancelStamp(): void;
  rotateStamp(): void;
  setHover(cell: [number, number] | null): void;
}

type Mode = 'none' | 'draw' | 'pan' | 'pinch';

export function attachInput(el: HTMLElement, t: InputTarget) {
  const pointers = new Map<number, { x: number; y: number }>();
  let mode: Mode = 'none';
  let paintValue = true;
  let last: [number, number] | null = null;
  let spaceHeld = false;
  let spaceUsed = false;
  let pinchDist = 0;
  let pinchCenter = { x: 0, y: 0 };

  const local = (e: PointerEvent | WheelEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pinchInfo = () => {
    const [a, b] = [...pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  /** Paint every cell on the line between the last and current cell, so fast strokes don't skip. */
  const paintLine = (to: [number, number]) => {
    const from = last ?? to;
    let [x0, y0] = from;
    const [x1, y1] = to;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      t.paint(x0, y0, paintValue);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    last = to;
  };

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    t.onFirstGesture();
    el.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 2) {
      // Second finger: switch to pinch. Drawing from the first finger stays.
      mode = 'pinch';
      const info = pinchInfo();
      pinchDist = info.d;
      pinchCenter = info.c;
      return;
    }
    if (pointers.size > 2) return;

    if (e.button === 1 || e.button === 2 || spaceHeld || t.isHand()) {
      mode = 'pan';
      if (spaceHeld) spaceUsed = true;
      return;
    }
    const cell = t.cam.cellAt(p.x, p.y);
    if (t.hasStamp()) {
      t.stamp(cell[0], cell[1], e.shiftKey);
      mode = 'none';
      return;
    }
    mode = 'draw';
    paintValue = t.paint(cell[0], cell[1]);
    last = cell;
  });

  el.addEventListener('pointermove', (e) => {
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (e.pointerType === 'mouse') t.setHover(t.cam.cellAt(p.x, p.y));
    if (!prev) return;
    pointers.set(e.pointerId, p);

    if (mode === 'pan') {
      t.cam.panBy(p.x - prev.x, p.y - prev.y);
    } else if (mode === 'pinch' && pointers.size === 2) {
      const info = pinchInfo();
      t.cam.panBy(info.c.x - pinchCenter.x, info.c.y - pinchCenter.y);
      if (pinchDist > 0) t.cam.zoomAt(info.c.x, info.c.y, info.d / pinchDist);
      pinchDist = info.d;
      pinchCenter = info.c;
    } else if (mode === 'draw') {
      paintLine(t.cam.cellAt(p.x, p.y));
    }
  });

  const end = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0 || mode === 'pinch') mode = pointers.size === 0 ? 'none' : 'pan';
    if (pointers.size === 0) last = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') t.setHover(null);
  });

  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // Trackpad pinch arrives as ctrl+wheel with small deltas.
      t.cam.zoomAt(p.x, p.y, Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0015)));
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' && e.code !== 'Space') return;
    const pan = 60;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (!e.repeat) {
          spaceHeld = true;
          spaceUsed = false;
        }
        break;
      case 'Enter':
      case 'KeyN':
        t.step();
        break;
      case 'KeyS':
        t.shuffle();
        break;
      case 'KeyH':
        t.toggleHand();
        break;
      case 'KeyR':
        t.rotateStamp();
        break;
      case 'Escape':
        t.cancelStamp();
        break;
      case 'ArrowLeft': t.cam.panBy(pan, 0); break;
      case 'ArrowRight': t.cam.panBy(-pan, 0); break;
      case 'ArrowUp': t.cam.panBy(0, pan); break;
      case 'ArrowDown': t.cam.panBy(0, -pan); break;
      case 'Equal':
      case 'NumpadAdd':
        t.cam.zoomAt(t.cam.w / 2, t.cam.h / 2, 1.25);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        t.cam.zoomAt(t.cam.w / 2, t.cam.h / 2, 0.8);
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    spaceHeld = false;
    // A tap (no drag) toggles play.
    if (!spaceUsed) t.togglePlay();
  });
}
