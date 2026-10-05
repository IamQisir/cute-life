// Crystal Siege crystals: a translucent faceted bud under the cells, one per
// side. It only displays the siege score: as HP drops, the crystal turns the
// attacker's colour (lost / max HP) and its eight facets crack one by one.
// During deployment the 2-cell no-build halo is outlined.

import { Container, Graphics } from 'pixi.js';
import type { Camera } from './camera';
import { TEAM_PALETTES } from './cellArt';
import { cellHash } from './util';
import type { CrystalView as Crystal } from '../battle/siege/siegeMode';

const hex = (c: string) => parseInt(c.slice(1), 16);
const INK = 0x3b302a;
const FACETS = 8;
const FLASH_MS = 320;

function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}

export class CrystalView {
  readonly root = new Container();
  /** World-space: one unit = one cell. */
  private world = new Container();
  private gems = new Graphics();
  private flash = new Graphics();
  private sig = '';
  private lastHp: Record<1 | 2, number> = { 1: -1, 2: -1 };
  private hitAt: Record<1 | 2, number> = { 1: -Infinity, 2: -Infinity };

  constructor() {
    this.world.addChild(this.gems, this.flash);
    this.root.addChild(this.world);
  }

  update(cam: Camera, crystals: Crystal[] | null, showHalo: boolean, now: number) {
    this.root.visible = crystals !== null;
    if (!crystals) return;
    const z = cam.zoom;
    this.world.scale.set(z);
    this.world.position.set(cam.w / 2 - cam.x * z, cam.h / 2 - cam.y * z);

    for (const c of crystals) {
      // A hit since last frame (not a reset to full HP) makes the crystal flash.
      if (this.lastHp[c.team] >= 0 && c.hp < this.lastHp[c.team]) this.hitAt[c.team] = now;
      if (c.hp > this.lastHp[c.team]) this.hitAt[c.team] = -Infinity;
      this.lastHp[c.team] = c.hp;
    }
    this.drawFlash(crystals, now);

    const sig = `${crystals.map((c) => c.hp).join()},${showHalo}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const g = this.gems;
    g.clear();
    for (const c of crystals) this.drawCrystal(g, c, showHalo);
  }

  private drawCrystal(g: Graphics, c: Crystal, showHalo: boolean) {
    const { box, team } = c;
    const enemy = team === 1 ? 2 : 1;
    const own = TEAM_PALETTES[team], foe = TEAM_PALETTES[enemy];
    const lost = 1 - c.hp / c.maxHp;
    const w = box.x1 - box.x0 + 1;
    const cx = box.x0 + w / 2, cy = box.y0 + w / 2;

    if (showHalo) {
      const h = c.halo;
      g.rect(box.x0 - h, box.y0 - h, w + 2 * h, w + 2 * h).fill({ color: 0xf2ece0, alpha: 0.75 });
      dashedRect(g, box.x0 - h, box.y0 - h, w + 2 * h, w + 2 * h, 0.8);
      g.stroke({ width: 0.14, color: INK, alpha: 0.5 });
    }

    // The hitbox itself: a faint square, so the scoring area is honest.
    g.rect(box.x0, box.y0, w, w).fill({ color: mix(hex(own.body), hex(foe.body), lost), alpha: 0.28 });
    g.rect(box.x0, box.y0, w, w).stroke({ width: 0.1, color: mix(hex(own.outline), hex(foe.outline), lost), alpha: 0.35 });

    // Bud: an octagon of eight facets around a small table.
    const r = w * 0.46;
    const corner = (i: number, k = 1): [number, number] => {
      const a = (i / FACETS) * Math.PI * 2 - Math.PI / 2 + Math.PI / FACETS;
      return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
    };
    const perFacet = c.maxHp / FACETS;
    const lostHp = c.maxHp - c.hp;
    for (let i = 0; i < FACETS; i++) {
      // Facets crack in a fixed, scattered order so damage reads at a glance.
      const order = (i * 3) % FACETS;
      const taken = Math.max(0, Math.min(1, (lostHp - order * perFacet) / perFacet));
      const light = i % 2 === 0 ? 0.18 : 0;
      const base = mix(hex(own.hatch), 0xffffff, light);
      const color = mix(base, mix(hex(foe.hatch), 0xffffff, light), Math.max(taken, lost * 0.6));
      const [ax, ay] = corner(i), [bx, by] = corner(i + 1);
      const [ix, iy] = corner(i, 0.42), [jx, jy] = corner(i + 1, 0.42);
      g.poly([ax, ay, bx, by, jx, jy, ix, iy]).fill({ color, alpha: 0.5 + 0.2 * taken });
      if (taken >= 1) {
        // A pencil crack across the broken facet.
        const t = (n: number) => (((cellHash(team * 31 + i, n) & 1023) / 1023) - 0.5) * 0.5;
        const mx = (ax + bx + ix + jx) / 4, my = (ay + by + iy + jy) / 4;
        g.moveTo((ix + jx) / 2, (iy + jy) / 2).lineTo(mx + t(1), my + t(2)).lineTo((ax + bx) / 2 + t(3), (ay + by) / 2 + t(4));
        g.stroke({ width: 0.3, color: INK, alpha: 0.8, cap: 'round', join: 'round' });
      }
    }
    const table: number[] = [];
    for (let i = 0; i < FACETS; i++) table.push(...corner(i, 0.42));
    g.poly(table).fill({ color: mix(mix(hex(own.body), 0xffffff, 0.4), hex(foe.body), lost), alpha: 0.75 });
    const outline: number[] = [];
    for (let i = 0; i < FACETS; i++) outline.push(...corner(i));
    g.poly(outline).stroke({ width: 0.2, color: mix(hex(own.outline), hex(foe.outline), lost), alpha: 0.85, join: 'round' });
    g.poly(table).stroke({ width: 0.12, color: mix(hex(own.outline), hex(foe.outline), lost), alpha: 0.6, join: 'round' });
    for (let i = 0; i < FACETS; i++) {
      const [ax, ay] = corner(i), [ix, iy] = corner(i, 0.42);
      g.moveTo(ax, ay).lineTo(ix, iy);
    }
    g.stroke({ width: 0.08, color: mix(hex(own.outline), hex(foe.outline), lost), alpha: 0.5 });
    if (c.hp === 0) {
      // Shattered: a big X of cracks over the whole bud.
      g.moveTo(cx - r * 0.8, cy - r * 0.6).lineTo(cx + 0.4, cy - 0.3).lineTo(cx + r * 0.75, cy + r * 0.7)
        .moveTo(cx + r * 0.7, cy - r * 0.75).lineTo(cx - 0.3, cy + 0.4).lineTo(cx - r * 0.65, cy + r * 0.8);
      g.stroke({ width: 0.38, color: INK, alpha: 0.85, cap: 'round', join: 'round' });
    }
  }

  private drawFlash(crystals: Crystal[], now: number) {
    const f = this.flash;
    f.clear();
    for (const c of crystals) {
      const age = now - this.hitAt[c.team];
      if (age < 0 || age >= FLASH_MS) continue;
      const { box } = c;
      const w = box.x1 - box.x0 + 1;
      const foe = TEAM_PALETTES[c.team === 1 ? 2 : 1];
      f.rect(box.x0, box.y0, w, w).fill({ color: hex(foe.hatch), alpha: 0.35 * (1 - age / FLASH_MS) });
    }
  }
}

function dashedRect(g: Graphics, x: number, y: number, w: number, h: number, dash: number) {
  const edges: [number, number, number, number][] = [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]];
  for (const [ax, ay, bx, by] of edges) {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.round(len / dash));
    for (let i = 0; i < n; i += 2) {
      const t0 = i / n, t1 = Math.min(1, (i + 1) / n);
      g.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0).lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
    }
  }
}
