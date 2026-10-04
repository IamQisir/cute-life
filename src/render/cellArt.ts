// Procedural "colored pencil" cell drawings. Everything is drawn once into
// small canvases that become textures; later these can be swapped for
// AI-generated body art while the faces stay procedural.

export type Mood = 'happy' | 'blink' | 'lonely' | 'crowded' | 'fading';

export const MOODS: Mood[] = ['happy', 'blink', 'lonely', 'crowded', 'fading'];

export interface Palette {
  body: string;
  hatch: string;
  outline: string;
  nucleus: string;
  blush: string;
}

export const PALETTES: Palette[] = [
  { body: '#cdeee0', hatch: '#7fcfae', outline: '#3f7f6a', nucleus: '#5fb894', blush: '#f4a7a7' },
  { body: '#d9ecf7', hatch: '#8cc3e6', outline: '#406f93', nucleus: '#6aa8d6', blush: '#f4a7b9' },
  { body: '#f6e6c8', hatch: '#e8bb73', outline: '#8a6436', nucleus: '#dca04f', blush: '#f29a8a' },
  { body: '#ecdff4', hatch: '#c3a3dd', outline: '#6b4f88', nucleus: '#a983cc', blush: '#f4a2c0' },
];

/** Team colours for battles: warm red vs cool blue. */
export const TEAM_PALETTES: Record<1 | 2, Palette> = {
  1: { body: '#f9d6cc', hatch: '#ee8f7b', outline: '#9c3b2c', nucleus: '#e2654f', blush: '#f29a8a' },
  2: { body: '#d4e0f7', hatch: '#86a3e2', outline: '#304c8c', nucleus: '#5f86d6', blush: '#f4a7b9' },
};

export const TEX_SIZE = 128;
const INK = '#3b302a';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A slightly lumpy circle: radius varies with a few low harmonics. */
function blobPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rand: () => number, lump = 0.06) {
  const a1 = rand() * Math.PI * 2;
  const a2 = rand() * Math.PI * 2;
  const steps = 48;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rr = r * (1 + lump * Math.sin(2 * t + a1) + lump * 0.6 * Math.sin(3 * t + a2));
    const x = cx + Math.cos(t) * rr;
    const y = cy + Math.sin(t) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Diagonal pencil hatching inside the current clip. */
function hatch(ctx: CanvasRenderingContext2D, size: number, color: string, gap: number, rand: () => number, alpha = 0.5) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let o = -size; o < size * 2; o += gap * (0.8 + rand() * 0.4)) {
    ctx.globalAlpha = alpha * (0.6 + rand() * 0.4);
    ctx.lineWidth = 1 + rand() * 1.2;
    ctx.beginPath();
    ctx.moveTo(o, size);
    ctx.lineTo(o + size * (0.9 + rand() * 0.2), 0);
    ctx.stroke();
  }
  ctx.restore();
}

