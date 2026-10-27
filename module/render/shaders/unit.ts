// The units: one shape per unit, a disc unless its kind says otherwise, sized, faded and moved
// back by the depth rules.
import { MAX_TYPES } from '../../model/typeRegistry.ts';
import { shapesGlsl, UNIT_SHAPES, type UnitShape } from '../shapes.ts';
import { DEPTH_GLSL, END_ATTRIBUTES } from './common.ts';

export const UNIT_VS = /* glsl */ `
${DEPTH_GLSL}
${END_ATTRIBUTES}
attribute vec3 posPrev;
attribute vec3 posNext;
attribute vec2 currentDegree;
attribute vec2 isOnActivePath;
attribute vec2 filterState;
attribute vec2 halves;
attribute vec4 look;
uniform float uSize;
uniform float uSizeScale;
uniform float uOpacityScale;
uniform vec3 uUnitPalette[${MAX_TYPES}];
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vColor2;
varying vec2 vSplit;
varying float vOpacity;
varying float vGlow;
varying float vMarked;
varying float vHalo;
varying float vShape;

// Where a point shows on screen, up to a scale shared by every point: enough for directions.
vec2 seen(vec3 p) {
  vec4 v = modelViewMatrix * vec4(p, 1.0);
  return v.xy / max(-v.z, 1e-6);
}

// The direction across the unit, from its first end's side to its second's, as seen. The cut runs
// perpendicular to it, along the bisector of the angle between the two ends, so each end's line
// enters the half of that end.
vec2 split(vec3 p) {
  vec3 a = mix(aPrevA, aNextA, uT);
  a.z += stateMix(aStateA.xy, aStateA.zw).x;
  vec3 b = mix(aPrevB, aNextB, uT);
  b.z += stateMix(aStateB.xy, aStateB.zw).x;
  vec2 c = seen(p);
  vec2 da = seen(a) - c;
  vec2 db = seen(b) - c;
  vec2 na = dot(da, da) > 1e-12 ? normalize(da) : vec2(0.0);
  vec2 nb = dot(db, db) > 1e-12 ? normalize(db) : vec2(0.0);
  vec2 d = nb - na;
  if (dot(d, d) < 1e-8) d = vec2(na.y, -na.x);
  if (dot(d, d) < 1e-8) d = vec2(1.0, 0.0);
  return normalize(d);
}

void main() {
  vec4 st = stateMix(currentDegree, isOnActivePath);
  vec3 p = mix(posPrev, posNext, uT);
  p.z += st.x;
  float halo = 1.0 + 0.9 * st.w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * 2.0 * uSize * uSizeScale * st.y * halo;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0 * halo;
  vColor = uUnitPalette[int(halves.x + 0.5)];
  vColor2 = uUnitPalette[int(halves.y + 0.5)];
  vOpacity = st.z * mix(filterState.x, filterState.y, uT) * look.y * uOpacityScale;
  vGlow = st.w;
  vMarked = look.x;
  vHalo = halo;
  vShape = look.z;
  // Shapes other than the disc may divide the unit between its two ends.
  vSplit = look.z > 0.5 ? split(p) : vec2(0.0);
  // Nothing to draw: move the quad past the far plane, so that it costs no fragments.
  if (vOpacity < 0.002) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}
`;

/** The fragment shader, with every shape the units may take. */
export const unitFs = (shapes: readonly UnitShape[] = UNIT_SHAPES) => /* glsl */ `
uniform vec3 uInk;
uniform vec3 uSurface;
uniform vec3 uPathColour;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vColor2;
varying vec2 vSplit;
varying float vOpacity;
varying float vGlow;
varying float vMarked;
varying float vHalo;
varying float vShape;
${shapesGlsl(shapes)}
void main() {
  vec3 col = vColor;
  float d = unitShape(vShape, vUv, col);
  float aa = max(fwidth(d), 1e-4);
  float core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
  // A thin ring in the surface colour separates the unit from the lines behind it.
  float sep = smoothstep(0.82 - aa, 0.82 + aa, d) * core;
  col = mix(col, uSurface, sep * 0.9);
  // The root, the path's ends and the inspected unit carry an ink outline: state by shape, not hue.
  if (vMarked > 0.5) col = mix(col, uInk, smoothstep(0.58 - aa, 0.58 + aa, d) * (1.0 - sep));
  float alpha = core;
  // Glow: a soft halo in the path colour outside the disc, for units on the active path.
  if (vGlow > 0.0 && core < 0.999) {
    float g = vGlow * (1.0 - smoothstep(1.0, vHalo, d));
    col = mix(col, uPathColour, 1.0 - core);
    alpha = max(alpha, g * 0.55);
  }
  alpha *= vOpacity;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
`;
