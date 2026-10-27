// The state of the picture between two model changes: the instanced attributes, the transition's
// flags and its point, and the CPU's copy of the shaders' sums, so that picking, labels, hulls and
// the snapshot read what is drawn.
import { CHEVRON_AT, depthState, plane, type DepthState } from '../model/depth.ts';
import type { GraphModel } from '../model/model.ts';
import type { V3 } from '../model/picking.ts';
import { LOOK, type ChevronBuffers, type LineBuffers, type UnitBuffers } from './geometry.ts';
import type { Gpu } from './gpu.ts';
import { PUBLIC_LOOKS, type Looks } from './looks.ts';
import { CHEVRON_ROOM } from './rules.ts';

export const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The least radius a unit answers clicks in, in pixels, by plane: deeper units are smaller, so they get more. */
const UNIT_REACH = [6, 8, 10, 12];

/** A unit's state at this point of a transition. */
export interface Now {
  p: V3;
  s: DepthState;
  filter: number;
}

export interface Snapshot {
  st: Now[];
  screen: { x: number; y: number; behind: boolean }[];
}

export class FrameState {
  u!: UnitBuffers;
  l!: LineBuffers;
  c!: ChevronBuffers;
  /** Root, path and depth, before and after the transition. */
  flags = { root: [0, 0], path: [0, 0], depth: [0, 0] };
  /** How far the transition is, 0 to 1. */
  t = 1;
  /** Counts the states applied, so that a cached snapshot knows it is out of date. */
  applied = 0;
  /** Relations per unit, for the order in which labels claim room. */
  relationsPer = new Uint32Array(0);
  gpu: Gpu | null = null;
  readonly model: GraphModel;
  /** How each kind of unit looks, and the shapes the unit shader holds. */
  readonly looks: Looks;
  private snap: { key: string; value: Snapshot } | null = null;

  constructor(model: GraphModel, looks: Looks = PUBLIC_LOOKS) {
    this.model = model;
    this.looks = looks;
  }

  forget() {
    this.snap = null;
  }

  private stateOf(i: number, which: 0 | 1): DepthState {
    return depthState({
      degree: this.u.currentDegree[2 * i + which],
      onPath: this.u.isOnActivePath[2 * i + which] > 0.5,
      hasRoot: this.flags.root[which] > 0.5,
      hasPath: this.flags.path[which] > 0.5,
      depth: this.flags.depth[which] > 0.5,
    });
  }

  /** A unit's state now, as the shader computes it. */
  unitNow(i: number): Now {
    const e = ease(this.t);
    const a = this.stateOf(i, 0);
    const b = this.stateOf(i, 1);
    const mix = (x: number, y: number) => x + (y - x) * e;
    const s: DepthState = {
      z: mix(a.z, b.z),
      scale: mix(a.scale, b.scale),
      opacity: mix(a.opacity, b.opacity),
      glow: mix(a.glow, b.glow),
    };
    const p: V3 = [
      mix(this.u.posPrev[3 * i], this.u.posNext[3 * i]),
      mix(this.u.posPrev[3 * i + 1], this.u.posNext[3 * i + 1]),
      mix(this.u.posPrev[3 * i + 2], this.u.posNext[3 * i + 2]) + s.z,
    ];
    const fade = this.u.look[4 * i + LOOK.fade];
    return { p, s, filter: mix(this.u.filterState[2 * i], this.u.filterState[2 * i + 1]) * fade };
  }

  /** Every unit's state, and its place on the canvas; the same state and camera reuse it. */
  snapshot(): Snapshot {
    const g = this.gpu;
    g?.camera.updateMatrixWorld();
    const key = g
      ? [
          this.t,
          this.applied,
          g.width,
          g.height,
          ...g.camera.matrixWorld.elements,
          ...g.camera.projectionMatrix.elements,
        ].join()
      : `${this.t},${this.applied}`;
    if (this.snap?.key === key) return this.snap.value;
    const st = this.model.ids.map((_, i) => this.unitNow(i));
    const value = { st, screen: st.map((v) => (g ? g.project(v.p) : { x: 0, y: 0, behind: false })) };
    this.snap = { key, value };
    return value;
  }

