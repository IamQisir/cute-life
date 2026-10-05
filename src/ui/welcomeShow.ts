import type { Container, Renderer } from 'pixi.js';
import { MusicBox } from '../audio/musicBox';
import type { WorldView } from '../render/world';
import { buds, neighborCounts, type Cells } from '../life/engine';
import { welcomeCreature, welcomeFace, WELCOME_MOODS } from './welcomeCast';
import { WELCOME_CARD, WELCOME_LINES } from './onboardingText';
import { soundState } from './toolbar';
import { icon } from './icons';
import { borrowSandbox, type WelcomeHost } from './welcomeSandbox';
import { buildTitleScene, welcomeTitleCamera } from './welcomeTitleScene';
import { introSource, introState } from './welcomeVideo';
import { perf } from '../render/perf';
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
  private gateAt = 0;
  private gateSteps = 0;
  private gated = true;
  private final = false;
  private closing = false;
  private reduced = false;
  private video: HTMLVideoElement | null = null;
  private poster: HTMLImageElement | null = null;
  private bufferTimer = 0;
  private failureTimer = 0;
  private lease: ReturnType<MusicBox['beginWelcome']> = null;
  private savedBitmap = false;
  private savedVisibleOrganisms = false;
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
      if (this.video) this.video.muted = this.presentation.audio.mode === 'off';
      this.renderSpeaker();
    });
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
  /** The opaque intro video fills the screen, so the stage under it need not be drawn. */
  get covering() { return this.active && !this.gated && !this.final && !this.closing && this.video !== null && !this.video.hidden; }
  /** Only reduced motion and the choice card freeze the live renderer. */
  renderTime(now: number) { return this.reduced || this.final || this.closing ? this.frozenAt : now; }

  start(done: (tour: boolean) => void, replay = false) {
    if (this.active) return;
    this.done = done;
    this.final = this.closing = false;
    this.gated = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.savedBitmap = this.presentation.view.dotBitmapEnabled;
    this.presentation.view.dotBitmapEnabled = true;
    this.savedVisibleOrganisms = this.presentation.view.visibleOrganismsOnly;
    this.presentation.view.visibleOrganismsOnly = true;
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
    this.overlay.append(this.note, this.speaker);
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
    const source = introSource(this.host.cam.w, this.host.cam.h, import.meta.env.BASE_URL);
    if (!this.reduced) {
      this.video = node('video', 'welcome-video');
      this.video.src = source.video;
      this.video.poster = source.poster;
      this.video.preload = 'metadata';
      this.video.playsInline = true;
      this.video.setAttribute('playsinline', '');
      this.video.hidden = true;
      const video = this.video;
      video.addEventListener('ended', () => { if (this.video === video) this.finish(); });
      video.addEventListener('playing', () => { if (this.video === video) clearTimeout(this.failureTimer); });
      video.addEventListener('waiting', () => { if (this.video === video && !this.gated && !this.final) this.watchFailure(); });
      video.addEventListener('error', () => { if (this.video === video && !this.gated) this.fail('load/decode error'); });
      this.overlay.prepend(this.video);
      this.bufferTimer = window.setTimeout(() => this.buffer(), 1000);
    }
    this.renderGate();
    if (replay) this.begin();
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
    begin.addEventListener('pointerenter', () => this.buffer());
    begin.addEventListener('focus', () => this.buffer());
  }

  private buffer() {
    if (this.video && this.video.preload !== 'auto') this.video.preload = 'auto';
  }

  private watchFailure() {
    clearTimeout(this.failureTimer);
    this.failureTimer = window.setTimeout(() => this.fail('no playback within 3s'), 3000);
  }

  private fail(reason: string) {
    if (this.final || this.closing) return;
    perf.log(`intro video: ${reason}; choice card`);
    if (introState(this.reduced, 'failure') === 'choice') this.finish();
  }

  private begin() {
    if (!this.gated || this.closing) return;
    this.gated = false;
    clearTimeout(this.bufferTimer);
    this.overlay?.classList.remove('welcome-gated');
    if (introState(this.reduced, 'begin') === 'poster') {
      this.finish();
      return;
    }
    const source = introSource(this.host.cam.w, this.host.cam.h, import.meta.env.BASE_URL);
    if (!this.video!.src.endsWith(source.video)) { this.video!.src = source.video; this.video!.poster = source.poster; }
    try { this.lease = this.presentation.audio.beginWelcome(); } catch { this.lease = null; }
    this.buffer();
    const video = this.video!;
    // The video contains one mixed track: both music and all enable that track.
    video.muted = this.presentation.audio.mode === 'off';
    video.hidden = false;
    this.overlay?.classList.add('welcome-playing');
    const skip = this.action(WELCOME_CARD.skip, () => this.finish(), 'welcome-skip');
    const caption = node('h2', 'welcome-video-description', 'welcome to cute life ~');
    caption.id = 'welcome-title';
    const description = node('p', 'welcome-video-description', 'a tiny world where cells are born, live and dance');
    description.id = 'welcome-copy';
    this.note.replaceChildren(caption, description, skip);
    skip.focus({ preventScroll: true });
    this.watchFailure();
    try {
      if (video.error) this.fail('load/decode error');
      else void video.play().catch((error: unknown) => this.video === video && this.fail(`play rejected: ${String(error)}`));
    } catch (error) { this.fail(`play failed: ${String(error)}`); }
  }

  private setScene(cells: Cells) {
    const sim = this.host.sim;
    sim.cells = new Set(cells);
    sim.counts = neighborCounts(sim.cells);
    sim.budKeys = buds(sim.cells, sim.counts);
    sim.bornAt = new Map(); sim.fading = [];
    sim.generation = 120;
    sim.animMs = 75;
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
      const timing = perf.start();
      if (perf.enabled) perf.quality = 'welcome title';
      const wanted = Math.floor(seconds * 4);
      for (let i = 0; this.gateSteps < wanted && i < 2; i++, this.gateSteps++) this.host.sim.advance(now);
      if (wanted - this.gateSteps > 2) this.gateSteps = wanted;
      this.host.sim.prune(now);
      Object.assign(this.host.cam, welcomeTitleCamera(seconds));
      perf.end('sim/bake playback', timing);
      return;
    }
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

  private render() {
    const heading = node('h2', 'welcome-title', this.reduced ? WELCOME_LINES[0] : WELCOME_CARD.title);
    heading.id = 'welcome-title';
    const copy = node('div', 'welcome-copy');
    copy.id = 'welcome-copy';
    if (this.reduced) for (const line of WELCOME_LINES.slice(1)) copy.append(node('p', '', line));
    copy.append(node('p', 'welcome-invitation', WELCOME_CARD.text));
    const actions = node('div', 'welcome-actions');
    actions.append(this.action(WELCOME_CARD.tour, () => this.close(true)), this.action(WELCOME_CARD.play, () => this.close(false)));
    this.note.replaceChildren(heading, copy, actions);
    actions.querySelector('button')?.focus({ preventScroll: true });
  }

  private finish() {
    if (this.final || this.closing) return;
    if (this.reduced && !this.poster) {
      this.poster = node('img', 'welcome-poster');
      this.poster.src = introSource(this.host.cam.w, this.host.cam.h, import.meta.env.BASE_URL).poster;
      this.poster.alt = '';
      this.overlay?.prepend(this.poster);
    }
    this.gated = false;
    this.final = true;
    this.frozenAt = performance.now();
    clearTimeout(this.bufferTimer);
    clearTimeout(this.failureTimer);
    this.video?.pause();
    this.lease?.release(); this.lease = null;
    this.presentation.view.dotBitmapEnabled = this.savedBitmap;
    this.presentation.view.visibleOrganismsOnly = this.savedVisibleOrganisms;
    if (!this.savedBitmap) this.presentation.view.releaseDotBitmap?.();
    this.restore?.(); this.restore = null;
    this.overlay?.classList.remove('welcome-gated', 'welcome-playing');
    this.video?.classList.add('welcome-video-finished');
    this.overlay?.classList.add('welcome-final');
    this.render();
  }

  private close(tour: boolean) {
    if (this.closing) return;
    this.closing = true;
    this.frozenAt = performance.now();
    this.overlay?.classList.add('welcome-closing');
    window.setTimeout(() => {
      this.presentation.view.dotBitmapEnabled = this.savedBitmap;
      this.presentation.view.visibleOrganismsOnly = this.savedVisibleOrganisms;
      if (!this.savedBitmap) this.presentation.view.releaseDotBitmap?.();
      this.restore?.(); this.restore = null;
      if (this.video) { this.video.removeAttribute('src'); this.video.load(); this.video = null; }
      this.poster = null;
      this.overlay?.remove(); this.overlay = null;
      this.backgrounds.forEach(({ node: el, inert }) => { el.inert = inert; });
      document.body.classList.remove('welcome-showing', 'welcome-leaving');
      if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
      this.done(tour);
    }, this.reduced ? 0 : 240);
  }
}
