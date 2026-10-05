import { describe, expect, it } from 'vitest';
import { MODES } from '../src/ui/modes';

describe('mode picker options', () => {
  it('offers sandbox, garden battle and crystal siege with the mode IDs used by the game', () => {
    expect(MODES.filter((mode) => !mode.disabled).map(({ id, name }) => ({ id, name })))
      .toEqual([{ id: 'sandbox', name: 'sandbox' }, { id: 'battle', name: 'garden battle' }, { id: 'siege', name: 'crystal siege' }]);
    expect(MODES.every((mode) => mode.description.length > 0)).toBe(true);
  });
});
