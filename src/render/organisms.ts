// Mid-zoom view: each group of interacting cells is drawn as ONE organism —
// a shared membrane with a nucleus per cell and a single face. The family
// decides colour and behaviour:
//   still      -> lavender, asleep, floating "z"
//   oscillator -> butter yellow, dancing, music notes
//   spaceship  -> mint, face leads the way, speed lines behind
//   blob       -> blue, face shows whether the group is about to change

import { Container, Graphics, type Texture, TilingSprite } from 'pixi.js';
import { type Cluster, type Family, findClusters } from '../life/clusters';
import { key, keyX, keyY } from '../life/engine';
import type { SimView } from '../sim';
import type { Camera } from './camera';
import { MOODS, type Mood, PALETTES, type Palette, TEAM_PALETTES, TEX_SIZE, drawFaceOnly, drawHatch, drawNote, drawZ } from './cellArt';
import { SpritePool, cellHash, tex } from './util';
import { VisibleClusterCache, type WorldRect } from './visibleClusters';
import { perf } from './perf';

const FAMILY_PALETTE: Record<Family, number> = { still: 3, oscillator: 2, spaceship: 0, blob: 1 };
const BODY_R = 0.72;
/**
 * Membrane geometry is built at U units per cell and the container scaled by
 * zoom / U: Pixi tessellates circles by their local radius, so a 0.72-unit
 * circle blown up 40x looked faceted.
 */
const U = 32;
/** Faces are drawn at this multiple of TEX_SIZE so they stay sharp when large. */
const FACE_RES = 3;
/** Forward half of the 5x5 neighbourhood: each linked pair is visited once. */
const LINKS: [number, number][] = [
  [1, 0], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
];
const hex = (c: string) => parseInt(c.slice(1), 16);

/** Membrane style: team colour in battles, pattern family in the sandbox. */
type Styled = Cluster & { team?: 1 | 2 };
const styleOf = (c: Styled): string => (c.team ? `team${c.team}` : c.family);
const paletteOf = (style: string): Palette =>
  style === 'team1' ? TEAM_PALETTES[1] : style === 'team2' ? TEAM_PALETTES[2] : PALETTES[FAMILY_PALETTE[style as Family]];

