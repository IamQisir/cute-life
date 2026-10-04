import { MIN_ZOOM } from './camera';
import { boundsTarget, followBounds, type FollowTarget } from './follow';
import type { Bounds } from './framing';

const ENVELOPE_GENERATIONS = 30;
const COMFORT = 0.8;
const CENTRE_DRIFT = 0.15;
const ZOOM_STEP = 1.05;
const ZOOM_IN_RATIO = 1.3;
const SHRINK_GENERATIONS = 90;

interface Sample { generation: number; bounds: Bounds }

/** Aim is centred on the free viewport; UI offsets belong to the renderer. */
export interface FollowState {
  aim: FollowTarget | null;
  history: Sample[];
  viewW: number;
  viewH: number;
  shrinkSince: number | null;
}

export function createFollowState(aim: FollowTarget | null = null): FollowState {
  return { aim, history: [], viewW: 0, viewH: 0, shrinkSince: null };
}

function envelope(history: Sample[]): Bounds {
  return {
    left: Math.min(...history.map((s) => s.bounds.left)),
    top: Math.min(...history.map((s) => s.bounds.top)),
    right: Math.max(...history.map((s) => s.bounds.right)),
    bottom: Math.max(...history.map((s) => s.bounds.bottom)),
  };
}

/** Round down so a zoom bin never crops the requested fit. */
function zoomBin(zoom: number): number {
  return Math.max(MIN_ZOOM, MIN_ZOOM * ZOOM_STEP ** Math.floor(Math.log(zoom / MIN_ZOOM) / Math.log(ZOOM_STEP)));
}

/**
 * Pure generation-based follow decision. Repeated render frames do no work and
 * cannot advance the envelope or shrink timer. Record every simulation step,
 * including steps taken while the camera is easing or a stamp is gliding.
 */
export function updateFollow(state: FollowState, cells: Iterable<number>, generation: number,
  viewW: number, viewH: number): FollowState {
  const last = state.history.at(-1)?.generation;
  if (last === generation && state.viewW === viewW && state.viewH === viewH) return state;
  if (last !== undefined && generation < last) state = createFollowState();
  let history = state.history;
  if (last !== generation || !history.length) {
    const bounds = followBounds(cells);
    if (!bounds) return createFollowState();
    history = [...history.filter((s) => s.generation > generation - ENVELOPE_GENERATIONS), { generation, bounds }];
  }
  const body = envelope(history);
  // Extra room inside the comfort region accommodates unseen oscillator phases
  // at startup and leaves room for the rendered camera to ease behind a ship.
  const fit = boundsTarget(body, viewW * COMFORT, viewH * COMFORT);
  fit.zoom = zoomBin(fit.zoom);
  const next = { ...state, history, viewW, viewH };
  if (!state.aim) return { ...next, aim: fit, shrinkSince: null };

  const aim = state.aim;
  const width = viewW / aim.zoom;
  const height = viewH / aim.zoom;
  const outside = body.left < aim.x - width * COMFORT / 2 || body.right > aim.x + width * COMFORT / 2
    || body.top < aim.y - height * COMFORT / 2 || body.bottom > aim.y + height * COMFORT / 2;
  const drifted = Math.abs(fit.x - aim.x) > width * CENTRE_DRIFT || Math.abs(fit.y - aim.y) > height * CENTRE_DRIFT;
  const shrinking = fit.zoom > aim.zoom * ZOOM_IN_RATIO;
  const shrinkSince = shrinking ? (state.shrinkSince ?? generation) : null;
  const zoomIn = shrinkSince !== null && generation - shrinkSince >= SHRINK_GENERATIONS;
  if (!outside && !drifted && !zoomIn) return { ...next, shrinkSince };

  // Translation alone must not change zoom. Zoom out only for an oversized
  // envelope, and zoom in only after sustained shrinkage, even during a pan.
  const oversized = body.right - body.left > width * COMFORT || body.bottom - body.top > height * COMFORT;
  const zoomOut = oversized && fit.zoom < aim.zoom / ZOOM_STEP;
  return { ...next, aim: { x: fit.x, y: fit.y, zoom: zoomOut || zoomIn ? fit.zoom : aim.zoom },
    shrinkSince: zoomOut || zoomIn ? null : shrinkSince };
}
