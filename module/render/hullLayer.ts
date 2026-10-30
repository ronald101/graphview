// Hulls around close units of one type (specification 6.9), by the settings of the group "Hulls".
import { clusters, hullPoints, median } from '../model/hulls.ts';
import type { V3 } from '../model/picking.ts';
import type { FrameState } from './frame.ts';
import type { HullSpec } from './gpu.ts';
import { lookOf } from './looks.ts';

export class HullLayer {
  /** The groups drawn, for the snapshot. */
  groups: { type: string; members: number }[] = [];
  /** The median relation length of the graph laid out, or null when no relation is longer than 0. */
  private median: number | null = null;

  /** Learns the median relation length of a newly laid out graph. */
  measure(s: FrameState) {
    const m = s.model;
    const lengths = m.relations.map((r) =>
      Math.hypot(m.positions[2 * r.a] - m.positions[2 * r.b], m.positions[2 * r.a + 1] - m.positions[2 * r.b + 1]),
    );
    this.median = median(lengths.filter((l) => l > 0)) || null;
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
    const set = m.settings;
    const minFilter = set.get('hulls.minFilter');
    const byType = new Map<string, V3[]>();
    for (let i = 0; i < m.ids.length; i++) {
      if (!lookOf(s.looks, m.kinds.of[i]).hulls) continue;
      const v = s.unitNow(i);
      if (v.filter < minFilter) continue;
      const t = m.unitType(m.graph.units[i]);
      if (!t) continue;
      if (!byType.has(t.id)) byType.set(t.id, []);
      byType.get(t.id)!.push(v.p);
    }
    // One hull for each group of enough same-type units that sit close together.
    const reach = this.median === null ? set.get('hulls.fallbackReach') : set.get('hulls.reach') * this.median;
    const fewest = set.get('hulls.minMembers');
    const pad = set.get('hulls.pad');
    const hulls: HullSpec[] = [];
    this.groups = [];
    for (const [type, pts] of byType) {
      const colour = m.types.unit.find((t) => t.id === type)?.colour ?? m.types.look.other;
      for (const group of clusters(pts, reach)) {
        if (group.length < fewest) continue;
        hulls.push({
          type,
          colour,
          points: hullPoints(
            group.map((j) => pts[j]),
            pad,
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
    const set = s.model.settings;
    const [near, far] = [set.get('hulls.opacity.near'), set.get('hulls.opacity.far')];
    const dist = g.camera.position.distanceTo(g.controls.target);
    const lo = Math.min(near, far);
    const hi = Math.max(near, far);
    const base = Math.min(hi, Math.max(lo, near + ((far - near) * dist) / set.get('hulls.opacity.distance')));
    const dim = set.get('hulls.dimWithPath') ? 1 + (s.rules.depth.dimmed - 1) * s.pathShare() : 1;
    return base * dim;
  }
}