interface Built {
  version: number;
  zoom: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class OrganismView {
  readonly root = new Container();
  private world = new Container();
  private body = new Graphics();
  /** Shares the membrane geometry, used only as a mask for the hatching. */
  private bodyMask = new Graphics(this.body.context);
  private hatch = new TilingSprite({ texture: tex(drawHatch()), width: 1, height: 1 });
  private facePool: SpritePool;
  private extraPool: SpritePool;
  private faces: Record<Mood, Texture>;
  private zTex = tex(drawZ());
  private noteTex = tex(drawNote());
  private clusters: Styled[] = [];
  private clusterVersion = -1;
  private clusterCache = new VisibleClusterCache();
  get spritesDrawn() { return this.facePool.drawn + this.extraPool.drawn; }
  private built: Built | null = null;

  constructor() {
    this.world.addChild(this.body, this.bodyMask);
    this.hatch.mask = this.bodyMask;
    const faceLayer = new Container();
    const extraLayer = new Container();
    this.root.addChild(this.world, this.hatch, extraLayer, faceLayer);
    this.facePool = new SpritePool(faceLayer);
    this.extraPool = new SpritePool(extraLayer);
    this.faces = {} as Record<Mood, Texture>;
    for (const m of MOODS) this.faces[m] = tex(drawFaceOnly(PALETTES[0], m, FACE_RES));
  }

  /** Standalone portraits own their textures; dispose them after extraction. */
  destroy() {
    const textures = [...Object.values(this.faces), this.zTex, this.noteTex, this.hatch.texture];
    this.root.destroy({ children: true, context: true });
    textures.forEach((texture) => texture.destroy(true));
  }

  private ensureClusters(sim: SimView, rect: WorldRect, visibleOnly: boolean) {
    if (this.clusterVersion === sim.version) return;
    const timing = perf.start();
    this.clusters = sim.teamClusters ? sim.teamClusters() : visibleOnly ? this.clusterCache.get(sim.cells, sim.version, rect) : findClusters(sim.cells);
    perf.end('clusters', timing);
    this.clusterVersion = sim.version;
  }

  /** Redraw membranes only when cells change, zoom changes a lot, or we pan off the drawn area. */
  private needsBuild(sim: SimView, cam: Camera, vx0: number, vy0: number, vx1: number, vy1: number) {
    const b = this.built;
    if (!b || b.version !== sim.version) return true;
    const ratio = cam.zoom / b.zoom;
    if (ratio > 1.15 || ratio < 0.87) return true;
    return vx0 < b.x0 || vy0 < b.y0 || vx1 > b.x1 || vy1 > b.y1;
  }

  private build(sim: SimView, cam: Camera, vx0: number, vy0: number, vx1: number, vy1: number) {
    // Draw a margin around the view so small pans don't trigger a rebuild.
    const mx = (vx1 - vx0) * 0.5;
    const my = (vy1 - vy0) * 0.5;
    const b: Built = { version: sim.version, zoom: cam.zoom, x0: vx0 - mx, y0: vy0 - my, x1: vx1 + mx, y1: vy1 + my };
    this.built = b;
    const g = this.body;
    g.clear();
    const outlinePx = 1.6 / cam.zoom;
    const visible = this.clusters.filter((c) => c.maxX + 1 >= b.x0 && c.minX <= b.x1 && c.maxY + 1 >= b.y0 && c.minY <= b.y1);
    const styles = [...new Set(visible.map(styleOf))];

    // Pass 1 draws everything a bit fatter in the outline colour, pass 2 the
    // body on top: the union of circles and bridges reads as one membrane.
    for (const pass of ['outline', 'body'] as const) {
      for (const style of styles) {
        const p = paletteOf(style);
        const color = hex(pass === 'outline' ? p.outline : p.body);
        const grow = pass === 'outline' ? outlinePx : 0;
        let any = false;
        for (const c of visible) {
          if (styleOf(c) !== style) continue;
          any = true;
          for (const k of c.cells) g.circle((keyX(k) + 0.5) * U, (keyY(k) + 0.5) * U, (BODY_R + grow) * U);
        }
        if (any) g.fill({ color });
        // Bridges between neighbours, thinner across a one-cell gap.
        for (const thick of [true, false]) {
          let drew = false;
          for (const c of visible) {
            if (styleOf(c) !== style) continue;
            const members = new Set(c.cells);
            for (const k of c.cells) {
              const x = keyX(k);
              const y = keyY(k);
              for (const [dx, dy] of LINKS) {
                const far = Math.max(Math.abs(dx), Math.abs(dy)) === 2;
                if (far === thick || !members.has(key(x + dx, y + dy))) continue;
                g.moveTo((x + 0.5) * U, (y + 0.5) * U).lineTo((x + dx + 0.5) * U, (y + dy + 0.5) * U);
                drew = true;
              }
            }
          }
          if (drew) g.stroke({ width: 2 * ((thick ? 0.6 : 0.42) + grow) * U, color, cap: 'round' });
        }
      }
    }

    // Nuclei: one per cell, so you can still count the cells inside.
    for (const style of styles) {
      const p = paletteOf(style);
      let any = false;
      for (const c of visible) {
        if (styleOf(c) !== style) continue;
        any = true;
        for (const k of c.cells) g.circle((keyX(k) + 0.5) * U, (keyY(k) + 0.5) * U, 0.2 * U);
      }
      if (any) g.fill({ color: hex(p.nucleus), alpha: 0.55 });
    }

    // Speed lines behind travellers.
    let lines = false;
    for (const c of visible) {
      if (c.family !== 'spaceship') continue;
      const [hx, hy] = c.heading;
      const len = Math.hypot(hx, hy) || 1;
      const ux = hx / len;
      const uy = hy / len;
      const back = Math.max(c.maxX - c.minX, c.maxY - c.minY) / 2 + 1.4;
      for (const off of [-0.7, 0, 0.7]) {
        const sx = c.cx - ux * back - uy * off;
        const sy = c.cy - uy * back + ux * off;
        g.moveTo(sx * U, sy * U).lineTo((sx - ux * (off ? 0.8 : 1.3)) * U, (sy - uy * (off ? 0.8 : 1.3)) * U);
        lines = true;
      }
    }
    if (lines) g.stroke({ width: (2.2 / cam.zoom) * U, color: hex(PALETTES[0].outline), alpha: 0.6, cap: 'round' });
  }

  update(now: number, sim: SimView, cam: Camera, visibleOnly = false) {
    const z = cam.zoom;
    const [vx0, vy0] = cam.toWorld(0, 0);
    const [vx1, vy1] = cam.toWorld(cam.w, cam.h);
    this.ensureClusters(sim, { x0: vx0, y0: vy0, x1: vx1, y1: vy1 }, visibleOnly);
    if (this.needsBuild(sim, cam, vx0, vy0, vx1, vy1)) this.build(sim, cam, vx0, vy0, vx1, vy1);
    this.world.scale.set(z / U);
    this.world.position.set(cam.w / 2 - cam.x * z, cam.h / 2 - cam.y * z);
    // Hatching stays at pencil scale on screen but slides with the paper.
    this.hatch.width = cam.w;
    this.hatch.height = cam.h;
    this.hatch.tilePosition.set(-cam.x * z, -cam.y * z);

    const sec = now / 1000;
    this.facePool.begin();
    this.extraPool.begin();
    for (const c of this.clusters) {
      if (c.maxX + 2 < vx0 || c.minX - 2 > vx1 || c.maxY + 2 < vy0 || c.minY - 2 > vy1) continue;
      const n = c.cells.length;
      const ph = (cellHash(Math.floor(c.cx), Math.floor(c.cy)) % 628) / 100;
      // Face grows with the organism, but stays readable on tiny ones.
      const sizeCells = Math.min(7, 2 + Math.sqrt(n) * 0.55);
      const scale = (sizeCells * z) / (TEX_SIZE * 0.5) / FACE_RES;
      let [fx, fy] = cam.toScreen(c.cx, c.cy);
      let mood: Mood = 'happy';
      let rot = 0;
      let breathe = 1;

      if (c.family === 'still') {
        mood = 'fading';
        breathe = 1 + 0.04 * Math.sin(sec * 1.2 + ph);
        // A "z" drifts up from the sleeper every few seconds.
        const t = (sec * 0.45 + ph) % 1;
        const zs = this.extraPool.next(this.zTex);
        const [tx, ty] = cam.toScreen(c.maxX + 0.8, c.minY);
        zs.position.set(tx + t * 0.6 * z, ty - t * 1.4 * z);
        zs.scale.set((z * (0.5 + t * 0.5)) / TEX_SIZE * 2);
        zs.alpha = Math.sin(t * Math.PI);
      } else if (c.family === 'oscillator') {
        mood = (now + ph * 1000) % 3000 < 150 ? 'blink' : 'happy';
        rot = Math.sin(sec * 4 + ph) * 0.18;
        const t = (sec * 0.6 + ph) % 1;
        const ns = this.extraPool.next(this.noteTex);
        const [tx, ty] = cam.toScreen(c.minX - 0.3, c.minY);
        ns.position.set(tx - t * 0.4 * z + Math.sin(t * 9) * 0.15 * z, ty - t * 1.2 * z);
        ns.scale.set((z * 0.9) / TEX_SIZE * 2);
        ns.alpha = Math.sin(t * Math.PI);
      } else if (c.family === 'spaceship') {
        fx += c.heading[0] * 0.35 * z;
        fy += c.heading[1] * 0.35 * z;
        fy += Math.sin(sec * 8 + ph) * 0.05 * z;
      } else if (n > 40) {
        // Big colonies get a scattering of small faces instead of one lonely one.
        const stride = Math.max(1, Math.round(n / Math.min(12, n / 60)));
        const faceScale = (3.6 * z) / (TEX_SIZE * 0.5) / FACE_RES;
        for (const k of c.cells) {
          const x = keyX(k);
          const y = keyY(k);
          const h = cellHash(x, y);
          if (h % stride !== 0) continue;
          const m = sim.counts.get(k) ?? 0;
          let fm: Mood = m < 2 ? 'lonely' : m > 3 ? 'crowded' : 'happy';
          if (fm === 'happy' && (now + h) % 4300 < 150) fm = 'blink';
          const [sx, sy] = cam.toScreen(x + 0.5, y + 0.5);
          const fs = this.facePool.next(this.faces[fm]);
          fs.position.set(sx, sy + Math.sin(sec * 2 + (h % 628) / 100) * 0.1 * z);
          fs.scale.set(faceScale);
        }
        continue;
      } else {
        let lonely = 0;
        let crowded = 0;
        for (const k of c.cells) {
          const m = sim.counts.get(k) ?? 0;
          if (m < 2) lonely++;
          else if (m > 3) crowded++;
        }
        if (lonely + crowded > n / 2) mood = crowded >= lonely ? 'crowded' : 'lonely';
        else if ((now + ph * 1000) % 4300 < 150) mood = 'blink';
        breathe = 1 + 0.03 * Math.sin(sec * 2.2 + ph);
      }

      const s = this.facePool.next(this.faces[mood]);
      s.position.set(fx, fy);
      s.rotation = rot;
      s.scale.set(scale * breathe, scale / breathe);
    }
    this.facePool.end();
    this.extraPool.end();
  }
}
