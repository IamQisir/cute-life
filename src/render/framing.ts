/** World-space edges; right/bottom exclude the last cell (include its full square). */
export interface Bounds { left: number; top: number; right: number; bottom: number }

export function pointBounds(points: [number, number][]): Bounds | null {
  if (!points.length) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [x, y] of points) {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
  }
  return { left, top, right, bottom };
}

/** Frame a clipped stamp, or one occupying less than 15% of the visible area. */
export function shouldFrameStamp(stampBounds: Bounds, view: Bounds): boolean {
  const clipped = stampBounds.left < view.left || stampBounds.right > view.right
    || stampBounds.top < view.top || stampBounds.bottom > view.bottom;
  const area = (stampBounds.right - stampBounds.left) * (stampBounds.bottom - stampBounds.top);
  const visibleArea = (view.right - view.left) * (view.bottom - view.top);
  return clipped || area < visibleArea * 0.15;
}
