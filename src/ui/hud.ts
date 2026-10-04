import { type Category, byCategory } from '../life/catalog';
import { type Pattern, cellCount } from '../life/patterns';
import type { SoundMode } from '../audio/musicBox';
import { WorldView } from '../render/world';
import { attachCornerCells } from './cornerCells';
import { type CardHandlers, patternCard } from './patternCard';
import { isPaletteHidden, paletteSection, setPaletteHidden } from './paletteSections';
import { type StampEntry, type StampSectionActions, stampSection } from './stamps';
import { MODES, type Mode, type PlayableMode } from './modes';
import { icon, type IconName } from './icons';
import { activeToolLabel, SETTINGS_ITEMS, soundState, TOOLBAR_ITEMS } from './toolbar';
import { Popover } from './popover';

/** Sections open until the player decides otherwise: the most fun to try first. */
const OPEN_BY_DEFAULT = new Set<Category>(['spaceship', 'gun', 'oscillator']);

export interface HudActions {
  openHelp(): void;
  wakeCell(index: number): void;
  togglePlay(): void;
  step(): void;
  shuffle(): void;
  clear(): void;
  setSpeed(genPerSec: number): void;
  toggleSound(): void;
  toggleHand(): void;
  pickPattern(p: Pattern | null): void;
  toggleRecord(): void;
  share(): void;
  setMode(mode: PlayableMode): void;
  /** Drag-and-drop from palette cards onto the canvas. */
  cardDrag: CardHandlers;
  toggleSelect(): void;
  toggleFollow(): void;
}

export interface ResultActions {
  download(): void;
  copyLink(): void;
  post(): void;
}

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
    b.blur(); // keep Space for play/pause, not for re-clicking this button
    onClick();
  });
  return b;
}

/** Replace only presentation; stateful buttons keep their identity and listeners. */
function decorate(b: HTMLButtonElement, glyph: IconName, label: string, title = label) {
  const copy = el('span', 'toolbar-label', label);
  b.replaceChildren(icon(glyph), copy);
  b.title = title;
  b.setAttribute('aria-label', title);
}

function toolbarButton(id: string, glyph: IconName, label: string, onClick?: () => void, cls = '') {
  const b = el('button', `btn toolbar-btn ${id}-btn ${cls}`.trim());
  b.type = 'button';
  decorate(b, glyph, label);
  if (onClick) b.addEventListener('click', (e) => {
    e.stopPropagation();
    // Leave settings items focused so their keyup cannot reach the game.
    if (!b.closest('[role="menu"]')) b.blur();
    onClick();
  });
  return b;
}

export class Hud {
  private status = el('div', 'status');
  private playBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
  private recordBtn: HTMLButtonElement;
  private modeBtn: HTMLButtonElement;
  private modeMenu = el('div', 'paper-menu mode-menu');
  private settingsBtn: HTMLButtonElement;
  private settingsMenu = el('div', 'paper-menu settings-menu');
  private modePopover: Popover;
  private settingsPopover: Popover;
  private mode: PlayableMode = 'sandbox';
  private selecting = false;
  private moving = false;
  private modeCards = new Map<Mode, HTMLButtonElement>();
  private root: HTMLElement;
  private modal: HTMLElement | null = null;
  private handBtn: HTMLButtonElement;
  private hint = el('div', 'hint');
  private toastEl = el('div', 'toast');
  private toastTimer = 0;
  private cards = new Map<Pattern, HTMLElement>();
  private customCards = new Map<Pattern, HTMLElement>();
  private customArea = el('div', 'custom-area');
  /** The stamp palette; also the battle's palette (cards show cell costs). */
  readonly palette: HTMLElement;
  private selectBtn: HTMLButtonElement;
  private followBtn: HTMLButtonElement;
  private picked: Pattern | null = null;
  private cornerCells: ReturnType<typeof attachCornerCells>;

