// GLSL shared by the three programs: the depth rules, and two ends: a relation's units, or an
// interface's ends. Every number comes in as a uniform from the drawing rules (rules.ts).

/** The GLSL twin of depthState() and plane() in model/depth.ts. They change together. */
export const DEPTH_GLSL = /* glsl */ `
uniform float uT;
uniform vec2 uHasRoot;
uniform vec2 uHasPath;
uniform vec2 uDepth;
uniform vec4 uDepthA; // spacing, foreground, deepest plane, degrees in front
uniform vec4 uDepthB; // second plane: scale, opacity; far planes: scale, opacity
uniform vec4 uDepthC; // path: scale, opacity, glow; off the path: opacity
uniform float uCull;

float planeOf(float deg) {
  return deg < -0.5 ? uDepthA.z : min(uDepthA.z, max(0.0, deg - uDepthA.w));
}

vec4 depthState(float deg, float onPath, float hasRoot, float hasPath, float depth) {
  vec4 s = vec4(0.0, 1.0, 1.0, 0.0);
  if (hasRoot > 0.5) {
    float p = planeOf(deg);
    if (p > 0.5 && p < 1.5) s = vec4(-uDepthA.x, uDepthB.x, uDepthB.y, 0.0);
    else if (p > 1.5) s = vec4(-uDepthA.x * p, uDepthB.z, uDepthB.w, 0.0);
  }
  if (hasPath > 0.5) {
    if (onPath > 0.5) s = vec4(uDepthA.y, uDepthC.x, uDepthC.y, uDepthC.z);
    else s = vec4(s.x, s.y, uDepthC.w, 0.0);
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
export const endsGlsl = (slots: number) => /* glsl */ `
${DEPTH_GLSL}
${END_ATTRIBUTES}
uniform vec2 uResolution;
uniform float uSizeScale;
uniform float uOpacityScale;
uniform vec3 uKeypairPalette[${slots}];
`;
