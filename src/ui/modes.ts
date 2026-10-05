import { t } from '../i18n';

/** Siege stays visible, but cannot be selected until it is ready to play. */
export const MODES = [
  { id: 'sandbox', ...t.modes.sandbox, disabled: false },
  { id: 'battle', ...t.modes.battle, disabled: false },
  { id: 'siege', ...t.modes.siege, disabled: true },
] as const;

export type Mode = typeof MODES[number]['id'];
export type PlayableMode = Extract<typeof MODES[number], { disabled: false }>['id'];
