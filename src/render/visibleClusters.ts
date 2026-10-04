import { findClusters, type Cluster } from '../life/clusters';
import { keyX, keyY, type Cells } from '../life/engine';

export interface WorldRect { x0: number; y0: number; x1: number; y1: number }
export function cellsInRect(cells: Cells, rect: WorldRect, margin = 8): Cells {
  const visible = new Set<number>();
  for (const k of cells) {
    const x = keyX(k), y = keyY(k);
    if (x >= rect.x0 - margin && x <= rect.x1 + margin && y >= rect.y0 - margin && y <= rect.y1 + margin) visible.add(k);
  }
  return visible;
}
/** Freeze the padded selection until the next state version; normal pans fit in the moat. */
export class VisibleClusterCache {
  private version = -1;
  private source: Cells | null = null;
  private clusters: Cluster[] = [];
  get(cells: Cells, version: number, rect: WorldRect): Cluster[] {
    if (this.version !== version || this.source !== cells) {
      this.clusters = findClusters(cellsInRect(cells, rect));
      this.version = version;
      this.source = cells;
    }
    return this.clusters;
  }
}
