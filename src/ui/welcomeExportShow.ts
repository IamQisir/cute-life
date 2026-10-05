// Developer-only trailer driver (export and preview). No wall clock: the
// caller passes the time, and the simulation only ever steps forward.
import { keyX, keyY } from '../life/engine';
import type { WelcomeHost } from './welcomeSandbox';
import { borrowSandbox } from './welcomeSandbox';
import type { WelcomePresentation } from './welcomeShow';
import { buildWelcomeScene, LETTERING_RECT, welcomeLetters, welcomePattern, WELCOME_GENESIS } from './welcomeScene';
import { at, GENESIS_POPS, HUSH_BLINKER, LETTER_POPS, trailerFrame, trailerGeneration, type TrailerFrame } from './trailer';
import { WelcomeLens } from './welcomeLens';
import { WelcomeParticles } from './welcomeParticles';

export interface TrailerShowOptions {
  /** Export renders every cell sprite; the preview may use the cheaper dot bitmap. */
  dotBitmap: boolean;
}

export class WelcomeExportShow {
  private restore: () => void;
  private lens: WelcomeLens;
  private particles: WelcomeParticles;
  private steps = 0;
  private popped = 0;
  private letters = 0;
  private cleared = 0;
  private hushed = false;
  private bitmap: boolean;
  private visible: boolean;
  private genesis = welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y);
  private letterCells = welcomeLetters();
  constructor(private host: WelcomeHost, private presentation: WelcomePresentation, options: TrailerShowOptions) {
    // The title stays out of the world until it slams in at the end.
    this.restore = borrowSandbox(host, buildWelcomeScene(false, false));
    this.bitmap = presentation.view.dotBitmapEnabled;
    this.visible = presentation.view.visibleOrganismsOnly;
    presentation.view.dotBitmapEnabled = options.dotBitmap;
    presentation.view.visibleOrganismsOnly = true;
    this.particles = new WelcomeParticles(presentation.stage);
    this.lens = new WelcomeLens(presentation.stage, presentation.view);
  }

  /** Wipe the title's footprint so the letters land on clean paper. */
  private clearTitleArea(now: number) {
    const { sim } = this.host;
    const r = LETTERING_RECT;
    for (const k of [...sim.cells]) {
      const x = keyX(k), y = keyY(k);
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) sim.set(x, y, false, now);
    }
  }

  sample(seconds: number): { frame: TrailerFrame; births: number[]; generation: number } {
    const { sim, cam } = this.host;
    const now = seconds * 1000;
    // Hook: genesis cells pop in on the beat.
    const pops = GENESIS_POPS.filter((p) => seconds >= p).length;
    if (pops > this.popped) {
      sim.addMany(this.genesis.slice(this.popped, pops), now);
      this.popped = pops;
    }
    const births: number[] = [];
    // Faces get longer birth animations in the slow montage.
    sim.animMs = seconds >= at(5) && seconds < at(8, 2) ? 260 : 150;
    const target = trailerGeneration(seconds);
    while (this.steps < target) { births.push(...sim.advance(now)); this.steps++; }
    for (const [i, mark] of [at(7, 2), at(8, 2)].entries()) {
      if (seconds >= mark && this.cleared <= i) { this.clearTitleArea(now); this.cleared = i + 1; }
    }
    if (seconds >= at(8) && !this.hushed) { sim.addMany([...HUSH_BLINKER], now); this.hushed = true; }
    const letters = LETTER_POPS.filter((p) => seconds >= p).length;
    if (letters > this.letters) {
      sim.addMany(this.letterCells.slice(this.letters, letters).flat(), now);
      this.letters = letters;
    }
    sim.prune(now);
    const frame = trailerFrame(seconds, cam.w, cam.h, this.steps);
    Object.assign(cam, frame.camera);
    this.particles.update(now, births, cam, frame.section === 'build' || frame.section === 'montage');
    this.lens.update(now, sim, cam.w, cam.h, {
      sx: frame.lens.sx, sy: frame.lens.sy, radius: frame.lens.radius, lens: frame.lens.camera,
      lensVisible: frame.lens.visible, inkAlpha: frame.lens.inkAlpha,
    });
    this.presentation.view.update(now, sim, cam, null, true);
    return { frame, births, generation: this.steps };
  }

  dispose() {
    this.lens.destroy(); this.particles.destroy();
    this.presentation.view.dotBitmapEnabled = this.bitmap;
    this.presentation.view.visibleOrganismsOnly = this.visible;
    if (!this.bitmap) this.presentation.view.releaseDotBitmap();
    this.restore();
  }
}
