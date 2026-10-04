import type { Container, Renderer } from 'pixi.js';
import { MusicBox } from '../audio/musicBox';
import { WelcomeSound } from '../audio/welcomeSound';
import type { WorldView } from '../render/world';
import { buds, neighborCounts, type Cells } from '../life/engine';
import { welcomeCreature, welcomeFace, WELCOME_MOODS } from './welcomeCast';
import { WelcomeParticles } from './welcomeParticles';
import { WELCOME_CARD, WELCOME_LINES } from './onboardingText';
import { soundState } from './toolbar';
import { icon } from './icons';
import { borrowSandbox, type WelcomeHost } from './welcomeSandbox';
import { WelcomeLens } from './welcomeLens';
import { buildTitleScene, buildWelcomeScene, welcomePattern, WELCOME_GENESIS, WELCOME_PRE_ADVANCE, WELCOME_GEN_PER_SEC } from './welcomeScene';
import { welcomeBeat, welcomeCamera, welcomeLensTimeline, welcomeUsesDive, WELCOME_SECONDS, WELCOME_ZOOM_END, WELCOME_SHOTS, welcomeTitleCamera, welcomeGeneration, type WelcomeTransition } from './welcomeTimeline';
import './welcomeShow.css';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) {
  const el = document.createElement(tag);
  el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

export interface WelcomePresentation {
  stage: Container;
  renderer: Renderer;
  view: WorldView;
  audio: MusicBox;
  soundChanged(): void;
}

/** The normal ticker renders the borrowed sim; this module owns its clock. */
export class WelcomeShow {
  private overlay: HTMLElement | null = null;
  private note = node('section', 'welcome-note');
  private speaker = node('button', 'btn welcome-speaker');
  private speedLines = node('div', 'welcome-speed');
  private flash = node('div', 'welcome-flash');
  private startAt = 0;
  private gateAt = 0;
  private gateSteps = 0;
  private genesisInserted = 0;
  private small = false;
  private scene: Cells = new Set();
  private particles: WelcomeParticles | null = null;
  private steps = 0;
  private beat = -1;
  private gated = true;
  private final = false;
  private closing = false;
  private reduced = false;
  private transition: WelcomeTransition = 'lens';
  private lens: WelcomeLens | null = null;
  private sound: WelcomeSound | null = null;
  private lastFrame = 0;
  private sampleMs = 0;
  private sampleCount = 0;
  private frozenAt = 0;
  private restore: (() => void) | null = null;
  private done: (tour: boolean) => void = () => {};
  private backgrounds: { node: HTMLElement; inert: boolean }[] = [];
  private returnFocus: HTMLElement | null = null;
  private blockedKeys = new Set<string>();

  constructor(private host: WelcomeHost, private presentation: WelcomePresentation) {
    this.speaker.type = 'button';
    this.speaker.addEventListener('click', () => {
      if (this.closing) return;
      this.presentation.audio.cycleMode();
      this.presentation.soundChanged();
      this.sound?.syncMode();
      this.renderSpeaker();
    });
    this.speedLines.setAttribute('aria-hidden', 'true');
    this.flash.setAttribute('aria-hidden', 'true');
    const ns = 'http://www.w3.org/2000/svg';
    const rays = document.createElementNS(ns, 'svg');
    rays.setAttribute('viewBox', '0 0 1000 1000');
    rays.setAttribute('preserveAspectRatio', 'none');
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      const path = document.createElementNS(ns, 'path');
      const inner = 260 + (i % 4) * 35;
      path.setAttribute('d', `M ${500 + Math.cos(angle) * inner} ${500 + Math.sin(angle) * inner} Q ${500 + Math.cos(angle + 0.006) * 550} ${500 + Math.sin(angle + 0.006) * 550} ${500 + Math.cos(angle) * 850} ${500 + Math.sin(angle) * 850}`);
      rays.append(path);
    }
    this.speedLines.append(rays);
    document.addEventListener('keydown', (event) => {
      if (!this.active) return;
      this.blockedKeys.add(event.code);
      event.stopPropagation();
      if (this.closing) { event.preventDefault(); return; }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (event.repeat) return;
        if (this.final) this.close(false); else this.finish();
      } else if (event.key === 'Enter' || event.code === 'Space') {
        if (event.repeat) { event.preventDefault(); return; }
        const button = event.target instanceof Element && event.target.closest('button');
        if (!button || (this.gated && button.classList.contains('welcome-begin'))) {
          event.preventDefault();
          if (this.gated) this.begin(); else if (!this.final) this.finish();
        }
      } else if (event.key === 'Tab') {
        event.preventDefault();
        const buttons = [...this.overlay!.querySelectorAll<HTMLButtonElement>('button')].filter((button) => !button.hidden);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = index < 0 ? (event.shiftKey ? buttons.length - 1 : 0)
          : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    }, true);
    document.addEventListener('keyup', (event) => {
      const blocked = this.blockedKeys.delete(event.code);
      if (this.active || blocked) event.stopPropagation();
    }, true);
  }

  get active() { return this.overlay !== null; }
  /** Only reduced motion and the choice card freeze the live renderer. */
  renderTime(now: number) { return this.reduced || this.final || this.closing ? this.frozenAt : now; }

  start(done: (tour: boolean) => void) {
    if (this.active) return;
    this.done = done;
    this.final = this.closing = false;
    this.gated = true;
    this.steps = this.sampleMs = this.sampleCount = 0;
    this.beat = -1;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.transition = welcomeUsesDive(this.host.cam.w, this.host.cam.h, matchMedia('(pointer: coarse)').matches) ? 'dive' : 'lens';
    this.small = this.transition === 'dive';
    this.scene = buildWelcomeScene(this.small);
    this.restore = borrowSandbox(this.host, buildTitleScene());
    this.host.sim.animMs = 225;
    this.gateAt = performance.now();
    this.gateSteps = 0;
    Object.assign(this.host.cam, welcomeTitleCamera(0));
    this.frozenAt = performance.now();
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.backgrounds = [...document.querySelectorAll<HTMLElement>('#hud, #stage')]
      .map((el) => ({ node: el, inert: el.inert }));
    this.backgrounds.forEach(({ node: el }) => { el.inert = true; });
    document.body.classList.add('welcome-showing');
    this.overlay = node('div', 'welcome-overlay welcome-gated');
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'welcome-title');
    this.overlay.setAttribute('aria-describedby', 'welcome-copy');
    this.overlay.append(this.speedLines, this.flash, this.note, this.speaker);
    this.renderSpeaker();
    this.overlay.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.overlay.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!this.gated && !this.final && event.target instanceof Element && !event.target.closest('button')) this.finish();
    });
    this.overlay.addEventListener('wheel', (event) => {
      event.stopPropagation();
      if (!this.note.contains(event.target as Node)) event.preventDefault();
    }, { passive: false });
    document.body.append(this.overlay);
    this.renderGate();
  }

  private renderGate() {
    const heading = node('h1', 'welcome-handwriting');
    heading.id = 'welcome-title';
    heading.setAttribute('aria-label', 'cute life');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 360 120');
    svg.setAttribute('aria-hidden', 'true');
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '180'); text.setAttribute('y', '88'); text.setAttribute('text-anchor', 'middle');
    text.textContent = 'cute life'; svg.append(text); heading.append(svg);
    const subtitle = node('p', 'welcome-subtitle', "a cosy little game based on Conway's Game of Life");
    subtitle.id = 'welcome-copy';
    const play = node('p', 'welcome-playline', 'draw cells ~ watch them live ~ meet creatures ~ battle a friend');
    const cast = node('div', 'welcome-cast');
    WELCOME_MOODS.forEach(({ label }, index) => {
      const character = node('figure', `welcome-character welcome-character-${index}`);
      character.append(welcomeFace(index), node('figcaption', '', label));
      cast.append(character);
    });
    const creatures = node('div', 'welcome-creatures');
    for (const [index, id] of ['glider', 'lwss', 'blinker'].entries()) {
      const character = node('figure', `welcome-creature welcome-creature-${index}`);
      try {
        const canvas = welcomeCreature(this.presentation.renderer, id);
        canvas.setAttribute('aria-hidden', 'true');
        character.append(canvas, node('figcaption', '', id === 'lwss' ? 'a little traveller' : id === 'blinker' ? 'a little dancer' : 'a little explorer'));
        creatures.append(character);
      } catch {
        // Some canvas/GPU implementations cannot extract. The real scene still shows the cast.
        creatures.replaceChildren(node('p', 'welcome-live-cast', 'meet the creatures swimming behind the title ~'));
        break;
      }
    }
    const copy = node('p', 'welcome-sound-note', 'with sound ~');
    const begin = this.action('▶ tap to begin', () => this.begin(), 'welcome-begin');
    const skip = this.action('skip', () => this.finish(), 'welcome-skip');
    this.note.replaceChildren(creatures, heading, subtitle, play, cast, begin, copy, skip);
    begin.focus({ preventScroll: true });
  }

  private begin() {
    if (!this.gated || this.closing) return;
    // Synchronous user gesture is required by Safari as well as Chrome.
    this.sound = new WelcomeSound(this.presentation.audio, this.reduced);
    this.gated = false;
    this.overlay?.classList.remove('welcome-gated');
    this.startAt = this.lastFrame = this.frozenAt = performance.now();
    this.setScene(this.scene);
    this.steps = this.genesisInserted = 0;
    if (!this.reduced) this.particles = new WelcomeParticles(this.presentation.stage);
    if (this.reduced) {
      Object.assign(this.host.cam, welcomeCamera(WELCOME_SECONDS, this.host.cam.w, this.host.cam.h));
      this.finish();
    } else this.update(this.startAt);
  }

  private setScene(cells: Cells) {
    const sim = this.host.sim;
    sim.cells = new Set(cells);
    sim.counts = neighborCounts(sim.cells);
    sim.budKeys = buds(sim.cells, sim.counts);
    sim.bornAt = new Map(); sim.fading = [];
    sim.generation = WELCOME_PRE_ADVANCE;
    sim.animMs = 900 / WELCOME_GEN_PER_SEC;
    sim.version++;
  }

  update(now: number) {
    if (!this.active || this.final || this.closing) return;
    if (this.gated) {
      if (this.reduced) return;
      const elapsed = Math.max(0, (now - this.gateAt) / 1000);
      // Loop the small menu world once per minute, so its travellers stay on screen.
      if (elapsed >= 60) {
        this.setScene(buildTitleScene()); this.host.sim.animMs = 225; this.gateAt = now; this.gateSteps = 0;
      }
      const seconds = (now - this.gateAt) / 1000;
      const wanted = Math.floor(seconds * 4);
      for (let i = 0; this.gateSteps < wanted && i < 2; i++, this.gateSteps++) this.host.sim.advance(now);
      if (wanted - this.gateSteps > 2) this.gateSteps = wanted;
      this.host.sim.prune(now);
      Object.assign(this.host.cam, welcomeTitleCamera(seconds));
      return;
    }
    const seconds = Math.min(WELCOME_SECONDS, Math.max(0, (now - this.startAt) / 1000));
    const elapsed = now - this.lastFrame;
    // Ignore background-tab gaps; average real frame cadence during the first second.
    if (seconds <= 1 && elapsed > 0 && !document.hidden) {
      this.sampleMs += elapsed; this.sampleCount++;
    }
    this.lastFrame = now;
    if (seconds < 2.5 && welcomeUsesDive(this.host.cam.w, this.host.cam.h, matchMedia('(pointer: coarse)').matches,
      seconds >= 1 && this.sampleCount ? this.sampleMs / this.sampleCount : 0)) {
      this.transition = 'dive';
      if (!this.small) {
        this.small = true;
        this.scene = buildWelcomeScene(true);
        this.setScene(this.scene); this.steps = this.genesisInserted = 0;
      }
    }
    const frame = welcomeLensTimeline(seconds, this.host.cam.w, this.host.cam.h, this.transition);
    Object.assign(this.host.cam, frame.main);
    // Bound catch-up after dropped frames / background tabs; discard excess debt.
    const seed = welcomePattern('rpentomino', WELCOME_GENESIS.x, WELCOME_GENESIS.y);
    const visible = Math.min(seed.length, Math.max(0, Math.floor((seconds - 0.12) / 0.18) + 1));
    if (visible > this.genesisInserted) {
      this.host.sim.addMany(seed.slice(this.genesisInserted, visible), now);
      this.genesisInserted = visible;
    }
    this.host.sim.animMs = seconds >= WELCOME_ZOOM_END && seconds < 13.5 ? 225 : 900 / WELCOME_GEN_PER_SEC;
    const wanted = welcomeGeneration(seconds);
    const births: number[] = [];
    for (let i = 0; this.steps < wanted && i < 4; i++, this.steps++) births.push(...this.host.sim.advance(now));
    if (wanted - this.steps > 4) this.steps = wanted;
    this.host.sim.prune(now);
    this.sound?.update(seconds, this.host.sim.generation, births, this.small ? 2 : 4);
    this.particles?.update(now, seconds, births, this.host.cam);
    if (frame.lensVisible && !this.lens) this.lens = new WelcomeLens(this.presentation.stage, this.presentation.view);
    this.lens?.update(now, this.host.sim, this.host.cam.w, this.host.cam.h, frame);
    if (seconds >= WELCOME_ZOOM_END + 0.15) { this.lens?.destroy(); this.lens = null; }
    this.speedLines.style.opacity = String(frame.speedAlpha);
    this.flash.style.opacity = String(frame.flashAlpha);
    const beat = welcomeBeat(seconds);
    if (beat !== this.beat) {
      this.beat = beat;
      this.render(false);
    }
    if (seconds >= WELCOME_SECONDS) this.finish();
  }

  private renderSpeaker() {
    const state = soundState(this.presentation.audio.mode);
    this.speaker.replaceChildren(icon(state.icon), node('span', '', state.label));
    this.speaker.setAttribute('aria-label', state.title);
    this.speaker.title = state.title;
  }

  private action(text: string, run: () => void, cls = '') {
    const button = node('button', `btn ${cls}`, text);
    button.type = 'button';
    button.addEventListener('click', run);
    return button;
  }

  private render(final: boolean) {
    const focusedSpeaker = document.activeElement === this.speaker;
    const heading = node('h2', 'welcome-title', final ? (this.reduced ? 'cute life ~' : WELCOME_CARD.title) : WELCOME_SHOTS[this.beat].caption);
    heading.id = 'welcome-title';
    const copy = node('div', 'welcome-copy');
    copy.id = 'welcome-copy';
    copy.setAttribute('aria-live', 'polite');
    const lines = final && this.reduced ? WELCOME_LINES.slice(1) : [];
    for (const line of lines) copy.append(node('p', '', line));
    if (!final && this.beat === 4) {
      const rules = node('div', 'welcome-rule-strip');
      WELCOME_MOODS.forEach(({ rule }, index) => {
        const row = node('div', 'welcome-rule');
        row.append(welcomeFace(index), node('span', '', rule)); rules.append(row);
      });
      copy.append(rules);
    }
    const actions = node('div', 'welcome-actions');
    if (final) {
      copy.append(node('p', 'welcome-invitation', WELCOME_CARD.text));
      actions.append(this.action(WELCOME_CARD.tour, () => this.close(true)),
        this.action(WELCOME_CARD.play, () => this.close(false)));
    } else actions.append(this.action(WELCOME_CARD.skip, () => this.finish(), 'welcome-skip'));
    this.note.replaceChildren(heading, copy, actions);
    if (!focusedSpeaker) actions.querySelector('button')?.focus({ preventScroll: true });
  }

  private finish() {
    if (this.final || this.closing) return;
    if (this.gated) {
      this.gated = false;
      this.overlay?.classList.remove('welcome-gated');
      this.setScene(this.scene);
    }
    this.final = true;
    this.frozenAt = performance.now();
    this.lens?.destroy(); this.lens = null;
    this.speedLines.style.opacity = this.flash.style.opacity = '0';
    this.particles?.destroy(); this.particles = null;
    // Skip and completion share the widest view and the same choice card.
    if (!this.reduced) Object.assign(this.host.cam, welcomeCamera(WELCOME_SECONDS, this.host.cam.w, this.host.cam.h));
    this.sound?.finish();
    this.overlay?.classList.add('welcome-final');
    this.render(true);
  }

  private close(tour: boolean) {
    if (this.closing) return;
    this.closing = true;
    this.frozenAt = performance.now();
    this.lens?.destroy(); this.lens = null;
    this.particles?.destroy(); this.particles = null;
    // Stop tails immediately, even while the paper fades away.
    this.sound?.dispose(); this.sound = null;
    this.overlay?.classList.add('welcome-closing');
    document.body.classList.add('welcome-leaving');
    window.setTimeout(() => {
      this.restore?.(); this.restore = null;
      this.overlay?.remove(); this.overlay = null;
      this.backgrounds.forEach(({ node: el, inert }) => { el.inert = inert; });
      document.body.classList.remove('welcome-showing', 'welcome-leaving');
      if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
      this.done(tour);
    }, this.reduced ? 0 : 240);
  }
}
