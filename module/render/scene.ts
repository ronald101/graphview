// The scene draws the model (specification 5.5 and section 6). It listens to the model, turns its
// state into instanced attributes, eases from one state to the next, and conducts the camera, the
// hulls and the labels. It reads the model and never changes it.
import { keyId, tokens, type Key } from '../core/index.ts';
import type { Aspect, Inspected } from '../model/contracts.ts';
import type { GraphModel } from '../model/model.ts';
import type { V3 } from '../model/picking.ts';
import { paletteOf } from '../model/typeRegistry.ts';
import { allocate, step } from './buffers.ts';
import { CameraRig, type Nudge } from './camera.ts';
import { ease, FrameState } from './frame.ts';
import { LOOK } from './geometry.ts';
import type { Gpu } from './gpu.ts';
import { HullLayer } from './hullLayer.ts';
import { LabelLayer } from './labelLayer.ts';
import { PUBLIC_LOOKS, type Looks } from './looks.ts';
import { pickAt } from './picker.ts';
import { sceneSnapshot, type SceneSnapshot } from './snapshot.ts';

export type { SceneSnapshot };

const DURATION = 450;

export class Scene {
  reducedMotion = false;
  private model: GraphModel;
  private state: FrameState;
  private camera: CameraRig;
  private hulls = new HullLayer();
  private labelLayer = new LabelLayer();
  private gpu: Gpu | null = null;
  private labels: HTMLCanvasElement | null = null;
  private stopListening: () => void;
  private start = 0;
  private uploaded = false;
  private framesSinceHull = 0;
  private waiters: (() => void)[] = [];
  private ready = false;

  /** The looks say how each kind of unit draws (looks.ts); the public ones unless a host gives its own. */
  constructor(model: GraphModel, looks: Looks = PUBLIC_LOOKS) {
    this.model = model;
    this.state = new FrameState(model, looks);
    this.camera = new CameraRig(model);
    this.allocate();
    this.stopListening = model.subscribe((a) => this.onChange(a));
  }

  attach(gpu: Gpu, labels: HTMLCanvasElement) {
    this.gpu = gpu;
    this.state.gpu = gpu;
    this.camera.gpu = gpu;
    this.labels = labels;
    // Every camera move, by mouse, keys, fit or code, sets the hulls' opacity for the new distance.
    gpu.controls.addEventListener('change', () => gpu.setHullOpacity(this.hulls.opacity(this.state)));
    gpu.onFrame = () => this.frame();
    gpu.onDraw = () => this.drawLabels();
    this.colours();
    this.overrides();
    this.camera.mode(false);
    if (this.model.graph || this.model.refused) this.onChange(new Set<Aspect>(['graph', 'layout']));
  }

  detach() {
    this.stopListening();
    if (this.gpu) {
      this.gpu.onFrame = null;
      this.gpu.onDraw = null;
    }
    this.gpu = null;
    this.state.gpu = null;
    this.camera.gpu = null;
    this.labels = null;
  }

  private onChange(a: ReadonlySet<Aspect>) {
    const m = this.model;
    if (a.has('graph')) {
      this.ready = false;
      this.allocate();
      if (m.refused || (m.laidOut && !m.graph)) {
        this.upload();
        this.uploaded = true;
        this.ready = true;
        this.settle();
      }
    }
    // A new graph may bring saved settings: everything below it changed too (contracts.ts).
    const all = a.has('graph');
    if (all || a.has('theme')) this.colours();
    if (all || a.has('types') || a.has('theme')) this.palettes();
    if (all || a.has('display')) this.overrides();
    if (all || a.has('mode')) this.camera.mode(m.laidOut && !this.reducedMotion);
    if (!m.graph || !m.laidOut) return;
    if (a.has('layout')) {
      this.hulls.measure(this.state);
      this.apply(false);
      this.camera.fit();
      this.ready = true;
      this.settle();
      return;
    }
    if (a.has('root') && m.root !== null) this.camera.centreOn(m.index.get(keyId(m.root))!);
    if (a.has('mode') || a.has('root') || a.has('paths') || a.has('filters')) this.apply(true);
    else if (a.has('inspect')) this.mark();
    if (a.has('types') || a.has('display')) this.hulls.refresh(this.state);
  }

  /** The units with an ink outline: the root, the path's target and the inspected unit. */
  private marks(): string[] {
    const m = this.model;
    return [m.root, m.target, m.inspected?.kind === 'unit' ? m.inspected.key : null]
      .filter((k): k is Key => k !== null)
      .map(keyId);
  }

  /** Outlines change at once; nothing moves. */
  private mark() {
    const marks = this.marks();
    this.model.ids.forEach((id, i) => (this.state.u.look[4 * i + LOOK.marked] = marks.includes(id) ? 1 : 0));
    this.gpu?.touch('units', ['look']);
  }

