// GLSL shared by the three programs: the depth rules, and two ends: a relation's units, or an
// interface's ends.
import { DEPTH_RULES, FOREGROUND, SPACING } from '../../model/depth.ts';
import { MAX_TYPES } from '../../model/typeRegistry.ts';

/** A number as GLSL writes it. */
export const f = (n: number) => n.toFixed(3);

/** The GLSL twin of depthState() and plane() in model/depth.ts. They change together. */
export const DEPTH_GLSL = /* glsl */ `
uniform float uT;
uniform vec2 uHasRoot;
uniform vec2 uHasPath;
uniform vec2 uDepth;

float planeOf(float deg) {
  return deg < -0.5 ? ${f(DEPTH_RULES.maxPlanes)} : min(${f(DEPTH_RULES.maxPlanes)}, max(0.0, deg - 1.0));
}

vec4 depthState(float deg, float onPath, float hasRoot, float hasPath, float depth) {
  vec4 s = vec4(0.0, 1.0, 1.0, 0.0);
  if (hasRoot > 0.5) {
    float p = planeOf(deg);
    if (p > 0.5 && p < 1.5) s = vec4(${f(-SPACING)}, ${f(DEPTH_RULES.second.scale)}, ${f(DEPTH_RULES.second.opacity)}, 0.0);
    else if (p > 1.5) s = vec4(${f(-SPACING)} * p, ${f(DEPTH_RULES.far.scale)}, ${f(DEPTH_RULES.far.opacity)}, 0.0);
  }
  if (hasPath > 0.5) {
    if (onPath > 0.5) s = vec4(${f(FOREGROUND)}, ${f(DEPTH_RULES.path.scale)}, ${f(DEPTH_RULES.path.opacity)}, ${f(DEPTH_RULES.path.glow)});
    else s = vec4(s.x, s.y, ${f(DEPTH_RULES.dimmed)}, 0.0);
  }
  s.x *= depth;
  return s;
}

// The state at the current point of a transition: z, scale, opacity, glow.
vec4 stateMix(vec2 deg, vec2 path) {
  return mix(
    depthState(deg.x, path.x, uHasRoot.x, uHasPath.x, uDepth.x),
    depthState(deg.y, path.y, uHasRoot.y, uHasPath.y, uDepth.y),
    uT
  );
}
`;

/** Two ends, each with its place before and after, and its depth state (EndBuffers in geometry.ts). */
export const END_ATTRIBUTES = /* glsl */ `
attribute vec3 aPrevA;
attribute vec3 aNextA;
attribute vec3 aPrevB;
attribute vec3 aNextB;
attribute vec4 aStateA;
attribute vec4 aStateB;
`;

/** Shared head of the line and chevron shaders: both ends of a relation, displaced. */
export const ENDS_GLSL = /* glsl */ `
${DEPTH_GLSL}
${END_ATTRIBUTES}
uniform vec2 uResolution;
uniform float uSizeScale;
uniform float uOpacityScale;
uniform vec3 uKeypairPalette[${MAX_TYPES}];
`;
