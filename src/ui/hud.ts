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
import { LANG_NAMES, LANGS, lang, type Lang, t } from '../i18n';

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
  rotateStamp(): void;
  flipStamp(): void;
  pickPattern(p: Pattern | null): void;
  toggleRecord(): void;
  share(): void;
  setMode(mode: PlayableMode): void;
  /** Drag-and-drop from palette cards onto the canvas. */
  cardDrag: CardHandlers;
  toggleSelect(): void;
  toggleFollow(): void;
  setLanguage(lang: Lang): void;
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
  private stampControls = el('div', 'stamp-controls');
  private cornerCells: ReturnType<typeof attachCornerCells>;

  constructor(root: HTMLElement, a: HudActions) {
    this.root = root;
    const title = el('div', 'title');
    const logo = el('img');
    logo.src = WorldView.portrait('happy', 0).toDataURL();
    logo.alt = '';
    title.append(logo, el('span', '', 'cute'), el('span', '', 'life'));

    const topRight = el('div', 'top-right');
    this.soundBtn = toolbarButton('sound', 'soundAll', t.sound.all, a.toggleSound);
    this.handBtn = toolbarButton('move', 'move', t.toolbar.move, () => {
      a.toggleHand();
      this.settingsPopover.close(true);
    }, 'sandbox-only');
    this.selectBtn = toolbarButton('select', 'select', t.toolbar.select, () => {
      a.toggleSelect();
      this.settingsPopover.close(true);
    }, 'sandbox-only');
    this.followBtn = toolbarButton('follow', 'follow', t.toolbar.follow, a.toggleFollow);
    this.recordBtn = toolbarButton('record', 'record', t.toolbar.record, a.toggleRecord, 'rec');
    const shareBtn = toolbarButton('share', 'share', t.toolbar.share, a.share);
    this.modeBtn = toolbarButton('mode', 'sandbox', t.toolbar.sandbox);
    this.settingsBtn = toolbarButton('settings', 'settings', t.toolbar.settings);
    this.modeMenu.id = 'mode-menu';
    this.modeMenu.setAttribute('aria-label', t.toolbar.chooseMode);
    this.settingsMenu.id = 'settings-menu';
    this.settingsMenu.setAttribute('aria-label', t.toolbar.settings);
    const settings = { sound: this.soundBtn, select: this.selectBtn, move: this.handBtn };
    for (const id of SETTINGS_ITEMS) {
      const item = settings[id];
      item.setAttribute('role', id === 'sound' ? 'menuitem' : 'menuitemcheckbox');
      if (id !== 'sound') item.setAttribute('aria-checked', 'false');
      this.settingsMenu.append(item);
    }
    // Switching reloads the page, so these are plain items marked with aria-current.
    const langRow = el('div', 'lang-row');
    langRow.setAttribute('role', 'group');
    langRow.setAttribute('aria-label', t.toolbar.language);
    langRow.append(icon('language'));
    for (const option of LANGS) {
      const pick = el('button', `btn lang-btn${option === lang ? ' on' : ''}`, LANG_NAMES[option]);
      pick.type = 'button';
      pick.lang = option;
      pick.setAttribute('role', 'menuitem');
      if (option === lang) pick.setAttribute('aria-current', 'true');
      pick.addEventListener('click', (e) => {
        e.stopPropagation();
        this.settingsPopover.close(true);
        a.setLanguage(option);
      });
      langRow.append(pick);
    }
    this.settingsMenu.append(langRow);
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
      if (option.disabled) copy.append(el('span', 'mode-soon', t.modes.soon));
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
    const helpBtn = toolbarButton('help', 'help', t.toolbar.help, a.openHelp);
    helpBtn.addEventListener('keydown', (e) => e.stopPropagation());
    helpBtn.addEventListener('keyup', (e) => e.stopPropagation());
    topRight.insertBefore(helpBtn, this.settingsBtn);
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
    top.append(el('span', 'pal-arrow', '▸'), el('span', 'label', t.palette.stamps));
    top.title = t.palette.toggle;
    top.addEventListener('click', (e) => {
      e.stopPropagation();
      top.blur();
      const hidden = !palette.classList.contains('collapsed');
      palette.classList.toggle('collapsed', hidden);
      setPaletteHidden(hidden);
    });
    this.stampControls.hidden = true;
    this.stampControls.setAttribute('role', 'group');
    this.stampControls.setAttribute('aria-label', t.palette.orient);
    this.stampControls.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.stampControls.append(
      toolbarButton('rotate', 'rotate', t.toolbar.rotate, a.rotateStamp),
      toolbarButton('flip', 'flip', t.toolbar.flip, a.flipStamp),
    );
    const [rotate, flip] = this.stampControls.querySelectorAll('button');
    decorate(rotate, 'rotate', t.toolbar.rotate, t.toolbar.rotateTitle);
    decorate(flip, 'flip', t.toolbar.flip, t.toolbar.flipTitle);
    palette.append(this.stampControls, top);
    const cell = WorldView.portrait('happy', 0);
    for (const group of byCategory()) {
      const cards = group.entries.map((p) => {
        const card = patternCard(p, cell, {
          ...a.cardDrag,
          pick: () => a.pickPattern(card.classList.contains('on') ? null : p),
        }, true, t.palette.cardTitle(p.label, p.fullName, p.blurb), p.label);
        this.cards.set(p, card);
        return card;
      });
      palette.append(paletteSection(group.category, group.label, cards.length, cards, OPEN_BY_DEFAULT.has(group.category)));
    }
    palette.append(this.customArea);

    const bottom = el('div', 'bottom');
    const controls = el('div', 'controls');
    this.playBtn = button(t.controls.play, a.togglePlay, 'big');
    const speed = el('label', 'speed');
    const slider = el('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '20';
    slider.value = '4';
    slider.addEventListener('input', () => a.setSpeed(Number(slider.value)));
    speed.append(el('span', '', t.controls.slow), slider, el('span', '', t.controls.fast));
    controls.append(this.playBtn, button(t.controls.step, a.step), speed, button(t.controls.sprinkle, a.shuffle), button(t.controls.clear, a.clear));
    bottom.append(this.status, controls);

    this.hint.textContent = t.controls.hint;

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
    // Segments alternate plain text and bold numbers.
    this.status.replaceChildren(...t.controls.status(generation, population)
      .map((text, i) => (i % 2 ? el('b', '', text) : document.createTextNode(text))));
  }

  setPlaying(on: boolean) {
    this.playBtn.textContent = on ? t.controls.pause : t.controls.play;
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
    decorate(this.handBtn, 'move', t.toolbar.move, t.toolbar.moveTitle(on));
    this.updateSettingsBadge();
  }

  setPattern(p: Pattern | null) {
    this.picked = p;
    this.stampControls.hidden = !p;
    for (const [q, card] of [...this.cards, ...this.customCards]) card.classList.toggle('on', q === p);
  }

  setFollow(on: boolean) {
    this.followBtn.classList.toggle('on', on);
    this.followBtn.setAttribute('aria-pressed', String(on));
    decorate(this.followBtn, 'follow', t.toolbar.follow, t.toolbar.followTitle(on));
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
    decorate(this.selectBtn, 'select', t.toolbar.select, t.toolbar.selectTitle(on));
    this.updateSettingsBadge();
  }

  /** Rebuild the "my stamps" section of the sandbox palette. */
  setStamps(entries: StampEntry[], a: StampSectionActions) {
    const cell = WorldView.portrait('happy', 0);
    const { nodes, cards } = stampSection(entries, cell, a, true, false);
    this.customArea.replaceChildren(paletteSection('mine', t.palette.myStamps, entries.length, nodes, true));
    this.customCards = cards;
    this.setPattern(this.picked);
  }

  /** Switch the HUD between the sandbox and battle layouts. */
  setMode(mode: PlayableMode) {
    this.cornerCells.reset();
    this.root.classList.toggle('battle', mode === 'battle');
    this.mode = mode;
    const name = MODES.find((option) => option.id === mode)!.name;
    decorate(this.modeBtn, mode, name, t.toolbar.modeTitle(name));
    for (const [id, card] of this.modeCards) card.setAttribute('aria-checked', String(id === mode));
    this.modePopover.close();
    this.settingsPopover.close();
    this.updateSettingsBadge();
  }

  private updateSettingsBadge() {
    const tools = activeToolLabel(this.selecting, this.moving, this.mode);
    this.settingsBtn.classList.toggle('on', !!tools);
    this.settingsBtn.classList.toggle('has-active-tool', !!tools);
    const label = tools ? t.toolbar.settingsActive(tools) : t.toolbar.settings;
    this.settingsBtn.title = label;
    this.settingsBtn.setAttribute('aria-label', label);
  }

  /** Seconds elapsed while recording, or null when idle. */
  setRecording(seconds: number | null, max: number) {
    this.recordBtn.classList.toggle('live', seconds !== null);
    const label = seconds === null ? t.toolbar.record : t.toolbar.recordStop(Math.floor(seconds), max);
    decorate(this.recordBtn, 'record', label, seconds === null ? t.toolbar.recordTitle : t.toolbar.recording(label));
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
      ext === 'mp4' ? t.result.mp4 : t.result.webm);
    const row = el('div', 'controls');
    row.append(
      button(t.result.save, a.download, 'big'),
      button(t.result.copyLink, a.copyLink),
      button(t.result.post, a.post),
      button(t.result.close, () => this.closeResult()),
    );
    card.append(el('div', 'modal-title', t.result.title), video, note, row);
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
