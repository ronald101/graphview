// The chevrons: one per keypair, along its relation's line, in its keypair type's colour.
import { endsGlsl } from './common.ts';

export const chevronVs = (slots: number) => /* glsl */ `
${endsGlsl(slots)}
attribute vec4 aChev;
attribute vec4 aChevState;
attribute vec2 aAbove;
attribute vec2 aEmph;
uniform vec2 uHighlight;
uniform vec3 uOutgoing;
uniform vec3 uIncoming;
uniform float uChevronPx;
uniform vec2 uChevronPath; // growth along the travel direction, opacity against it
uniform vec2 uChevronRoom; // room and fade-in, in chevron sizes
uniform float uBelowChevrons;
varying vec2 vLocal;
varying vec3 vColor;
varying float vOpacity;
varying float vGlow;
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
  vec2 d = dir * aChev.y;
  vec2 n = vec2(-d.y, d.x);
  float t = aChev.x;
  vec4 c = mix(ca, cb, t);
  float hasPath = mix(uHasPath.x, uHasPath.y, uT);
  float flow = mix(aChevState.x, aChevState.y, uT);
  float aligned = clamp(flow, 0.0, 1.0);
  float opposing = clamp(-flow, 0.0, 1.0);
  float size = uChevronPx * uSizeScale * mix(sa.y, sb.y, t) * (1.0 + uChevronPath.x * aligned * hasPath);
  c.xy += (d * position.x + n * position.y) * size / halfRes * c.w;
  gl_Position = c;
  vLocal = position.xy;
  float op = mix(sa.z, sb.z, t);
  // On a path, the chevron along the travel direction stays lit; the opposing one dims.
  float pathOp = aligned + opposing * uChevronPath.y + (1.0 - aligned - opposing) * uDepthC.w;
  op = mix(op, pathOp, hasPath);
  float above = mix(mix(aAbove.x, aAbove.y, uT), 1.0, uBelowChevrons);
  op *= mix(aChevState.z, aChevState.w, uT) * above * aChev.w * uOpacityScale * mix(uHighlight.y, 1.0, aEmph.x);
  // A chevron needs room: it fades out where the line is too short for it.
  op *= clamp((len - uChevronRoom.x * size) / (uChevronRoom.y * size), 0.0, 1.0);
  // One selected unit colours its chevrons by direction (6.20).
  vColor = aEmph.y > 1.5 ? uIncoming : aEmph.y > 0.5 ? uOutgoing : uKeypairPalette[int(aChev.z + 0.5)];
  vOpacity = op;
  vGlow = hasPath * aligned;
  if (op < uCull) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}
`;

export const CHEVRON_FS = /* glsl */ `
uniform vec3 uGlyph; // half length, half spread, half stroke
uniform vec4 uChevronGlow; // extra stroke, whitening, opacity, reach
uniform float uDiscard;
varying vec2 vLocal;
varying vec3 vColor;
varying float vOpacity;
varying float vGlow;
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  vec2 p = vLocal;
  vec2 tip = vec2(uGlyph.x, 0.0);
  float d = min(seg(p, vec2(-uGlyph.x, uGlyph.y), tip), seg(p, vec2(-uGlyph.x, -uGlyph.y), tip));
  float aa = max(fwidth(d), 1e-4);
  float w = uGlyph.z + uChevronGlow.x * vGlow;
  float alpha = 1.0 - smoothstep(w - aa, w + aa, d);
  vec3 col = mix(vColor, vec3(1.0), uChevronGlow.y * vGlow * (1.0 - alpha));
  alpha = max(alpha, vGlow * uChevronGlow.z * (1.0 - smoothstep(w, w + uChevronGlow.w, d)));
  alpha *= vOpacity;
  if (alpha < uDiscard) discard;
  gl_FragColor = vec4(col, alpha);
}
`;
