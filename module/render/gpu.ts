// The GPU side of the viewer (specification 6.2): three instanced draws, one each for units, relation lines
// and chevrons, plus convex hulls. Depth, size, opacity and their transitions are computed in the
// shaders from per-instance attributes; the CPU only rewrites attributes when the model changes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import type { V3 } from '../model/picking.ts';
import { MAX_TYPES } from '../settings/defaults.ts';
import { instanced, lineQuad, type ChevronBuffers, type LineBuffers, type UnitBuffers } from './geometry.ts';
import type { DrawColours, DrawRules } from './rules.ts';
import { CHEVRON_FS, chevronVs } from './shaders/chevron.ts';
import { LINE_FS, lineVs } from './shaders/line.ts';
import type { UnitShape } from './shapes.ts';
import { unitFs, unitVs } from './shaders/unit.ts';

/**
 * A colour for the shaders' uniforms, in the same sRGB values as its text. three.js would
 * otherwise turn it linear, and the raw shaders, which do no conversion, would draw it darker.
 */
const shaderColour = (c: string, out = new THREE.Color()) => out.set(c).convertLinearToSRGB();

/** What the renderer and the camera start with (the groups "Renderer" and "Camera"). */
export interface GpuOptions {
  antialias: boolean;
  alpha: boolean;
  preserveDrawingBuffer: boolean;
  /** Null for the device's own ratio. */
  pixelRatio: number | null;
  fov: number;
  near: number;
  far: number;
  start: V3;
}

export const GPU_DEFAULTS: GpuOptions = {
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
  pixelRatio: null,
  fov: 45,
  near: 1,
  far: 100000,
  start: [0, 0, 1500],
};

/** The orbit controls' settings that change at once. */
export interface ControlOptions {
  damping: boolean;
  screenSpacePanning: boolean;
  zoomSpeed: number;
  rotateSpeed: number;
  panSpeed: number;
  zoomToCursor: boolean;
  minDistance: number;
  maxDistance: number | null;
  minPolarAngle: number;
  maxPolarAngle: number;
}

export type Layer = 'hulls' | 'lines' | 'chevrons' | 'units';

export interface HullSpec {
  type: string;
  colour: string;
  points: [number, number, number][];
}

export type { V3 };

export class Gpu {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly uniforms: Record<string, THREE.IUniform>;
  private units: THREE.Mesh | null = null;
  private lines: THREE.Mesh | null = null;
  private chevrons: THREE.Mesh | null = null;
  private hullGroup = new THREE.Group();
  private frame = 0;
  private dirty = true;
  private surface = '#F6F8F9';
  /** The palettes' slots, which the shaders are built for. */
  private slots = MAX_TYPES;
  private order: Record<Layer, number> = { hulls: 0, lines: 1, chevrons: 3, units: 4 };
  readonly options: GpuOptions;
  /** Before each frame, for transitions. */
  onFrame: (() => void) | null = null;
  /** After each frame, for the label overlay. */
  onDraw: (() => void) | null = null;
  width = 1;
  height = 1;

  private container: HTMLElement;

  constructor(container: HTMLElement, input: HTMLElement, options: GpuOptions = GPU_DEFAULTS) {
    this.container = container;
    this.options = options;
    this.renderer = new THREE.WebGLRenderer({
      antialias: options.antialias,
      alpha: options.alpha,
      preserveDrawingBuffer: options.preserveDrawingBuffer,
    });
    this.renderer.setPixelRatio(options.pixelRatio ?? devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.camera = new THREE.PerspectiveCamera(options.fov, 1, options.near, options.far);
    this.camera.position.set(...options.start);
    this.controls = new OrbitControls(this.camera, input);
    this.controls.addEventListener('change', () => this.request());
    // The values below are placeholders: the scene sets every one from the settings before the first frame.
    const v2 = () => new THREE.Vector2();
    const v3 = () => new THREE.Vector3();
    const v4 = () => new THREE.Vector4();
    const colour = () => new THREE.Color();
    this.uniforms = {
      uT: { value: 1 },
      uHasRoot: { value: v2() },
      uHasPath: { value: v2() },
      uDepth: { value: v2() },
      uDepthA: { value: v4() },
      uDepthB: { value: v4() },
      uDepthC: { value: v4() },
      uCull: { value: 0 },
      uDiscard: { value: 0 },
      uSize: { value: 1 },
      uSizeScale: { value: 1 },
      uWidth: { value: 1 },
      uWidthScale: { value: 1 },
      uOpacityScale: { value: 1 },
      uChevronPx: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uUnitPalette: { value: this.palette() },
      uKeypairPalette: { value: this.palette() },
      uUnitGlow: { value: v2() },
      uRing: { value: v2() },
      uOutlineFrom: { value: 0 },
      uCut: { value: v2() },
      uLineGain: { value: v4() },
      uFeather: { value: 0 },
      uBrighten: { value: 0 },
      uDash: { value: v2() },
      uChevronPath: { value: v2() },
      uChevronRoom: { value: v2() },
      uBelowChevrons: { value: 0 },
      uGlyph: { value: v3() },
      uChevronGlow: { value: v4() },
      uSurface: { value: colour() },
      uRingColour: { value: colour() },
      uOutlineColour: { value: colour() },
      uGlowColour: { value: colour() },
      uCutColour: { value: colour() },
      uLineColour: { value: colour() },
      uLineBelowColour: { value: colour() },
      uLinePathColour: { value: colour() },
      uStrengthColour: { value: colour() },
      uIssue: { value: colour() },
      uHighlight: { value: v2() },
      uOutgoing: { value: colour() },
      uIncoming: { value: colour() },
    };
    this.hullGroup.renderOrder = this.order.hulls;
    this.scene.add(this.hullGroup);
  }

  private palette(): THREE.Color[] {
    return Array.from({ length: this.slots }, () => new THREE.Color());
  }

  private material(vs: string, fs: string): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: fs,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  }

