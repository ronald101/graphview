// The units: one shape per unit, a disc unless its kind says otherwise, sized, faded and moved
// back by the depth rules.
import { shapesGlsl, UNIT_SHAPES, type UnitShape } from '../shapes.ts';
import { DEPTH_GLSL, END_ATTRIBUTES } from './common.ts';

export const unitVs = (slots: number) => /* glsl */ `
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
uniform vec2 uUnitGlow; // reach past the disc, opacity at its edge
uniform vec2 uHighlight; // size of highlighted units, opacity of the rest
uniform vec3 uUnitPalette[${slots}];
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
  float halo = 1.0 + uUnitGlow.x * st.w;
  // Highlighted units grow and carry the outline; while a group is on, the rest dims.
  float grow = look.w > 0.5 ? uHighlight.x : 1.0;
  float rest = look.w < -0.5 ? uHighlight.y : 1.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * 2.0 * uSize * uSizeScale * st.y * halo * grow;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0 * halo;
  vColor = uUnitPalette[int(halves.x + 0.5)];
  vColor2 = uUnitPalette[int(halves.y + 0.5)];
  vOpacity = st.z * mix(filterState.x, filterState.y, uT) * look.y * uOpacityScale * rest;
  vGlow = st.w;
  vMarked = max(look.x, step(0.5, look.w));
  vHalo = halo;
  vShape = look.z;
  // Shapes other than the disc may divide the unit between its two ends.
  vSplit = look.z > 0.5 ? split(p) : vec2(0.0);
  // Nothing to draw: move the quad past the far plane, so that it costs no fragments.
  if (vOpacity < uCull) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}
`;

/** The fragment shader, with every shape the units may take. */
export const unitFs = (shapes: readonly UnitShape[] = UNIT_SHAPES) => /* glsl */ `
uniform vec3 uSurface;
uniform vec3 uRingColour;
uniform vec3 uOutlineColour;
uniform vec3 uGlowColour;
uniform vec3 uCutColour;
uniform vec2 uRing; // where the ring starts, its strength
uniform float uOutlineFrom;
uniform vec2 uUnitGlow;
uniform vec2 uCut; // half the width of an interface's cut, its strength
uniform float uDiscard;
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
  // A thin ring separates the unit from the lines behind it.
  float sep = smoothstep(uRing.x - aa, uRing.x + aa, d) * core;
  col = mix(col, uRingColour, sep * uRing.y);
  // Marked units carry an outline: state by shape, not hue.
  if (vMarked > 0.5) col = mix(col, uOutlineColour, smoothstep(uOutlineFrom - aa, uOutlineFrom + aa, d) * (1.0 - sep));
  float alpha = core;
  // Glow: a soft halo outside the disc, for units on the active path.
  if (vGlow > 0.0 && core < 0.999) {
    float g = vGlow * (1.0 - smoothstep(1.0, vHalo, d));
    col = mix(col, uGlowColour, 1.0 - core);
    alpha = max(alpha, g * uUnitGlow.y);
  }
  alpha *= vOpacity;
  if (alpha < uDiscard) discard;
  gl_FragColor = vec4(col, alpha);
}
`;
