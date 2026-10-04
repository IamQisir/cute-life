import { keyX, keyY, type Cells } from '../life/engine';

export interface DotRaster {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number; height: number;
  x: number; y: number;
  pixelsPerCell: number;
}
export interface DotColour { outline: number; nucleus: number }
/** Pure RGBA rasteriser. Three samples/cell retain round ink edges and the coloured nucleus. */
export function rasterDots(cells: Cells, colour: (k: number) => DotColour, zoom: number, pixelsPerCell = 3): DotRaster {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of cells) {
    const x = keyX(k), y = keyY(k);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (!cells.size) return { data: new Uint8ClampedArray(4), width: 1, height: 1, x: 0, y: 0, pixelsPerCell };
  // drawDot's radii are .42 and .20 of its texture. Match the old 4.5px scale floor.
  // Stamp size is sampled once per generation; the Sprite follows the camera every frame.
  const size = Math.max(1, 4.5 / Math.max(zoom, 0.01));
  const radius = 0.42 * size * pixelsPerCell;
  const nucleus = 0.2 * size * pixelsPerCell;
  const pad = Math.ceil(radius / pixelsPerCell);
  const x0 = minX - pad, y0 = minY - pad;
  const width = (maxX - minX + 1 + pad * 2) * pixelsPerCell;
  const height = (maxY - minY + 1 + pad * 2) * pixelsPerCell;
  const data = new Uint8ClampedArray(width * height * 4);
  // All cell centres share the same subpixel phase. Build each palette's stamp once,
  // rather than doing hypot, edge coverage and colour mixing for every live cell.
  const phase = (pixelsPerCell / 2) % 1;
  const samples: { dx: number; dy: number; alpha: number; mix: number }[] = [];
  const extent = Math.ceil(radius + 1);
  for (let dy = -extent; dy <= extent; dy++) for (let dx = -extent; dx <= extent; dx++) {
    const distance = Math.hypot(dx + 0.5 - phase, dy + 0.5 - phase);
    const alpha = Math.min(1, Math.max(0, radius + 0.5 - distance));
    if (alpha) samples.push({ dx, dy, alpha, mix: Math.min(1, Math.max(0, nucleus + 0.5 - distance)) });
  }
  const stamps = new Map<number, { offsets: Int32Array; rgba: Uint8ClampedArray }>();
  for (const k of cells) {
    const cx = Math.floor((keyX(k) - x0 + 0.5) * pixelsPerCell);
    const cy = Math.floor((keyY(k) - y0 + 0.5) * pixelsPerCell);
    const ink = colour(k), id = ink.outline * 16777216 + ink.nucleus;
    let stamp = stamps.get(id);
    if (!stamp) {
      const offsets = new Int32Array(samples.length), rgba = new Uint8ClampedArray(samples.length * 4);
      for (let j = 0; j < samples.length; j++) {
        const sample = samples[j];
        offsets[j] = (sample.dy * width + sample.dx) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const shift = 16 - channel * 8;
          rgba[j * 4 + channel] = ((ink.outline >> shift) & 255) * (1 - sample.mix) + ((ink.nucleus >> shift) & 255) * sample.mix;
        }
        rgba[j * 4 + 3] = sample.alpha * 255;
      }
      stamp = { offsets, rgba }; stamps.set(id, stamp);
    }
    const base = (cy * width + cx) * 4;
    for (let j = 0; j < stamp.offsets.length; j++) {
      const i = base + stamp.offsets[j], source = j * 4;
      if (i < 0 || i + 3 >= data.length) continue;
      const alpha = stamp.rgba[source + 3];
      if (alpha === 255 || data[i + 3] === 0) {
        data[i] = stamp.rgba[source]; data[i + 1] = stamp.rgba[source + 1]; data[i + 2] = stamp.rgba[source + 2];
        data[i + 3] = alpha;
      } else {
        const a = alpha / 255, old = data[i + 3] / 255 * (1 - a), out = a + old;
        data[i] = (stamp.rgba[source] * a + data[i] * old) / out;
        data[i + 1] = (stamp.rgba[source + 1] * a + data[i + 1] * old) / out;
        data[i + 2] = (stamp.rgba[source + 2] * a + data[i + 2] * old) / out;
        data[i + 3] = out * 255;
      }
    }
  }
  return { data, width, height, x: x0, y: y0, pixelsPerCell };
}
