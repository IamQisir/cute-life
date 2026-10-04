import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/life/catalog';
import { fromList, keyX, keyY, step, type Cells } from '../src/life/engine';
import { INTRO_PICTURES, introPoints, pickIntroPicture } from '../src/life/introArt';

const ALLOWED_IDS = new Set([
  'block', 'beehive', 'loaf', 'boat', 'tub', 'pond', 'ship', 'eater1',
  'blinker', 'toad', 'beacon', 'clock', 'pulsar', 'pentadecathlon',
]);

function bounds(cells: Cells): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const k of cells) {
    const x = keyX(k);
    const y = keyY(k);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

describe('introArt suite', () => {
  it('has at least 6 pictures', () => {
    expect(INTRO_PICTURES.length).toBeGreaterThanOrEqual(6);
  });

  it('pickIntroPicture selects pictures according to rand', () => {
    expect(pickIntroPicture(() => 0)).toBe(INTRO_PICTURES[0]);
    expect(pickIntroPicture(() => 0.999)).toBe(INTRO_PICTURES[INTRO_PICTURES.length - 1]);
  });

  describe.each(INTRO_PICTURES)('$name', (pic) => {
    it('uses only allowed ids with categories still or oscillator', () => {
      expect(pic.pieces.length).toBeGreaterThan(0);
      for (const piece of pic.pieces) {
        expect(ALLOWED_IDS.has(piece.id), `Piece id ${piece.id} allowed`).toBe(true);
        const entry = CATALOG.find((e) => e.id === piece.id);
        expect(entry, `Entry ${piece.id} exists in CATALOG`).toBeDefined();
        expect(['still', 'oscillator']).toContain(entry!.category);
      }
    });

    it('dances in place for 60 generations without exploding or leaking', () => {
      const points = introPoints(pic);
      expect(points.length).toBeGreaterThan(0);
      const initialCells = fromList(points);
      const initPop = initialCells.size;
      const initialSortedKeys = [...initialCells].sort((a, b) => a - b);

      const [initMinX, initMinY, initMaxX, initMaxY] = bounds(initialCells);
      const width = initMaxX - initMinX + 1;
      const height = initMaxY - initMinY + 1;

      // Picture dimensions roughly 30-60 wide and 20-40 tall
      expect(width).toBeGreaterThanOrEqual(25);
      expect(width).toBeLessThanOrEqual(65);
      expect(height).toBeGreaterThanOrEqual(18);
      expect(height).toBeLessThanOrEqual(45);

      let cells = initialCells;
      for (let gen = 1; gen <= 60; gen++) {
        cells = step(cells);

        // Population never exceeds 1.5x initial population
        expect(cells.size).toBeLessThanOrEqual(initPop * 1.5);

        // Bounding box stays within initial bounding box expanded by 3 cells
        const [bMinX, bMinY, bMaxX, bMaxY] = bounds(cells);
        expect(bMinX).toBeGreaterThanOrEqual(initMinX - 3);
        expect(bMinY).toBeGreaterThanOrEqual(initMinY - 3);
        expect(bMaxX).toBeLessThanOrEqual(initMaxX + 3);
        expect(bMaxY).toBeLessThanOrEqual(initMaxY + 3);

        // Asserts the cell set at gen 30 and gen 60 equals the initial set exactly
        if (gen === 30 || gen === 60) {
          const currentSortedKeys = [...cells].sort((a, b) => a - b);
          expect(currentSortedKeys).toEqual(initialSortedKeys);
        }
      }
    });
  });
});
