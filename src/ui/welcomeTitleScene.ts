import { fromList } from '../life/engine';
import type { Cells } from '../life/engine';
import { welcomePattern } from './welcomePatterns';

/** A separate, compact live menu tableau: the real renderer draws its creatures. */
export function buildTitleScene(): Cells {
  return fromList([
    ...welcomePattern('pulsar', -48, -25), ...welcomePattern('pulsar', 48, 25),
    ...welcomePattern('pentadecathlon', -40, 30),
    ...['lwss', 'mwss', 'hwss'].flatMap((id, i) => welcomePattern(id, 35 + i * 20, -20 + i * 20)),
    ...welcomePattern('glider', -10, -35), ...welcomePattern('glider', 10, 35),
  ]);
}

export function welcomeTitleCamera(seconds: number) {
  return { x: -12 + Math.sin(seconds * 0.08) * 14, y: Math.sin(seconds * 0.11) * 8, zoom: 7 };
}