  /** A pair of (previous, next) values at this point of the transition. */
  now(arr: Float32Array, i: number, stride: number, offset: number) {
    const e = ease(this.t);
    return arr[stride * i + offset] + (arr[stride * i + offset + 1] - arr[stride * i + offset]) * e;
  }

  /** How far the view is into path mode, 0 to 1, at this point of the transition. */
  pathShare(): number {
    return this.flags.path[0] + (this.flags.path[1] - this.flags.path[0]) * ease(this.t);
  }

  lineOpacity(i: number, snap: Snapshot): number {
    const rel = this.model.relations[i];
    const onPath = this.now(this.l.aLine2, i, 4, 2);
    const mid = (snap.st[rel.a].s.opacity + snap.st[rel.b].s.opacity) / 2;
    const base = mid + (0.05 + 0.95 * onPath - mid) * this.pathShare();
    const above = this.now(this.l.aLine, i, 4, 2);
    return (
      base *
      this.now(this.l.aLine, i, 4, 0) *
      (0.6 + 0.4 * above) *
      this.l.aStatic[2 * i] *
      this.model.overrides.opacity
    );
  }

  /** A chevron's size on screen, in pixels, as the shader draws it. */
  chevronPx(i: number, snap: Snapshot): number {
    const ch = this.model.chevrons[i];
    const rel = this.model.relations[ch.rel];
    const t = ch.forward ? CHEVRON_AT.forward : CHEVRON_AT.backward;
    const a = snap.st[rel.a].s.scale;
    const b = snap.st[rel.b].s.scale;
    const lit = Math.max(0, this.now(this.c.aChevState, i, 4, 0)) * this.pathShare();
    return (
      (this.gpu?.uniforms.uChevronPx.value ?? 14) * this.model.overrides.size * (a + (b - a) * t) * (1 + 0.2 * lit)
    );
  }

  chevronOpacity(i: number, snap: Snapshot): number {
    const ch = this.model.chevrons[i];
    const rel = this.model.relations[ch.rel];
    const t = ch.forward ? CHEVRON_AT.forward : CHEVRON_AT.backward;
    const oa = snap.st[rel.a].s.opacity;
    const ob = snap.st[rel.b].s.opacity;
    const flow = this.now(this.c.aChevState, i, 4, 0);
    const aligned = Math.max(0, Math.min(1, flow));
    const opposing = Math.max(0, Math.min(1, -flow));
    const pathOp = aligned + opposing * 0.15 + (1 - aligned - opposing) * 0.05;
    const base = oa + (ob - oa) * t;
    // The shader's fade for chevrons on short lines: 0 where two chevrons do not fit on screen.
    const pa = snap.screen[rel.a];
    const pb = snap.screen[rel.b];
    const px = this.chevronPx(i, snap);
    const room = this.gpu
      ? Math.min(1, Math.max(0, (Math.hypot(pb.x - pa.x, pb.y - pa.y) - CHEVRON_ROOM * px) / (0.5 * px)))
      : 1;
    return (
      (base + (pathOp - base) * this.pathShare()) *
      this.now(this.c.aChevState, i, 4, 2) *
      this.now(this.c.aAbove, i, 2, 0) *
      this.c.aChev[4 * i + 3] *
      room *
      this.model.overrides.opacity
    );
  }

  /** The radius, in pixels, within which a click picks unit i. */
  unitReach(i: number, snap: Snapshot): number {
    const g = this.gpu;
    const v = snap.st[i];
    const drawn = g
      ? ((g.uniforms.uSize.value as number) * this.model.overrides.size * v.s.scale) / g.worldPerPixel(v.p)
      : 0;
    const d = this.model.degrees?.[i];
    const p = d === undefined ? 0 : Math.min(UNIT_REACH.length - 1, plane(d));
    return Math.max(drawn + 2, UNIT_REACH[p]);
  }
}
