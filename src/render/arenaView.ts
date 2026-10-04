// The battle arena on paper: a hand-drawn frame, each team's deployment zone
// shaded with coloured pencil hatching, and the paper outside dimmed.

import { Container, Graphics, Text, TilingSprite } from 'pixi.js';
import type { Camera } from './camera';
import { TEAM_PALETTES, drawHatch } from './cellArt';
import { cellHash, tex } from './util';

export interface ArenaLayout {
  width: number;
  height: number;
  /** Edges that wrap are drawn dashed; walls are solid. */
  wrapX: boolean;
  wrapY: boolean;
  zones: Record<1 | 2, { x0: number; x1: number }>;
}

export interface ArenaViewState {
  /** Zones to shade; during deployment only your own. */
  showZones: (1 | 2)[];
  /** Zone to mark with a big "?" (the hidden opponent). */
  hiddenZone?: 1 | 2;
}

const hex = (c: string) => parseInt(c.slice(1), 16);
const PAPER = 0xf2ece0;
const INK = 0x3b302a;

export class ArenaView {
  readonly root = new Container();
  private dim = new Graphics();
  private frame = new Graphics();
  private zoneFill = new Graphics();
  private hatch: Record<1 | 2, TilingSprite>;
  private masks: Record<1 | 2, Graphics>;
  private question: Text;
  private sig = '';

  constructor() {
    const hatchTex = tex(drawHatch());
    const make = (team: 1 | 2) => {
      const t = new TilingSprite({ texture: hatchTex, width: 1, height: 1 });
      t.tint = hex(TEAM_PALETTES[team].outline);
      t.alpha = 0.55;
      return t;
    };
    this.hatch = { 1: make(1), 2: make(2) };
    this.masks = { 1: new Graphics(), 2: new Graphics() };
    this.hatch[1].mask = this.masks[1];
    this.hatch[2].mask = this.masks[2];
    this.question = new Text({
      text: '?',
      // padding: Caveat's strokes overhang its measured box, which clipped the glyph.
      style: { fontFamily: 'Caveat, cursive', fontWeight: '700', fontSize: 120, fill: hex(TEAM_PALETTES[2].outline), padding: 24 },
    });
    this.question.anchor.set(0.5);
    this.question.alpha = 0.35;
    this.root.addChild(this.dim, this.zoneFill, this.hatch[1], this.hatch[2], this.masks[1], this.masks[2], this.frame, this.question);
  }

  update(cam: Camera, layout: ArenaLayout | null, state: ArenaViewState) {
    this.root.visible = layout !== null;
    if (!layout) return;
    const sig = `${cam.x},${cam.y},${cam.zoom},${cam.w},${cam.h},${state.showZones.join()},${state.hiddenZone},${layout.wrapX},${layout.wrapY}`;
    if (sig === this.sig) return;
    this.sig = sig;

    const [ax0, ay0] = cam.toScreen(0, 0);
    const [ax1, ay1] = cam.toScreen(layout.width, layout.height);

    // Dim the paper outside the arena so the eye stays on the fight.
    const d = this.dim;
    d.clear();
    d.rect(0, 0, cam.w, Math.max(0, ay0))
      .rect(0, ay1, cam.w, Math.max(0, cam.h - ay1))
      .rect(0, ay0, Math.max(0, ax0), ay1 - ay0)
      .rect(ax1, ay0, Math.max(0, cam.w - ax1), ay1 - ay0)
      .fill({ color: PAPER, alpha: 0.6 });

    // Zones: a pale wash plus hatching, masked to the zone rectangle.
    const z = this.zoneFill;
    z.clear();
    for (const team of [1, 2] as const) {
      const on = state.showZones.includes(team);
      const hatch = this.hatch[team];
      const mask = this.masks[team];
      hatch.visible = on;
      mask.clear();
      if (!on) continue;
      const { x0, x1 } = layout.zones[team];
      const [sx0] = cam.toScreen(x0, 0);
      const [sx1] = cam.toScreen(x1 + 1, 0);
      z.rect(sx0, ay0, sx1 - sx0, ay1 - ay0).fill({ color: hex(TEAM_PALETTES[team].body), alpha: 0.35 });
      mask.rect(sx0, ay0, sx1 - sx0, ay1 - ay0).fill({ color: 0xffffff });
      hatch.width = cam.w;
      hatch.height = cam.h;
      hatch.tilePosition.set(-cam.x * cam.zoom * (team === 1 ? 1 : -1), -cam.y * cam.zoom);
    }

    // Frame: walls are a solid double pencil line; edges that wrap are dashed,
    // a hint that cells leaving there come back on the other side.
    const f = this.frame;
    f.clear();
    const wob = (i: number, j: number) => (((cellHash(i, j) & 1023) / 1023) - 0.5) * 3;
    const edges: { a: [number, number]; b: [number, number]; wraps: boolean }[] = [
      { a: [ax0, ay0], b: [ax1, ay0], wraps: layout.wrapY },
      { a: [ax1, ay0], b: [ax1, ay1], wraps: layout.wrapX },
      { a: [ax1, ay1], b: [ax0, ay1], wraps: layout.wrapY },
      { a: [ax0, ay1], b: [ax0, ay0], wraps: layout.wrapX },
    ];
    edges.forEach(({ a, b, wraps }, e) => {
      if (wraps) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(2, Math.round(len / 18));
        for (let i = 0; i < n; i += 2) {
          const t0 = i / n;
          const t1 = Math.min(1, (i + 1) / n);
          f.moveTo(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            .lineTo(a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1);
        }
        f.stroke({ width: 1.8, color: INK, alpha: 0.5, cap: 'round' });
        return;
      }
      for (let pass = 0; pass < 2; pass++) {
        f.moveTo(a[0] + wob(pass, e), a[1] + wob(e, pass)).lineTo(b[0] + wob(pass, e + 1), b[1] + wob(e + 1, pass));
        f.stroke({ width: pass ? 1.6 : 3.4, color: INK, alpha: pass ? 0.45 : 0.9, cap: 'round' });
      }
    });

    const q = this.question;
    q.visible = state.hiddenZone !== undefined;
    if (state.hiddenZone !== undefined) {
      const { x0, x1 } = layout.zones[state.hiddenZone];
      const [cx, cy] = cam.toScreen((x0 + x1 + 1) / 2, layout.height / 2);
      q.position.set(cx, cy);
      q.style.fill = hex(TEAM_PALETTES[state.hiddenZone].outline);
      q.scale.set(Math.max(0.3, (cam.zoom * layout.height) / 120 / 3));
    }
  }
}
