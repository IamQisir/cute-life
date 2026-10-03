import { Container, Graphics, type Texture, TilingSprite } from 'pixi.js';
import { keyX, keyY } from '../life/engine';
import type { Sim } from '../sim';
import type { Camera } from './camera';
import { MOODS, type Mood, PALETTES, TEX_SIZE, drawBud, drawCell, drawDot, drawPaper } from './cellArt';
import { OrganismView } from './organisms';
import { SpritePool, cellHash, tex } from './util';

export { cellHash };

const VARIANTS_PER_PALETTE = 2;
const NONE: never[] = [];
// Semantic zoom: individual cells up close, organisms in the middle, dots far away.
/** Organisms fade in below FADE_HI and fully replace cells below FADE_LO. */
const FADE_LO = 13;
const FADE_HI = 17;
/** Below this, organisms are too small to read: plain coloured dots. */
const DOT_ZOOM = 4;
const GRID_ZOOM = 9;

const easeOutBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface Textures {
  faces: Record<Mood, Texture>[];
  dots: Texture[];
  bud: Texture;
}

function buildTextures(): Textures {
  const faces: Record<Mood, Texture>[] = [];
  const dots: Texture[] = [];
  PALETTES.forEach((p, pi) => {
    for (let v = 0; v < VARIANTS_PER_PALETTE; v++) {
      const seed = 1000 + pi * 97 + v * 13;
      const set = {} as Record<Mood, Texture>;
      for (const m of MOODS) set[m] = tex(drawCell(p, seed, m));
      faces.push(set);
      dots.push(tex(drawDot(p)));
    }
  });
  return { faces, dots, bud: tex(drawBud()) };
}

export interface StampPreview {
  points: [number, number][];
}

export class WorldView {
  readonly root = new Container();
  private paper: TilingSprite;
  private creases = new Graphics();
  private grid = new Graphics();
  private budPool: SpritePool;
  private cellPool: SpritePool;
  private fadePool: SpritePool;
  private stampPool: SpritePool;
  private tx = buildTextures();
  private gridSig = '';
  private cellsRoot = new Container();
  private organisms = new OrganismView();

  constructor() {
    this.paper = new TilingSprite({ texture: tex(drawPaper()), width: 1, height: 1 });
    const budLayer = new Container();
    const cellLayer = new Container();
    const fadeLayer = new Container();
    const stampLayer = new Container();
    this.cellsRoot.addChild(budLayer, fadeLayer, cellLayer);
    this.root.addChild(this.paper, this.creases, this.grid, this.organisms.root, this.cellsRoot, stampLayer);
    this.budPool = new SpritePool(budLayer);
    this.cellPool = new SpritePool(cellLayer);
    this.fadePool = new SpritePool(fadeLayer);
    this.stampPool = new SpritePool(stampLayer);
  }

  /** Canvas of a happy cell, for use in the DOM (icons, decorations). */
  static portrait(mood: Mood, palette = 0): HTMLCanvasElement {
    return drawCell(PALETTES[palette], 1000 + palette * 97, mood);
  }

  resize(w: number, h: number) {
    this.paper.width = w;
    this.paper.height = h;
    this.drawCreases(w, h);
    this.gridSig = '';
  }

