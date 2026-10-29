// The scene draws the model (specification 5.5 and section 6). It listens to the model, turns its
// state into instanced attributes, eases from one state to the next, and conducts the camera, the
// hulls and the labels. It reads the model and its settings and never changes them.
import { keyId, type Key } from '../core/index.ts';
import type { Aspect, Inspected } from '../model/contracts.ts';
import type { GraphModel } from '../model/model.ts';
import type { V3 } from '../model/picking.ts';
import { paletteOf } from '../model/typeRegistry.ts';
import { allocate, statics, step } from './buffers.ts';
import { CameraRig, type Nudge } from './camera.ts';
import { FrameState } from './frame.ts';
import { LOOK } from './geometry.ts';
import type { Gpu } from './gpu.ts';
import { HullLayer } from './hullLayer.ts';
import { LabelLayer } from './labelLayer.ts';
import { PUBLIC_LOOKS, type Looks } from './looks.ts';
import { pickAt } from './picker.ts';
import { drawColours, drawRules } from './rules.ts';
import { sceneSnapshot, type SceneSnapshot } from './snapshot.ts';

export type { SceneSnapshot };

const ENDS = ['aPrevA', 'aNextA', 'aPrevB', 'aNextB', 'aStateA', 'aStateB'];

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
    this.engine();
    this.colours();
    this.overrides();
    this.camera.mode(false);
    if (this.model.graph || this.model.refused) this.onChange(new Set<Aspect>(['graph', 'layout']));
  }

  /** Lets go of the renderer, as when it is built again, and keeps following the model. */
  release() {
    if (this.gpu) {
      this.gpu.onFrame = null;
      this.gpu.onDraw = null;
    }
    this.gpu = null;
    this.state.gpu = null;
    this.camera.gpu = null;
    this.labels = null;
    this.uploaded = false;
  }

  detach() {
    this.stopListening();
    this.release();
  }

  private onChange(a: ReadonlySet<Aspect>) {
    const m = this.model;
    if (a.has('settings')) this.settings();
    // Another drawing draws other chevrons and shapes: the buffers start again, and nothing moves.
    if (a.has('settings') && !a.has('graph') && m.changedSettings.some((k) => k.startsWith('drawing.'))) {
      this.redraw();
      return;
    }
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
      if (m.settings.get('camera.fitOnLoad')) this.camera.fit();
      this.ready = true;
      this.settle();
      return;
    }
    if (a.has('root') && m.root !== null && m.settings.get('camera.followRoot'))
      this.camera.centreOn(m.index.get(keyId(m.root))!);
    if (a.has('mode') || a.has('root') || a.has('paths') || a.has('filters')) this.apply(true);
    else if (a.has('inspect')) this.mark();
    if (a.has('types') || a.has('display') || a.has('settings')) this.hulls.refresh(this.state);
  }

  /** A change of settings: the drawing rules, colours, statics, outlines and the camera follow at once. */
  private settings() {
    const s = this.state;
    s.rules = drawRules(this.model);
    s.forget();
    this.engine();
    this.colours();
    if (this.model.graph && this.uploaded) {
      statics(s);
      this.mark();
      this.gpu?.touch('lines', ['aStatic']);
      this.gpu?.touch('chevrons', ['aChev']);
    }
    this.camera.mode(false);
  }

  /** The renderer's settings: the shaders' numbers, the controls, the field of view and the draw order. */
  private engine() {
    const g = this.gpu;
    if (!g) return;
    const s = this.model.settings;
    g.setRules(this.state.rules);
    g.setControls({
      damping: s.get('camera.damping'),
      screenSpacePanning: s.get('camera.screenSpacePanning'),
      zoomSpeed: s.get('camera.zoomSpeed'),
      rotateSpeed: s.get('camera.rotateSpeed'),
      panSpeed: s.get('camera.panSpeed'),
      zoomToCursor: s.get('camera.zoomToCursor'),
      minDistance: s.get('camera.minDistance'),
      maxDistance: s.get('camera.maxDistance'),
      minPolarAngle: s.get('camera.minPolarAngle'),
      maxPolarAngle: s.get('camera.maxPolarAngle'),
    });
    g.setFov(s.get('camera.fov'));
    g.setOrder(s.get('renderer.drawOrder'));
  }

  /** The units with an outline: those the setting names, of the root, the path's end, the inspected unit and the path. */
  private marks(): string[] {
    const m = this.model;
    const which = m.settings.get('units.outline.marks');
    return [
      which.includes('root') ? m.root : null,
      which.includes('target') ? m.target : null,
      which.includes('inspected') && m.inspected?.kind === 'unit' ? m.inspected.key : null,
      ...(which.includes('path') ? (m.activePath() ?? []) : []),
    ]
      .filter((k): k is Key => k !== null)
      .map(keyId);
  }

  /** Outlines change at once; nothing moves. */
  private mark() {
    const marks = new Set(this.marks());
    this.model.ids.forEach((id, i) => (this.state.u.look[4 * i + LOOK.marked] = marks.has(id) ? 1 : 0));
    this.gpu?.touch('units', ['look']);
  }

  private allocate() {
    allocate(this.state);
    this.uploaded = false;
    this.hulls.clear(this.state);
    this.labelLayer.clear();
  }

  /** The graph drawn again from the start, where it stands, with the camera where it is. */
  private redraw() {
    const m = this.model;
    this.allocate();
    if (!m.graph || !m.laidOut) return;
    this.hulls.measure(this.state);
    this.apply(false);
  }

  private upload() {
    const m = this.model;
    const s = this.state;
    this.gpu?.setData(
      s.u,
      m.ids.length,
      s.l,
      m.relations.length,
      s.c,
      s.chevrons.length,
      s.looks.shapes,
      m.types.look.slots,
    );
    this.palettes();
  }

  private palettes() {
    const m = this.model;
    this.gpu?.setPalette('unit', paletteOf(m.types.unit, m.types.look));
    this.gpu?.setPalette('keypair', paletteOf(m.types.keypair, m.types.look));
  }

  private colours() {
    this.gpu?.setColours(drawColours(this.model));
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
      gpu.touch('units', ['posPrev', 'posNext', 'currentDegree', 'isOnActivePath', 'filterState', 'look', ...ENDS]);
      gpu.touch('lines', [...ENDS, 'aLine', 'aLine2']);
      gpu.touch('chevrons', [...ENDS, 'aChevState', 'aAbove']);
    }
    if (gpu) {
      const f = this.state.flags;
      gpu.uniforms.uHasRoot.value.set(f.root[0], f.root[1]);
      gpu.uniforms.uHasPath.value.set(f.path[0], f.path[1]);
      gpu.uniforms.uDepth.value.set(f.depth[0], f.depth[1]);
    }
    this.start = performance.now();
    const still = this.reducedMotion || this.state.rules.duration <= 0;
    this.setT(animate && !still && !first ? 0 : 1);
    if (this.state.t >= 1) this.settle();
  }

  private setT(t: number) {
    this.state.t = t;
    if (this.gpu) {
      this.gpu.uniforms.uT.value = this.state.ease(t);
      this.gpu.request();
    }
  }

  /** Called before each frame: advances transitions, the camera and the hulls. */
  private frame() {
    if (this.state.t >= 1) return;
    this.setT((performance.now() - this.start) / this.state.rules.duration);
    this.camera.move(this.state.ease());
    if (++this.framesSinceHull >= this.model.settings.get('hulls.refreshEvery')) {
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

  /** The picture as it is on screen, at a factor of its pixels, with or without its background and labels. */
  capture(background: boolean, scale = 1, labels = true): HTMLCanvasElement | null {
    const g = this.gpu;
    if (!g) return null;
    const out = g.capture(background, scale);
    if (labels && this.labels) {
      if (scale === 1) out.getContext('2d')!.drawImage(this.labels, 0, 0);
      else {
        const sharp = document.createElement('canvas');
        this.labelLayer.draw(this.state, sharp, g.pixelRatio * scale);
        out.getContext('2d')!.drawImage(sharp, 0, 0);
        this.drawLabels();
      }
    }
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
