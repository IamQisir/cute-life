import { CATALOG } from '../life/catalog';
import { placePattern } from '../life/patterns';

export function welcomePattern(id: string, x: number, y: number): [number, number][] {
  const pattern = CATALOG.find((entry) => entry.id === id);
  if (!pattern) throw new Error(`Missing showcase pattern: ${id}`);
  return placePattern(pattern, x, y);
}

