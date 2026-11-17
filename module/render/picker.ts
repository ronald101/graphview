// What lies under a canvas point (specification 6.11).
import type { Key } from '../core/index.ts';
import type { Inspected } from '../model/contracts.ts';
import type { Relation } from '../model/topology.ts';
import { across, along, raySegment, type V3 } from '../model/picking.ts';
import type { FrameState } from './frame.ts';

/**
 * A unit, a chevron (one keypair), a line (its relation), or nothing. Each target is an invisible
 * capsule (a sphere for a unit) around what is drawn, wider by a padding in pixels; units deeper
 * back answer within a wider radius. A point on a target picks it, by the pointer's priority (units,
 * then chevrons, then lines); a point in the padding picks the nearest target.
 */
export function pickAt(s: FrameState, x: number, y: number): Inspected {
  const g = s.gpu;
  const m = s.model;
  if (!g || !m.graph) return null;
  const r = s.rules.pointer;
  const rank = (kind: 'unit' | 'chevron' | 'line') => r.priority.indexOf(kind);
  const { origin, dir } = g.ray(x, y);
  const eye = g.camera.position.toArray() as V3;
  const snap = s.snapshot();
  const found: { hit: NonNullable<Inspected>; d: number; rank: number }[] = [];
  // d is the distance in pixels from the point to the target: 0 or less on it.
  const consider = (hit: NonNullable<Inspected>, d: number, pad: number, rank: number) => {
    if (d <= pad) found.push({ hit, d, rank });
  };
  // Units under the point: a drawn disc that covers it wins, the front one first; past the drawing,
  // within a unit's reach, the nearest centre wins. A far unit's larger reach never takes a click
  // from a unit drawn there.
  let unitHit: { key: Key; drawnOn: boolean; px: number; depth: number } | null = null;
  const better = (a: NonNullable<typeof unitHit>, b: typeof unitHit) =>
    !b ||
    (a.drawnOn !== b.drawnOn
      ? a.drawnOn
      : a.drawnOn
        ? a.depth < b.depth || (a.depth === b.depth && a.px < b.px)
        : a.px < b.px || (a.px === b.px && a.depth < b.depth));
  // A relation whose ends are both in front of the camera can only be hit inside its box on screen.
  const far = (rel: Relation) => {
    const a = snap.screen[rel.a];
    const b = snap.screen[rel.b];
    const pad = r.boxMargin;
    if (a.behind || b.behind) return false;
    return (
      x < Math.min(a.x, b.x) - pad ||
      x > Math.max(a.x, b.x) + pad ||
      y < Math.min(a.y, b.y) - pad ||
      y > Math.max(a.y, b.y) + pad
    );
  };
  const opacity = m.overrides.opacity;
  for (let i = 0; i < m.ids.length; i++) {
    const v = snap.st[i];
    if (v.filter < r.minFilter || v.s.opacity * v.filter * opacity < r.minOpacity) continue;
    const h = raySegment(origin, dir, v.p, v.p);
    const wpp = g.worldPerPixel(v.p);
    const px = h.distance / wpp;
    const d = px - s.unitReach(i, snap);
    if (d > 0) {
      consider({ kind: 'unit', key: m.graph.units[i] }, d, r.padding.unit, rank('unit'));
      continue;
    }
    const c = {
      key: m.graph.units[i],
      drawnOn: px <= s.unitDrawn(i, snap) + r.padding.unit,
      px,
      depth: Math.hypot(v.p[0] - eye[0], v.p[1] - eye[1], v.p[2] - eye[2]),
    };
    if (better(c, unitHit)) unitHit = c;
  }
  // A unit within reach is on its target; with units first in the priority, nothing else is looked at.
  if (unitHit && rank('unit') === 0) return { kind: 'unit', key: unitHit.key };
  if (unitHit) found.push({ hit: { kind: 'unit', key: unitHit.key }, d: -1, rank: rank('unit') });
  s.chevrons.forEach((ch, i) => {
    const rel = m.relations[ch.rel];
    if (far(rel) || s.chevronOpacity(i, snap) < r.minOpacity) return;
    const a = snap.st[rel.a];
    const b = snap.st[rel.b];
    const centre = along(a.p, b.p, s.chevronAt(i));
    const wpp = g.worldPerPixel(centre);
    const px = s.chevronPx(i, snap);
    // A capsule across the line covers the glyph.
    const axis = across(a.p, b.p, centre, eye, r.capsule.halfLength * px * wpp);
    if (!axis) return;
    const h = raySegment(origin, dir, axis[0], axis[1]);
    // A chevron of the perspective drawing picks its perspective (6.18).
    const p = ch.perspective;
    const hit: Inspected = p
      ? { kind: 'perspective', iface: p.iface, from: p.from, to: p.to }
      : { kind: 'keypair', from: ch.from, to: ch.to };
    consider(hit, h.distance / wpp - r.capsule.radius * px, r.padding.chevron, rank('chevron'));
  });
  const [gain, below] = s.rules.lines.gain;
  m.relations.forEach((rel, i) => {
    if (far(rel) || s.lineOpacity(i, snap) < r.minOpacity) return;
    const a = snap.st[rel.a];
    const b = snap.st[rel.b];
    const h = raySegment(origin, dir, a.p, b.p);
    const wpp = g.worldPerPixel(along(a.p, b.p, h.t));
    const above = s.now(s.l.aLine, i, 4, 2);
    const w = s.rules.lines.width * m.overrides.width * (a.s.scale + (b.s.scale - a.s.scale) * h.t);
    const strong = w * (1 + gain * s.now(s.l.aLine2, i, 4, 0));
    const halfPx = Math.max(1, (below + (strong - below) * above) / 2) + r.lineExtra;
    consider({ kind: 'relation', a: rel.ka, b: rel.kb }, h.distance / wpp - halfPx, r.padding.line, rank('line'));
  });
  if (!found.length) return null;
  const on = found.filter((f) => f.d <= 0);
  const pool = on.length ? on : found;
  pool.sort((p, q) => (on.length ? p.rank - q.rank || p.d - q.d : p.d - q.d || p.rank - q.rank));
  return pool[0].hit;
}
