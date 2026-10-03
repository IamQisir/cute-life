// Sparse, unbounded Game of Life. Only live cells are stored, so the world
// size is limited by population, not by coordinates.

const OFFSET = 2 ** 20;
const SPAN = 2 ** 21;

/** Packs (x, y) into one number. Valid for |x|, |y| < 2^20. */
export function key(x: number, y: number): number {
  return (x + OFFSET) * SPAN + (y + OFFSET);
}

export function keyX(k: number): number {
  return Math.floor(k / SPAN) - OFFSET;
}

export function keyY(k: number): number {
  return (k % SPAN) - OFFSET;
}

export type Cells = Set<number>;

export function neighborCount(cells: Cells, x: number, y: number): number {
  let n = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if ((dx || dy) && cells.has(key(x + dx, y + dy))) n++;
    }
  }
  return n;
}

/** Counts live neighbours for every cell adjacent to a live cell. */
export function neighborCounts(cells: Cells): Map<number, number> {
  const counts = new Map<number, number>();
  for (const k of cells) {
    const x = keyX(k);
    const y = keyY(k);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nk = key(x + dx, y + dy);
        counts.set(nk, (counts.get(nk) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** One generation of B3/S23. Pure: returns a new set. */
export function step(cells: Cells): Cells {
  const next: Cells = new Set();
  for (const [k, n] of neighborCounts(cells)) {
    if (n === 3 || (n === 2 && cells.has(k))) next.add(k);
  }
  return next;
}

/** Cells that are empty now but will be born next generation. */
export function buds(cells: Cells, counts = neighborCounts(cells)): number[] {
  const out: number[] = [];
  for (const [k, n] of counts) if (n === 3 && !cells.has(k)) out.push(k);
  return out;
}

export function fromList(points: [number, number][]): Cells {
  return new Set(points.map(([x, y]) => key(x, y)));
}

export function toList(cells: Cells): [number, number][] {
  return [...cells].map((k) => [keyX(k), keyY(k)] as [number, number]);
}
