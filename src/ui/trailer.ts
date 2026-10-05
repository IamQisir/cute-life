// The intro trailer as pure functions of time. One tempo drives everything:
// camera, cuts, captions, effects, simulation speed and the score all read
// the cue sheet below, so they can never drift apart.
import { WELCOME_GENESIS, WELCOME_WORLD } from './welcomeScene';

export const BPM = 128;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
/** Bar.beat → seconds. */
export const at = (bar: number, beat = 0) => (bar * 4 + beat) * BEAT;
export const TRAILER_SECONDS = at(10, 1.6);

export type Section = 'hook' | 'build' | 'drop' | 'montage' | 'hush' | 'slam' | 'end';
export const SECTIONS: readonly { name: Section; start: number; end: number }[] = [
  { name: 'hook', start: 0, end: at(1) },
  { name: 'build', start: at(1), end: at(4) },
  { name: 'drop', start: at(4), end: at(5) },
  { name: 'montage', start: at(5), end: at(8) },
  { name: 'hush', start: at(8), end: at(8, 2) },
  { name: 'slam', start: at(8, 2), end: at(9) },
  { name: 'end', start: at(9), end: TRAILER_SECONDS },
];
export function sectionAt(t: number): Section {
  return (SECTIONS.find((s) => t < s.end) ?? SECTIONS[SECTIONS.length - 1]).name;
}

/** Montage shots, two beats each; every one starts on a beat with a hard cut. */
export const MONTAGE = [
  { start: at(5), name: 'gun', x: -128, y: -97, zoom: 40 },
  { start: at(5, 2), name: 'chaos', x: -128, y: 92, zoom: 22 },
  { start: at(6), name: 'fleet', x: NaN, y: 84, zoom: 10 },
  { start: at(6, 2), name: 'pulsars', x: -159, y: 10, zoom: 17 },
  { start: at(7), name: 'armada', x: NaN, y: 78, zoom: 4.6 },
  { start: at(7, 2), name: 'bloom', x: 2, y: -120, zoom: 26 },
] as const;

/** Hard cuts: the only places where the camera may jump. */
export const CUTS = [at(5), ...MONTAGE.slice(1).map((s) => s.start), at(8)] as const;
/** Impacts: shake, and the loud hits in the score. */
export const IMPACTS = [at(1), at(5), at(8, 2), at(9)] as const;
/** Punch-in kicks on beats 1 and 3 of the build bars. */
export const KICKS = [1, 2, 3].flatMap((bar) => [at(bar), at(bar, 2)]);

export const CAPTIONS = [
  { start: at(2), end: at(3), text: 'FOUR LITTLE RULES', place: 'centre' },
  { start: at(3), end: at(4), text: 'ENDLESS LIFE', place: 'centre' },
  { start: at(5), end: at(6), text: 'MEET THEM', place: 'low' },
  { start: at(7), end: at(8), text: 'BUILD · BATTLE · SHARE', place: 'low' },
] as const;
export const TAGLINE = { start: at(9, 1), text: "a cosy little game based on Conway's Game of Life" } as const;

/** Hook: the R-pentomino's five cells pop in on beats 0, 1, 1.5, 2, 2.5. */
export const GENESIS_POPS = [at(0, 0), at(0, 1), at(0, 1.5), at(0, 2), at(0, 2.5)] as const;
/** Slam: the title's eight letters pop in on sixteenth notes. */
export const LETTER_POPS = Array.from({ length: 8 }, (_, i) => at(8, 2 + i / 4));

const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u); };
const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
const easeIn = (t: number) => clamp(t) ** 3;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const logMix = (a: number, b: number, t: number) => a * Math.pow(b / a, t);

/**
 * Generations per second, piecewise linear, so the simulation speeds up
 * through the build, slows down for faces and holds its breath in the hush.
 */
const RATE: readonly [number, number][] = [
  [0, 0], [at(1) - 1e-6, 0], [at(1), 10], [at(4), 26], [at(4) + 1e-6, 12], [at(5), 12],
  [at(5) + 1e-6, 8], [at(8), 8], [at(8) + 1e-6, 4], [at(8, 2), 4], [at(8, 2) + 1e-6, 12], [TRAILER_SECONDS, 12],
];
/** Simulation steps since the show began (the integral of RATE). */
export function trailerGeneration(seconds: number) {
  const t = Math.max(0, Math.min(TRAILER_SECONDS, seconds));
  let total = 0;
  for (let i = 1; i < RATE.length; i++) {
    const [t0, r0] = RATE[i - 1], [t1, r1] = RATE[i];
    if (t <= t0) break;
    const end = Math.min(t, t1), r = mix(r0, r1, (end - t0) / (t1 - t0 || 1));
    total += (r0 + r) / 2 * (end - t0);
  }
  return Math.floor(total + 1e-9);
}