  private drawCreases(w: number, h: number) {
    // Two soft folds, like the sheet was once folded in thirds.
    const g = this.creases;
    g.clear();
    for (const [x0, y0, x1, y1] of [
      [w * 0.33, 0, w * 0.31, h],
      [0, h * 0.58, w, h * 0.55],
    ]) {
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 3, color: 0xffffff, alpha: 0.35 });
      g.moveTo(x0 + 2, y0 + 2).lineTo(x1 + 2, y1 + 2).stroke({ width: 1.2, color: 0x9c8f7a, alpha: 0.12 });
    }
  }

  private drawGrid(cam: Camera) {
    const sig = `${cam.x},${cam.y},${cam.zoom},${cam.w},${cam.h}`;
    if (sig === this.gridSig) return;
    this.gridSig = sig;
    const g = this.grid;
    g.clear();
    if (cam.zoom < GRID_ZOOM) return;
    const alpha = Math.min(1, (cam.zoom - GRID_ZOOM) / 12);
    const [wx0, wy0] = cam.toWorld(0, 0);
    const [wx1, wy1] = cam.toWorld(cam.w, cam.h);
    const seg = 90;
    // Hand-drawn wobble that sticks to each line as you pan.
    const wob = (i: number, j: number) => (((cellHash(i, j) & 1023) / 1023) - 0.5) * 1.6;
    const drawLines = (major: boolean) => {
      for (let i = Math.floor(wx0); i <= Math.ceil(wx1); i++) {
        if ((i % 5 === 0) !== major) continue;
        const [sx] = cam.toScreen(i, 0);
        g.moveTo(sx + wob(i, 0), 0);
        for (let y = seg, j = 1; y < cam.h + seg; y += seg, j++) g.lineTo(sx + wob(i, j), y);
      }
      for (let i = Math.floor(wy0); i <= Math.ceil(wy1); i++) {
        if ((i % 5 === 0) !== major) continue;
        const [, sy] = cam.toScreen(0, i);
        g.moveTo(0, sy + wob(0, i));
        for (let x = seg, j = 1; x < cam.w + seg; x += seg, j++) g.lineTo(x, sy + wob(j, i));
      }
    };
    drawLines(false);
    g.stroke({ width: 1, color: 0x8a7d6c, alpha: 0.22 * alpha });
    drawLines(true);
    g.stroke({ width: 1.4, color: 0x8a7d6c, alpha: 0.34 * alpha });
  }

  update(now: number, sim: Sim, cam: Camera, stamp: StampPreview | null, showBuds: boolean) {
    this.paper.tilePosition.set(-cam.x * cam.zoom, -cam.y * cam.zoom);
    this.drawGrid(cam);

    const z = cam.zoom;
    const faces = z >= FADE_LO;
    const dots = z < DOT_ZOOM;
    const cellAlpha = faces ? Math.min(1, (z - FADE_LO) / (FADE_HI - FADE_LO)) : dots ? 1 : 0;
    this.cellsRoot.alpha = cellAlpha;
    this.cellsRoot.visible = cellAlpha > 0;
    const orgAlpha = dots ? 0 : 1 - cellAlpha;
    this.organisms.root.visible = orgAlpha > 0;
    this.organisms.root.alpha = orgAlpha;
    if (orgAlpha > 0) this.organisms.update(now, sim, cam);
    const [wx0, wy0] = cam.toWorld(-z, -z);
    const [wx1, wy1] = cam.toWorld(cam.w + z, cam.h + z);
    const inView = (x: number, y: number) => x >= wx0 && x <= wx1 && y >= wy0 && y <= wy1;
    const scale = (faces ? 1.3 : 1) * z / TEX_SIZE;
    const sec = now / 1000;
    const anim = sim.animMs;
    const variants = this.tx.faces.length;

    // Buds: the rule made visible — "a cell will be born here".
    this.budPool.begin();
    if (faces && showBuds) {
      for (const k of sim.budKeys) {
        const x = keyX(k);
        const y = keyY(k);
        if (!inView(x, y)) continue;
        const [sx, sy] = cam.toScreen(x + 0.5, y + 0.5);
        const s = this.budPool.next(this.tx.bud);
        const ph = (cellHash(x, y) % 628) / 100;
        s.position.set(sx, sy);
        s.scale.set(scale * (0.95 + 0.08 * Math.sin(sec * 3 + ph)));
        s.rotation = sec * 0.6 + ph;
        s.alpha = 0.6 + 0.2 * Math.sin(sec * 3 + ph);
      }
    }
    this.budPool.end();

    this.cellPool.begin();
    // Skip per-cell work entirely while organisms have fully taken over.
    for (const k of cellAlpha > 0 ? sim.cells : NONE) {
      const x = keyX(k);
      const y = keyY(k);
      if (!inView(x, y)) continue;
      const h = cellHash(x, y);
      const v = h % variants;
      const ph = (h % 628) / 100;
      let [sx, sy] = cam.toScreen(x + 0.5, y + 0.5);

      if (!faces) {
        const s = this.cellPool.next(this.tx.dots[v]);
        s.position.set(sx, sy);
        s.scale.set(scale * popScale(now, sim.bornAt.get(k), anim));
        continue;
      }

      const n = sim.counts.get(k) ?? 0;
      let mood: Mood = n < 2 ? 'lonely' : n > 3 ? 'crowded' : 'happy';
      if (mood === 'happy' && (now + h) % 4300 < 150) mood = 'blink';
      const s = this.cellPool.next(this.tx.faces[v][mood]);
      let sxScale = 1;
      let syScale = 1;
      sy += Math.sin(sec * 2.2 + ph) * 0.035 * z;
      if (mood === 'lonely') {
        s.rotation = Math.sin(sec * 1.4 + ph) * 0.13;
      } else if (mood === 'crowded') {
        sxScale = 1.07 + 0.03 * Math.sin(sec * 14 + ph);
        syScale = 0.93 - 0.03 * Math.sin(sec * 14 + ph);
        sx += Math.sin(sec * 23 + ph) * 0.02 * z;
      } else {
        // Gentle breathing.
        sxScale = 1 + 0.025 * Math.sin(sec * 2.2 + ph + 1.2);
        syScale = 1 - 0.025 * Math.sin(sec * 2.2 + ph + 1.2);
      }
      const pop = popScale(now, sim.bornAt.get(k), anim);
      s.position.set(sx, sy);
      s.scale.set(scale * sxScale * pop, scale * syScale * pop);
    }
    this.cellPool.end();

    // Fading cells drift up and dissolve.
    this.fadePool.begin();
    for (const f of cellAlpha > 0 ? sim.fading : NONE) {
      const t = (now - f.t0) / anim;
      if (t < 0 || t >= 1) continue;
      const x = keyX(f.k);
      const y = keyY(f.k);
      if (!inView(x, y)) continue;
      const h = cellHash(x, y);
      const v = h % variants;
      const [sx, sy] = cam.toScreen(x + 0.5, y + 0.5);
      const s = this.fadePool.next(faces ? this.tx.faces[v].fading : this.tx.dots[v]);
      s.position.set(sx + Math.sin(t * 5 + h) * 0.06 * z, sy - t * 0.45 * z);
      s.scale.set(scale * (1 - 0.3 * t));
      s.alpha = 1 - t * t;
    }
    this.fadePool.end();

    this.stampPool.begin();
    if (stamp) {
      for (const [x, y] of stamp.points) {
        const v = cellHash(x, y) % variants;
        const [sx, sy] = cam.toScreen(x + 0.5, y + 0.5);
        const s = this.stampPool.next(faces ? this.tx.faces[v].happy : this.tx.dots[v]);
        s.position.set(sx, sy);
        s.scale.set(scale);
        s.alpha = 0.45;
      }
    }
    this.stampPool.end();
  }
}

function popScale(now: number, born: number | undefined, anim: number) {
  if (born === undefined) return 1;
  const t = (now - born) / anim;
  if (t >= 1) return 1;
  return Math.max(0.01, easeOutBack(Math.max(0, t)));
}
