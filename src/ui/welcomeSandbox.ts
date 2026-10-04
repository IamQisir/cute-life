import { buds, neighborCounts, type Cells } from '../life/engine';
import type { Camera } from '../render/camera';
import type { Sim } from '../sim';
import { WELCOME_GEN_PER_SEC, WELCOME_PRE_ADVANCE } from './welcomeScene';

export interface WelcomeHost {
  sim: Sim;
  cam: Camera;
  playing(): boolean;
  following(): boolean;
  setPlaying(on: boolean): void;
  setFollowing(on: boolean): void;
  refreshStatus(): void;
}

/** Swap references so the sandbox's animation records are preserved as well. */
export function borrowSandbox(host: WelcomeHost, cells: Cells): () => void {
  const { sim, cam } = host;
  const saved = {
    cells: sim.cells, counts: sim.counts, budKeys: sim.budKeys,
    bornAt: sim.bornAt, fading: sim.fading, generation: sim.generation, animMs: sim.animMs,
  };
  const camera = { x: cam.x, y: cam.y, zoom: cam.zoom };
  const playing = host.playing();
  const following = host.following();
  host.setPlaying(false);
  host.setFollowing(false);
  sim.cells = cells;
  sim.counts = neighborCounts(cells);
  sim.budKeys = buds(cells, sim.counts);
  sim.bornAt = new Map();
  sim.fading = [];
  sim.generation = WELCOME_PRE_ADVANCE;
  sim.animMs = 900 / WELCOME_GEN_PER_SEC;
  sim.version++;
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    Object.assign(sim, saved);
    // Keep renderer cache identities monotonic; never restore an old version.
    sim.version++;
    Object.assign(cam, camera);
    host.setFollowing(following);
    host.setPlaying(playing);
    host.refreshStatus();
  };
}
