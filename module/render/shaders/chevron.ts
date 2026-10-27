// The chevrons: one per keypair, along its relation's line, in its keypair type's colour.
import { DEPTH_RULES } from '../../model/depth.ts';
import { CHEVRON_ROOM } from '../rules.ts';
import { ENDS_GLSL, f } from './common.ts';

export const CHEVRON_VS = /* glsl */ `
${ENDS_GLSL}
attribute vec4 aChev;
attribute vec4 aChevState;
attribute vec2 aAbove;
uniform float uChevronPx;
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
  float size = uChevronPx * uSizeScale * mix(sa.y, sb.y, t) * (1.0 + 0.2 * aligned * hasPath);
  c.xy += (d * position.x + n * position.y) * size / halfRes * c.w;
  gl_Position = c;
  vLocal = position.xy;
  float op = mix(sa.z, sb.z, t);
  // On a path, the chevron along the travel direction stays lit; the opposing one dims.
  float pathOp = aligned + opposing * 0.15 + (1.0 - aligned - opposing) * ${f(DEPTH_RULES.dimmed)};
  op = mix(op, pathOp, hasPath);
  op *= mix(aChevState.z, aChevState.w, uT) * mix(aAbove.x, aAbove.y, uT) * aChev.w * uOpacityScale;
  // A chevron needs room: it fades out where the line is shorter than two chevrons.
  op *= clamp((len - ${CHEVRON_ROOM.toFixed(2)} * size) / (0.5 * size), 0.0, 1.0);
  vColor = uKeypairPalette[int(aChev.z + 0.5)];
  vOpacity = op;
  vGlow = hasPath * aligned;
  if (op < 0.002) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}
`;

export const CHEVRON_FS = /* glsl */ `
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
  float d = min(seg(p, vec2(-0.2, 0.32), vec2(0.2, 0.0)), seg(p, vec2(-0.2, -0.32), vec2(0.2, 0.0)));
  float aa = max(fwidth(d), 1e-4);
  float w = 0.085 + 0.03 * vGlow;
  float alpha = 1.0 - smoothstep(w - aa, w + aa, d);
  vec3 col = mix(vColor, vec3(1.0), 0.25 * vGlow * (1.0 - alpha));
  alpha = max(alpha, vGlow * 0.35 * (1.0 - smoothstep(w, w + 0.18, d)));
  alpha *= vOpacity;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
`;