/** Pencil outline: the same path stroked twice with a little jitter. */
function pencilStroke(ctx: CanvasRenderingContext2D, draw: (jx: number, jy: number) => void, color: string, width: number, rand: () => number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = pass === 0 ? 0.9 : 0.45;
    ctx.lineWidth = pass === 0 ? width : width * 0.7;
    draw((rand() - 0.5) * 1.6, (rand() - 0.5) * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

function newCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  return [c, c.getContext('2d')!];
}

/** Body without a face: membrane, cilia, nucleus, organelles. */
function drawBody(ctx: CanvasRenderingContext2D, p: Palette, seed: number) {
  const rand = rng(seed);
  const S = TEX_SIZE;
  const c = S / 2;
  const r = S * 0.36;

  // Cilia: short curved hairs around the membrane.
  ctx.save();
  ctx.strokeStyle = p.outline;
  ctx.lineCap = 'round';
  const hairs = 14;
  for (let i = 0; i < hairs; i++) {
    const t = (i / hairs) * Math.PI * 2 + rand() * 0.2;
    const r0 = r * 1.02;
    const r1 = r * (1.15 + rand() * 0.08);
    const bend = (rand() - 0.5) * 0.25;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(t) * r0, c + Math.sin(t) * r0);
    ctx.quadraticCurveTo(
      c + Math.cos(t + bend) * (r0 + r1) / 2, c + Math.sin(t + bend) * (r0 + r1) / 2,
      c + Math.cos(t + bend * 2) * r1, c + Math.sin(t + bend * 2) * r1,
    );
    ctx.stroke();
  }
  ctx.restore();

  // Membrane fill + hatching.
  const bodySeed = rand() * 1e9;
  blobPath(ctx, c, c, r, rng(bodySeed));
  ctx.fillStyle = p.body;
  ctx.fill();
  ctx.save();
  blobPath(ctx, c, c, r, rng(bodySeed));
  ctx.clip();
  hatch(ctx, S, p.hatch, 5, rand, 0.45);
  // Soft inner rim, like a cell wall seen through a microscope.
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 7;
  ctx.strokeStyle = p.hatch;
  blobPath(ctx, c, c, r, rng(bodySeed));
  ctx.stroke();
  ctx.restore();

  // Nucleus, tucked up and to one side so the face has room.
  const nx = c + r * (0.28 + rand() * 0.12) * (rand() < 0.5 ? -1 : 1);
  const ny = c - r * 0.42;
  const nr = r * 0.26;
  const nSeed = rand() * 1e9;
  blobPath(ctx, nx, ny, nr, rng(nSeed), 0.1);
  ctx.fillStyle = p.nucleus;
  ctx.globalAlpha = 0.75;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save();
  blobPath(ctx, nx, ny, nr, rng(nSeed), 0.1);
  ctx.clip();
  hatch(ctx, S, p.outline, 4, rand, 0.25);
  ctx.restore();
  pencilStroke(ctx, (jx, jy) => blobPath(ctx, nx + jx, ny + jy, nr, rng(nSeed), 0.1), p.outline, 1.6, rand);
  // Nucleolus highlight.
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(nx - nr * 0.3, ny - nr * 0.3, nr * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // A couple of tiny organelles.
  for (let i = 0; i < 2; i++) {
    const ox = c + (rand() - 0.5) * r * 1.1;
    const oy = c + r * (0.45 + rand() * 0.15);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(rand() * Math.PI);
    ctx.strokeStyle = p.outline;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.09, r * 0.05, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Membrane outline on top.
  pencilStroke(ctx, (jx, jy) => blobPath(ctx, c + jx, c + jy, r, rng(bodySeed)), p.outline, 2.4, rand);
}

function eyeDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lookX = 0, lookY = 0) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x + lookX, y + lookY, r * 0.85, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + lookX - r * 0.3, y + lookY - r * 0.35, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, pts: number[], width = 2.2, color = INK) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
  ctx.restore();
}

