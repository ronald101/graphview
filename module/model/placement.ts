// Where units sit (specification 6.1): given positions when every unit has one, else the force
// layout; both scaled so that the larger side spans EXTENT, centred on 0, with y pointing up.
import { keyId, type Graph } from '../core/index.ts';
import { runForce } from '../workers/index.ts';
import { givenLayout, startPositions } from './layout.ts';
import type { Relation } from './topology.ts';

/** The layout spans this many world units across. */
export const EXTENT = 1000;

/** x and y of each unit, in world units; null when the graph stopped being current meanwhile. */
export async function placeUnits(
  g: Graph,
  ids: string[],
  relations: Relation[],
  current: () => boolean,
): Promise<Float32Array<ArrayBuffer> | null> {
  let pts: Map<string, { x: number; y: number }>;
  if (g.units.length && g.units.every((k) => g.unitInfo.get(keyId(k))?.pos)) pts = givenLayout(g);
  else {
    const start = startPositions(g.units, 1);
    const out = await runForce({
      units: ids,
      links: relations.map((r) => [r.a, r.b] as [number, number]),
      start: ids.map((id) => start.get(id)!),
      pinned: [],
      settings: {},
    });
    if (!current()) return null;
    pts = new Map(ids.map((id, i) => [id, out.positions[i]]));
  }
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const p of pts.values()) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const s = EXTENT / (Math.max(maxX - minX, maxY - minY) || 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const positions = new Float32Array(2 * ids.length);
  ids.forEach((id, i) => {
    const p = pts.get(id) ?? { x: cx, y: cy };
    // The data's y points down; the scene's points up.
    positions[2 * i] = (p.x - cx) * s;
    positions[2 * i + 1] = -(p.y - cy) * s;
  });
  return positions;
}
