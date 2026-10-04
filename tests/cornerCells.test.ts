import { describe, expect, it } from 'vitest';
import { MAX_POKES, SLEEP_AFTER_MS, pokeCell, settleCell, sleepingCell } from '../src/ui/cornerCellState';

describe('corner cell state', () => {
  it('starts asleep and wakes on its first click', () => {
    const asleep = sleepingCell();
    expect(settleCell(asleep, 100)).toEqual({ pokes: 0, sleepAt: null });
    expect(pokeCell(asleep, 100)).toEqual({ pokes: 1, sleepAt: 100 + SLEEP_AFTER_MS });
    expect(asleep).toEqual({ pokes: 0, sleepAt: null });
  });

  it('escalates through yawn, puff and surprise, then caps the reaction', () => {
    let state = sleepingCell();
    for (let n = 1; n <= 8; n++) {
      state = pokeCell(state, n * 100);
      expect(state.pokes).toBe(Math.min(n, MAX_POKES));
      expect(state.sleepAt).toBe(n * 100 + SLEEP_AFTER_MS);
    }
  });

  it('sleeps exactly at its inactivity deadline', () => {
    const awake = pokeCell(sleepingCell(), 250);
    expect(settleCell(awake, 250 + SLEEP_AFTER_MS - 1).pokes).toBe(1);
    expect(settleCell(awake, 250 + SLEEP_AFTER_MS)).toEqual(sleepingCell());
    expect(settleCell(awake, 250 + SLEEP_AFTER_MS + 500)).toEqual(sleepingCell());
  });

  it('extends the deadline after each poke, including at the final level', () => {
    let state = pokeCell(sleepingCell(), 0);
    for (let n = 1; n <= 5; n++) state = pokeCell(state, n * 100);
    expect(settleCell(state, SLEEP_AFTER_MS).pokes).toBe(MAX_POKES);
    expect(settleCell(state, 500 + SLEEP_AFTER_MS)).toEqual(sleepingCell());
  });

  it('treats clicks at or after expiry as a fresh wake even if a timer was delayed', () => {
    const awake = pokeCell(pokeCell(sleepingCell(), 0), 100);
    for (const delay of [0, 5000]) {
      const now = 100 + SLEEP_AFTER_MS + delay;
      expect(pokeCell(awake, now)).toEqual({ pokes: 1, sleepAt: now + SLEEP_AFTER_MS });
    }
  });

  it('escalates a click just before expiry', () => {
    const awake = pokeCell(sleepingCell(), 0);
    const now = SLEEP_AFTER_MS - 1;
    expect(pokeCell(awake, now)).toEqual({ pokes: 2, sleepAt: now + SLEEP_AFTER_MS });
  });

  it('keeps both sleepers independent', () => {
    const left = pokeCell(sleepingCell(), 0);
    const right = pokeCell(pokeCell(sleepingCell(), 1000), 2000);
    expect(settleCell(left, SLEEP_AFTER_MS)).toEqual(sleepingCell());
    expect(settleCell(right, SLEEP_AFTER_MS).pokes).toBe(2);
    expect(left.pokes).toBe(1);
  });
});
