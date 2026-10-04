// Developer-only show driver. No wall clock, catch-up cap or adaptive degradation.
import type { WelcomeHost } from './welcomeSandbox';
import { borrowSandbox } from './welcomeSandbox';
import type { WelcomePresentation } from './welcomeShow';
import { buildWelcomeScene, welcomePattern, WELCOME_GENESIS, WELCOME_GEN_PER_SEC } from './welcomeScene';
import { welcomeBeat, welcomeGeneration, welcomeLensTimeline, WELCOME_ZOOM_END } from './welcomeTimeline';
import { WelcomeLens } from './welcomeLens';
import { WelcomeParticles } from './welcomeParticles';

export class WelcomeExportShow {
  private restore: () => void;
  private lens: WelcomeLens;
  private particles: WelcomeParticles;
  private steps = 0;
  private inserted = 0;
  private beat = -1;
  private bitmap: boolean;
  private visible: boolean;
  constructor(private host: WelcomeHost, private presentation: WelcomePresentation) {
    this.restore = borrowSandbox(host, buildWelcomeScene());
    this.bitmap = presentation.view.dotBitmapEnabled;
    this.visible = presentation.view.visibleOrganismsOnly;
    presentation.view.dotBitmapEnabled = true;
    presentation.view.visibleOrganismsOnly = true;
    this.particles = new WelcomeParticles(presentation.stage);
    this.lens = new WelcomeLens(presentation.stage, presentation.view);
  }
  sample(seconds: number) {
    const { sim, cam } = this.host;
    const now = seconds * 1000;
    const frame = welcomeLensTimeline(seconds, cam.w, cam.h);
    Object.assign(cam, frame.main);
    const beat = welcomeBeat(seconds);
    if (beat !== this.beat) { sim.version++; this.beat = beat; }
    const seed = welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y);
    const visible = Math.min(seed.length, Math.max(0, Math.floor((seconds - 0.12) / 0.18) + 1));
    if (visible > this.inserted) {
      sim.addMany(seed.slice(this.inserted, visible), now);
      this.inserted = visible;
    }
    sim.animMs = seconds >= WELCOME_ZOOM_END && seconds < 13.5 ? 225 : 900 / WELCOME_GEN_PER_SEC;
    const births: number[] = [];
    // At 60 fps there is at most one generation per frame. Never skip a generation.
    while (this.steps < welcomeGeneration(seconds)) { births.push(...sim.advance(now)); this.steps++; }
    sim.prune(now);
    this.particles.update(now, seconds, births, cam);
    this.lens.update(now, sim, cam.w, cam.h, frame);
    this.presentation.view.update(now, sim, cam, null, true);
    return { frame, births, generation: sim.generation };
  }
  dispose() {
    this.lens.destroy(); this.particles.destroy();
    this.presentation.view.dotBitmapEnabled = this.bitmap;
    this.presentation.view.visibleOrganismsOnly = this.visible;
    if (!this.bitmap) this.presentation.view.releaseDotBitmap();
    this.restore();
  }
}
