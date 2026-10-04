import { drawBud } from '../render/cellArt';
import { WorldView } from '../render/world';
import type { Mode } from './modes';
import { nextOnboarding, OnboardingSeen } from './onboardingState';
import { RULES_CARDS, TOUR_STEPS, type TourTarget } from './onboardingText';
import './onboarding.css';

const TARGETS: Record<Exclude<TourTarget, 'canvas'>, string> = {
  palette: '.palette', controls: '.bottom .controls', mode: '.mode-btn', share: '.top-right .rec, .top-right .share-btn',
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, action: () => void) {
  const node = element('button', 'btn', text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

/** A single overlay owns the tour and the following mode card. */
export class Onboarding {
  private seen = new OnboardingSeen();
  private started = false;
  private linkVisit = false;
  private overlay: HTMLElement | null = null;
  private note = element('section', 'onboarding-note');
  private spotlight = element('div', 'onboarding-spotlight');
  private step = 0;
  private touring = false;
  private forceRules = false;
  private returnFocus: HTMLElement | null = null;
  private backgrounds: { node: HTMLElement; inert: boolean }[] = [];

  constructor(private currentMode: () => Mode) {
    // Capture both phases, even if focus escapes the dialog. Space toggles the
    // game's play state on keyup, so blocking only keydown is insufficient.
    document.addEventListener('keydown', (event) => {
      if (!this.overlay) return;
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.dismiss();
      } else if (event.key === 'Tab') {
        const buttons = [...this.note.querySelectorAll<HTMLButtonElement>('button')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        const next = index < 0 ? (event.shiftKey ? buttons.length - 1 : 0)
          : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    }, true);
    document.addEventListener('keyup', (event) => {
      if (this.overlay) event.stopPropagation();
    }, true);
    window.addEventListener('resize', () => {
      if (this.overlay && this.touring) this.renderStep();
    });
  }

  start(linkVisit: boolean) {
    this.linkVisit = linkVisit;
    this.started = true;
    this.modeChanged();
  }

  modeChanged() {
    if (!this.started || this.overlay || document.querySelector('.modal-back')) return;
    const next = nextOnboarding(this.seen.state, this.currentMode(), this.linkVisit);
    if (next === 'tour') this.openTour(false);
    else if (next === 'rules') this.openRules();
  }

  openHelp() {
    if (!this.overlay) this.openTour(true);
  }

  private mount() {
    this.returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : document.querySelector<HTMLButtonElement>('.help-btn');
    this.backgrounds = [...document.querySelectorAll<HTMLElement>('#hud, #stage')]
      .map((node) => ({ node, inert: node.inert }));
    this.backgrounds.forEach(({ node }) => { node.inert = true; });
    this.overlay = element('div', 'onboarding-overlay');
    this.spotlight.setAttribute('aria-hidden', 'true');
    this.note.setAttribute('role', 'dialog');
    this.note.setAttribute('aria-modal', 'true');
    this.note.setAttribute('aria-labelledby', 'onboarding-title');
    this.overlay.append(this.spotlight, this.note);
    this.overlay.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.overlay.addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.target === this.overlay) this.dismiss();
    });
    document.body.append(this.overlay);
  }

  private heading(title: string) {
    const heading = element('h2', 'onboarding-title', title);
    heading.id = 'onboarding-title';
    return heading;
  }

  private openTour(forceRules: boolean) {
    this.forceRules = forceRules;
    this.touring = true;
    this.step = 0;
    this.seen.tourSeen();
    this.mount();
    this.renderStep();
  }

  private target(target: TourTarget): DOMRect | null {
    if (target === 'canvas') {
      const size = Math.min(150, window.innerWidth / 3, window.innerHeight / 3);
      return new DOMRect((window.innerWidth - size) / 2, (window.innerHeight - size) / 2, size, size);
    }
    const rects = [...document.querySelectorAll<HTMLElement>(TARGETS[target])].flatMap((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0 || rect.height === 0
        || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return [];
      // A folded palette has no visible header on narrow screens.
      if (target === 'palette' && node.classList.contains('collapsed')
        && getComputedStyle(node.querySelector('.pal-top')!).display === 'none') return [];
      return [rect];
    });
    if (!rects.length) return null;
    const left = Math.max(4, Math.min(...rects.map((r) => r.left)));
    const top = Math.max(4, Math.min(...rects.map((r) => r.top)));
    const right = Math.min(innerWidth - 4, Math.max(...rects.map((r) => r.right)));
    const bottom = Math.min(innerHeight - 4, Math.max(...rects.map((r) => r.bottom)));
    return new DOMRect(left, top, right - left, bottom - top);
  }

  private renderStep() {
    let rect: DOMRect | null = null;
    while (this.step < TOUR_STEPS.length) {
      rect = this.target(TOUR_STEPS[this.step].target);
      if (rect) break;
      this.step++;
    }
    if (!rect) { this.dismiss(); return; }
    const step = TOUR_STEPS[this.step];
    const dots = element('div', 'onboarding-dots');
    dots.setAttribute('aria-label', `step ${this.step + 1} of ${TOUR_STEPS.length}`);
    TOUR_STEPS.forEach((_, index) => {
      const dot = element('span', '', index === this.step ? '●' : '○');
      dot.setAttribute('aria-hidden', 'true');
      dots.append(dot);
    });
    const actions = element('div', 'onboarding-actions');
    actions.append(dots, button('skip', () => this.dismiss()), button(
      this.step === TOUR_STEPS.length - 1 ? 'done' : 'next',
      () => { this.step++; this.renderStep(); },
    ));
    this.note.replaceChildren(this.heading(step.title), element('p', '', step.text), actions);
    this.spotlight.hidden = false;
    Object.assign(this.spotlight.style, {
      left: `${rect.left - 3}px`, top: `${rect.top - 3}px`, width: `${rect.width + 6}px`, height: `${rect.height + 6}px`,
    });
    this.positionNote(rect);
    actions.querySelector<HTMLButtonElement>('button:last-child')!.focus();
  }

  private positionNote(rect: DOMRect) {
    this.note.style.cssText = '';
    const gap = 14;
    const w = this.note.offsetWidth;
    const h = this.note.offsetHeight;
    const clampX = (x: number) => Math.max(12, Math.min(x, innerWidth - w - 12));
    const clampY = (y: number) => Math.max(12, Math.min(y, innerHeight - h - 12));
    if (matchMedia('(max-width: 720px)').matches) {
      // Raise the bottom sheet above low targets so their highlight stays visible.
      const low = rect.top > innerHeight / 2;
      this.note.style.left = '12px';
      this.note.style.top = `${clampY(low ? rect.top - h - gap : innerHeight - h - 12)}px`;
      return;
    }
    let x = rect.right + gap;
    let y = rect.top;
    if (x + w > innerWidth - 12) {
      if (rect.left - w - gap >= 12) x = rect.left - w - gap;
      else {
        x = rect.left + (rect.width - w) / 2;
        y = rect.bottom + h + gap < innerHeight ? rect.bottom + gap : rect.top - h - gap;
      }
    }
    this.note.style.left = `${clampX(x)}px`;
    this.note.style.top = `${clampY(y)}px`;
  }

  private openRules() {
    this.touring = false;
    this.forceRules = false;
    this.seen.rulesSeen(this.currentMode());
    if (!this.overlay) this.mount();
    this.overlay!.classList.add('onboarding-rules');
    this.note.style.cssText = '';
    this.spotlight.hidden = true;
    const card = RULES_CARDS[this.currentMode()];
    this.note.replaceChildren(this.heading(card.title));
    for (const line of card.lines) {
      const row = element('div', 'onboarding-rule');
      if (line.face !== 'none') {
        const face = line.face === 'born' ? drawBud() : WorldView.portrait(line.face === 'teary' ? 'lonely' : line.face, 0);
        face.setAttribute('aria-hidden', 'true');
        row.append(face);
      }
      row.append(element('p', '', line.text));
      this.note.append(row);
    }
    if (card.footer) this.note.append(element('p', 'onboarding-footer', card.footer));
    const close = button('got it', () => this.dismiss());
    this.note.append(close);
    close.focus();
  }

  private dismiss() {
    if (this.touring && (this.forceRules || nextOnboarding(this.seen.state, this.currentMode(), this.linkVisit) === 'rules')) {
      this.openRules();
      return;
    }
    this.overlay?.remove();
    this.overlay = null;
    this.touring = false;
    this.backgrounds.forEach(({ node, inert }) => { node.inert = inert; });
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
  }
}
