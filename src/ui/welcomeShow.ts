import type { Container } from 'pixi.js';
import { MusicBox } from '../audio/musicBox';
import { WelcomeSound } from '../audio/welcomeSound';
import type { WorldView } from '../render/world';
import { WELCOME_CARD, WELCOME_LINES } from './onboardingText';
import { soundState } from './toolbar';
import { icon } from './icons';
import { borrowSandbox, type WelcomeHost } from './welcomeSandbox';
import { WelcomeLens } from './welcomeLens';
import { buildWelcomeScene, WELCOME_GEN_PER_SEC } from './welcomeScene';
import { welcomeBeat, welcomeCamera, welcomeLensTimeline, welcomeUsesDive, WELCOME_SECONDS, WELCOME_ZOOM_END, type WelcomeTransition } from './welcomeTimeline';
import './welcomeShow.css';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) {
  const el = document.createElement(tag);
  el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

export interface WelcomePresentation {
  stage: Container;
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
        if (this.gated || this.final) this.close(false); else this.finish();
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
  /** Reduced motion, the gate and the choice card freeze even facial animation. */
  renderTime(now: number) { return this.gated || this.reduced || this.final || this.closing ? this.frozenAt : now; }

  start(done: (tour: boolean) => void) {
    if (this.active) return;
    this.done = done;
    this.final = this.closing = false;
    this.gated = true;
    this.steps = this.sampleMs = this.sampleCount = 0;
    this.beat = -1;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.transition = welcomeUsesDive(this.host.cam.w, this.host.cam.h, matchMedia('(pointer: coarse)').matches) ? 'dive' : 'lens';
    this.restore = borrowSandbox(this.host, buildWelcomeScene());
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
    this.overlay.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
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
    const copy = node('p', 'welcome-sound-note', 'with sound ~');
    copy.id = 'welcome-copy';
    const begin = this.action('▶ tap to begin', () => this.begin(), 'welcome-begin');
    const skip = this.action('skip', () => this.close(false), 'welcome-skip');
    this.note.replaceChildren(heading, begin, copy, skip);
    begin.focus({ preventScroll: true });
  }

  private begin() {
    if (!this.gated || this.closing) return;
    // Synchronous user gesture is required by Safari as well as Chrome.
    this.sound = new WelcomeSound(this.presentation.audio, this.reduced);
    this.gated = false;
    this.overlay?.classList.remove('welcome-gated');
    this.startAt = this.lastFrame = this.frozenAt = performance.now();
    if (this.reduced) {
      Object.assign(this.host.cam, welcomeCamera(WELCOME_ZOOM_END, this.host.cam.w, this.host.cam.h));
      this.finish();
    } else this.update(this.startAt);
  }

  update(now: number) {
    if (!this.active || this.gated || this.final || this.closing) return;
    const seconds = Math.min(WELCOME_SECONDS, Math.max(0, (now - this.startAt) / 1000));
    const elapsed = now - this.lastFrame;
    // Ignore background-tab gaps; average real frame cadence during macro second 1.
    if (seconds <= 1 && elapsed > 0 && !document.hidden) {
      this.sampleMs += elapsed; this.sampleCount++;
    }
    this.lastFrame = now;
    if (seconds < 4 && welcomeUsesDive(this.host.cam.w, this.host.cam.h, matchMedia('(pointer: coarse)').matches,
      seconds >= 1 && this.sampleCount ? this.sampleMs / this.sampleCount : 0)) this.transition = 'dive';
    const frame = welcomeLensTimeline(seconds, this.host.cam.w, this.host.cam.h, this.transition);
    Object.assign(this.host.cam, frame.main);
    // Bound catch-up after dropped frames / background tabs; discard excess debt.
    const wanted = Math.floor(seconds * WELCOME_GEN_PER_SEC);
    const births: number[] = [];
    for (let i = 0; this.steps < wanted && i < 4; i++, this.steps++) births.push(...this.host.sim.advance(now));
    if (wanted - this.steps > 4) this.steps = wanted;
    this.host.sim.prune(now);
    this.sound?.update(seconds, this.host.sim.generation, births);
    if (frame.lensVisible && !this.lens) this.lens = new WelcomeLens(this.presentation.stage, this.presentation.view);
    this.lens?.update(now, this.host.sim, this.host.cam.w, this.host.cam.h, frame);
    if (seconds >= 6.75) { this.lens?.destroy(); this.lens = null; }
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
    const heading = node('h2', 'welcome-title', final && !this.reduced ? WELCOME_CARD.title : WELCOME_LINES[0]);
    heading.id = 'welcome-title';
    const copy = node('div', 'welcome-copy');
    copy.id = 'welcome-copy';
    copy.setAttribute('aria-live', 'polite');
    const lines = final ? (this.reduced ? WELCOME_LINES.slice(1) : []) : WELCOME_LINES.slice(1, this.beat + 1);
    for (const line of lines) copy.append(node('p', '', line));
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
    this.final = true;
    this.frozenAt = performance.now();
    this.lens?.destroy(); this.lens = null;
    this.speedLines.style.opacity = this.flash.style.opacity = '0';
    // A skipped transition lands immediately on the same face scene as the finale.
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
