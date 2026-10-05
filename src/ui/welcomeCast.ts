import { Rectangle, type Renderer } from 'pixi.js';
import { t } from '../i18n';
import { Camera } from '../render/camera';
import { drawBud, drawCell, PALETTES } from '../render/cellArt';
import { OrganismView } from '../render/organisms';
import { Sim } from '../sim';
import { welcomePattern } from './welcomePatterns';

export const WELCOME_MOODS = [
  { mood: 'happy', label: t.welcome.moods[0], rule: '2 or 3 ~ lives on' },
  { mood: 'lonely', label: t.welcome.moods[1], rule: 'fewer than 2 ~ lonely' },
  { mood: 'crowded', label: t.welcome.moods[2], rule: 'more than 3 ~ crowded' },
  { mood: 'born', label: t.welcome.moods[3], rule: 'empty + exactly 3 ~ born' },
] as const;
export function welcomeFace(index: number) {
  const mood = WELCOME_MOODS[index].mood;
  const canvas = mood === 'born' ? drawBud() : drawCell(PALETTES[index], 1000 + index * 97, mood);
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

/** Use precisely the game's membrane, hatching and face art, rather than drawing a second mascot. */
export function welcomeCreature(renderer: Renderer, id: string): HTMLCanvasElement {
  const sim = new Sim();
  sim.addMany(welcomePattern(id, 0, 0), 0);
  const cam = new Camera();
  Object.assign(cam, { w: 180, h: 110, zoom: id === 'lwss' ? 18 : 23 });
  const view = new OrganismView();
  try {
    view.update(1200, sim, cam);
    return renderer.extract.canvas({ target: view.root, frame: new Rectangle(0, 0, 180, 110), resolution: 2 }) as HTMLCanvasElement;
  } finally { view.destroy(); }
}
