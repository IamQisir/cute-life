import { WELCOME_CARD, WELCOME_LINES } from './onboardingText';
import { borrowSandbox, type WelcomeHost } from './welcomeSandbox';
import { buildWelcomeScene, WELCOME_GEN_PER_SEC } from './welcomeScene';
import { welcomeBeat, welcomeCamera, WELCOME_SECONDS } from './welcomeTimeline';
import './welcomeShow.css';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) {
  const el = document.createElement(tag);
  el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** The normal Pixi ticker renders the borrowed sim; this module owns its timeline. */
export class WelcomeShow {
  private overlay: HTMLElement | null = null;
  private note = node('section', 'welcome-note');
  private startAt = 0;
  private steps = 0;
  private beat = -1;
  private final = false;
  private closing = false;
  private reduced = false;
  private restore: (() => void) | null = null;
  private done: (tour: boolean) => void = () => {};
  private backgrounds: { node: HTMLElement; inert: boolean }[] = [];
  private returnFocus: HTMLElement | null = null;
  private blockedKeys = new Set<string>();

  constructor(private host: WelcomeHost) {
    document.addEventListener('keydown', (event) => {
      if (!this.active) return;
      this.blockedKeys.add(event.code);
      event.stopPropagation();
      if (event.repeat && (event.key === 'Escape' || event.key === 'Enter')) {
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape' || (event.key === 'Enter' && !this.final)) {
        event.preventDefault();
        if (this.closing) return;
        if (this.final) this.close(false);
        else this.finish();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        const buttons = [...this.note.querySelectorAll<HTMLButtonElement>('button')];
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

  start(done: (tour: boolean) => void) {
    if (this.active) return;
    this.done = done;
    this.final = this.closing = false;
    this.steps = 0;
    this.beat = -1;
    const reduced = this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Reduced motion keeps the home picture static, including an already-playing sandbox.
    const cells = reduced ? new Set(this.host.sim.cells) : buildWelcomeScene();
    this.restore = borrowSandbox(this.host, cells);
    this.startAt = performance.now();
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.backgrounds = [...document.querySelectorAll<HTMLElement>('#hud, #stage')]
      .map((el) => ({ node: el, inert: el.inert }));
    this.backgrounds.forEach(({ node: el }) => { el.inert = true; });
    document.body.classList.add('welcome-showing');
    this.overlay = node('div', 'welcome-overlay');
    this.note.setAttribute('role', 'dialog');
    this.note.setAttribute('aria-modal', 'true');
    this.note.setAttribute('aria-labelledby', 'welcome-title');
    this.note.setAttribute('aria-describedby', 'welcome-copy');
    this.overlay.append(this.note);
    this.overlay.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      if (event.target === this.overlay && !this.final) this.finish();
    });
    this.overlay.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
    document.body.append(this.overlay);
    if (reduced) this.finish();
    else this.update(this.startAt);
  }

  update(now: number) {
    if (!this.active || this.final || this.closing) return;
    const seconds = Math.min(WELCOME_SECONDS, Math.max(0, (now - this.startAt) / 1000));
    Object.assign(this.host.cam, welcomeCamera(seconds, this.host.cam.w, this.host.cam.h));
    // Bound catch-up work after a dropped frame / background tab. No endless emission.
    const wanted = Math.floor(seconds * WELCOME_GEN_PER_SEC);
    for (let i = 0; this.steps < wanted && i < 4; i++, this.steps++) this.host.sim.advance(now);
    this.host.sim.prune(now);
    const beat = welcomeBeat(seconds);
    if (beat !== this.beat) {
      this.beat = beat;
      this.render(false);
    }
    if (seconds >= WELCOME_SECONDS) this.finish();
  }

  private action(text: string, run: () => void, cls = '') {
    const button = node('button', `btn ${cls}`, text);
    button.type = 'button';
    button.addEventListener('click', run);
    return button;
  }

  private render(final: boolean) {
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
    } else {
      actions.append(this.action(WELCOME_CARD.skip, () => this.finish(), 'welcome-skip'));
    }
    this.note.replaceChildren(heading, copy, actions);
    // Replacing a focused skip must not leave keyboard focus in the inert HUD.
    actions.querySelector('button')?.focus({ preventScroll: true });
  }

  private finish() {
    if (this.final || this.closing) return;
    this.final = true;
    this.overlay?.classList.add('welcome-final');
    this.render(true);
    // Finishing or skipping returns the home picture behind the choice card.
    // Keep input blocked until a choice is made; the normal ticker stays suspended.
    if (this.reduced) this.restoreScene();
    else {
      document.body.classList.add('welcome-leaving');
      window.setTimeout(() => {
        this.restoreScene();
        if (!this.closing) document.body.classList.remove('welcome-leaving');
      }, 240);
    }
  }

  private restoreScene() {
    this.restore?.();
    this.restore = null;
  }

  private close(tour: boolean) {
    if (this.closing) return;
    this.closing = true;
    this.overlay?.classList.add('welcome-closing');
    document.body.classList.add('welcome-leaving');
    const reduced = this.reduced;
    window.setTimeout(() => {
      this.restoreScene();
      this.overlay?.remove();
      this.overlay = null;
      this.backgrounds.forEach(({ node: el, inert }) => { el.inert = inert; });
      document.body.classList.remove('welcome-showing', 'welcome-leaving');
      if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
      this.done(tour);
    }, reduced ? 0 : 240);
  }
}
