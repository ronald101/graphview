// The state of the picture between two model changes: the instanced attributes, the transition's
// flags and its point, and the CPU's copy of the shaders' sums, so that picking, labels, hulls and
// the snapshot read what is drawn.
import { depthState, plane, type DepthState } from '../model/depth.ts';
import type { GraphModel } from '../model/model.ts';
import type { V3 } from '../model/picking.ts';
import { LOOK, type ChevronBuffers, type LineBuffers, type UnitBuffers } from './geometry.ts';
import type { Gpu } from './gpu.ts';
import { PUBLIC_LOOKS, type Looks } from './looks.ts';
import { drawRules, EASINGS, type DrawRules } from './rules.ts';

/** The default easing, a cubic slowing. */
export const ease = EASINGS['cubic-out'];

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
  /** How each kind of unit looks, and the shapes the unit shader holds: the host's, with the setting "Looks of kinds" over them for the graph loaded. */
  looks: Looks;
  readonly baseLooks: Looks;
  /** The numbers the shaders draw with, from the settings; the scene refreshes them. */
  rules: DrawRules;
  private snap: { key: string; value: Snapshot } | null = null;

  constructor(model: GraphModel, looks: Looks = PUBLIC_LOOKS) {
    this.model = model;
    this.looks = this.baseLooks = looks;
    this.rules = drawRules(model);
  }

  forget() {
    this.snap = null;
  }

  /** The transition's point, eased as the shaders get it. */
  ease(t = this.t): number {
    return this.rules.ease(t);
  }

  private stateOf(i: number, which: 0 | 1): DepthState {
    return depthState(
      {
        degree: this.u.currentDegree[2 * i + which],
        onPath: this.u.isOnActivePath[2 * i + which] > 0.5,
        hasRoot: this.flags.root[which] > 0.5,
        hasPath: this.flags.path[which] > 0.5,
        depth: this.flags.depth[which] > 0.5,
      },
      this.rules.depth,
    );
  }

  /** A unit's state now, as the shader computes it. */
  unitNow(i: number): Now {
    const e = this.ease();
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
    const e = this.ease();
    return arr[stride * i + offset] + (arr[stride * i + offset + 1] - arr[stride * i + offset]) * e;
  }

  /** How far the view is into path mode, 0 to 1, at this point of the transition. */
  pathShare(): number {
    return this.flags.path[0] + (this.flags.path[1] - this.flags.path[0]) * this.ease();
  }

  lineOpacity(i: number, snap: Snapshot): number {
    const rel = this.model.relations[i];
    const dimmed = this.rules.depth.dimmed;
    const below = this.rules.lines.gain[3];
    const onPath = this.now(this.l.aLine2, i, 4, 2);
    const mid = (snap.st[rel.a].s.opacity + snap.st[rel.b].s.opacity) / 2;
    const base = mid + (dimmed + (1 - dimmed) * onPath - mid) * this.pathShare();
    const above = this.now(this.l.aLine, i, 4, 2);
    return (
      base *
      this.now(this.l.aLine, i, 4, 0) *
      (below + (1 - below) * above) *
      this.l.aStatic[2 * i] *
      this.model.overrides.opacity
    );
  }

  /** Where chevron i sits along its line, as a share from the line's first unit. */
  chevronAt(i: number): number {
    const at = this.rules.chevrons.at;
    return this.model.chevrons[i].forward ? at.forward : at.backward;
  }

  /** A chevron's size on screen, in pixels, as the shader draws it. */
  chevronPx(i: number, snap: Snapshot): number {
    const ch = this.model.chevrons[i];
    const rel = this.model.relations[ch.rel];
    const t = this.chevronAt(i);
    const a = snap.st[rel.a].s.scale;
    const b = snap.st[rel.b].s.scale;
    const lit = Math.max(0, this.now(this.c.aChevState, i, 4, 0)) * this.pathShare();
    const r = this.rules.chevrons;
    return r.size * this.model.overrides.size * (a + (b - a) * t) * (1 + r.path[0] * lit);
  }

  chevronOpacity(i: number, snap: Snapshot): number {
    const ch = this.model.chevrons[i];
    const rel = this.model.relations[ch.rel];
    const r = this.rules.chevrons;
    const t = this.chevronAt(i);
    const oa = snap.st[rel.a].s.opacity;
    const ob = snap.st[rel.b].s.opacity;
    const flow = this.now(this.c.aChevState, i, 4, 0);
    const aligned = Math.max(0, Math.min(1, flow));
    const opposing = Math.max(0, Math.min(1, -flow));
    const pathOp = aligned + opposing * r.path[1] + (1 - aligned - opposing) * this.rules.depth.dimmed;
    const base = oa + (ob - oa) * t;
    // The shader's fade for chevrons on short lines: 0 where a chevron does not fit on screen.
    const pa = snap.screen[rel.a];
    const pb = snap.screen[rel.b];
    const px = this.chevronPx(i, snap);
    const room = this.gpu
      ? Math.min(1, Math.max(0, (Math.hypot(pb.x - pa.x, pb.y - pa.y) - r.room * px) / (r.fadeIn * px)))
      : 1;
    const above = r.below ? 1 : this.now(this.c.aAbove, i, 2, 0);
    return (
      (base + (pathOp - base) * this.pathShare()) *
      this.now(this.c.aChevState, i, 4, 2) *
      above *
      this.c.aChev[4 * i + 3] *
      room *
      this.model.overrides.opacity
    );
  }

  /** The radius a unit is drawn with, in pixels. */
  unitDrawn(i: number, snap: Snapshot): number {
    const g = this.gpu;
    const v = snap.st[i];
    return g ? (this.rules.units.radius * this.model.overrides.size * v.s.scale) / g.worldPerPixel(v.p) : 0;
  }

  /** The radius, in pixels, within which a click picks unit i. */
  unitReach(i: number, snap: Snapshot): number {
    const r = this.rules.pointer;
    const d = this.model.degrees?.[i];
    const p = d === undefined ? 0 : Math.min(r.reach.length - 1, plane(d, this.rules.depth));
    return Math.max(this.unitDrawn(i, snap) + r.drawnExtra, r.reach[p]);
  }
}
