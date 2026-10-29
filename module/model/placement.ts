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
