export type AiArenaSize = 'xl' | 'huge';
const KEY = 'cute-life:arena-size';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export function readArenaSize(storage?: Storage): AiArenaSize {
  try {
    return (storage ?? localStorage).getItem(KEY) === 'huge' ? 'huge' : 'xl';
  } catch {
    return 'xl';
  }
}

export function rememberArenaSize(size: AiArenaSize, storage?: Storage): void {
  try {
    (storage ?? localStorage).setItem(KEY, size);
  } catch {
    // Playing still works when browser storage is unavailable.
  }
}
