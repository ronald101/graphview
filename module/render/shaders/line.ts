// The lines: one per relation, drawn in screen space between its two units.
import { endsGlsl } from './common.ts';

export const lineVs = (slots: number) => /* glsl */ `
${endsGlsl(slots)}
attribute vec4 aLine;
attribute vec4 aLine2;
attribute vec2 aStatic;
attribute vec2 aEmph;
uniform vec2 uHighlight;
uniform float uWidth;
uniform float uWidthScale;
uniform vec4 uLineGain; // width gain by strength, width below the threshold, extra width on the path, opacity below
uniform float uFeather;
uniform float uBrighten;
uniform vec3 uLineColour;
uniform vec3 uLineBelowColour;
uniform vec3 uLinePathColour;
uniform vec3 uStrengthColour;
varying float vT;
varying float vSide;
varying float vOpacity;
varying vec3 vColor;
varying float vMissing;
varying float vLenPx;
varying float vHalfPx;
void main() {
  vec4 sa = stateMix(aStateA.xy, aStateA.zw);
  vec4 sb = stateMix(aStateB.xy, aStateB.zw);
  vec3 pa = mix(aPrevA, aNextA, uT); pa.z += sa.x;
  vec3 pb = mix(aPrevB, aNextB, uT); pb.z += sb.x;
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(pa, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(pb, 1.0);
  vec2 halfRes = uResolution * 0.5;
  vec2 s0 = ca.xy / ca.w * halfRes;
  vec2 s1 = cb.xy / cb.w * halfRes;
  vec2 dir = s1 - s0;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float t = position.x;
  float hasPath = mix(uHasPath.x, uHasPath.y, uT);
  float onPath = mix(aLine2.z, aLine2.w, uT);
  float above = mix(aLine.z, aLine.w, uT);
  float strength = mix(aLine2.x, aLine2.y, uT);
  // Thickness and opacity follow the end units, linearly along the line.
  float w = uWidth * uWidthScale * mix(sa.y, sb.y, t) * (1.0 + uLineGain.x * strength);
  w = mix(uLineGain.y, w, above);
  w *= 1.0 + uLineGain.z * onPath * hasPath;
  float op = mix(sa.z, sb.z, t);
  op = mix(op, mix(uDepthC.w, 1.0, onPath), hasPath);
  op *= mix(aLine.x, aLine.y, uT) * aStatic.x * uOpacityScale * mix(uHighlight.y, 1.0, aEmph.x);
  op *= mix(uLineGain.w, 1.0, above);
  vec4 c = mix(ca, cb, t);
  float halfPx = w * 0.5 + uFeather;
  c.xy += nrm * position.y * halfPx / halfRes * c.w;
  gl_Position = c;
  // Lines stay in their own colour; the chevrons carry the keypairs' type colours.
  vec3 col = mix(uLineColour, uStrengthColour, uBrighten * strength * above);
  col = mix(uLineBelowColour, col, above);
  col = mix(col, uLinePathColour, onPath * hasPath);
  vColor = col;
  vT = t;
  vSide = position.y;
  vOpacity = op;
  vMissing = aStatic.y;
  vLenPx = len;
  vHalfPx = halfPx;
  if (op < uCull) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}
`;

export const LINE_FS = /* glsl */ `
uniform vec3 uIssue;
uniform vec2 uDash; // period in pixels, drawn share
uniform float uDiscard;
varying float vT;
varying float vSide;
varying float vOpacity;
varying vec3 vColor;
varying float vMissing;
varying float vLenPx;
varying float vHalfPx;
void main() {
  vec3 col = vColor;
  // A missing keypair: the half on its unit's side is dashed in the issue colour.
  bool missing = (vMissing > 0.5 && vMissing < 1.5 && vT < 0.5) || (vMissing > 1.5 && vT > 0.5);
  if (missing) {
    col = uIssue;
    if (fract(vT * vLenPx / uDash.x) > uDash.y) discard;
  }
  float dist = abs(vSide) * vHalfPx;
  float cover = clamp(vHalfPx - dist, 0.0, 1.0);
  float alpha = vOpacity * cover;
  if (alpha < uDiscard) discard;
  gl_FragColor = vec4(col, alpha);
}
`;
