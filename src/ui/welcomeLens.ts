import { Container, Graphics } from 'pixi.js';
import { Camera } from '../render/camera';
import { WorldView } from '../render/world';
import type { SimView } from '../sim';
import type { welcomeLensTimeline } from './welcomeTimeline';

/** Second on-screen pass, circle masked; no framebuffer or copied cell textures. */
export class WelcomeLens {
  private root = new Container();
  private mask = new Graphics();
  private ink = new Graphics();
  private camera = new Camera();
  private view: WorldView;
  private size = '';

  constructor(stage: Container, source: WorldView) {
    this.view = new WorldView(source);
    this.view.root.mask = this.mask;
    this.root.addChild(this.view.root, this.mask, this.ink);
    stage.addChild(this.root);
  }

  update(now: number, sim: SimView, width: number, height: number, frame: ReturnType<typeof welcomeLensTimeline>) {
    this.root.visible = frame.lensVisible || frame.inkAlpha > 0;
    if (!this.root.visible) return;
    const { sx, sy, radius: r } = frame;
    if (this.size !== `${width},${height}`) {
      this.size = `${width},${height}`;
      this.view.resize(width, height);
    }
    Object.assign(this.camera, frame.lens, { w: width, h: height });
    this.view.root.visible = frame.lensVisible;
    if (frame.lensVisible) {
      this.mask.clear().circle(sx, sy, r).fill(0xffffff);
      this.view.update(now, sim, this.camera, null, true, {
        left: Math.max(0, sx - r), top: Math.max(0, sy - r),
        right: Math.min(width, sx + r), bottom: Math.min(height, sy + r),
      });
    }
    const ink = this.ink.clear();
    ink.alpha = frame.inkAlpha;
    // Two imperfect rings, with a round wooden handle at the lower right.
    for (const offset of [0, 5]) {
      for (let i = 0; i <= 96; i++) {
        const a = i / 96 * Math.PI * 2;
        const wobble = 1.3 * Math.sin(a * 7) + 0.8 * Math.cos(a * 11);
        const x = sx + Math.cos(a) * (r + offset + wobble);
        const y = sy + Math.sin(a) * (r + offset + wobble);
        if (i === 0) ink.moveTo(x, y); else ink.lineTo(x, y);
      }
      ink.stroke({ color: 0x655747, width: offset ? 2 : 5, cap: 'round', join: 'round' });
    }
    ink.moveTo(sx + r * 0.7, sy + r * 0.7).lineTo(sx + r * 0.7 + 70, sy + r * 0.7 + 76)
      .stroke({ color: 0x655747, width: 18, cap: 'round' });
    ink.moveTo(sx + r * 0.7 + 10, sy + r * 0.7 + 12).lineTo(sx + r * 0.7 + 69, sy + r * 0.7 + 74)
      .stroke({ color: 0xb59c76, width: 10, cap: 'round' });
  }

  destroy() {
    this.view.root.mask = null;
    this.view.destroy();
    this.root.destroy({ children: true, context: true });
  }
}
