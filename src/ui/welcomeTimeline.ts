import { WELCOME_GENESIS, WELCOME_GEN_PER_SEC, WELCOME_WORLD } from './welcomeScene';

export const WELCOME_SECONDS = 16;
export const WELCOME_ZOOM_START = 8;
export const WELCOME_ZOOM_END = 10.5;
export const WELCOME_IRIS_START = 9.6;
export const WELCOME_FINALE = 13.5;
export const WELCOME_FOCUS = { x: -130, y: -100 };
export const WELCOME_EVOLVE_START = 1.2;
const FACE_ZOOM = 44;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const geometric = (a: number, b: number, t: number) => t === 1 ? b : a * Math.pow(b / a, t);
export type WelcomeTransition = 'lens' | 'dive';
type Pose = { x: number; y: number; zoom: number };
const move = (a: Pose, b: Pose, t: number): Pose => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), zoom: geometric(a.zoom, b.zoom, t) });

export const WELCOME_SHOTS = [
  { start: 0, end: 2.5, name: 'genesis', caption: 'a few cells ~ a whole universe', cut: false },
  { start: 2.5, end: 6, name: 'world', caption: 'tiny rules. endless possibilities.', cut: false },
  { start: 6, end: 8, name: 'fleet', caption: 'meet the creatures ~ going places', cut: true },
  { start: 8, end: 10.5, name: 'magnifier', caption: 'come closer ~ there’s life inside', cut: true },
  { start: 10.5, end: 13.5, name: 'faces', caption: 'four little rules bring them to life', cut: false },
  { start: 13.5, end: 16, name: 'reveal', caption: 'and this little world is yours ~', cut: false },
] as const;
export function welcomeBeat(seconds: number) { return Math.max(0, WELCOME_SHOTS.filter((shot) => seconds >= shot.start).length - 1); }
export function welcomeWideZoom(width: number, height: number) {
  return Math.max(0.45, Math.min(3.2, (width - 32) / WELCOME_WORLD.width, (height - 150) / WELCOME_WORLD.height));
}
export function welcomeTitleCamera(seconds: number) {
  return { x: -12 + Math.sin(seconds * 0.08) * 14, y: Math.sin(seconds * 0.11) * 8, zoom: 7 };
}
/** Slow the close-up to four generations/sec so moods and births can be read. */
export function welcomeGeneration(seconds: number) {
  const t = Math.max(0, Math.min(WELCOME_SECONDS, seconds));
  const before = Math.max(0, Math.min(t, WELCOME_ZOOM_END) - WELCOME_EVOLVE_START) * WELCOME_GEN_PER_SEC;
  const faces = Math.max(0, Math.min(t, WELCOME_FINALE) - WELCOME_ZOOM_END) * 4;
  const after = Math.max(0, t - WELCOME_FINALE) * WELCOME_GEN_PER_SEC;
  return Math.floor(before + faces + after);
}
export function welcomeFleetX(seconds: number) { return 100 - welcomeGeneration(seconds) / 2; }

/** Distinct, eased shots on one world. Only the two declared whip cuts are discontinuous. */
export function welcomeCamera(seconds: number, width = 1280, height = 800): Pose {
  const t = Math.max(0, Math.min(WELCOME_SECONDS, seconds));
  const wide = welcomeWideZoom(width, height);
  const worldStart = { x: -25, y: -20, zoom: wide * 1.15 };
  if (t < 2.5) return move({ ...WELCOME_GENESIS, zoom: FACE_ZOOM }, worldStart, smooth((t - 1.25) / 1.25));
  if (t < 6) {
    const u = smooth((t - 2.5) / 3.5);
    const pose = move(worldStart, { x: 28, y: 18, zoom: wide }, u);
    pose.y -= Math.sin(u * Math.PI) * 32;
    return pose;
  }
  // Continuous tracking velocity; the actual flotilla moves c/2, not camera easing.
  if (t < 8) return { x: 100 - Math.max(0, t - WELCOME_EVOLVE_START) * WELCOME_GEN_PER_SEC / 2 + 18 * (1 - smooth((t - 6) / 2)), y: 84, zoom: mix(8, 10, smooth((t - 6) / 2)) };
  if (t < WELCOME_ZOOM_END) return move({ x: -85, y: -72, zoom: 4.5 }, { ...WELCOME_FOCUS, zoom: FACE_ZOOM }, smooth((t - 8) / 2.5));
  if (t < WELCOME_FINALE) return { ...WELCOME_FOCUS, zoom: FACE_ZOOM };
  return move({ ...WELCOME_FOCUS, zoom: FACE_ZOOM }, { x: 0, y: 0, zoom: wide }, smooth((t - WELCOME_FINALE) / 1.9));
}

/** Pure lens geometry; at full coverage both cameras are identical. */
export function welcomeLensTimeline(seconds: number, width: number, height: number, transition: WelcomeTransition = 'lens') {
  const t = Math.max(0, Math.min(WELCOME_SECONDS, seconds));
  const main = welcomeCamera(t, width, height);
  const iris = smooth((t - WELCOME_IRIS_START) / (WELCOME_ZOOM_END - WELCOME_IRIS_START));
  const roam = smooth((t - 8) / 1.6);
  const world = { x: mix(WELCOME_FOCUS.x + 12, WELCOME_FOCUS.x, roam), y: mix(WELCOME_FOCUS.y + 5, WELCOME_FOCUS.y, roam) };
  const sx = mix((world.x - main.x) * main.zoom + width / 2, width / 2, iris);
  const sy = mix((world.y - main.y) * main.zoom + height / 2, height / 2, iris);
  const lens = { x: world.x - (sx - width / 2) / FACE_ZOOM, y: world.y - (sy - height / 2) / FACE_ZOOM, zoom: FACE_ZOOM };
  const enter = smooth((t - 8) / 0.35);
  const landed = t >= WELCOME_ZOOM_END;
  const cutFlash = Math.max(...WELCOME_SHOTS.filter((shot) => shot.cut).map((shot) => Math.max(0, 1 - Math.abs(t - shot.start) / 0.14)));
  return {
    main, lens, world, sx, sy,
    radius: mix(Math.min(width, height) * 0.24 * enter, Math.hypot(width / 2, height / 2), iris),
    lensVisible: transition === 'lens' && t >= 8 && !landed,
    inkAlpha: transition === 'lens' ? enter * (1 - smooth((t - 10.05) / 0.6)) * (t >= 8 && t <= 10.65 ? 1 : 0) : 0,
    landed,
    speedAlpha: Math.max(Math.sin(Math.PI * clamp((t - 1.25) / 1.25)) * 0.35, Math.sin(Math.PI * clamp((t - 13.5) / 1.9)) * 0.45,
      transition === 'dive' ? Math.sin(Math.PI * clamp((t - 8) / 2.5)) * 0.5 : 0),
    flashAlpha: Math.max(cutFlash, transition === 'dive' ? Math.max(0, 1 - Math.abs(t - welcomeSemanticSwitch(width, height)) / 0.11) : 0),
  };
}
export function welcomeSemanticSwitch(_width: number, _height: number) {
  const target = Math.log(17 / 4.5) / Math.log(FACE_ZOOM / 4.5);
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (smooth(mid) < target) lo = mid; else hi = mid; }
  return 8 + (lo + hi) / 2 * 2.5;
}
export function welcomeUsesDive(width: number, height: number, coarse: boolean, frameMs = 0) {
  return coarse || Math.min(width, height) < 600 || frameMs > 28;
}
