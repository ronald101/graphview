// The depth rules of the viewer (specification 6.4). The shaders compute the same values on the GPU;
// this file is their reference and serves picking, the panels and the scene for tests. The values come
// from the settings of the group "Root and depth".
import { CHEVRON_AT, DEPTH_RULES, FOREGROUND, SPACING } from '../settings/defaults.ts';

export { CHEVRON_AT, DEPTH_RULES, FOREGROUND, SPACING };

/** Degree of separation: 0 for the root, -1 for a unit the root does not reach. */
export type Degree = number;

/** The rules a depth state follows. */
export interface DepthRules {
  spacing: number;
  foreground: number;
  second: { scale: number; opacity: number };
  far: { scale: number; opacity: number };
  path: { scale: number; opacity: number; glow: number };
  dimmed: number;
  /** Deepest plane, in steps of the depth spacing. */
  maxPlanes: number;
  /** Degrees up to this share the front plane with the root. */
  frontDegrees: number;
}

export const DEFAULT_DEPTH: DepthRules = {
  spacing: SPACING,
  foreground: FOREGROUND,
  ...DEPTH_RULES,
  frontDegrees: 1,
};

export interface DepthState {
  z: number;
  scale: number;
  opacity: number;
  glow: number;
}

export interface DepthInput {
  degree: Degree;
  onPath: boolean;
  hasRoot: boolean;
  hasPath: boolean;
  /** False in the 2D view: units keep their size and opacity rules, but stay on z = 0. */
  depth: boolean;
}

/**
 * The plane a unit sits on, counted from the front: 0 for the root and the degrees in front, then one
 * plane per degree up to the deepest; units out of reach sit deepest.
 */
export function plane(degree: Degree, r: DepthRules = DEFAULT_DEPTH): number {
  if (degree < 0) return r.maxPlanes;
  return Math.min(r.maxPlanes, Math.max(0, degree - r.frontDegrees));
}

/**
 * Where a unit sits and how it looks. Without a root everything sits on z = 0 at full size. With a
 * root: the front plane at full size; the second plane back at its size and opacity; the planes
 * behind at the far size and opacity. With an active path, the path's units come to the foreground
 * at the path's size and glow, and the rest dims.
 */
export function depthState(i: DepthInput, r: DepthRules = DEFAULT_DEPTH): DepthState {
  let s: DepthState = { z: 0, scale: 1, opacity: 1, glow: 0 };
  if (i.hasRoot) {
    const p = plane(i.degree, r);
    if (p === 1) s = { z: -r.spacing, scale: r.second.scale, opacity: r.second.opacity, glow: 0 };
    else if (p > 1) s = { z: -r.spacing * p, scale: r.far.scale, opacity: r.far.opacity, glow: 0 };
  }
  if (i.hasPath) {
    if (i.onPath) s = { z: r.foreground, ...r.path };
    else s = { ...s, opacity: r.dimmed, glow: 0 };
  }
  if (!i.depth) s = { ...s, z: 0 };
  return s;
}
