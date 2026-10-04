// Collapsible palette sections ("guns (4)", "my stamps (2)" ...). Which
// sections are open is remembered per browser; storage failures are ignored.

const STORE_KEY = 'cute-life.palette.v1';

function loadOpen(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function saveOpen(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* fine: just not remembered */
  }
}

const openState = loadOpen();

/**
 * A section with a clickable header and a body of cards. `defaultOpen` is used
 * until the player toggles it once.
 */
export function paletteSection(id: string, label: string, count: number, body: HTMLElement[], defaultOpen: boolean): HTMLElement {
  const section = document.createElement('div');
  section.className = 'pal-section';
  const header = document.createElement('button');
  header.className = 'pal-header';
  const open = openState[id] ?? defaultOpen;
  section.classList.toggle('open', open);
  const arrow = document.createElement('span');
  arrow.className = 'pal-arrow';
  arrow.textContent = '▸';
  const text = document.createElement('span');
  text.textContent = count ? `${label} (${count})` : label;
  header.append(arrow, text);
  header.addEventListener('click', (e) => {
    e.stopPropagation();
    header.blur();
    const now = !section.classList.contains('open');
    section.classList.toggle('open', now);
    openState[id] = now;
    saveOpen(openState);
  });
  const grid = document.createElement('div');
  grid.className = 'pal-body';
  grid.append(...body);
  section.append(header, grid);
  return section;
}

/** Whole-sidebar collapse, remembered like the sections. */
export function isPaletteHidden(): boolean {
  return openState.__hidden === true;
}

export function setPaletteHidden(hidden: boolean) {
  openState.__hidden = hidden;
  saveOpen(openState);
}