  constructor(root: HTMLElement, a: HudActions) {
    this.root = root;
    const title = el('div', 'title');
    const icon = el('img');
    icon.src = WorldView.portrait('happy', 0).toDataURL();
    icon.alt = '';
    title.append(icon, el('span', '', 'cute'), el('span', '', 'life'));

    const topRight = el('div', 'top-right');
    this.soundBtn = toolbarButton('sound', 'soundAll', 'sound on', a.toggleSound);
    this.handBtn = toolbarButton('move', 'move', 'move', () => {
      a.toggleHand();
      this.settingsPopover.close(true);
    }, 'sandbox-only');
    this.selectBtn = toolbarButton('select', 'select', 'select', () => {
      a.toggleSelect();
      this.settingsPopover.close(true);
    }, 'sandbox-only');
    this.followBtn = toolbarButton('follow', 'follow', 'follow', a.toggleFollow);
    this.recordBtn = toolbarButton('record', 'record', 'record', a.toggleRecord, 'rec');
    const shareBtn = toolbarButton('share', 'share', 'share', a.share);
    this.modeBtn = toolbarButton('mode', 'sandbox', 'sandbox');
    this.settingsBtn = toolbarButton('settings', 'settings', 'settings');
    this.modeMenu.id = 'mode-menu';
    this.modeMenu.setAttribute('aria-label', 'choose a mode');
    this.settingsMenu.id = 'settings-menu';
    this.settingsMenu.setAttribute('aria-label', 'settings');
    const settings = { sound: this.soundBtn, select: this.selectBtn, move: this.handBtn };
    for (const id of SETTINGS_ITEMS) {
      const item = settings[id];
      item.setAttribute('role', id === 'sound' ? 'menuitem' : 'menuitemcheckbox');
      if (id !== 'sound') item.setAttribute('aria-checked', 'false');
      this.settingsMenu.append(item);
    }
    for (const option of MODES) {
      const card = el('button', 'mode-card');
      card.type = 'button';
      card.setAttribute('role', 'menuitemradio');
      card.setAttribute('aria-checked', String(option.id === 'sandbox'));
      card.disabled = option.disabled;
      card.setAttribute('aria-disabled', String(option.disabled));
      const preview = el('span', `mode-preview ${option.id}`);
      preview.setAttribute('aria-hidden', 'true');
      if (option.id === 'sandbox') preview.append(WorldView.portrait('happy', 0));
      else if (option.id === 'battle') preview.append(WorldView.teamPortrait(1), WorldView.teamPortrait(2));
      else {
        const crystal = el('canvas');
        crystal.width = crystal.height = 54;
        const ctx = crystal.getContext('2d')!;
        ctx.fillStyle = '#d5c9ed';
        ctx.strokeStyle = '#7a6a5c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(26, 3); ctx.lineTo(43, 19); ctx.lineTo(38, 39);
        ctx.lineTo(24, 51); ctx.lineTo(12, 35); ctx.lineTo(14, 17);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(26, 3); ctx.lineTo(22, 20); ctx.lineTo(24, 51);
        ctx.moveTo(14, 17); ctx.lineTo(22, 20); ctx.lineTo(43, 19);
        ctx.stroke();
        preview.append(crystal);
      }
      const copy = el('span', 'mode-copy');
      copy.append(el('span', 'mode-name', option.name), el('span', 'mode-description', option.description));
      if (option.disabled) copy.append(el('span', 'mode-soon', 'coming soon'));
      card.append(preview, copy);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        if (option.disabled) return;
        this.modePopover.close(true);
        a.setMode(option.id);
      });
      this.modeCards.set(option.id, card);
      this.modeMenu.append(card);
    }
    this.modePopover = new Popover(this.modeBtn, this.modeMenu, () => this.settingsPopover.close());
    this.settingsPopover = new Popover(this.settingsBtn, this.settingsMenu, () => this.modePopover.close());
    const toolbar = { mode: this.modeBtn, record: this.recordBtn, share: shareBtn, follow: this.followBtn, settings: this.settingsBtn };
    topRight.append(...TOOLBAR_ITEMS.map((id) => toolbar[id]));
    const topArea = el('div', 'top-area');
    title.setAttribute('aria-label', 'cute life');
    const menus = el('div', 'top-menus');
    menus.append(this.modeMenu, this.settingsMenu);
    topArea.append(title, topRight, menus);

    const palette = el('div', 'palette');
    this.palette = palette;
    palette.classList.toggle('collapsed', isPaletteHidden());
    // The "stamps" title itself folds the whole palette (arrow like the sections).
    const top = el('button', 'pal-top');
    top.append(el('span', 'pal-arrow', '▸'), el('span', 'label', 'stamps'));
    top.title = 'show / hide stamps';
    top.addEventListener('click', (e) => {
      e.stopPropagation();
      top.blur();
      const hidden = !palette.classList.contains('collapsed');
      palette.classList.toggle('collapsed', hidden);
      setPaletteHidden(hidden);
    });
    palette.append(top);
    const cell = WorldView.portrait('happy', 0);
    for (const group of byCategory()) {
      const cards = group.entries.map((p) => {
        const card = patternCard(p, cell, {
          ...a.cardDrag,
          pick: () => a.pickPattern(card.classList.contains('on') ? null : p),
        }, true, `${p.fullName}: ${p.blurb}`);
        this.cards.set(p, card);
        return card;
      });
      palette.append(paletteSection(group.category, group.label, cards.length, cards, OPEN_BY_DEFAULT.has(group.category)));
    }
    palette.append(this.customArea);

    const bottom = el('div', 'bottom');
    const controls = el('div', 'controls');
    this.playBtn = button('play', a.togglePlay, 'big');
    const speed = el('label', 'speed');
    const slider = el('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '20';
    slider.value = '4';
    slider.addEventListener('input', () => a.setSpeed(Number(slider.value)));
    speed.append(el('span', '', 'slow'), slider, el('span', '', 'fast'));
    controls.append(this.playBtn, button('step', a.step), speed, button('sprinkle', a.shuffle), button('clear', a.clear));
    bottom.append(this.status, controls);

    this.hint.textContent = 'click to draw a little cell ~ space to play\nscroll to zoom ~ right-drag (or hold space) to move';

    const sleepers = ['bl', 'br'].map((side, i) => {
      const s = el('div', `sleeper ${side}`);
      const img = el('img');
      img.src = WorldView.portrait('blink', i + 1).toDataURL();
      img.alt = '';
      s.append(img, el('span', 'z', 'z'), el('span', 'z', 'z'));
      return s;
    });

    root.append(topArea, palette, this.hint, bottom, this.toastEl, ...sleepers);
    // Before setMode below, which resets the corner cells.
    this.cornerCells = attachCornerCells(title, sleepers, a);
    this.setMode('sandbox');
    this.setHand(false);
    this.setSelect(false);
    this.setSound('all');
  }

  setStatus(generation: number, population: number) {
    this.status.replaceChildren(document.createTextNode('generation '), el('b', '', String(generation)),
      document.createTextNode(' · '), el('b', '', String(population)),
      document.createTextNode(` ${population === 1 ? 'cell' : 'cells'}`));
  }

  setPlaying(on: boolean) {
    this.playBtn.textContent = on ? 'pause' : 'play';
  }

  setSound(mode: SoundMode) {
    const state = soundState(mode);
    decorate(this.soundBtn, state.icon, state.label, state.title);
    this.soundBtn.classList.toggle('on', mode !== 'all');
  }

  setHand(on: boolean) {
    this.moving = on;
    this.handBtn.classList.toggle('on', on);
    this.handBtn.setAttribute('aria-checked', String(on));
    decorate(this.handBtn, 'move', 'move', `move tool ${on ? 'on' : 'off'} · H`);
    this.updateSettingsBadge();
  }

  setPattern(p: Pattern | null) {
    this.picked = p;
    for (const [q, card] of [...this.cards, ...this.customCards]) card.classList.toggle('on', q === p);
  }

  setFollow(on: boolean) {
    this.followBtn.classList.toggle('on', on);
    this.followBtn.setAttribute('aria-pressed', String(on));
    decorate(this.followBtn, 'follow', 'follow', `follow camera ${on ? 'on' : 'off'}`);
  }

  /** Battle deployment: grey out stamps that don't fit the cells left (null = no limit). */
  setBudget(left: number | null) {
    for (const [p, card] of [...this.cards, ...this.customCards]) {
      card.classList.toggle('off', left !== null && cellCount(p) > left);
    }
  }

  /** Hide the palette while a battle plays, keeping its space so the arena doesn't jump. */
  setPaletteActive(on: boolean) {
    this.palette.style.visibility = on ? 'visible' : 'hidden';
  }

  setSelect(on: boolean) {
    this.selecting = on;
    this.selectBtn.classList.toggle('on', on);
    this.selectBtn.setAttribute('aria-checked', String(on));
    decorate(this.selectBtn, 'select', 'select', `select tool ${on ? 'on' : 'off'}`);
    this.updateSettingsBadge();
  }

  /** Rebuild the "my stamps" section of the sandbox palette. */
  setStamps(entries: StampEntry[], a: StampSectionActions) {
    const cell = WorldView.portrait('happy', 0);
    const { nodes, cards } = stampSection(entries, cell, a, true, false);
    this.customArea.replaceChildren(paletteSection('mine', 'my stamps', entries.length, nodes, true));
    this.customCards = cards;
    this.setPattern(this.picked);
  }

  /** Switch the HUD between the sandbox and battle layouts. */
  setMode(mode: PlayableMode) {
    this.cornerCells.reset();
    this.root.classList.toggle('battle', mode === 'battle');
    this.mode = mode;
    const name = MODES.find((option) => option.id === mode)!.name;
    decorate(this.modeBtn, mode, name, `mode: ${name}`);
    for (const [id, card] of this.modeCards) card.setAttribute('aria-checked', String(id === mode));
    this.modePopover.close();
    this.settingsPopover.close();
    this.updateSettingsBadge();
  }

  private updateSettingsBadge() {
    const tools = activeToolLabel(this.selecting, this.moving, this.mode);
    this.settingsBtn.classList.toggle('on', !!tools);
    this.settingsBtn.classList.toggle('has-active-tool', !!tools);
    const label = tools ? `settings · ${tools} tool active` : 'settings';
    this.settingsBtn.title = label;
    this.settingsBtn.setAttribute('aria-label', label);
  }

  /** Seconds elapsed while recording, or null when idle. */
  setRecording(seconds: number | null, max: number) {
    this.recordBtn.classList.toggle('live', seconds !== null);
    const label = seconds === null ? 'record' : `stop ${Math.floor(seconds)}s / ${max}s`;
    decorate(this.recordBtn, 'record', label, seconds === null ? 'record video' : `${label} · recording video`);
    this.recordBtn.setAttribute('aria-pressed', String(seconds !== null));
  }

  /** A sticky-note popup with the finished clip. */
  showResult(videoUrl: string, ext: string, a: ResultActions) {
    this.closeResult();
    const back = el('div', 'modal-back');
    const card = el('div', 'modal');
    const video = el('video');
    video.src = videoUrl;
    video.autoplay = video.loop = video.muted = video.playsInline = true;
    video.controls = true;
    const note = el('div', 'modal-note',
      ext === 'mp4'
        ? 'your clip is ready! save it, then attach it to your post ~'
        : 'saved as WebM; X only takes MP4, so try Chrome or Safari for posting');
    const row = el('div', 'controls');
    row.append(
      button('save video', a.download, 'big'),
      button('copy link', a.copyLink),
      button('post on X', a.post),
      button('close', () => this.closeResult()),
    );
    card.append(el('div', 'modal-title', 'look what grew!'), video, note, row);
    back.append(card);
    back.addEventListener('pointerdown', (e) => e.target === back && this.closeResult());
    document.body.append(back);
    this.modal = back;
  }

  closeResult() {
    this.modal?.remove();
    this.modal = null;
  }

  dismissHint() {
    this.hint.classList.add('gone');
  }

  dispose() {
    this.cornerCells.dispose();
    clearTimeout(this.toastTimer);
  }

  toast(msg: string, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
}
