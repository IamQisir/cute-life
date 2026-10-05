export interface Orientation {
  rot: 0 | 1 | 2 | 3;
  flip: boolean;
}

export function rotateOrientation(o: Orientation): Orientation {
  return { ...o, rot: ((o.rot + 1) % 4) as Orientation['rot'] };
}

export function flipOrientation(o: Orientation): Orientation {
  return { ...o, flip: !o.flip };
}

/** Mirror horizontally in the pattern's local coordinates, then rotate about its anchor. */
export function orientPoints(points: readonly [number, number][], o: Orientation): [number, number][] {
  return points.map(([px, py]) => {
    let x = o.flip ? -px : px;
    let y = py;
    for (let r = 0; r < o.rot; r++) [x, y] = [-y, x];
    return [x || 0, y || 0];
  });
}
