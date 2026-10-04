import { CATALOG } from './catalog';

/** One catalog still life / oscillator placed with its top-left corner at (x, y). rot = quarter turns clockwise. */
export interface IntroPiece {
  id: string;
  x: number;
  y: number;
  rot?: 0 | 1 | 2 | 3;
}

export interface IntroPicture {
  name: string;
  pieces: IntroPiece[];
}

export const INTRO_PICTURES: IntroPicture[] = [
  // 1. "smiley" - pulsing eyes, cheerful smile, and rounded face outline
  {
    name: 'smiley',
    pieces: [
      // Top face outline
      { id: 'tub', x: 14, y: 0 },
      { id: 'beehive', x: 21, y: 0 },
      { id: 'tub', x: 29, y: 0 },
      { id: 'beehive', x: 7, y: 1 },
      { id: 'beehive', x: 35, y: 1 },

      // Left cheek outline
      { id: 'beehive', x: 2, y: 7, rot: 1 },
      { id: 'tub', x: 1, y: 14 },
      { id: 'beehive', x: 2, y: 21, rot: 1 },

      // Right cheek outline
      { id: 'beehive', x: 41, y: 7, rot: 1 },
      { id: 'tub', x: 42, y: 14 },
      { id: 'beehive', x: 41, y: 21, rot: 1 },

      // Eyes (two pulsing period-3 pulsars)
      { id: 'pulsar', x: 8, y: 7 },
      { id: 'pulsar', x: 25, y: 7 },

      // Smile arc (blocks and blinkers with ample clearance from pulsing eyes)
      { id: 'block', x: 9, y: 24 },
      { id: 'blinker', x: 14, y: 27, rot: 0 },
      { id: 'block', x: 19, y: 28 },
      { id: 'block', x: 25, y: 28 },
      { id: 'blinker', x: 30, y: 27, rot: 0 },
      { id: 'block', x: 35, y: 24 },

      // Bottom face outline
      { id: 'beehive', x: 7, y: 30 },
      { id: 'beehive', x: 35, y: 30 },
      { id: 'tub', x: 14, y: 33 },
      { id: 'beehive', x: 21, y: 33 },
      { id: 'tub', x: 29, y: 33 },
    ],
  },

  // 2. "heart" - heart silhouette with beating beacon and toad inside
  {
    name: 'heart',
    pieces: [
      // Top left lobe
      { id: 'beehive', x: 7, y: 1 },
      { id: 'loaf', x: 13, y: 1 },
      { id: 'boat', x: 2, y: 4 },
      { id: 'beehive', x: 1, y: 9, rot: 1 },

      // Top right lobe
      { id: 'loaf', x: 21, y: 1, rot: 1 },
      { id: 'beehive', x: 27, y: 1 },
      { id: 'boat', x: 33, y: 4, rot: 1 },
      { id: 'beehive', x: 34, y: 9, rot: 1 },

      // Center dip
      { id: 'tub', x: 17, y: 7 },

      // Left tapering curve
      { id: 'block', x: 2, y: 15 },
      { id: 'loaf', x: 5, y: 19 },
      { id: 'beehive', x: 10, y: 24, rot: 1 },
      { id: 'boat', x: 14, y: 29 },

      // Right tapering curve
      { id: 'block', x: 33, y: 15 },
      { id: 'loaf', x: 29, y: 19, rot: 2 },
      { id: 'beehive', x: 25, y: 24, rot: 1 },
      { id: 'boat', x: 21, y: 29, rot: 3 },

      // Bottom tip
      { id: 'tub', x: 17, y: 34 },

      // Beating heart center (oscillators)
      { id: 'beacon', x: 11, y: 11 },
      { id: 'beacon', x: 23, y: 11 },
      { id: 'toad', x: 17, y: 18 },
    ],
  },

  // 3. "flower" - large pulsar blossom with petals, leafy stem, and pot
  {
    name: 'flower',
    pieces: [
      // Blossom petals (top, sides, corners)
      { id: 'beehive', x: 16, y: 1 },
      { id: 'loaf', x: 5, y: 3 },
      { id: 'loaf', x: 28, y: 3, rot: 1 },
      { id: 'beehive', x: 4, y: 11, rot: 1 },
      { id: 'beehive', x: 30, y: 11, rot: 1 },
      { id: 'tub', x: 5, y: 18 },
      { id: 'tub', x: 29, y: 18 },

      // Center blossom (pulsar with 3+ rows of clearance from petals)
      { id: 'pulsar', x: 12, y: 7 },

      // Stem (blinker and block chain)
      { id: 'blinker', x: 18, y: 23, rot: 1 },
      { id: 'block', x: 17, y: 28 },
      { id: 'blinker', x: 18, y: 32, rot: 1 },

      // Leaves
      { id: 'boat', x: 11, y: 27 },
      { id: 'boat', x: 22, y: 29, rot: 2 },

      // Pot / ground line
      { id: 'tub', x: 2, y: 37 },
      { id: 'beehive', x: 7, y: 37 },
      { id: 'block', x: 13, y: 37 },
      { id: 'beehive', x: 17, y: 37 },
      { id: 'block', x: 23, y: 37 },
      { id: 'beehive', x: 27, y: 37 },
      { id: 'tub', x: 33, y: 37 },
    ],
  },

  // 4. "hi" - friendly greeting spelled in blocks and blinkers with sparkling oscillators
  {
    name: 'hi',
    pieces: [
      // Letter H - left stroke
      { id: 'block', x: 3, y: 2 },
      { id: 'blinker', x: 3, y: 7, rot: 1 },
      { id: 'block', x: 3, y: 12 },
      { id: 'blinker', x: 3, y: 16, rot: 1 },
      { id: 'block', x: 3, y: 21 },

      // Letter H - crossbar
      { id: 'blinker', x: 7, y: 12, rot: 0 },
      { id: 'blinker', x: 12, y: 12, rot: 0 },

      // Letter H - right stroke
      { id: 'block', x: 17, y: 2 },
      { id: 'blinker', x: 17, y: 7, rot: 1 },
      { id: 'block', x: 17, y: 12 },
      { id: 'blinker', x: 17, y: 16, rot: 1 },
      { id: 'block', x: 17, y: 21 },

      // Letter I - top serif
      { id: 'blinker', x: 23, y: 2, rot: 0 },

      // Letter I - stem
      { id: 'block', x: 24, y: 7 },
      { id: 'blinker', x: 24, y: 12, rot: 1 },
      { id: 'block', x: 24, y: 17 },

      // Letter I - bottom serif
      { id: 'blinker', x: 23, y: 22, rot: 0 },

      // Exclamation point - stick
      { id: 'block', x: 30, y: 2 },
      { id: 'blinker', x: 30, y: 7, rot: 1 },
      { id: 'block', x: 30, y: 12 },

      // Exclamation point - dot
      { id: 'tub', x: 30, y: 19 },

      // Decorative animated stars below
      { id: 'beacon', x: 8, y: 25 },
      { id: 'clock', x: 19, y: 25 },
      { id: 'toad', x: 30, y: 25 },
    ],
  },

  // 5. "cat face" - pointed ears, blinking eyes, twitching whiskers, and chin
  {
    name: 'cat face',
    pieces: [
      // Left ear
      { id: 'boat', x: 6, y: 1 },
      { id: 'loaf', x: 3, y: 6 },
      { id: 'block', x: 9, y: 7 },

      // Right ear
      { id: 'boat', x: 29, y: 1, rot: 1 },
      { id: 'block', x: 26, y: 7 },
      { id: 'loaf', x: 30, y: 6, rot: 1 },

      // Forehead
      { id: 'beehive', x: 17, y: 5 },

      // Blinking eyes (toads)
      { id: 'toad', x: 9, y: 12 },
      { id: 'toad', x: 25, y: 12 },

      // Nose
      { id: 'tub', x: 17, y: 15 },

      // Left whiskers (blinkers)
      { id: 'blinker', x: 1, y: 13, rot: 0 },
      { id: 'blinker', x: 2, y: 18, rot: 0 },
      { id: 'blinker', x: 1, y: 23, rot: 0 },

      // Right whiskers (blinkers)
      { id: 'blinker', x: 34, y: 13, rot: 0 },
      { id: 'blinker', x: 33, y: 18, rot: 0 },
      { id: 'blinker', x: 34, y: 23, rot: 0 },

      // Mouth
      { id: 'block', x: 13, y: 20 },
      { id: 'tub', x: 17, y: 21 },
      { id: 'block', x: 22, y: 20 },

      // Chin / cheeks outline
      { id: 'beehive', x: 8, y: 25 },
      { id: 'beehive', x: 16, y: 27 },
      { id: 'beehive', x: 25, y: 25 },
    ],
  },

  // 6. "house" - cottage with gabled roof, chimney smoke, and lit windows
  {
    name: 'house',
    pieces: [
      // Chimney & smoke
      { id: 'block', x: 28, y: 0 },
      { id: 'blinker', x: 33, y: 0, rot: 0 },

      // Roof ridge & slope
      { id: 'tub', x: 18, y: 1 },
      { id: 'boat', x: 13, y: 4 },
      { id: 'loaf', x: 8, y: 8 },
      { id: 'beehive', x: 3, y: 12 },
      { id: 'block', x: 0, y: 16 },

      { id: 'boat', x: 23, y: 4, rot: 1 },
      { id: 'loaf', x: 27, y: 8, rot: 1 },
      { id: 'beehive', x: 32, y: 12 },
      { id: 'block', x: 37, y: 16 },

      // Walls
      { id: 'block', x: 4, y: 19 },
      { id: 'beehive', x: 3, y: 23, rot: 1 },
      { id: 'block', x: 4, y: 29 },

      { id: 'block', x: 33, y: 19 },
      { id: 'beehive', x: 33, y: 23, rot: 1 },
      { id: 'block', x: 33, y: 29 },

      // Windows (glowing clock and beacon)
      { id: 'clock', x: 9, y: 18 },
      { id: 'beacon', x: 26, y: 18 },

      // Door
      { id: 'eater1', x: 17, y: 20 },
      { id: 'block', x: 18, y: 27 },

      // Ground lawn
      { id: 'block', x: 1, y: 33 },
      { id: 'tub', x: 8, y: 33 },
      { id: 'pond', x: 16, y: 33 },
      { id: 'tub', x: 28, y: 33 },
      { id: 'block', x: 36, y: 33 },
    ],
  },

  // 7. "mushroom" - polka-dot mushroom with dancing spores and stem
  {
    name: 'mushroom',
    pieces: [
      // Cap dome top
      { id: 'beehive', x: 15, y: 1 },
      { id: 'beehive', x: 22, y: 1 },

      // Cap shoulders
      { id: 'loaf', x: 9, y: 3 },
      { id: 'loaf', x: 28, y: 3, rot: 1 },

      // Cap sides
      { id: 'boat', x: 3, y: 6 },
      { id: 'boat', x: 35, y: 6, rot: 1 },
      { id: 'block', x: 1, y: 12 },
      { id: 'block', x: 38, y: 12 },

      // Cap spots (animated oscillators)
      { id: 'blinker', x: 8, y: 10, rot: 0 },
      { id: 'beacon', x: 18, y: 7 },
      { id: 'blinker', x: 28, y: 10, rot: 0 },

      // Underside skirt
      { id: 'beehive', x: 3, y: 16 },
      { id: 'tub', x: 9, y: 15 },
      { id: 'tub', x: 29, y: 15 },
      { id: 'beehive', x: 34, y: 16 },

      // Stalk
      { id: 'block', x: 14, y: 20 },
      { id: 'blinker', x: 14, y: 24, rot: 1 },
      { id: 'block', x: 14, y: 29 },

      { id: 'block', x: 25, y: 20 },
      { id: 'blinker', x: 25, y: 24, rot: 1 },
      { id: 'block', x: 25, y: 29 },

      { id: 'clock', x: 18, y: 23 },

      // Forest floor
      { id: 'tub', x: 2, y: 26 },
      { id: 'block', x: 2, y: 32 },
      { id: 'tub', x: 8, y: 33 },
      { id: 'beehive', x: 18, y: 33 },
      { id: 'boat', x: 31, y: 33 },
    ],
  },
];

