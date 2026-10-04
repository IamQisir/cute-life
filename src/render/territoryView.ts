// Territory in a battle: every square a team has stood on is coloured in with
// that team's pencil (a pale wash plus hatching). With a garden objective, the
// garden squares are flowers whose petals take the colour of whoever painted
// them last, and the paint outside the garden is faded so the eye goes there.

import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { Camera } from './camera';
import { TEAM_PALETTES, drawFlower, drawFlowerCentre, drawHatch } from './cellArt';
import { cellHash, tex } from './util';

const hex = (c: string) => parseInt(c.slice(1), 16);
const UNCLAIMED = 0xf4ecdc;
const INK = 0x3b302a;

export interface Garden {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TerritorySource {
  paint: Uint8Array;
  paintVersion: number;
  cfg: { width: number; height: number; garden?: Garden };
}

export class TerritoryView {
  readonly root = new Container();
  /** World-space container: one unit = one cell. */
  private world = new Container();
  private wash = new Graphics();
  private gardenWash = new Graphics();
  private masks: Record<1 | 2, Graphics> = { 1: new Graphics(), 2: new Graphics() };
  private hatch: Record<1 | 2, TilingSprite>;
  private gardenFrame = new Graphics();
  private flowers = new Container();
  private petals: Sprite[] = [];
  private centres: Sprite[] = [];
  private petalTex = tex(drawFlower());
  private centreTex = tex(drawFlowerCentre());
  private drawn = -1;

  constructor() {
    const hatchTex = tex(drawHatch());
    const make = (team: 1 | 2) => {
      const t = new TilingSprite({ texture: hatchTex, width: 1, height: 1 });
      t.tint = hex(TEAM_PALETTES[team].outline);
      t.alpha = 0.6;
      t.mask = this.masks[team];
      return t;
    };
    this.hatch = { 1: make(1), 2: make(2) };
    this.world.addChild(this.wash, this.gardenWash, this.masks[1], this.masks[2]);
    this.root.addChild(this.world, this.hatch[1], this.hatch[2], this.gardenFrame, this.flowers);
  }

  update(cam: Camera, src: TerritorySource | null) {
    this.root.visible = src !== null;
    if (!src) return;
    const z = cam.zoom;
    this.world.scale.set(z);
    this.world.position.set(cam.w / 2 - cam.x * z, cam.h / 2 - cam.y * z);
    const garden = src.cfg.garden;
    for (const team of [1, 2] as const) {
      const h = this.hatch[team];
      h.width = cam.w;
      h.height = cam.h;
      // Red and blue hatch lean opposite ways, like two pencils.
      h.tilePosition.set(-cam.x * z, -cam.y * z);
      h.tileScale.set(team === 1 ? 1 : -1, 1);
      h.alpha = garden ? 0.3 : 0.6;
    }
    this.drawGarden(cam, src, garden);
    if (src.paintVersion === this.drawn) return;
    this.drawn = src.paintVersion;

    const { width: w } = src.cfg;
    const inGarden = (x: number, y: number) =>
      garden !== undefined && x >= garden.x0 && x <= garden.x1 && y >= garden.y0 && y <= garden.y1;
    this.wash.clear();
    this.gardenWash.clear();
    for (const team of [1, 2] as const) {
      const m = this.masks[team];
      m.clear();
      let out = false;
      let inside = false;
      for (let i = 0; i < src.paint.length; i++) {
        if (src.paint[i] !== team) continue;
        const x = i % w;
        const y = Math.floor(i / w);
        if (inGarden(x, y)) {
          this.gardenWash.rect(x, y, 1, 1);
          inside = true;
        } else {
          this.wash.rect(x, y, 1, 1);
          out = true;
        }
        m.rect(x, y, 1, 1);
      }
      const body = hex(TEAM_PALETTES[team].body);
      if (out) this.wash.fill({ color: body, alpha: garden ? 0.3 : 0.75 });
      if (inside) this.gardenWash.fill({ color: body, alpha: 0.8 });
      if (out || inside) m.fill({ color: 0xffffff });
    }
  }

  /** Flowers and a dashed pencil frame for the garden, in screen space. */
  private drawGarden(cam: Camera, src: TerritorySource, garden: Garden | undefined) {
    const f = this.gardenFrame;
    f.clear();
    if (!garden) {
      this.flowers.visible = false;
      return;
    }
    this.flowers.visible = true;
    const z = cam.zoom;
    const [gx0, gy0] = cam.toScreen(garden.x0, garden.y0);
    const [gx1, gy1] = cam.toScreen(garden.x1 + 1, garden.y1 + 1);
    // Dashed rounded frame.
    const corners: [number, number][] = [[gx0, gy0], [gx1, gy0], [gx1, gy1], [gx0, gy1]];
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e];
      const [bx, by] = corners[(e + 1) % 4];
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 10));
      for (let i = 0; i < n; i += 2) {
        f.moveTo(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)
          .lineTo(ax + ((bx - ax) * Math.min(n, i + 1)) / n, ay + ((by - ay) * Math.min(n, i + 1)) / n);
      }
    }
    f.stroke({ width: 2.2, color: INK, alpha: 0.7, cap: 'round' });

    const { width: w } = src.cfg;
    let n = 0;
    for (let y = garden.y0; y <= garden.y1; y++) {
      for (let x = garden.x0; x <= garden.x1; x++) {
        let petal = this.petals[n];
        let centre = this.centres[n];
        if (!petal) {
          petal = new Sprite(this.petalTex);
          centre = new Sprite(this.centreTex);
          petal.anchor.set(0.5);
          centre.anchor.set(0.5);
          this.flowers.addChild(petal, centre);
          this.petals.push(petal);
          this.centres.push(centre);
        }
        const owner = src.paint[y * w + x];
        const [sx, sy] = cam.toScreen(x + 0.5, y + 0.5);
        const scale = (z * 1.05) / 128;
        const tilt = ((cellHash(x, y) % 100) / 100 - 0.5) * 0.6;
        petal.position.set(sx, sy);
        petal.scale.set(scale);
        petal.rotation = tilt;
        petal.tint = owner ? hex(TEAM_PALETTES[owner as 1 | 2].hatch) : UNCLAIMED;
        centre.position.set(sx, sy);
        centre.scale.set(scale);
        petal.visible = centre.visible = true;
        n++;
      }
    }
    for (let i = n; i < this.petals.length; i++) this.petals[i].visible = this.centres[i].visible = false;
  }
}
