// The GPU side of the viewer (specification 6.2): three instanced draws, one each for units, relation lines
// and chevrons, plus convex hulls. Depth, size, opacity and their transitions are computed in the
// shaders from per-instance attributes; the CPU only rewrites attributes when the model changes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import type { V3 } from '../model/picking.ts';
import { MAX_TYPES } from '../model/typeRegistry.ts';
import { instanced, lineQuad, type ChevronBuffers, type LineBuffers, type UnitBuffers } from './geometry.ts';
import { CHEVRON_FS, CHEVRON_VS } from './shaders/chevron.ts';
import { LINE_FS, LINE_VS } from './shaders/line.ts';
import type { UnitShape } from './shapes.ts';
import { unitFs, UNIT_VS } from './shaders/unit.ts';

/**
 * A colour for the shaders' uniforms, in the same sRGB values as its text. three.js would
 * otherwise turn it linear, and the raw shaders, which do no conversion, would draw it darker.
 */
const shaderColour = (c: string, out = new THREE.Color()) => out.set(c).convertLinearToSRGB();

export interface Colours {
  surface: string;
  ink: string;
  context: string;
  neutral: string;
  path: string;
  issue: string;
}

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
  /** Before each frame, for transitions. */
  onFrame: (() => void) | null = null;
  /** After each frame, for the label overlay. */
  onDraw: (() => void) | null = null;
  width = 1;
  height = 1;

  private container: HTMLElement;

  constructor(container: HTMLElement, input: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 100000);
    this.camera.position.set(0, 0, 1500);
    this.controls = new OrbitControls(this.camera, input);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.request());
    const palette = () => Array.from({ length: MAX_TYPES }, () => shaderColour('#74859A'));
    this.uniforms = {
      uT: { value: 1 },
      uHasRoot: { value: new THREE.Vector2(0, 0) },
      uHasPath: { value: new THREE.Vector2(0, 0) },
      uDepth: { value: new THREE.Vector2(0, 0) },
      uSize: { value: 6 },
      uSizeScale: { value: 1 },
      uWidth: { value: 1.5 },
      uWidthScale: { value: 1 },
      uOpacityScale: { value: 1 },
      uChevronPx: { value: 14 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uUnitPalette: { value: palette() },
      uKeypairPalette: { value: palette() },
      uInk: { value: shaderColour('#13222E') },
      uSurface: { value: shaderColour('#F6F8F9') },
      uContext: { value: shaderColour('#74859A') },
      uNeutral: { value: shaderColour('#A9B4BE') },
      uPathColour: { value: shaderColour('#17A070') },
      uIssue: { value: shaderColour('#D03B3B') },
    };
    // Hulls go first, so that lines, chevrons and units draw over them.
    this.hullGroup.renderOrder = 0;
    this.scene.add(this.hullGroup);
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

  /** Replaces all geometry; the unit shader holds the shapes given. */
  setData(
    u: UnitBuffers,
    uCount: number,
    l: LineBuffers,
    lCount: number,
    c: ChevronBuffers,
    cCount: number,
    shapes: readonly UnitShape[],
  ) {
    for (const m of [this.units, this.lines, this.chevrons]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    this.lines = new THREE.Mesh(instanced(lineQuad(), lCount, l), this.material(LINE_VS, LINE_FS));
    this.lines.renderOrder = 1;
    this.chevrons = new THREE.Mesh(instanced(quad, cCount, c), this.material(CHEVRON_VS, CHEVRON_FS));
    this.chevrons.renderOrder = 3;
    this.units = new THREE.Mesh(instanced(quad, uCount, u), this.material(UNIT_VS, unitFs(shapes)));
    this.units.renderOrder = 4;
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
    colours.slice(0, MAX_TYPES).forEach((c, i) => shaderColour(c, u[i]));
    this.request();
  }

  setColours(c: Colours) {
    shaderColour(c.surface, this.uniforms.uSurface.value);
    shaderColour(c.ink, this.uniforms.uInk.value);
    shaderColour(c.context, this.uniforms.uContext.value);
    shaderColour(c.neutral, this.uniforms.uNeutral.value);
    shaderColour(c.path, this.uniforms.uPathColour.value);
    shaderColour(c.issue, this.uniforms.uIssue.value);
    this.surface = c.surface;
    this.renderer.setClearColor(c.surface, 1);
    this.request();
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
      fill.renderOrder = 0;
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

  /** The picture as it is on screen, at the device's pixel size, with or without the background. */
  capture(background: boolean): HTMLCanvasElement {
    if (!background) this.renderer.setClearColor(this.surface, 0);
    this.renderer.render(this.scene, this.camera);
    const out = document.createElement('canvas');
    out.width = this.renderer.domElement.width;
    out.height = this.renderer.domElement.height;
    out.getContext('2d')!.drawImage(this.renderer.domElement, 0, 0);
    if (!background) {
      this.renderer.setClearColor(this.surface, 1);
      this.renderer.render(this.scene, this.camera);
    }
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