/** Zooms are written for a 1080-px short side and scale with the frame. */
export function frameScale(width: number, height: number) { return Math.min(width, height) / 1080; }
export function wideZoom(width: number, height: number) {
  // Fill either aspect ratio with the field while keeping the 260-cell title in view.
  return Math.max(0.45, Math.min(width / 280, Math.max(width / WELCOME_WORLD.width, height / 640)));
}
/** The fleet travels left at c/2; this tracks one ship in the middle of it. */
export function fleetX(generation: number) { return 100 - generation / 2; }
export function armadaX(generation: number) { return 64 - generation / 2; }

const FACE = 40;
/** The build ends over the dense upper batteries; the drop pans on from there. */
const BUILD_END_Y = -185;
/** The hush: one blinker pulsing like a heartbeat in the middle of the empty page. */
export const HUSH_BLINKER: readonly [number, number][] = [[-1, 1], [0, 1], [1, 1]];
const FOCUS = { x: -128, y: -97 };
export type Pose = { x: number; y: number; zoom: number };
export type TrailerFrame = {
  section: Section;
  camera: Pose;
  /** Screen-space shake in px, already folded into `camera`. */
  shake: number;
  lens: { visible: boolean; sx: number; sy: number; radius: number; camera: Pose; inkAlpha: number };
  flash: number;
  speedLines: number;
  paperFade: number;
  letters: number;
  tagline: number;
};

const since = (t: number, marks: readonly number[]) => {
  let best = Infinity;
  for (const m of marks) if (t >= m && t - m < best) best = t - m;
  return best;
};

function baseCamera(t: number, w: number, h: number, generation: number): Pose {
  const s = frameScale(w, h), wide = wideZoom(w, h);
  const face = FACE * s;
  const genesis = { x: WELCOME_GENESIS.x + 1, y: WELCOME_GENESIS.y + 1 };
  if (t < at(1)) return { ...genesis, zoom: face * mix(1, 1.08, smooth(t / at(1))) };
  if (t < at(4)) {
    // One continuous, decelerating pull-back over the upper field (the centre
    // is kept clear for the title), swinging left and back.
    const u = (t - at(1)) / (at(4) - at(1));
    const z = easeOut(u);
    return {
      x: genesis.x - Math.sin(Math.PI * u) * 34,
      y: mix(genesis.y, BUILD_END_Y, smooth(u)),
      zoom: logMix(face * 1.08, wide * 1.3, z),
    };
  }
  if (t < at(5)) {
    // A fast pan from the build's last frame down to the focus battery while the magnifier hunts.
    const u = (t - at(4)) / BAR;
    const pan = easeOut(u * 1.6);
    return { x: mix(WELCOME_GENESIS.x + 1, -112, pan), y: mix(BUILD_END_Y, -90, pan), zoom: logMix(wide * 1.3, 6.2 * s, pan) };
  }
  if (t < at(8)) {
    const shot = [...MONTAGE].reverse().find((m) => t >= m.start)!;
    const u = (t - shot.start) / (BEAT * 2);
    // Every shot pushes in a little: momentum without a cut in the middle.
    const zoom = shot.zoom * s * mix(1, 1.12, u);
    if (shot.name === 'fleet') return { x: fleetX(generation), y: shot.y, zoom };
    if (shot.name === 'armada') return { x: armadaX(generation) + mix(18, -18, u), y: shot.y, zoom };
    return { x: shot.x, y: shot.y, zoom };
  }
  if (t < at(8, 2)) return { x: 0, y: 1, zoom: face * mix(1, 1.04, (t - at(8)) / (BEAT * 2)) };
  if (t < at(9)) {
    // Rapid, decelerating pull-back while the letters pop in.
    return { x: 0, y: 1, zoom: logMix(face, wide * 0.97, easeOut((t - at(8, 2)) / (BEAT * 2) * 1.15)) };
  }
  // End card: a slow settle and drift.
  return { x: mix(0, 3, smooth((t - at(9)) / (TRAILER_SECONDS - at(9)))), y: 1, zoom: wide * mix(0.97, 1, smooth((t - at(9)) / BAR)) };
}

