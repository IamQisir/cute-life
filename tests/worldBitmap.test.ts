import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sprite } from 'pixi.js';
import { Camera } from '../src/render/camera';
import { WorldView } from '../src/render/world';
import { Sim } from '../src/sim';

// Exercise actual Pixi Sprite/Texture invalidation without a DOM or GPU dependency.
vi.mock('../src/render/cellArt', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/render/cellArt')>();
  const canvas = () => document.createElement('canvas');
  return { ...original, drawCell: canvas, drawDot: canvas, drawBud: canvas, drawPaper: canvas,
    drawHatch: canvas, drawZ: canvas, drawNote: canvas, drawFaceOnly: canvas };
});
afterEach(() => vi.unstubAllGlobals());
describe('WorldView dot bitmap', () => {
  it('defaults off, rasterizes only changed states, follows the camera, updates bounds and releases storage', () => {
    const upload = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ({ putImageData: upload }) }) });
    vi.stubGlobal('ImageData', class {});
    const sim = new Sim();
    sim.addMany([[-2, -2], [-1, -2], [0, 0]], 0);
    const cam = new Camera();
    Object.assign(cam, { zoom: 3, w: 320, h: 200 });
    const view = new WorldView();
    expect(view.dotBitmapEnabled).toBe(false);
    view.dotBitmapEnabled = true;
    view.update(100, sim, cam, null, false);
    const dot = view.root.children.find((child) => child instanceof Sprite) as Sprite;
    expect(dot.visible).toBe(true);
    expect(dot.texture.dynamic).toBe(true);
    expect(dot.texture.source.scaleMode).toBe('nearest');
    expect(view.spritesDrawn).toBe(1);
    expect(upload).toHaveBeenCalledOnce();
    const x = dot.x, width = dot.width;
    cam.x += 2; cam.zoom = 2.8;
    view.update(110, sim, cam, null, false);
    expect(dot.x).not.toBe(x);
    expect(dot.scale.x).toBeCloseTo(2.8 / 3);
    expect(upload).toHaveBeenCalledOnce();
    sim.addMany([[12, -2]], 120);
    view.update(120, sim, cam, null, false);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(dot.width).toBeGreaterThan(width);
    expect(dot.width).toBeCloseTo(dot.texture.orig.width * cam.zoom / 3);
    cam.zoom = 14;
    view.update(130, sim, cam, null, false);
    expect(dot.visible).toBe(false);
    expect(view.spritesDrawn).toBeGreaterThan(1);
    cam.zoom = 3;
    view.update(140, sim, cam, null, false);
    expect(dot.visible).toBe(true);
    expect(upload).toHaveBeenCalledTimes(2);
    const texture = dot.texture;
    view.releaseDotBitmap();
    expect(dot.visible).toBe(false);
    expect(texture.destroyed).toBe(true);
    view.destroy();
  });
});
