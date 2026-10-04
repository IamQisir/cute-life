// Where the camera should look to keep the "body" of the population on screen.
// The body is the middle 80% of cells on each axis, so stragglers (a gun's
// glider stream, a lone escaping ship) don't drag the view ever further out.

import { keyX, keyY } from '../life/engine';
import { MAX_ZOOM, MIN_ZOOM } from './camera';
import type { Bounds } from './framing';

export interface FollowTarget {
  x: number;
  y: number;
  zoom: number;
}

/** At most this many cells are sampled, so big populations stay cheap. */
const SAMPLE = 3000;
const TRIM = 0.1;
/** Don't zoom in closer than this while following: it's for overview. */
const FOLLOW_MAX_ZOOM = 48;

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

/**
 * Bounds of the population body, including full cell squares. Null for an empty
 * world. Set `bodyOnly` false to include every extremity of art or a stamp.
 */
export function followBounds(cells: Iterable<number>, bodyOnly = true): Bounds | null {
  const xs: number[] = [];
  const ys: number[] = [];
  let i = 0;
  let stride = 1;
  const all = Array.isArray(cells) ? (cells as number[]) : [...cells];
  if (all.length === 0) return null;
  if (bodyOnly && all.length > SAMPLE) stride = Math.ceil(all.length / SAMPLE);
  for (; i < all.length; i += stride) {
    xs.push(keyX(all[i]));
    ys.push(keyY(all[i]));
  }
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const trim = bodyOnly ? TRIM : 0;
  const x0 = quantile(xs, trim);
  const x1 = quantile(xs, 1 - trim) + 1;
  const y0 = quantile(ys, trim);
  const y1 = quantile(ys, 1 - trim) + 1;
  return { left: x0, top: y0, right: x1, bottom: y1 };
}

/** Fit bounds to free screen pixels with `pad` cells of breathing room. */
export function boundsTarget(bounds: Bounds, viewW: number, viewH: number, pad = 6): FollowTarget {
  const { left: x0, top: y0, right: x1, bottom: y1 } = bounds;
  const w = x1 - x0 + pad * 2;
  const h = y1 - y0 + pad * 2;
  const zoom = Math.max(MIN_ZOOM, Math.min(FOLLOW_MAX_ZOOM, MAX_ZOOM, viewW / w, viewH / h));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom };
}

/** Stateless fit, also used for a one-off full stamp framing. */
export function followTarget(cells: Iterable<number>, viewW: number, viewH: number, pad = 6, bodyOnly = true): FollowTarget | null {
  const bounds = followBounds(cells, bodyOnly);
  return bounds ? boundsTarget(bounds, viewW, viewH, pad) : null;
}
