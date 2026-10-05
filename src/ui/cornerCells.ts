import type { Mood } from '../render/cellArt';
import { t } from '../i18n';
import { WorldView } from '../render/world';
import { pokeLine, randomTip } from './cellTips';
import { pokeCell, settleCell, sleepingCell } from './cornerCellState';
import './cornerCells.css';

interface CornerActions {
  openHelp(): void;
  wakeCell(index: number): void;
}

/** Attach only to the existing decorations, leaving the rest of the HUD transparent. */
export function attachCornerCells(title: HTMLElement, sleepers: HTMLElement[], actions: CornerActions) {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const resets: (() => void)[] = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const portraits = new Map<string, string>();
  const portrait = (mood: Mood, palette: number) => {
    const key = `${mood}:${palette}`;
    if (!portraits.has(key)) portraits.set(key, WorldView.portrait(mood, palette).toDataURL());
    return portraits.get(key)!;
  };

  function interactive(element: HTMLElement, label: string, activate: () => void) {
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    element.setAttribute('aria-label', label);
    element.addEventListener('pointerdown', (event) => event.stopPropagation(), options);
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      activate();
    }, options);
    for (const type of ['keydown', 'keyup'] as const) {
      element.addEventListener(type, (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation(); // Space's keyup must not toggle canvas playback.
        if (type === 'keydown' && !event.repeat) activate();
      }, options);
    }
  }

  sleepers.forEach((element, index) => {
    const image = element.querySelector('img')!;
    const bubble = document.createElement('div');
    bubble.className = 'cell-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-atomic', 'true');
    bubble.setAttribute('aria-hidden', 'true');
    element.append(bubble);
    let state = sleepingCell();
    let timer = 0;
    let lastTip: string | undefined;

    function render() {
      element.classList.toggle('awake', state.pokes > 0);
      element.dataset.pokes = String(state.pokes);
      const mood = state.pokes === 0 || state.pokes === 2 ? 'blink' : state.pokes === 3 ? 'crowded' : 'happy';
      image.src = portrait(mood, index + 1);
      bubble.setAttribute('aria-hidden', String(state.pokes === 0));
    }

    function sleepWhenDue() {
      state = settleCell(state, performance.now());
      render();
      if (state.sleepAt !== null) {
        timer = window.setTimeout(sleepWhenDue, Math.max(1, state.sleepAt - performance.now()));
      }
    }

    interactive(element, t.corner.wake, () => {
      clearTimeout(timer);
      state = pokeCell(state, performance.now());
      if (state.pokes === 1) {
        lastTip = randomTip(undefined, lastTip).text;
        bubble.textContent = lastTip;
      } else {
        bubble.textContent = `${state.pokes === 4 ? '✦ ' : ''}${pokeLine(state.pokes - 1)}`;
      }
      render();
      actions.wakeCell(index);
      timer = window.setTimeout(sleepWhenDue, state.sleepAt! - performance.now());
    });
    resets.push(() => {
      clearTimeout(timer);
      state = sleepingCell();
      render();
    });
  });

  const icon = title.querySelector('img')!;
  const originalIcon = icon.src;
  let helpTimer = 0;
  let openingHelp = false;
  interactive(title, t.corner.help, () => {
    if (openingHelp) return;
    openingHelp = true;
    icon.src = portrait('blink', 0);
    title.classList.add('opening-help');
    helpTimer = window.setTimeout(() => {
      icon.src = originalIcon;
      title.classList.remove('opening-help');
      openingHelp = false;
      actions.openHelp();
    }, reducedMotion.matches ? 120 : 520);
  });
  resets.push(() => {
    clearTimeout(helpTimer);
    openingHelp = false;
    icon.src = originalIcon;
    title.classList.remove('opening-help');
  });

  const reset = () => resets.forEach((resetCell) => resetCell());
  window.addEventListener('pagehide', reset, options);
  return {
    reset,
    dispose() {
      reset();
      listeners.abort();
      sleepers.forEach((element) => element.querySelector('.cell-bubble')?.remove());
    },
  };
}
