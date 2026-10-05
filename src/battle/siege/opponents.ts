// Phase 1 opponents: fixed sample armies from the Phase 0 experiments
// (docs/specs/crystal-siege-experiments.md, births recipes). Written for the
// red side; the opponent mirrors them. Picked at random, never by looking at
// the player's army: deployment stays hidden and simultaneous.

import type { Team } from '../arena';
import { RED } from '../arena';
import type { Prefabs, Stamp } from './prefabs';
import { PREFABS, mirrorStamps } from './units';

export type SampleId = 'artillery' | 'fortress' | 'rush' | 'hybrid' | 'breach' | 'wave';

const GUN: Stamp = { id: 'gosperglidergun', x: 51, y: 4, orientation: 7 };
const WIDTH = 128;
/** Recipes the experiments wrote for blue, as red recipes. */
const fromBlue = (stamps: Stamp[]) => mirrorStamps(PREFABS, stamps, WIDTH);
/** The certified blue eater port (69,35)/o0 on the red side: covers the enemy's upper gun route. */
const [EATER] = fromBlue([{ id: 'eater1', x: 69, y: 35, orientation: 0 }]);

export const SAMPLE_ARMIES: Record<SampleId, Stamp[]> = {
  // Upper gun + eater ("upper gun + eater" defence in the experiments).
  artillery: [GUN, EATER],
  // Mirror of the exact-72 functioning gun+eater defence.
  fortress: fromBlue([
    { id: 'gosperglidergun', x: 68, y: 56, orientation: 5 }, { id: 'eater1', x: 69, y: 35, orientation: 0 },
    { id: 'glider', x: 110, y: 4, orientation: 2 },
    ...[90, 98, 106].flatMap((x) => [72, 80].map((y): Stamp => ({ id: 'block', x, y }))),
  ]),
  // Tournament rush: five LWSS.
  rush: [
    { id: 'lwss', x: 4, y: 42, orientation: 4 }, { id: 'lwss', x: 14, y: 42, orientation: 4 },
    { id: 'lwss', x: 24, y: 42, orientation: 4 }, { id: 'lwss', x: 4, y: 49, orientation: 4 },
    { id: 'lwss', x: 14, y: 49, orientation: 4 },
  ],
  // Tournament hybrid.
  hybrid: [
    GUN, { id: 'lwss', x: 8, y: 49, orientation: 2 }, { id: 'lwss', x: 18, y: 49, orientation: 2 },
    { id: 'rpentomino', x: 54, y: 57 }, { id: 'rpentomino', x: 48, y: 49 }, { id: 'block', x: 44, y: 63 },
  ],
  // Exact-72 gun-dependent breach.
  breach: [
    GUN, { id: 'lwss', x: 4, y: 46, orientation: 4 }, { id: 'lwss', x: 14, y: 46, orientation: 4 },
    { id: 'rpentomino', x: 54, y: 54 }, { id: 'rpentomino', x: 48, y: 46 },
    { id: 'block', x: 44, y: 60 }, { id: 'block', x: 4, y: 4 },
  ],
  // Whole-budget eight-LWSS wave.
  wave: [4, 11, 18, 25].flatMap((x) => [44, 50].map((y): Stamp => ({ id: 'lwss', x, y, orientation: 2 }))),
};

export const SAMPLE_IDS = Object.keys(SAMPLE_ARMIES) as SampleId[];

/** A sample army for `team` (mirrored for blue). */
export function sampleArmy(prefabs: Prefabs, id: SampleId, team: Team, width: number): Stamp[] {
  const red = SAMPLE_ARMIES[id];
  return team === RED ? red.map((s) => ({ ...s })) : mirrorStamps(prefabs, red, width);
}

/** A random sample, avoiding `previous` so rematches vary. */
export function pickSample(random: () => number, previous?: SampleId): SampleId {
  const pool = SAMPLE_IDS.filter((id) => id !== previous);
  return pool[Math.floor(random() * pool.length) % pool.length];
}
