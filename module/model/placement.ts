// Where units sit (specification 6.1): given positions when every unit has one, else the force
// layout; both scaled so that the larger side spans the extent, centred on 0, with y pointing up.
import { keyId, type Graph, type Key } from '../core/index.ts';
import { EXTENT, STEP } from '../settings/defaults.ts';
import { FORCE_DEFAULTS, type ForceSettings } from '../workers/force.ts';
import { runForce } from '../workers/index.ts';
import { givenLayout, startPositions } from './layout.ts';
import type { Relation } from './topology.ts';

export { EXTENT };

/** The settings of the group "Layout". */
export interface LayoutRules {
  extent: number;
  /** Given positions when complete, or always the force layout. */
  positions: 'auto' | 'force';
  /** The data's y points down; the scene's points up. */
  flipY: boolean;
  /** Units that keep their starting place while the force layout runs. */
  pinned: readonly Key[];
  seed: number;
  startSpacing: number;
  force: ForceSettings;
  /** Runs the force layout on the page instead of in a worker. */
  inline: boolean;
}

export const DEFAULT_LAYOUT: LayoutRules = {
  extent: EXTENT,
  positions: 'auto',
  flipY: true,
  pinned: [],
  seed: 1,
  startSpacing: STEP,
  force: FORCE_DEFAULTS,
  inline: false,
};

/** x and y of each unit, in world units; null when the graph stopped being current meanwhile. */
export async function placeUnits(
  g: Graph,
  ids: string[],
  relations: Relation[],
  current: () => boolean,
  rules: LayoutRules = DEFAULT_LAYOUT,
): Promise<Float32Array<ArrayBuffer> | null> {
  let pts: Map<string, { x: number; y: number }>;
  const given = g.units.length > 0 && g.units.every((k) => g.unitInfo.get(keyId(k))?.pos);
  if (given && rules.positions === 'auto') pts = givenLayout(g);
  else {
    const start = startPositions(g.units, rules.seed, rules.startSpacing);
    const pinned = new Set(rules.pinned.map(keyId));
    const out = await runForce(
      {
        units: ids,
        links: relations.map((r) => [r.a, r.b] as [number, number]),
        start: ids.map((id) => start.get(id)!),
        pinned: ids.flatMap((id, i) => (pinned.has(id) ? [i] : [])),
        settings: rules.force,
      },
      rules.inline,
    );
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
  const s = rules.extent / (Math.max(maxX - minX, maxY - minY) || 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const flip = rules.flipY ? -1 : 1;
  const positions = new Float32Array(2 * ids.length);
  ids.forEach((id, i) => {
    const p = pts.get(id) ?? { x: cx, y: cy };
    positions[2 * i] = (p.x - cx) * s;
    positions[2 * i + 1] = flip * (p.y - cy) * s;
  });
  return positions;
}

/**
 * The force layout on some units alone, from their places (6.21): the others stay, and the part keeps
 * the centre and the larger side of its box. Returns every unit's place.
 */
export async function placePart(
  ids: string[],
  positions: Float32Array,
  part: readonly number[],
  relations: readonly Relation[],
  rules: LayoutRules = DEFAULT_LAYOUT,
): Promise<Float32Array<ArrayBuffer>> {
  const at = new Map(part.map((i, n) => [i, n]));
  const box = (pts: { x: number; y: number }[]) => {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, side: Math.max(x1 - x0, y1 - y0) };
  };
  const start = part.map((i) => ({ x: positions[2 * i], y: positions[2 * i + 1] }));
  const out = await runForce(
    {
      units: part.map((i) => ids[i]),
      links: relations.flatMap((r) =>
        at.has(r.a) && at.has(r.b) ? [[at.get(r.a)!, at.get(r.b)!] as [number, number]] : [],
      ),
      start,
      pinned: [],
      settings: rules.force,
    },
    rules.inline,
  );
  const [was, now] = [box(start), box(out.positions)];
  const s = was.side > 0 && now.side > 0 ? was.side / now.side : 1;
  const next = Float32Array.from(positions);
  part.forEach((i, n) => {
    next[2 * i] = was.cx + (out.positions[n].x - now.cx) * s;
    next[2 * i + 1] = was.cy + (out.positions[n].y - now.cy) * s;
  });
  return next;
}
