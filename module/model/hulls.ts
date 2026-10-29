// Hull groups for the 3D view (specification 6.9): units of one type that sit close together.
// Pure geometry, so that it is testable without a browser.
import { HULL_LIMIT } from '../settings/defaults.ts';
import type { V3 } from './picking.ts';

export { HULL_LIMIT };

/**
 * Single-linkage groups: two points closer than `reach` share a group, and so do points
 * joined by a chain of such pairs. A grid of cells `reach` wide keeps it near linear.
 */
export function clusters(points: V3[], reach: number): number[][] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const cell = (v: number) => Math.floor(v / reach);
  const grid = new Map<string, number[]>();
  const r2 = reach * reach;
  points.forEach((p, i) => {
    const [cx, cy, cz] = [cell(p[0]), cell(p[1]), cell(p[2])];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
            const q = points[j];
            const d2 = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
            if (d2 <= r2) parent[find(i)] = find(j);
          }
        }
    const key = `${cx},${cy},${cz}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(i);
  });
  const groups = new Map<number, number[]>();
  points.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  });
  return [...groups.values()];
}

/** The points a hull wraps: each member widened by `pad` along every axis, so that flat groups still have volume. */
export function hullPoints(members: V3[], pad: number): V3[] {
  const out: V3[] = [];
  for (const p of members) {
    out.push(
      [p[0] + pad, p[1], p[2]],
      [p[0] - pad, p[1], p[2]],
      [p[0], p[1] + pad, p[2]],
      [p[0], p[1] - pad, p[2]],
      [p[0], p[1], p[2] + pad],
      [p[0], p[1], p[2] - pad],
    );
  }
  return out;
}

/** The median of the lengths, or 0 when there are none. */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