  /** Replaces all geometry; the unit shader holds the shapes given, and the palettes the slots given. */
  setData(
    u: UnitBuffers,
    uCount: number,
    l: LineBuffers,
    lCount: number,
    c: ChevronBuffers,
    cCount: number,
    shapes: readonly UnitShape[],
    slots: number = MAX_TYPES,
  ) {
    for (const m of [this.units, this.lines, this.chevrons]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    if (slots !== this.slots) {
      this.slots = slots;
      this.uniforms.uUnitPalette.value = this.palette();
      this.uniforms.uKeypairPalette.value = this.palette();
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    this.lines = new THREE.Mesh(instanced(lineQuad(), lCount, l), this.material(lineVs(slots), LINE_FS));
    this.chevrons = new THREE.Mesh(instanced(quad, cCount, c), this.material(chevronVs(slots), CHEVRON_FS));
    this.units = new THREE.Mesh(instanced(quad, uCount, u), this.material(unitVs(slots), unitFs(shapes)));
    this.applyOrder();
    for (const m of [this.lines, this.chevrons, this.units]) {
      m.frustumCulled = false;
      this.scene.add(m);
    }
    this.request();
  }

  /** Marks attributes as changed after the CPU rewrote their arrays. */
  touch(which: 'units' | 'lines' | 'chevrons', names: string[]) {
    const m = which === 'units' ? this.units : which === 'lines' ? this.lines : this.chevrons;
    if (!m) return;
    for (const n of names) {
      const a = m.geometry.getAttribute(n) as THREE.InstancedBufferAttribute | undefined;
      if (a) a.needsUpdate = true;
    }
    this.request();
  }

  setPalette(kind: 'unit' | 'keypair', colours: string[]) {
    const u = (kind === 'unit' ? this.uniforms.uUnitPalette : this.uniforms.uKeypairPalette).value as THREE.Color[];
    colours.slice(0, u.length).forEach((c, i) => shaderColour(c, u[i]));
    this.request();
  }

  setColours(c: DrawColours) {
    const u = this.uniforms;
    shaderColour(c.surface, u.uSurface.value);
    shaderColour(c.ring, u.uRingColour.value);
    shaderColour(c.outline, u.uOutlineColour.value);
    shaderColour(c.glow, u.uGlowColour.value);
    shaderColour(c.cut, u.uCutColour.value);
    shaderColour(c.line, u.uLineColour.value);
    shaderColour(c.lineBelow, u.uLineBelowColour.value);
    shaderColour(c.linePath, u.uLinePathColour.value);
    shaderColour(c.strength, u.uStrengthColour.value);
    shaderColour(c.issue, u.uIssue.value);
    shaderColour(c.outgoing, u.uOutgoing.value);
    shaderColour(c.incoming, u.uIncoming.value);
    this.surface = c.surface;
    this.renderer.setClearColor(c.surface, 1);
    this.request();
  }

  /** Every number the shaders draw with. */
  setRules(r: DrawRules) {
    const u = this.uniforms;
    const d = r.depth;
    u.uDepthA.value.set(d.spacing, d.foreground, d.maxPlanes, d.frontDegrees);
    u.uDepthB.value.set(d.second.scale, d.second.opacity, d.far.scale, d.far.opacity);
    u.uDepthC.value.set(d.path.scale, d.path.opacity, d.path.glow, d.dimmed);
    u.uCull.value = r.cull;
    u.uDiscard.value = r.discard;
    u.uSize.value = r.units.radius;
    u.uUnitGlow.value.set(...r.units.glow);
    u.uRing.value.set(...r.units.ring);
    u.uOutlineFrom.value = r.units.outlineFrom;
    u.uCut.value.set(...r.units.cut);
    u.uWidth.value = r.lines.width;
    u.uLineGain.value.set(...r.lines.gain);
    u.uFeather.value = r.lines.feather;
    u.uBrighten.value = r.lines.brighten;
    u.uDash.value.set(...r.dash);
    u.uChevronPx.value = r.chevrons.size;
    u.uChevronPath.value.set(...r.chevrons.path);
    u.uChevronRoom.value.set(r.chevrons.room, r.chevrons.fadeIn);
    u.uBelowChevrons.value = r.chevrons.below ? 1 : 0;
    u.uGlyph.value.set(...r.chevrons.glyph);
    u.uChevronGlow.value.set(...r.chevrons.glow);
    u.uHighlight.value.set(r.highlight.scale, r.highlight.dim);
    this.request();
  }

  /** The orbit controls' speeds, limits and glide. */
  setControls(c: ControlOptions) {
    const k = this.controls;
    k.enableDamping = c.damping;
    k.screenSpacePanning = c.screenSpacePanning;
    k.zoomSpeed = c.zoomSpeed;
    k.rotateSpeed = c.rotateSpeed;
    k.panSpeed = c.panSpeed;
    k.zoomToCursor = c.zoomToCursor;
    k.minDistance = c.minDistance;
    k.maxDistance = c.maxDistance ?? Infinity;
    k.minPolarAngle = c.minPolarAngle;
    k.maxPolarAngle = c.maxPolarAngle;
    this.request();
  }

  /** The camera's field of view. */
  setFov(fov: number) {
    if (this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.request();
  }

  /** The order in which the layers draw, the last on top. */
  setOrder(order: readonly Layer[]) {
    order.forEach((layer, i) => (this.order[layer] = i));
    this.applyOrder();
    this.request();
  }

  private applyOrder() {
    this.hullGroup.renderOrder = this.order.hulls;
    for (const child of this.hullGroup.children) child.renderOrder = this.order.hulls;
    if (this.lines) this.lines.renderOrder = this.order.lines;
    if (this.chevrons) this.chevrons.renderOrder = this.order.chevrons;
    if (this.units) this.units.renderOrder = this.order.units;
  }

  setHulls(hulls: HullSpec[], opacity: number) {
    for (const child of [...this.hullGroup.children]) {
      this.hullGroup.remove(child);
      const m = child as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    for (const h of hulls) {
      if (h.points.length < 4) continue;
      let geometry: THREE.BufferGeometry;
      try {
        geometry = new ConvexGeometry(h.points.map((p) => new THREE.Vector3(...p)));
      } catch {
        continue;
      }
      const fill = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: h.colour,
          transparent: true,
          opacity,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
        }),
      );
      fill.renderOrder = this.order.hulls;
      fill.userData.type = h.type;
      this.hullGroup.add(fill);
    }
    this.request();
  }

  /** Sets the opacity of the hulls drawn, without building them again. */
  setHullOpacity(opacity: number) {
    for (const child of this.hullGroup.children)
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = opacity;
    if (this.hullGroup.children.length) this.request();
  }

  hullCount(): number {
    return this.hullGroup.children.length;
  }

  /** The opacity the hulls draw with, or 0 without hulls. */
  hullOpacity(): number {
    const first = this.hullGroup.children[0] as THREE.Mesh | undefined;
    return first ? (first.material as THREE.MeshBasicMaterial).opacity : 0;
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    (this.uniforms.uResolution.value as THREE.Vector2).set(w, h);
    this.request();
  }

  /** Asks for a frame; frames are drawn only when something changed. */
  request() {
    this.dirty = true;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.onFrame?.();
      if (this.dirty) this.draw();
    });
  }

  draw() {
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
    this.onDraw?.();
  }

  /** The pixels drawn per CSS pixel. */
  get pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  /** The picture as it is on screen, at a factor of its pixel size, with or without the background. */
  capture(background: boolean, scale = 1): HTMLCanvasElement {
    const ratio = this.renderer.getPixelRatio();
    if (scale !== 1) {
      this.renderer.setPixelRatio(ratio * scale);
      this.renderer.setSize(this.width, this.height, false);
    }
    if (!background) this.renderer.setClearColor(this.surface, 0);
    this.renderer.render(this.scene, this.camera);
    const out = document.createElement('canvas');
    out.width = this.renderer.domElement.width;
    out.height = this.renderer.domElement.height;
    out.getContext('2d')!.drawImage(this.renderer.domElement, 0, 0);
    if (scale !== 1) {
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(this.width, this.height, false);
    }
    this.renderer.setClearColor(this.surface, 1);
    if (!background || scale !== 1) this.renderer.render(this.scene, this.camera);
    return out;
  }

  /** World coordinates to CSS pixels in the canvas. */
  project(p: V3): { x: number; y: number; behind: boolean } {
    const v = new THREE.Vector3(...p).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height, behind: v.z > 1 };
  }

  /** The ray through a canvas point. */
  ray(x: number, y: number): { origin: V3; dir: V3 } {
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1), this.camera);
    return { origin: r.ray.origin.toArray() as V3, dir: r.ray.direction.toArray() as V3 };
  }

  /** World units per CSS pixel at a point, for hit padding that stays the same on screen. */
  worldPerPixel(p: V3): number {
    const c = this.camera.position;
    const d = Math.hypot(c.x - p[0], c.y - p[1], c.z - p[2]);
    return (2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.height;
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.controls.dispose();
    this.setHulls([], 0);
    for (const m of [this.units, this.lines, this.chevrons]) {
      if (!m) continue;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
