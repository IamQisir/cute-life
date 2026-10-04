export const WELCOME_SECONDS = 12;
export const WELCOME_ZOOM_START = 4;
export const WELCOME_ZOOM_END = 6.5;
export const WELCOME_IRIS_START = 5.6;
export const WELCOME_FINALE = 11;
export const WELCOME_FOCUS = { x: -48, y: -31 };
const FACE_ZOOM = 44;

const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const geometric = (a: number, b: number, t: number) => a * Math.pow(b / a, t);
export type WelcomeTransition = 'lens' | 'dive';

function macroCamera(seconds: number, width: number, height: number) {
  const zoom = Math.max(0.6, Math.min(3.2, (width - 24) / 360, (height - 140) / 300));
  const drift = smooth(seconds / WELCOME_ZOOM_START);
  return { x: mix(5, -20, drift), y: mix(-10, -25, drift), zoom };
}

/** Continuous dive, also useful independently of the desktop lens. */
export function welcomeCamera(seconds: number, width = 1280, height = 800) {
  const t = Math.max(0, Math.min(WELCOME_SECONDS, seconds));
  const macro = macroCamera(t, width, height);
  const flight = smooth((t - WELCOME_ZOOM_START) / (WELCOME_ZOOM_END - WELCOME_ZOOM_START));
  const pullback = smooth((t - WELCOME_FINALE) / (WELCOME_SECONDS - WELCOME_FINALE));
  return {
    x: mix(macro.x, WELCOME_FOCUS.x, flight),
    y: mix(macro.y, WELCOME_FOCUS.y, flight),
    zoom: mix(geometric(macro.zoom, FACE_ZOOM, flight), 40, pullback),
  };
}

/** One clock for both cameras, the iris, ink and mobile effects. No frame state. */
export function welcomeLensTimeline(seconds: number, width: number, height: number, transition: WelcomeTransition = 'lens') {
  const t = Math.max(0, Math.min(WELCOME_SECONDS, seconds));
  const macro = macroCamera(t, width, height);
  const roam = smooth((t - 4) / 1.6);
  const iris = smooth((t - WELCOME_IRIS_START) / (WELCOME_ZOOM_END - WELCOME_IRIS_START));
  const world = { x: mix(12, WELCOME_FOCUS.x, roam), y: mix(25, WELCOME_FOCUS.y, roam) };
  const sx = mix((world.x - macro.x) * macro.zoom + width / 2, width / 2, iris);
  const sy = mix((world.y - macro.y) * macro.zoom + height / 2, height / 2, iris);
  // Full-screen lens camera: world is always underneath the circle's centre.
  const lens = { x: world.x - (sx - width / 2) / FACE_ZOOM, y: world.y - (sy - height / 2) / FACE_ZOOM, zoom: FACE_ZOOM };
  const micro = welcomeCamera(t, width, height);
  const baseRadius = Math.min(width, height) * 0.24;
  const coveringRadius = Math.hypot(width / 2, height / 2);
  const enter = smooth((t - 4) / 0.35);
  const landed = t >= WELCOME_ZOOM_END || iris >= 1;
  const main = transition === 'dive' || landed ? micro : macro;
  return {
    main, lens, world, sx, sy,
    radius: mix(baseRadius * enter, coveringRadius, iris),
    lensVisible: transition === 'lens' && t >= 4 && !landed,
    inkAlpha: transition === 'lens' ? enter * (1 - smooth((t - 6.15) / 0.6)) : 0,
    landed,
    speedAlpha: transition === 'dive' ? Math.sin(Math.PI * clamp((t - 4) / 2.5)) * 0.65 : 0,
    // Flash at FADE_HI: creatures have fully given way to faces here.
    flashAlpha: transition === 'dive' ? Math.max(0, 1 - Math.abs(t - welcomeSemanticSwitch(width, height)) / 0.11) : 0,
  };
}

export function welcomeSemanticSwitch(width: number, height: number) {
  const start = macroCamera(0, width, height).zoom;
  const target = Math.log(17 / start) / Math.log(FACE_ZOOM / start);
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (smooth(mid) < target) lo = mid; else hi = mid;
  }
  return 4 + (lo + hi) / 2 * 2.5;
}

export function welcomeUsesDive(width: number, height: number, coarse: boolean, frameMs = 0) {
  return coarse || Math.min(width, height) < 600 || frameMs > 28;
}

export function welcomeBeat(seconds: number): number {
  return seconds < 4 ? 0 : seconds < WELCOME_ZOOM_END ? 1 : 2;
}
