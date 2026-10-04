import { buds, key, keyX, keyY, neighborCounts, step, type Cells } from '../life/engine';
import type { Sim } from '../sim';
import { buildWelcomeScene, welcomePattern, WELCOME_GENESIS, WELCOME_PRE_ADVANCE } from './welcomeScene';
import { welcomeGeneration, WELCOME_SECONDS } from './welcomeTimeline';

// The engine's keys are 42-bit numbers, so they MUST NOT be truncated to Int32.
// The show stays within signed 12-bit coordinates. Counts occupy the top byte.
function pack(k: number, count = 0) {
  const x = keyX(k), y = keyY(k);
  if (x < -2048 || x > 2047 || y < -2048 || y > 2047) throw new RangeError('Bake coordinate overflow');
  return ((x & 4095) << 12) | (y & 4095) | (count << 24);
}
function unpack(value: number) {
  const x = (value >> 12) & 4095, y = value & 4095;
  return key(x >= 2048 ? x - 4096 : x, y >= 2048 ? y - 4096 : y);
}
export interface BakedFrame {
  generation: number;
  cells: Uint32Array;
  /** Full neighbour map, not just live-cell moods; preserves Sim bookkeeping. */
  counts: Uint32Array;
}
export function encodeFrame(cells: Cells, generation: number): BakedFrame {
  const counts = neighborCounts(cells);
  return { generation, cells: Uint32Array.from(cells, (k) => pack(k)),
    counts: Uint32Array.from(counts, ([k, n]) => pack(k, n)) };
}
export function decodeFrame(frame: BakedFrame) {
  const cells = new Set<number>();
  for (const value of frame.cells) cells.add(unpack(value));
  const counts = new Map<number, number>();
  for (const value of frame.counts) counts.set(unpack(value), value >>> 24);
  return { cells, counts, budKeys: buds(cells, counts) };
}
export function frameBytes(frame: BakedFrame) { return frame.cells.byteLength + frame.counts.byteLength; }
/** Stream frame zero before stepping, then all 153 generations, shared by main and lens. */
export function* bakeWelcome(small = false): Generator<BakedFrame> {
  let cells = buildWelcomeScene(small);
  yield encodeFrame(cells, 0);
  for (const [x, y] of welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y)) cells.add(key(x, y));
  for (let generation = 1; generation <= welcomeGeneration(WELCOME_SECONDS); generation++) {
    cells = step(cells);
    yield encodeFrame(cells, generation);
  }
}
/** Same birth/death bookkeeping as Sim.advance, without Life computation. */
export function applyBakedFrame(sim: Sim, frame: BakedFrame, now: number, reset = false): number[] {
  const state = decodeFrame(frame);
  const births: number[] = [];
  if (reset) { sim.bornAt = new Map(); sim.fading = []; }
  else {
    for (const k of state.cells) if (!sim.cells.has(k)) births.push(k);
    for (const k of sim.cells) if (!state.cells.has(k)) sim.fading.push({ k, t0: now });
    sim.prune(now);
    for (const k of births) sim.bornAt.set(k, now);
  }
  Object.assign(sim, state);
  sim.generation = WELCOME_PRE_ADVANCE + frame.generation;
  sim.version++;
  return births;
}
export type BakeMessage = { small: boolean; frame: BakedFrame } | { small: boolean; bytes: number; ms: number };