  private allocate() {
    allocate(this.state);
    this.uploaded = false;
    this.hulls.clear(this.state);
    this.labelLayer.clear();
  }

  private upload() {
    const m = this.model;
    const s = this.state;
    this.gpu?.setData(s.u, m.ids.length, s.l, m.relations.length, s.c, m.chevrons.length, s.looks.shapes);
    this.palettes();
  }

  private palettes() {
    const m = this.model;
    this.gpu?.setPalette('unit', paletteOf(m.types.unit, m.theme));
    this.gpu?.setPalette('keypair', paletteOf(m.types.keypair, m.theme));
  }

  private colours() {
    const t = tokens[this.model.theme];
    this.gpu?.setColours({
      surface: t.surface,
      ink: t['ink-1'],
      context: t.context,
      neutral: t.ring,
      path: t.path,
      issue: t.issue,
    });
  }

  private overrides() {
    const g = this.gpu;
    if (!g) return;
    const o = this.model.overrides;
    g.uniforms.uSizeScale.value = o.size;
    g.uniforms.uWidthScale.value = o.width;
    g.uniforms.uOpacityScale.value = o.opacity;
    g.request();
  }

  /** Moves every attribute one step to the model's state, and starts the transition. */
  private apply(animate: boolean) {
    if (!this.model.graph) return;
    const first = !this.uploaded;
    step(this.state, first, this.marks());
    const gpu = this.gpu;
    if (first) {
      this.upload();
      this.uploaded = true;
    } else if (gpu) {
      const ends = ['aPrevA', 'aNextA', 'aPrevB', 'aNextB', 'aStateA', 'aStateB'];
      gpu.touch('units', ['posPrev', 'posNext', 'currentDegree', 'isOnActivePath', 'filterState', 'look', ...ends]);
      gpu.touch('lines', [...ends, 'aLine', 'aLine2']);
      gpu.touch('chevrons', [...ends, 'aChevState', 'aAbove']);
    }
    if (gpu) {
      const f = this.state.flags;
      gpu.uniforms.uHasRoot.value.set(f.root[0], f.root[1]);
      gpu.uniforms.uHasPath.value.set(f.path[0], f.path[1]);
      gpu.uniforms.uDepth.value.set(f.depth[0], f.depth[1]);
    }
    this.start = performance.now();
    this.setT(animate && !this.reducedMotion && !first ? 0 : 1);
    if (this.state.t >= 1) this.settle();
  }

  private setT(t: number) {
    this.state.t = t;
    if (this.gpu) {
      this.gpu.uniforms.uT.value = ease(t);
      this.gpu.request();
    }
  }

  /** Called before each frame: advances transitions, the camera and the hulls. */
  private frame() {
    if (this.state.t >= 1) return;
    this.setT((performance.now() - this.start) / DURATION);
    this.camera.move(ease(this.state.t));
    if (++this.framesSinceHull >= 4) {
      this.framesSinceHull = 0;
      this.hulls.refresh(this.state);
    }
    if (this.state.t >= 1) this.settle();
  }

  private settle() {
    this.camera.move(1);
    this.hulls.refresh(this.state);
    if (!this.ready) return;
    const w = this.waiters;
    this.waiters = [];
    w.forEach((f) => f());
  }

  /** Resolves once the graph is drawn and the current transition has finished. */
  whenSettled(): Promise<void> {
    if (this.settled) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }

  get settled() {
    return this.state.t >= 1 && this.ready;
  }

  /** What is under a canvas point: a unit, a chevron (one keypair), a line (its relation), or nothing. */
  pick(x: number, y: number): Inspected {
    return pickAt(this.state, x, y);
  }

  /** Shows the whole graph from straight above. */
  fit() {
    this.camera.fit();
  }

  nudge(move: Nudge) {
    this.camera.nudge(move);
  }

  getCamera(): { position: V3; target: V3 } | null {
    return this.camera.get();
  }

  setCamera(position: V3, target: V3) {
    this.camera.set(position, target);
  }

  private drawLabels() {
    if (this.labels) this.labelLayer.draw(this.state, this.labels);
  }

  /** The picture as it is on screen, labels included, with or without the background. */
  capture(background: boolean): HTMLCanvasElement | null {
    const g = this.gpu;
    if (!g) return null;
    const out = g.capture(background);
    if (this.labels) out.getContext('2d')!.drawImage(this.labels, 0, 0);
    return out;
  }

  snapshotForTests(): SceneSnapshot {
    return sceneSnapshot(this.state, {
      settled: this.settled,
      hulls: this.hulls.groups,
      labels: this.labelLayer.placed,
    });
  }
}
