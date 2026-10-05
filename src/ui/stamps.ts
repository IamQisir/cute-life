// UI for custom stamps: the floating menu on a canvas selection, the import
// dialog, the "add this stamp?" offer for stamp links, and the "my stamps"
// palette section. Names are always rendered with textContent.

import { t } from '../i18n';
import { type Pattern, cellCount } from '../life/patterns';
import { type CardHandlers, patternCard, patternThumb } from './patternCard';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), text);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.blur();
    onClick();
  });
  return b;
}

/** A modal sticky note; returns a close function. */
function modal(title: string, body: HTMLElement[], actions: HTMLElement[]): () => void {
  const back = el('div', 'modal-back');
  const card = el('div', 'modal stamp-modal');
  const row = el('div', 'controls');
  row.append(...actions);
  card.append(el('div', 'modal-title', title), ...body, row);
  back.append(card);
  const close = () => back.remove();
  back.addEventListener('pointerdown', (e) => e.target === back && close());
  document.body.append(back);
  return close;
}

// ---- selection menu ---------------------------------------------------------

export interface SelectionActions {
  save(name: string): void;
  copyRle(name: string): void;
  close(): void;
}

/** Floats next to the selection box on the canvas. */
export class SelectionMenu {
  readonly root = el('div', 'selection-menu');
  private count = el('div', 'selection-count');
  private name = el('input', 'name-input');

  constructor(parent: HTMLElement, a: SelectionActions) {
    this.name.placeholder = t.stamps.namePlaceholder;
    this.name.maxLength = 24;
    this.name.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing must not trigger game shortcuts
      if (e.key === 'Enter') a.save(this.name.value);
      if (e.key === 'Escape') a.close();
    });
    const row = el('div', 'controls');
    row.append(
      button(t.stamps.save, () => a.save(this.name.value), 'big'),
      button(t.stamps.copyRle, () => a.copyRle(this.name.value)),
      button('×', a.close),
    );
    this.root.append(this.count, this.name, row);
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  /** Show at a screen position with the number of selected cells. */
  show(x: number, y: number, cells: number) {
    this.count.textContent = t.stamps.selected(cells);
    this.root.style.display = '';
    const w = this.root.offsetWidth;
    const h = this.root.offsetHeight;
    this.root.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x))}px`;
    this.root.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, y))}px`;
  }

  move(x: number, y: number) {
    if (this.root.style.display === 'none') return;
    const w = this.root.offsetWidth;
    const h = this.root.offsetHeight;
    this.root.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x))}px`;
    this.root.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, y))}px`;
  }

  hide() {
    this.root.style.display = 'none';
    this.name.value = '';
  }

  get visible() {
    return this.root.style.display !== 'none';
  }
}

// ---- dialogs ----------------------------------------------------------------

/** Paste RLE or a stamp link. `add` returns an error message, or null on success. */
export function openImportDialog(add: (text: string, name: string) => string | null) {
  const text = el('textarea', 'import-text');
  text.placeholder = t.stamps.importPlaceholder;
  text.rows = 6;
  const name = el('input', 'name-input');
  name.placeholder = t.stamps.optionalName;
  name.maxLength = 24;
  const error = el('div', 'modal-note');
  for (const input of [text, name]) input.addEventListener('keydown', (e) => e.stopPropagation());
  const close = modal(t.stamps.importTitle, [text, name, error], [
    button(t.stamps.add, () => {
      const problem = add(text.value, name.value);
      if (problem) error.textContent = problem;
      else close();
    }, 'big'),
    button(t.stamps.cancel, () => close()),
  ]);
  text.focus();
}

/** Someone opened a stamp link: show it and offer to add it. */
export function openStampOffer(p: Pattern, cell: HTMLCanvasElement, add: () => void, dismiss: () => void) {
  const preview = patternThumb(p, cell, 120);
  preview.classList.add('stamp-preview');
  const label = el('div', 'modal-note');
  label.textContent = t.stamps.offerLabel(p.name, cellCount(p));
  const close = modal(t.stamps.offerTitle, [preview, label], [
    button(t.stamps.addToMine, () => {
      add();
      close();
    }, 'big'),
    button(t.stamps.noThanks, () => {
      dismiss();
      close();
    }),
  ]);
}

// ---- palette section --------------------------------------------------------

export interface StampEntry {
  id: string;
  pattern: Pattern;
}

export interface StampSectionActions {
  cards: CardHandlers;
  share?(id: string): void;
  remove?(id: string): void;
  importStamp?(): void;
}

/**
 * The "my stamps" part of a palette. Returns the elements to append and the
 * card for each pattern (for highlighting the selected stamp).
 */
export function stampSection(
  entries: StampEntry[],
  cell: HTMLCanvasElement,
  a: StampSectionActions,
  showCost: boolean,
  withLabel = true,
): { nodes: HTMLElement[]; cards: Map<Pattern, HTMLElement> } {
  const nodes: HTMLElement[] = [];
  const cards = new Map<Pattern, HTMLElement>();
  if (withLabel && (entries.length || a.importStamp)) nodes.push(el('div', 'label', t.palette.myStamps));
  for (const { id, pattern } of entries) {
    const card = patternCard(pattern, cell, a.cards, showCost);
    card.classList.add('custom');
    const tools = el('div', 'card-tools');
    if (a.share) {
      const s = el('span', 'card-tool', '🔗');
      s.title = t.palette.copyStampLink;
      s.addEventListener('pointerdown', (e) => e.stopPropagation());
      s.addEventListener('click', (e) => {
        e.stopPropagation();
        a.share!(id);
      });
      tools.append(s);
    }
    if (a.remove) {
      const x = el('span', 'card-tool', '×');
      x.title = t.palette.deleteStamp;
      x.addEventListener('pointerdown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        a.remove!(id);
      });
      tools.append(x);
    }
    if (tools.childElementCount) card.append(tools);
    cards.set(pattern, card);
    nodes.push(card);
  }
  if (a.importStamp) {
    const add = el('div', 'card import-card', t.palette.import);
    add.title = t.palette.importTitle;
    add.addEventListener('click', (e) => {
      e.stopPropagation();
      a.importStamp!();
    });
    nodes.push(add);
  }
  return { nodes, cards };
}
