import { encodeRle, iterateRlePoints } from './rle';
import { compressRle, decompressRle } from './compress';

export interface SharedState {
  points: [number, number][];
  cam?: { x: number; y: number; zoom: number };
}

export const LINK_VERSION = 2;
const MAX_POINTS = 200000;
/** engine.key() packs coordinates safely only below 2^20; stay well inside. */
const MAX_COORD = 500000;

export async function toHash(state: SharedState): Promise<string> {
  const { rle, x, y } = encodeRle(state.points);
  const params = new URLSearchParams({
    v: '1', p: rle, ox: String(x), oy: String(y),
  });
  if (state.cam && [state.cam.x, state.cam.y, state.cam.zoom].every(Number.isFinite)) {
    params.set('cx', String(Number(state.cam.x.toFixed(2))));
    params.set('cy', String(Number(state.cam.y.toFixed(2))));
    params.set('z', String(Number(state.cam.zoom.toFixed(2))));
  }
  const legacy = `#${params.toString()}`;
  try {
    const data = await compressRle(rle);
    const compressed = new URLSearchParams({ v: String(LINK_VERSION), d: data });
    for (const [name, value] of params) {
      if (name !== 'v' && name !== 'p') compressed.set(name, value);
    }
    const hash = `#${compressed.toString()}`;
    return hash.length < legacy.length ? hash : legacy;
  } catch {
    // Older browsers may lack CompressionStream or raw-deflate support.
    return legacy;
  }
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

export async function fromHash(hash: string): Promise<SharedState | null> {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  let rle: string;
  if (params.get('v') === '1') {
    const payload = params.get('p');
    if (payload === null) return null;
    rle = payload;
  } else if (params.get('v') === String(LINK_VERSION)) {
    const data = params.get('d');
    if (data === null) return null;
    try {
      rle = await decompressRle(data);
    } catch {
      return null;
    }
  } else {
    return null;
  }

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