function piecePoints(piece: IntroPiece): [number, number][] {
  const entry = CATALOG.find((e) => e.id === piece.id);
  if (!entry) throw new Error(`Unknown catalog pattern id: ${piece.id}`);
  const h = entry.rows.length;
  const w = Math.max(...entry.rows.map((r) => r.length));
  const rot = ((piece.rot ?? 0) % 4) as 0 | 1 | 2 | 3;
  const points: [number, number][] = [];
  for (let r = 0; r < h; r++) {
    const row = entry.rows[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'O') {
        let xRel = c;
        let yRel = r;
        if (rot === 1) {
          xRel = h - 1 - r;
          yRel = c;
        } else if (rot === 2) {
          xRel = w - 1 - c;
          yRel = h - 1 - r;
        } else if (rot === 3) {
          xRel = r;
          yRel = w - 1 - c;
        }
        points.push([piece.x + xRel, piece.y + yRel]);
      }
    }
  }
  return points;
}

/** Live cells of a picture, centred so the picture's bounding box centre is near (0, 0). */
export function introPoints(pic: IntroPicture): [number, number][] {
  const pts: [number, number][] = [];
  for (const piece of pic.pieces) {
    pts.push(...piecePoints(piece));
  }
  if (!pts.length) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const cx = Math.floor((minX + maxX) / 2);
  const cy = Math.floor((minY + maxY) / 2);

  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const [x, y] of pts) {
    const ox = x - cx;
    const oy = y - cy;
    const k = `${ox},${oy}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([ox, oy]);
    }
  }
  return out;
}

/** A random picture; rand defaults to Math.random. */
export function pickIntroPicture(rand: () => number = Math.random): IntroPicture {
  if (INTRO_PICTURES.length === 0) {
    throw new Error('No intro pictures defined');
  }
  const r = rand();
  const index = Math.min(Math.floor(r * INTRO_PICTURES.length), INTRO_PICTURES.length - 1);
  return INTRO_PICTURES[Math.max(0, index)];
}
