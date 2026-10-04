// Territory in a battle: every square a team has stood on is coloured in with
// that team's pencil (a pale wash plus hatching), so the fight reads at a glance.

import { Container, Graphics, TilingSprite } from 'pixi.js';
import type { Camera } from './camera';
import { TEAM_PALETTES, drawHatch } from './cellArt';
import { tex } from './util';

const hex = (c: string) => parseInt(c.slice(1), 16);

export interface TerritorySource {
  paint: Uint8Array;
  paintVersion: number;
  cfg: { width: number; height: number };
}

export class TerritoryView {
  readonly root = new Container();
  /** World-space container: one unit = one cell. */
  private world = new Container();
  private wash = new Graphics();
  private masks: Record<1 | 2, Graphics> = { 1: new Graphics(), 2: new Graphics() };
  private hatch: Record<1 | 2, TilingSprite>;
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
    this.world.addChild(this.wash, this.masks[1], this.masks[2]);
    this.root.addChild(this.world, this.hatch[1], this.hatch[2]);
  }

  update(cam: Camera, src: TerritorySource | null) {
    this.root.visible = src !== null;
    if (!src) return;
    this.world.scale.set(cam.zoom);
    this.world.position.set(cam.w / 2 - cam.x * cam.zoom, cam.h / 2 - cam.y * cam.zoom);
    for (const team of [1, 2] as const) {
      const h = this.hatch[team];
      h.width = cam.w;
      h.height = cam.h;
      // Red and blue hatch lean opposite ways, like two pencils.
      h.tilePosition.set(-cam.x * cam.zoom, -cam.y * cam.zoom);
      h.tileScale.set(team === 1 ? 1 : -1, 1);
    }
    if (src.paintVersion === this.drawn) return;
    this.drawn = src.paintVersion;

    const { width: w } = src.cfg;
    const wash = this.wash;
    wash.clear();
    for (const team of [1, 2] as const) {
      const m = this.masks[team];
      m.clear();
      let any = false;
      for (let i = 0; i < src.paint.length; i++) {
        if (src.paint[i] !== team) continue;
        const x = i % w;
        const y = Math.floor(i / w);
        wash.rect(x, y, 1, 1);
        m.rect(x, y, 1, 1);
        any = true;
      }
      if (any) {
        wash.fill({ color: hex(TEAM_PALETTES[team].body), alpha: 0.75 });
        m.fill({ color: 0xffffff });
      }
    }
  }
}
