// Picking in 3D: invisible capsules around lines and chevrons, spheres around vertices
// (specification 6.11). Pure geometry, so that it is testable without a browser.

export type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * The smallest distance between a ray (origin o, unit direction d) and a segment p–q,
 * with the ray parameter s at the closest point. A capsule of radius r is hit when the
 * distance is at most r.
 */
export function raySegment(o: V3, d: V3, p: V3, q: V3): { distance: number; s: number; t: number } {
  const u = sub(q, p);
  const w = sub(o, p);
  const a = dot(d, d);
  const b = dot(d, u);
  const c = dot(u, u);
  const dd = dot(d, w);
  const e = dot(u, w);
  const den = a * c - b * b;
  let s: number;
  let t: number;
  if (c < 1e-12) {
    t = 0;
    s = Math.max(0, -dd / a);
  } else if (den < 1e-12) {
    s = 0;
    t = Math.min(1, Math.max(0, e / c));
  } else {
    s = (b * e - c * dd) / den;
    t = (a * e - b * dd) / den;
    if (t < 0 || t > 1) {
      t = Math.min(1, Math.max(0, t));
      s = (b * t - dd) / a;
    }
    if (s < 0) {
      s = 0;
      t = Math.min(1, Math.max(0, e / c));
    }
  }
  const cp: V3 = [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
  const cq: V3 = [p[0] + u[0] * t, p[1] + u[1] * t, p[2] + u[2] * t];
  const diff = sub(cp, cq);
  return { distance: Math.sqrt(dot(diff, diff)), s, t };
}

/** The point at share t along p–q. */
export const along = (p: V3, q: V3, t: number): V3 => [
  p[0] + (q[0] - p[0]) * t,
  p[1] + (q[1] - p[1]) * t,
  p[2] + (q[2] - p[2]) * t,
];

/**
 * The axis of a chevron's capsule: a segment through the point c, `half` long on each side,
 * square to the line p–q as seen from the eye. Null when the line points at the eye.
 */
export function across(p: V3, q: V3, c: V3, eye: V3, half: number): [V3, V3] | null {
  const n = cross(sub(q, p), sub(c, eye));
  const len = Math.sqrt(dot(n, n));
  if (len < 1e-9) return null;
  const k = half / len;
  return [
    [c[0] - n[0] * k, c[1] - n[1] * k, c[2] - n[2] * k],
    [c[0] + n[0] * k, c[1] + n[1] * k, c[2] + n[2] * k],
  ];
}
