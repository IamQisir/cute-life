import { Container, Graphics } from 'pixi.js';
import { keyX, keyY } from '../life/engine';
import type { Camera } from '../render/camera';

type Spark = { x: number; y: number; born: number; phase: number };
/** Show-only, bounded geometry: six short pencil rays per newborn, never a texture per particle. */
export class WelcomeParticles {
  private ink = new Graphics();
  private sparks: Spark[] = [];
  constructor(stage: Container) { stage.addChild(this.ink); }
  update(now: number, births: number[], cam: Camera, active: boolean) {
    if (active) {
      for (const k of births) {
        const x = keyX(k) + 0.5, y = keyY(k) + 0.5;
        const [sx, sy] = cam.toScreen(x, y);
        if (sx < 0 || sx > cam.w || sy < 0 || sy > cam.h) continue;
        this.sparks.push({ x, y, born: now, phase: (k % 17) / 17 * Math.PI });
        if (this.sparks.length >= 48) break;
      }
    }
    this.sparks = this.sparks.filter((spark) => now - spark.born < 500).slice(-48);
    const g = this.ink.clear();
    // Rays scale with the cell size so they read at every zoom.
    const size = Math.max(0.6, Math.min(2.2, cam.zoom / 20));
    for (const spark of this.sparks) {
      const u = (now - spark.born) / 500;
      const [x, y] = cam.toScreen(spark.x, spark.y);
      for (let i = 0; i < 6; i++) {
        const angle = spark.phase + i * Math.PI / 3;
        const r = (3 + u * 15) * size;
        g.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r)
          .lineTo(x + Math.cos(angle) * (r + 4 * size * (1 - u)), y + Math.sin(angle) * (r + 4 * size * (1 - u)));
      }
      g.stroke({ color: 0xc39851, alpha: (1 - u) * 0.7, width: 1.5 * size, cap: 'round' });
    }
  }
  destroy() { this.ink.destroy(); this.sparks = []; }
}
