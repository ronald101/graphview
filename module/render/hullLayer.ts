// Hulls around close units of one type (specification 6.9).
import { tokens } from '../core/index.ts';
import { DEPTH_RULES } from '../model/depth.ts';
import { clusters, hullPoints, median } from '../model/hulls.ts';
import { EXTENT } from '../model/placement.ts';
import type { V3 } from '../model/picking.ts';
import type { FrameState } from './frame.ts';
import type { HullSpec } from './gpu.ts';
import { lookOf } from './looks.ts';

/** Same-type units closer than this many median relation lengths share a hull. */
const HULL_REACH = 1;
const HULL_PAD = 18;

export class HullLayer {
  /** The groups drawn, for the snapshot. */
  groups: { type: string; members: number }[] = [];
  private reach = EXTENT / 20;

  /** Learns the median relation length of a newly laid out graph. */
  measure(s: FrameState) {
    const m = s.model;
    const lengths = m.relations.map((r) =>
      Math.hypot(m.positions[2 * r.a] - m.positions[2 * r.b], m.positions[2 * r.a + 1] - m.positions[2 * r.b + 1]),
    );
    this.reach = HULL_REACH * (median(lengths.filter((l) => l > 0)) || EXTENT / 20);
  }

  clear(s: FrameState) {
    this.groups = [];
    s.gpu?.setHulls([], 0);
  }

  /** Builds the hulls again from the units' places at this point of the transition. */
  refresh(s: FrameState) {
    const g = s.gpu;
    const m = s.model;
    if (!g) return;
    if (!m.hulls || !m.types.unit.length || !m.graph || !m.laidOut) {
      if (g.hullCount()) g.setHulls([], 0);
      this.groups = [];
      return;
    }
    const byType = new Map<string, V3[]>();
    for (let i = 0; i < m.ids.length; i++) {
      if (!lookOf(s.looks, m.kinds.of[i]).hulls) continue;
      const v = s.unitNow(i);
      if (v.filter < 0.5) continue;
      const t = m.unitType(m.graph.units[i]);
      if (!t) continue;
      if (!byType.has(t.id)) byType.set(t.id, []);
      byType.get(t.id)!.push(v.p);
    }
    // One hull for each group of at least three same-type units that sit close together.
    const hulls: HullSpec[] = [];
    this.groups = [];
    for (const [type, pts] of byType) {
      const colour = m.types.unit.find((t) => t.id === type)?.colour ?? tokens[m.theme].context;
      for (const group of clusters(pts, this.reach)) {
        if (group.length < 3) continue;
        hulls.push({
          type,
          colour,
          points: hullPoints(
            group.map((j) => pts[j]),
            HULL_PAD,
          ),
        });
        this.groups.push({ type, members: group.length });
      }
    }
    g.setHulls(hulls, this.opacity(s));
  }

  /**
   * Seen from far away, hulls carry the macro groups; close up they step back. An active path
   * dims them with everything else off the path (specification 6.5).
   */
  opacity(s: FrameState): number {
    const g = s.gpu!;
    const dist = g.camera.position.distanceTo(g.controls.target);
    const base = Math.min(0.16, Math.max(0.05, 0.05 + (0.11 * dist) / (EXTENT * 3)));
    return base * (1 + (DEPTH_RULES.dimmed - 1) * s.pathShare());
  }
}
