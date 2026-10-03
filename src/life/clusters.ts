import { fromList, key, keyX, keyY, step, toList, type Cells } from './engine';

export type Kind = 'block' | 'beehive' | 'loaf' | 'boat' | 'tub' | 'ship' | 'pond'
  | 'blinker' | 'toad' | 'beacon' | 'glider' | 'lwss' | 'blob';
export type Family = 'still' | 'oscillator' | 'spaceship' | 'blob';

export const FAMILY: Record<Kind, Family> = {
  block: 'still',
  beehive: 'still',
  loaf: 'still',
  boat: 'still',
  tub: 'still',
  ship: 'still',
  pond: 'still',
  blinker: 'oscillator',
  toad: 'oscillator',
  beacon: 'oscillator',
  glider: 'spaceship',
  lwss: 'spaceship',
  blob: 'blob',
};

export interface Cluster {
  cells: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  kind: Kind;
  family: Family;
  heading: [number, number];
}

type Match = { kind: Kind; heading: [number, number] };

function normalise(points: [number, number][]): string {
  const minX = Math.min(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  return points.map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([x, y]) => `${x},${y}`).join(';');
}

function neighborOffsets(reach: number): number[] {
  const stride = key(1, 0) - key(0, 0);
  const offsets: number[] = [];
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dy = -reach; dy <= reach; dy++) {
      if (dx || dy) offsets.push(dx * stride + dy);
    }
  }
  return offsets;
}

function takeComponent(remaining: Cells, start: number, offsets: number[]): number[] {
  remaining.delete(start);
  const component = [start];
  for (let i = 0; i < component.length; i++) {
    const k = component[i];
    for (let j = 0; j < offsets.length; j++) {
      const neighbor = k + offsets[j];
      if (remaining.delete(neighbor)) component.push(neighbor);
    }
  }
  return component;
}

function buildLookup(): Map<string, Match> {
  const seeds: [Kind, string[], number][] = [
    ['block', ['OO', 'OO'], 1],
    ['beehive', ['.OO.', 'O..O', '.OO.'], 1],
    ['loaf', ['.OO.', 'O..O', '.O.O', '..O.'], 1],
    ['boat', ['OO.', 'O.O', '.O.'], 1],
    ['tub', ['.O.', 'O.O', '.O.'], 1],
    ['ship', ['OO.', 'O.O', '.OO'], 1],
    ['pond', ['.OO.', 'O..O', 'O..O', '.OO.'], 1],
    ['blinker', ['OOO'], 2],
    ['toad', ['.OOO', 'OOO.'], 2],
    ['beacon', ['OO..', 'OO..', '..OO', '..OO'], 2],
    ['glider', ['.O.', '..O', 'OOO'], 4],
    ['lwss', ['.O..O', 'O....', 'O...O', 'OOOO'], 4],
  ];
  const lookup = new Map<string, Match>();
  const offsets = neighborOffsets(2);
  for (const [kind, rows, period] of seeds) {
    const seed: [number, number][] = [];
    rows.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === 'O') seed.push([x, y]);
      });
    });
    let phase = fromList(seed);
    for (let i = 0; i < period; i++) {
      const remaining = new Set(phase);
      takeComponent(remaining, remaining.values().next().value!, offsets);
      // Disconnected phases are omitted; all listed phases form one reach-2 group.
      if (remaining.size) {
        phase = step(phase);
        continue;
      }
      for (let mirror = 0; mirror < 2; mirror++) {
        for (let rotation = 0; rotation < 4; rotation++) {
          const points = toList(phase).map(([x, y]): [number, number] => {
            if (mirror) x = -x;
            for (let r = 0; r < rotation; r++) [x, y] = [-y, x];
            return [x, y];
          });
          let future = fromList(points);
          for (let t = 0; t < period; t++) future = step(future);
          const moved = toList(future);
          const heading: [number, number] = FAMILY[kind] === 'spaceship' ? [
            Math.sign(Math.min(...moved.map(([x]) => x)) - Math.min(...points.map(([x]) => x))),
            Math.sign(Math.min(...moved.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y))),
          ] : [0, 0];
          lookup.set(normalise(points), { kind, heading });
        }
      }
      phase = step(phase);
    }
  }
  return lookup;
}

const LOOKUP = buildLookup();

export function classify(points: [number, number][]): Match {
  if (points.length < 3 || points.length > 16) return { kind: 'blob', heading: [0, 0] };
  const match = LOOKUP.get(normalise(points));
  return match ? { kind: match.kind, heading: [...match.heading] }
    : { kind: 'blob', heading: [0, 0] };
}

export function findClusters(cells: Cells, reach = 2): Cluster[] {
  if (!Number.isInteger(reach) || reach < 0) {
    throw new RangeError('reach must be a non-negative integer');
  }
  const remaining = new Set(cells);
  const clusters: Cluster[] = [];
  const offsets = neighborOffsets(reach);
  for (const start of remaining) {
    const component = takeComponent(remaining, start, offsets);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < component.length; i++) {
      const k = component[i];
      const x = keyX(k);
      const y = keyY(k);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
    }
    const match: Match = component.length < 3 || component.length > 16
      ? { kind: 'blob', heading: [0, 0] }
      : classify(component.map((k) => [keyX(k), keyY(k)]));
    clusters.push({
      cells: component,
      minX, minY, maxX, maxY,
      cx: sumX / component.length + 0.5,
      cy: sumY / component.length + 0.5,
      kind: match.kind,
      family: FAMILY[match.kind],
      heading: match.heading,
    });
  }
  return clusters;
}