export function trailerFrame(seconds: number, width: number, height: number, generation = trailerGeneration(seconds)): TrailerFrame {
  const t = Math.max(0, Math.min(TRAILER_SECONDS, seconds));
  const s = frameScale(width, height);
  const section = sectionAt(t);
  const camera = baseCamera(t, width, height, generation);

  // Punch-in kicks through the build; a sharp kick back on the hook's boom.
  const kick = since(t, KICKS);
  if (section === 'build' && kick < BEAT) camera.zoom *= 1 + 0.07 * Math.exp(-kick / 0.09);
  // Shake on impacts, deterministic.
  const hit = since(t, IMPACTS);
  const shake = hit < 0.35 ? 14 * s * Math.exp(-hit / 0.09) : 0;
  if (shake) {
    camera.x += shake * Math.sin(t * 91.7) / camera.zoom;
    camera.y += shake * Math.cos(t * 77.3) / camera.zoom;
  }

  // Magnifier: enters fast, hunts, locks onto the gun, irises open on bar 5.
  const lensT = t - at(4);
  const enter = easeOut(lensT / (BEAT * 0.75));
  const lock = smooth((lensT - BEAT) / (BEAT * 1.5));
  const iris = easeIn((t - at(4, 3.5)) / (BEAT * 0.5));
  const target = { x: mix(FOCUS.x + 26, FOCUS.x, lock), y: mix(FOCUS.y + 18, FOCUS.y, lock) };
  const fx = (target.x - camera.x) * camera.zoom + width / 2;
  const fy = (target.y - camera.y) * camera.zoom + height / 2;
  const sx = mix(mix(width * 1.15, fx, enter), width / 2, iris);
  const sy = mix(fy, height / 2, iris);
  const face = FACE * s;
  const lensCamera = { x: FOCUS.x - (sx - width / 2) / face, y: FOCUS.y - (sy - height / 2) / face, zoom: face };
  const radius = mix(Math.min(width, height) * 0.25, Math.hypot(width, height) / 2 + 2, iris);
  const lensOn = section === 'drop';

  const flash = Math.max(
    flashAt(t, at(5), 1), flashAt(t, at(8, 2), 0.55), ...MONTAGE.slice(1).map((m) => flashAt(t, m.start, 0.18)),
  );
  const speedLines = Math.max(
    section === 'build' ? 0.32 * smooth((t - at(2, 2)) / BAR) : 0,
    section === 'slam' ? 0.5 * (1 - smooth((t - at(8, 2)) / (BEAT * 2))) : 0,
    section === 'drop' ? 0.28 * smooth((t - at(4, 2)) / BEAT) : 0,
  );
  return {
    section, camera, shake,
    lens: { visible: lensOn, sx, sy, radius, camera: lensCamera, inkAlpha: lensOn ? enter * (1 - iris) : 0 },
    flash, speedLines,
    paperFade: smooth((t - (TRAILER_SECONDS - 0.75)) / 0.75),
    letters: LETTER_POPS.filter((p) => t >= p).length,
    tagline: smooth((t - TAGLINE.start) / (BEAT * 1.5)),
  };
}

function flashAt(t: number, mark: number, strength: number) {
  const d = t - mark;
  if (d < 0) return 0;
  return strength * (d < 1 / 30 ? 1 : Math.exp(-(d - 1 / 30) / 0.08));
}

/** The caption on screen at t, with its slam animation. */
export function captionAt(seconds: number) {
  const c = CAPTIONS.find((cap) => seconds >= cap.start && seconds < cap.end);
  if (!c) return null;
  const d = seconds - c.start, left = c.end - seconds;
  // Back-out slam: in from 1.7x with a little overshoot, then a slow creep.
  const slam = clamp(d / 0.16);
  const back = 1 + 2.2 * (slam - 1) ** 3 + 1.2 * (slam - 1) ** 2;
  const scale = (slam < 1 ? mix(1.7, 1, back) : 1) * (1 + 0.03 * d);
  const alpha = Math.min(clamp(d / 0.05), clamp(left / 0.12));
  return { text: c.text, place: c.place, scale, alpha, rotate: (c.text.length % 2 ? -1 : 1) * 1.6 * Math.PI / 180 * (1 - slam) };
}
