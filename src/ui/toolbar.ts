import { t } from '../i18n';
import type { SoundMode } from '../audio/musicBox';
import type { PlayableMode } from './modes';
import type { IconName } from './icons';

/** Keep record/share separate and visible for recording and the onboarding tour. */
export const TOOLBAR_ITEMS = ['mode', 'record', 'share', 'follow', 'settings'] as const;
export const SETTINGS_ITEMS = ['sound', 'select', 'move'] as const;
export function settingsItems(mode: PlayableMode) {
  return SETTINGS_ITEMS.filter((item) => mode === 'sandbox' || item === 'sound');
}

export const SOUND_STATES: Record<SoundMode, { label: string; icon: IconName; next: string }> = {
  all: { label: t.sound.all, icon: 'soundAll', next: t.sound.music },
  music: { label: t.sound.music, icon: 'soundMusic', next: t.sound.off },
  off: { label: t.sound.off, icon: 'soundOff', next: t.sound.all },
};

export function soundState(mode: SoundMode) {
  const state = SOUND_STATES[mode];
  return { ...state, title: t.sound.title(state.label, state.next) };
}

export function activeToolLabel(select: boolean, move: boolean, mode: PlayableMode) {
  return mode === 'battle' ? '' : [select && t.toolbar.select, move && t.toolbar.move].filter(Boolean).join(' + ');
}
