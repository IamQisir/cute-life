import { describe, expect, it } from 'vitest';
import { ICONS } from '../src/ui/icons';
import { activeToolLabel, SETTINGS_ITEMS, settingsItems, soundState, TOOLBAR_ITEMS } from '../src/ui/toolbar';

describe('top bar controls', () => {
  it('keeps record and share distinct and visible, with tools inside settings', () => {
    expect(TOOLBAR_ITEMS).toEqual(['mode', 'record', 'share', 'follow', 'settings']);
    expect(SETTINGS_ITEMS).toEqual(['sound', 'select', 'move']);
    expect(new Set([...TOOLBAR_ITEMS, ...SETTINGS_ITEMS]).size).toBe(8);
    expect(settingsItems('sandbox')).toEqual(['sound', 'select', 'move']);
    expect(settingsItems('battle')).toEqual(['sound']);
    expect(settingsItems('siege')).toEqual(['sound']);
  });

  it('supplies sketch paths for every control, mode and sound state', () => {
    expect(Object.keys(ICONS)).toEqual([
      'sandbox', 'battle', 'siege', 'record', 'share', 'follow', 'select', 'move',
      'soundAll', 'soundMusic', 'soundOff', 'help', 'settings', 'rotate', 'flip',
    ]);
    for (const paths of Object.values(ICONS)) {
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.every((path) => /^M/.test(path) && !/NaN|undefined/.test(path))).toBe(true);
    }
    expect(new Set(['soundAll', 'soundMusic', 'soundOff'].map((id) => ICONS[id as keyof typeof ICONS].join(' '))).size).toBe(3);
  });

  it.each([
    ['all', 'sound on', 'soundAll', 'music only'],
    ['music', 'music only', 'soundMusic', 'sound off'],
    ['off', 'sound off', 'soundOff', 'sound on'],
  ] as const)('describes the %s sound mode and its next state', (mode, label, icon, next) => {
    expect(soundState(mode)).toEqual({ label, icon, next, title: `${label} · click for ${next}` });
  });

  it('reports active tools on the gear only while in the sandbox', () => {
    expect(activeToolLabel(false, false, 'sandbox')).toBe('');
    expect(activeToolLabel(true, false, 'sandbox')).toBe('select');
    expect(activeToolLabel(false, true, 'sandbox')).toBe('move');
    expect(activeToolLabel(true, true, 'sandbox')).toBe('select + move');
    expect(activeToolLabel(true, true, 'battle')).toBe('');
    expect(activeToolLabel(true, true, 'siege')).toBe('');
  });
});
