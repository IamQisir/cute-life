import { describe, expect, it, vi } from 'vitest';
import { Graphics, Texture } from 'pixi.js';
import { ARENA_PRESETS, BLUE, LEGACY_PRESETS, RED, deployZoneRects, inDeployZone } from '../src/battle/arena';
import { ArenaView } from '../src/render/arenaView';
import { Camera } from '../src/render/camera';

// Keep the real Pixi geometry and masks; only the canvas hatch texture is stubbed.
vi.mock('../src/render/util', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/util')>(), tex: () => Texture.WHITE,
}));
vi.mock('../src/render/cellArt', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/cellArt')>(), drawHatch: () => null,
}));

describe('arena deployment highlights', () => {
  it('fills and masks exactly the legal cells, including after a size/rules change with a fixed camera', () => {
    const view = new ArenaView();
    const cam = new Camera();
    Object.assign(cam, { x: 40, y: 28, zoom: 4, w: 640, h: 480 });
    const fill = view.root.children[1] as Graphics;
    const masks = { 1: view.root.children[4] as Graphics, 2: view.root.children[5] as Graphics };
    for (const cfg of [ARENA_PRESETS.xl, ARENA_PRESETS.huge, LEGACY_PRESETS.small]) {
      view.update(cam, { width: cfg.width, height: cfg.height, wrapX: cfg.wrapX, wrapY: cfg.wrapY,
        zones: { 1: deployZoneRects(cfg, RED), 2: deployZoneRects(cfg, BLUE) } }, { showZones: [RED, BLUE] });
      for (let y = 0; y < cfg.height; y++) for (let x = 0; x < cfg.width; x++) {
        const [sx, sy] = cam.toScreen(x + 0.5, y + 0.5);
        const point = { x: sx, y: sy };
        const red = inDeployZone(cfg, RED, x, y), blue = inDeployZone(cfg, BLUE, x, y);
        expect(fill.containsPoint(point)).toBe(red || blue);
        expect(masks[RED].containsPoint(point)).toBe(red);
        expect(masks[BLUE].containsPoint(point)).toBe(blue);
      }
    }
    view.root.destroy({ children: true });
  });
});
