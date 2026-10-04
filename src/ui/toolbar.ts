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
  all: { label: 'sound on', icon: 'soundAll', next: 'music only' },
  music: { label: 'music only', icon: 'soundMusic', next: 'sound off' },
  off: { label: 'sound off', icon: 'soundOff', next: 'sound on' },
};

export function soundState(mode: SoundMode) {
  const state = SOUND_STATES[mode];
  return { ...state, title: `${state.label} · click for ${state.next}` };
}

export function activeToolLabel(select: boolean, move: boolean, mode: PlayableMode) {
  return mode === 'battle' ? '' : [select && 'select', move && 'move'].filter(Boolean).join(' + ');
}
