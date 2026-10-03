import { encodeRle, iterateRlePoints } from './rle';

export interface SharedState {
  points: [number, number][];
  cam?: { x: number; y: number; zoom: number };
}

export const LINK_VERSION = 1;
const MAX_POINTS = 200000;
/** engine.key() packs coordinates safely only below 2^20; stay well inside. */
const MAX_COORD = 500000;

export function toHash(state: SharedState): string {
  const { rle, x, y } = encodeRle(state.points);
  const params = new URLSearchParams({
    v: String(LINK_VERSION), p: rle, ox: String(x), oy: String(y),
  });
  if (state.cam && [state.cam.x, state.cam.y, state.cam.zoom].every(Number.isFinite)) {
    params.set('cx', String(Number(state.cam.x.toFixed(2))));
    params.set('cy', String(Number(state.cam.y.toFixed(2))));
    params.set('z', String(Number(state.cam.zoom.toFixed(2))));
  }
  return `#${params.toString()}`;
}

function numberParam(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function originParam(params: URLSearchParams, name: string): number {
  const value = numberParam(params, name);
  return value !== undefined && Number.isSafeInteger(value) ? value : 0;
}

export function fromHash(hash: string): SharedState | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const rle = params.get('p');
  if (params.get('v') !== String(LINK_VERSION) || rle === null) return null;

  const points: [number, number][] = [];
  for (const point of iterateRlePoints(rle, originParam(params, 'ox'), originParam(params, 'oy'))) {
    if (Math.abs(point[0]) > MAX_COORD || Math.abs(point[1]) > MAX_COORD) continue;
    points.push(point);
    if (points.length === MAX_POINTS) break;
  }
  const state: SharedState = { points };
  const x = numberParam(params, 'cx');
  const y = numberParam(params, 'cy');
  const zoom = numberParam(params, 'z');
  if (x !== undefined && y !== undefined && zoom !== undefined) {
    state.cam = { x, y, zoom: Math.max(2, Math.min(140, zoom)) };
  }
  return state;
}
