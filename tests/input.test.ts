import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachInput, type InputTarget } from '../src/input';
import { Camera } from '../src/render/camera';

afterEach(() => vi.unstubAllGlobals());

describe('stamp keyboard shortcuts', () => {
  it('routes R/F to orientation actions, while typing leaves the stamp alone', () => {
    let keydown: (e: KeyboardEvent) => void = () => {};
    vi.stubGlobal('window', {
      addEventListener: (event: string, handler: typeof keydown) => {
        if (event === 'keydown') keydown = handler;
      },
    });
    const t: InputTarget = {
      cam: new Camera(), paint: () => true, stamp: () => true,
      hasStamp: () => true, isHand: () => false, isSelect: () => false,
      select: vi.fn(), onFirstGesture: vi.fn(), togglePlay: vi.fn(),
      step: vi.fn(), shuffle: vi.fn(), toggleHand: vi.fn(), cancelStamp: vi.fn(),
      rotateStamp: vi.fn(), flipStamp: vi.fn(), setHover: vi.fn(), manualCamera: vi.fn(),
    };
    attachInput({ addEventListener: vi.fn() } as unknown as HTMLElement, t);
    const key = (code: string, target: object | null) => keydown({ code, target } as KeyboardEvent);
    key('KeyR', null);
    key('KeyF', { tagName: 'BUTTON' });
    expect(t.rotateStamp).toHaveBeenCalledOnce();
    expect(t.flipStamp).toHaveBeenCalledOnce();
    for (const target of [
      { tagName: 'INPUT', type: 'text' }, { tagName: 'INPUT', type: 'search' },
      { tagName: 'TEXTAREA' }, { tagName: 'DIV', isContentEditable: true },
    ]) {
      key('KeyR', target);
      key('KeyF', target);
    }
    expect(t.rotateStamp).toHaveBeenCalledOnce();
    expect(t.flipStamp).toHaveBeenCalledOnce();
  });
});
