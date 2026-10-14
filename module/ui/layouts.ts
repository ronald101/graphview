// Layouts that need no engine (specification V07, V08 and V09). Graph coordinates, y pointing down.
import { keyId, rings as ringsOf, type Graph, type Key } from '../core/index.ts';

export type Positions = Map<string, { x: number; y: number }>;

export const SPACING = 100;

/** Seeded random numbers (mulberry32), for starting positions and offsets. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One circle in file order, clockwise from north. */
export function circleLayout(units: Key[]): Positions {
  const n = units.length;
  const r = n <= 1 ? 0 : Math.max(SPACING, (n * SPACING) / (2 * Math.PI));
  return new Map(
    units.map((k, i) => {
      const t = (2 * Math.PI * i) / Math.max(1, n);
      return [keyId(k), { x: r * Math.sin(t), y: -r * Math.cos(t) }];
    }),
  );
}

/** Rows of ⌈√n⌉ units in file order. */
export function gridLayout(units: Key[]): Positions {
  const cols = Math.max(1, Math.ceil(Math.sqrt(units.length)));
  return new Map(units.map((k, i) => [keyId(k), { x: (i % cols) * SPACING, y: Math.floor(i / cols) * SPACING }]));
}

export interface RingLayout {
  positions: Positions;
  /** Ring number per unit; -1 for beyond reach. */
  ring: Map<string, number>;
  depth: number;
  beyond: Key[];
  /** Top left corner of the "beyond reach" group, if any. */
  beyondAt: { x: number; y: number } | null;
}

/** The focus at the centre; ring k on a circle of radius k × spacing, near the angle of a parent. */
export function ringLayout(graph: Graph, focus: Key): RingLayout {
  const { rings, beyond } = ringsOf(graph, focus);
  const positions: Positions = new Map();
  const ring = new Map<string, number>();
  const angle = new Map<string, number>();
  const out = new Map<string, string[]>();
  for (const [a, b] of graph.keypairs) {
    const ia = keyId(a);
    if (!out.has(ia)) out.set(ia, []);
    out.get(ia)!.push(keyId(b));
  }
  rings.forEach((members, k) => {
    if (k === 0) {
      positions.set(keyId(members[0]), { x: 0, y: 0 });
      ring.set(keyId(members[0]), 0);
      angle.set(keyId(members[0]), 0);
      return;
    }
    // Parent angle: the first unit of ring k − 1, in its order, that reaches this unit.
    const parentAngle = new Map<string, number>();
    for (const p of rings[k - 1]) {
      for (const c of out.get(keyId(p)) ?? []) if (!parentAngle.has(c)) parentAngle.set(c, angle.get(keyId(p)) ?? 0);
    }
    const ordered = members
      .map((key, i) => ({ id: keyId(key), want: parentAngle.get(keyId(key)) ?? 0, i }))
      .sort((a, b) => a.want - b.want || a.i - b.i);
    const n = ordered.length;
    // Even spread, turned so that units sit as near their parents as possible. Ring 1 starts
    // half a step from north, where the ring numbers are.
    let shift = Math.PI / n;
    if (k > 1) {
      let sx = 0;
      let sy = 0;
      ordered.forEach((u, i) => {
        const d = u.want - (2 * Math.PI * i) / n;
        sx += Math.cos(d);
        sy += Math.sin(d);
      });
      shift = Math.atan2(sy, sx);
    }
    ordered.forEach((u, i) => {
      const t = shift + (2 * Math.PI * i) / n;
      angle.set(u.id, t);
      ring.set(u.id, k);
      positions.set(u.id, { x: k * SPACING * Math.sin(t), y: -k * SPACING * Math.cos(t) });
    });
  });
  const depth = rings.length - 1;
  let beyondAt: RingLayout['beyondAt'] = null;
  if (beyond.length) {
    const cols = Math.ceil(Math.sqrt(beyond.length));
    const x0 = (depth + 1) * SPACING;
    const y0 = -((depth + 1) * SPACING);
    beyondAt = { x: x0, y: y0 };
    beyond.forEach((k, i) => {
      positions.set(keyId(k), {
        x: x0 + (i % cols) * (SPACING / 2),
        y: y0 + 40 + Math.floor(i / cols) * (SPACING / 2),
      });
      ring.set(keyId(k), -1);
    });
  }
  return { positions, ring, depth, beyond, beyondAt };
}

/**
 * Given positions: a unit's pinned position, else its pos, else the mean of its placed
 * neighbours plus a small seeded offset, else a place on a circle around the rest.
 */
export function givenLayout(graph: Graph, pinned: Positions, seed: number): Positions {
  const positions: Positions = new Map();
  for (const k of graph.units) {
    const id = keyId(k);
    const p = pinned.get(id) ?? graph.unitInfo.get(id)?.pos;
    if (p) positions.set(id, { x: p.x, y: p.y });
  }
  return placeMissing(graph, positions, seed);
}

/** Places units without a position near their placed neighbours, or on a circle around the rest. */
export function placeMissing(graph: Graph, positions: Positions, seed: number): Positions {
  const rnd = seeded(seed);
  const nb = new Map<string, string[]>();
  for (const [a, b] of graph.keypairs) {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const ix = keyId(x);
      if (!nb.has(ix)) nb.set(ix, []);
      nb.get(ix)!.push(keyId(y));
    }
  }
  let missing = graph.units.map(keyId).filter((id) => !positions.has(id));
  // Repeat, so that chains of unplaced units follow their placed neighbours.
  for (let round = 0; round < 50 && missing.length; round++) {
    const placedNow: [string, { x: number; y: number }][] = [];
    for (const id of missing) {
      const placed = (nb.get(id) ?? []).map((n) => positions.get(n)).filter((p) => p !== undefined);
      if (!placed.length) continue;
      const x = placed.reduce((s, p) => s + p.x, 0) / placed.length;
      const y = placed.reduce((s, p) => s + p.y, 0) / placed.length;
      placedNow.push([id, { x: x + (rnd() - 0.5) * SPACING * 0.4, y: y + (rnd() - 0.5) * SPACING * 0.4 }]);
    }
    if (!placedNow.length) break;
    for (const [id, p] of placedNow) positions.set(id, p);
    missing = missing.filter((id) => !positions.has(id));
  }
  if (missing.length) {
    const all = [...positions.values()];
    const cx = all.length ? all.reduce((s, p) => s + p.x, 0) / all.length : 0;
    const cy = all.length ? all.reduce((s, p) => s + p.y, 0) / all.length : 0;
    const r0 = all.length ? Math.max(...all.map((p) => Math.hypot(p.x - cx, p.y - cy))) + SPACING : 0;
    const r = Math.max(r0, (missing.length * SPACING) / (2 * Math.PI));
    missing.forEach((id, i) => {
      const t = (2 * Math.PI * i) / missing.length;
      positions.set(
        id,
        missing.length === 1 && !all.length ? { x: 0, y: 0 } : { x: cx + r * Math.sin(t), y: cy - r * Math.cos(t) },
      );
    });
  }
  return positions;
}

/** Seeded starting positions for the force layout, in a square that grows with the graph. */
export function startPositions(units: Key[], seed: number): Positions {
  const rnd = seeded(seed);
  const side = Math.sqrt(units.length) * SPACING;
  return new Map(units.map((k) => [keyId(k), { x: rnd() * side, y: rnd() * side }]));
}