function blush(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, r: number, alpha = 0.7) {
  ctx.save();
  ctx.fillStyle = p.blush;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFace(ctx: CanvasRenderingContext2D, p: Palette, mood: Mood) {
  const S = TEX_SIZE;
  const c = S / 2;
  const ey = c + S * 0.04;
  const ex = S * 0.1;
  const er = S * 0.035;
  const my = ey + S * 0.075;

  switch (mood) {
    case 'happy':
      eyeDot(ctx, c - ex, ey, er);
      eyeDot(ctx, c + ex, ey, er);
      blush(ctx, p, c - ex * 1.75, ey + S * 0.045, S * 0.04);
      blush(ctx, p, c + ex * 1.75, ey + S * 0.045, S * 0.04);
      // Little "w" mouth.
      line(ctx, [c - 6, my - 1, c - 3, my + 2, c, my - 1, c + 3, my + 2, c + 6, my - 1], 2);
      break;
    case 'blink':
      line(ctx, [c - ex - 5, ey, c - ex, ey + 3, c - ex + 5, ey], 2.4);
      line(ctx, [c + ex - 5, ey, c + ex, ey + 3, c + ex + 5, ey], 2.4);
      blush(ctx, p, c - ex * 1.75, ey + S * 0.045, S * 0.04);
      blush(ctx, p, c + ex * 1.75, ey + S * 0.045, S * 0.04);
      line(ctx, [c - 6, my - 1, c - 3, my + 2, c, my - 1, c + 3, my + 2, c + 6, my - 1], 2);
      break;
    case 'lonely': {
      // Big watery eyes glancing sideways, worried brows, a tear.
      const look = -er * 0.5;
      eyeDot(ctx, c - ex, ey, er * 1.2, look, 0);
      eyeDot(ctx, c + ex, ey, er * 1.2, look, 0);
      line(ctx, [c - ex - 6, ey - 9, c - ex + 4, ey - 12], 1.8);
      line(ctx, [c + ex - 4, ey - 12, c + ex + 6, ey - 9], 1.8);
      ctx.save();
      ctx.fillStyle = '#9fd3f5';
      ctx.strokeStyle = '#4b8fc2';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(c + ex + 3, ey + 5);
      ctx.quadraticCurveTo(c + ex + 8, ey + 13, c + ex + 3, ey + 15);
      ctx.quadraticCurveTo(c + ex - 2, ey + 13, c + ex + 3, ey + 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // Small wobbly frown.
      line(ctx, [c - 5, my + 2, c - 2, my, c + 1, my + 1, c + 5, my + 2], 2);
      break;
    }
    case 'crowded': {
      // >< eyes, wavy mouth, sweat drops.
      line(ctx, [c - ex - 5, ey - 4, c - ex + 3, ey, c - ex - 5, ey + 4], 2.4);
      line(ctx, [c + ex + 5, ey - 4, c + ex - 3, ey, c + ex + 5, ey + 4], 2.4);
      line(ctx, [c - 7, my + 1, c - 4, my - 2, c - 1, my + 1, c + 2, my - 2, c + 5, my + 1, c + 7, my - 1], 1.8);
      blush(ctx, p, c - ex * 1.75, ey + S * 0.05, S * 0.045, 0.9);
      blush(ctx, p, c + ex * 1.75, ey + S * 0.05, S * 0.045, 0.9);
      ctx.save();
      ctx.fillStyle = '#bfe6fb';
      ctx.strokeStyle = '#4b8fc2';
      ctx.lineWidth = 1.2;
      for (const [sx, sy] of [[c + S * 0.25, c - S * 0.17], [c - S * 0.27, c - S * 0.1]]) {
        ctx.beginPath();
        ctx.moveTo(sx, sy - 6);
        ctx.quadraticCurveTo(sx + 5, sy + 2, sx, sy + 4);
        ctx.quadraticCurveTo(sx - 5, sy + 2, sx, sy - 6);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'fading':
      // Peaceful closed eyes, tiny "o" sigh.
      line(ctx, [c - ex - 5, ey + 1, c - ex, ey - 2, c - ex + 5, ey + 1], 2.2);
      line(ctx, [c + ex - 5, ey + 1, c + ex, ey - 2, c + ex + 5, ey + 1], 2.2);
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(c, my + 1, 2.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
  }
}

export function drawCell(palette: Palette, seed: number, mood: Mood | null): HTMLCanvasElement {
  const [canvas, ctx] = newCanvas();
  drawBody(ctx, palette, seed);
  if (mood) drawFace(ctx, palette, mood);
  return canvas;
}

/** Just the face, on a transparent canvas: organisms wear these. */
export function drawFaceOnly(palette: Palette, mood: Mood, res = 1): HTMLCanvasElement {
  // `res` draws at a higher resolution for faces shown large (organisms).
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX_SIZE * res;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(res, res);
  drawFace(ctx, palette, mood);
  return canvas;
}

/** Tileable diagonal pencil hatching, laid over organism membranes. */
export function drawHatch(size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const rand = rng(11);
  ctx.strokeStyle = '#5a4632';
  ctx.lineCap = 'round';
  for (let o = -size; o < size * 2; o += 6) {
    ctx.globalAlpha = 0.1 + rand() * 0.08;
    ctx.lineWidth = 1 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(o, size);
    ctx.lineTo(o + size, 0);
    ctx.stroke();
  }
  return c;
}

/**
 * A little pencil flower for garden squares. Petals are drawn white so a sprite
 * tint colours them in (team colour once painted, pale paper while unclaimed).
 */
export function drawFlower(): HTMLCanvasElement {
  const [canvas, ctx] = newCanvas();
  const rand = rng(23);
  const c = TEX_SIZE / 2;
  const petals = 5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2 + (rand() - 0.5) * 0.15;
    const px = c + Math.cos(a) * TEX_SIZE * 0.17;
    const py = c + Math.sin(a) * TEX_SIZE * 0.17;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, TEX_SIZE * 0.15, TEX_SIZE * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(70, 55, 40, 0.75)';
    ctx.stroke();
    ctx.restore();
  }
  return canvas;
}

/** The flower's yellow centre, drawn separately so it isn't tinted with the petals. */
export function drawFlowerCentre(): HTMLCanvasElement {
  const [canvas, ctx] = newCanvas();
  const c = TEX_SIZE / 2;
  ctx.beginPath();
  ctx.arc(c, c, TEX_SIZE * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#f2c14e';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(70, 55, 40, 0.8)';
  ctx.stroke();
  return canvas;
}

/** A handwritten "z" for sleepers. */
export function drawZ(): HTMLCanvasElement {
  const [canvas, ctx] = newCanvas();
  const c = TEX_SIZE / 2;
  line(ctx, [c - 14, c - 14, c + 14, c - 16, c - 14, c + 14, c + 15, c + 13], 5, '#7a6a5c');
  return canvas;
}

/** A little music note for dancers. */
export function drawNote(): HTMLCanvasElement {
  const [canvas, ctx] = newCanvas();
  const c = TEX_SIZE / 2;
  ctx.fillStyle = '#c4483a';
  ctx.beginPath();
  ctx.ellipse(c - 8, c + 16, 10, 7, -0.4, 0, Math.PI * 2);
  ctx.fill();
  line(ctx, [c + 1, c + 14, c + 1, c - 24, c + 16, c - 12], 4.5, '#c4483a');
  return canvas;
}

/** A dotted pencil ring with a sparkle: "something is about to be born here". */
export function drawBud(): HTMLCanvasElement {
  const [canvas, ctx] = newCanvas();
  const rand = rng(7);
  const c = TEX_SIZE / 2;
  const r = TEX_SIZE * 0.2;
  ctx.strokeStyle = '#8a7a6a';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  const dashes = 12;
  for (let i = 0; i < dashes; i++) {
    const t = (i / dashes) * Math.PI * 2 + rand() * 0.1;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(c, c, r, t, t + 0.28);
    ctx.stroke();
  }
  // Sparkle.
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#e0a640';
  ctx.lineWidth = 2.4;
  const s = 7;
  line(ctx, [c - s, c, c + s, c], 2.4, '#e0a640');
  line(ctx, [c, c - s, c, c + s], 2.4, '#e0a640');
  return canvas;
}

/** Simple filled dot used when zoomed far out. */
export function drawDot(palette: Palette): HTMLCanvasElement {
  const [canvas, ctx] = newCanvas();
  const c = TEX_SIZE / 2;
  ctx.fillStyle = palette.hatch;
  ctx.beginPath();
  ctx.arc(c, c, TEX_SIZE * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.nucleus;
  ctx.beginPath();
  ctx.arc(c + TEX_SIZE * 0.08, c - TEX_SIZE * 0.08, TEX_SIZE * 0.14, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** Warm paper with fibres and speckles; tiles seamlessly enough at low contrast. */
export function drawPaper(size = 512): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const rand = rng(42);
  ctx.fillStyle = '#f2ece0';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#b8a890';
  for (let i = 0; i < 260; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * Math.PI;
    const l = 4 + rand() * 14;
    ctx.globalAlpha = 0.05 + rand() * 0.08;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return c;
}

/** Same seeded RNG, exported for render-time variation. */
export { rng };
