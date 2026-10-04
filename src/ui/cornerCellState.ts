export const SLEEP_AFTER_MS = 4500;
export const MAX_POKES = 4;

export interface CornerCellState {
  /** 0 = asleep, 1 = awake, 2 = yawn, 3 = puff, 4 = surprise. */
  pokes: number;
  sleepAt: number | null;
}

export function sleepingCell(): CornerCellState {
  return { pokes: 0, sleepAt: null };
}

/** An explicit clock keeps the transitions independent of DOM and timer delivery. */
export function settleCell(state: CornerCellState, now: number): CornerCellState {
  return state.sleepAt !== null && now >= state.sleepAt ? sleepingCell() : state;
}

export function pokeCell(state: CornerCellState, now: number): CornerCellState {
  const current = settleCell(state, now);
  return { pokes: Math.min(current.pokes + 1, MAX_POKES), sleepAt: now + SLEEP_AFTER_MS };
}
