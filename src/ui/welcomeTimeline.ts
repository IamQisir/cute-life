export const WELCOME_SECONDS = 11;
export const WELCOME_ZOOM_START = 4;
export const WELCOME_ZOOM_END = 10;

const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Seconds, not frames. Narrow screens start farther out to include the world. */
export function welcomeCamera(seconds: number, width = 1280, height = 800) {
  const startZoom = Math.max(0.6, Math.min(3.2, (width - 24) / 360, (height - 140) / 300));
  const drift = smooth(seconds / WELCOME_ZOOM_START);
  const flight = smooth((seconds - WELCOME_ZOOM_START) / (WELCOME_ZOOM_END - WELCOME_ZOOM_START));
  return {
    x: mix(mix(5, -20, drift), -69, flight),
    y: mix(mix(-10, -25, drift), -35, flight),
    // Geometric interpolation makes the change of scale feel even.
    zoom: startZoom * Math.pow(44 / startZoom, flight),
  };
}

export function welcomeBeat(seconds: number): number {
  return seconds < 3 ? 0 : seconds < 9 ? 1 : 2;
}
