import { CanvasSource, type Container, Sprite, Texture } from 'pixi.js';

export function tex(canvas: HTMLCanvasElement): Texture {
  return new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: true }) });
}

/** Cheap integer hash so every cell gets a stable look and rhythm. */
export function cellHash(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) >>> 4;
}

/** Grows on demand and hides whatever wasn't used this frame. */
export class SpritePool {
  private sprites: Sprite[] = [];
  private used = 0;
  constructor(private layer: Container) {}

  begin() {
    this.used = 0;
  }

  next(texture: Texture): Sprite {
    let s = this.sprites[this.used];
    if (!s) {
      s = new Sprite(texture);
      s.anchor.set(0.5);
      this.layer.addChild(s);
      this.sprites.push(s);
    }
    this.used++;
    s.texture = texture;
    s.visible = true;
    s.alpha = 1;
    s.rotation = 0;
    s.tint = 0xffffff;
    return s;
  }

  end() {
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }
}

