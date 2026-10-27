// The depth rules of the viewer (specification 6.4). The shaders in
// render/gpu.ts compute the same values on the GPU; this file is their reference and serves
// picking, the panels and the scene for tests.

/** Degree of separation: 0 for the root, -1 for a unit the root does not reach. */
export type Degree = number;

/** The distance between depth planes, in world units; the layout spans 1000. */
export const SPACING = 300;
/** The global foreground offset: the z of the active path (specification 6.4). */
export const FOREGROUND = 0;

export const DEPTH_RULES = {
  second: { scale: 0.6, opacity: 0.6 },
  far: { scale: 0.25, opacity: 0.15 },
  path: { scale: 1.2, opacity: 1, glow: 1 },
  dimmed: 0.05,
  /** Deepest plane, in steps of the depth spacing. */
  maxPlanes: 6,
} as const;

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
 * The plane a unit sits on, counted from the front: 0 for the root and degree 1, 1 for
 * degree 2, then one plane per degree up to the deepest; units out of reach sit deepest.
 */
export function plane(degree: Degree): number {
  if (degree < 0) return DEPTH_RULES.maxPlanes;
  return Math.min(DEPTH_RULES.maxPlanes, Math.max(0, degree - 1));
}

/**
 * Where a unit sits and how it looks. Without a root everything sits on z = 0 at full size.
 * With a root: degree 0 and 1 in front at full size; degree 2 one plane back at 60 percent;
 * degree 3 and more further back, as points at 15 percent. With an active path, the path's
 * units come to the foreground at 1.2 times their size and glow, and the rest dims to 0.05.
 */
export function depthState(i: DepthInput): DepthState {
  let s: DepthState = { z: 0, scale: 1, opacity: 1, glow: 0 };
  if (i.hasRoot) {
    const p = plane(i.degree);
    if (p === 1) s = { z: -SPACING, scale: DEPTH_RULES.second.scale, opacity: DEPTH_RULES.second.opacity, glow: 0 };
    else if (p > 1) s = { z: -SPACING * p, scale: DEPTH_RULES.far.scale, opacity: DEPTH_RULES.far.opacity, glow: 0 };
  }
  if (i.hasPath) {
    if (i.onPath) s = { z: FOREGROUND, ...DEPTH_RULES.path };
    else s = { ...s, opacity: DEPTH_RULES.dimmed, glow: 0 };
  }
  if (!i.depth) s = { ...s, z: 0 };
  return s;
}

/** The chevrons' places along a relation's line, as a share of its length from its first unit. */
export const CHEVRON_AT = { forward: 1 / 3, backward: 2 / 3 } as const;
