// World units are cells. `zoom` is screen pixels per cell.

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 140;

export class Camera {
  x = 0;
  y = 0;
  zoom = 40;
  w = 1;
  h = 1;

  toScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom + this.w / 2, (wy - this.y) * this.zoom + this.h / 2];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.w / 2) / this.zoom + this.x, (sy - this.h / 2) / this.zoom + this.y];
  }

  /** The integer cell under a screen point (cell (i, j) spans [i, i+1)). */
  cellAt(sx: number, sy: number): [number, number] {
    const [wx, wy] = this.toWorld(sx, sy);
    return [Math.floor(wx), Math.floor(wy)];
  }

  panBy(dsx: number, dsy: number) {
    this.x -= dsx / this.zoom;
    this.y -= dsy / this.zoom;
  }

  /** Zoom keeping the world point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    this.x = wx - (sx - this.w / 2) / this.zoom;
    this.y = wy - (sy - this.h / 2) / this.zoom;
  }
}
