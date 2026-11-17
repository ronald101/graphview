// The camera: 2D and 3D controls, moves that ease from one place to the next, Fit, the keyboard and
// saved views (specification 6.3, 6.10, 6.14).
import { MOUSE, TOUCH, Vector3 } from 'three';
import type { GraphModel } from '../model/model.ts';
import type { V3 } from '../model/picking.ts';
import type { Gpu } from './gpu.ts';
import type { Easing } from './rules.ts';

const BUTTONS = { pan: MOUSE.PAN, rotate: MOUSE.ROTATE, dolly: MOUSE.DOLLY, none: null } as const;
const ONE = { pan: TOUCH.PAN, rotate: TOUCH.ROTATE, none: null } as const;
const TWO = { 'dolly-pan': TOUCH.DOLLY_PAN, 'dolly-rotate': TOUCH.DOLLY_ROTATE, none: null } as const;

export type Nudge = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'turn-left' | 'turn-right';

/** Where the camera stands and what it looks at. */
export interface Pose {
  position: V3;
  target: V3;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a: V3, b: V3, e: number): V3 => [
  a[0] + (b[0] - a[0]) * e,
  a[1] + (b[1] - a[1]) * e,
  a[2] + (b[2] - a[2]) * e,
];

/**
 * A pose between two others, at the eased point e from 0 to 1. The target moves in a straight line. The
 * camera keeps its direction and distance to the target where both poses share them; else the direction
 * turns along the shortest arc and the distance changes by equal factors, so that a turn does not cut
 * through the graph and a zoom runs evenly.
 */
export function mixPose(a: Pose, b: Pose, e: number): Pose {
  if (e <= 0) return a;
  if (e >= 1) return b;
  const target = lerp(a.target, b.target, e);
  const [oa, ob] = [sub(a.position, a.target), sub(b.position, b.target)];
  const [la, lb] = [length(oa), length(ob)];
  if (la < 1e-9 || lb < 1e-9) return { position: lerp(a.position, b.position, e), target };
  const [ua, ub] = [scale(oa, 1 / la), scale(ob, 1 / lb)];
  const angle = Math.acos(Math.min(1, Math.max(-1, dot(ua, ub))));
  // Opposite directions have no shortest arc: the straight line serves.
  if (Math.PI - angle < 1e-3) return { position: lerp(a.position, b.position, e), target };
  const sin = Math.sin(angle);
  const dir = angle < 1e-6 ? ub : add(scale(ua, Math.sin((1 - e) * angle) / sin), scale(ub, Math.sin(e * angle) / sin));
  return { position: add(target, scale(dir, la * Math.pow(lb / la, e))), target };
}

export class CameraRig {
  gpu: Gpu | null = null;
  /** How long a move lasts, in milliseconds, and how it eases; the scene sets it. Nothing or less jumps. */
  timing: () => { ms: number; ease: Easing } = () => ({ ms: 0, ease: (t) => t });
  /** A move in flight, on its own clock. */
  private glide: { from: Pose; to: Pose; start: number; ms: number; ease: Easing } | null = null;
  /** The target after the last move, which the focus plane runs through. */
  private focus: V3 | null = null;
  /** While the rig itself places the camera, the controls' changes are its own. */
  private placing = false;
  private model: GraphModel;

  constructor(model: GraphModel) {
    this.model = model;
  }

  /** Whether a move is in flight. */
  get moving(): boolean {
    return this.glide !== null;
  }

  /** The pose the camera is on its way to, or stands at. */
  private end(): Pose | null {
    return this.glide ? this.glide.to : this.get();
  }

  /** Puts the camera at a pose, at once. */
  private place(p: Pose) {
    const g = this.gpu;
    if (!g) return;
    this.placing = true;
    g.camera.position.set(...p.position);
    g.controls.target.set(...p.target);
    g.controls.update();
    this.placing = false;
    this.focus = p.target;
    g.request();
  }

  /** Moves the camera to a pose: over the transition when asked and motion allows it, else at once. */
  private go(to: Pose, animate: boolean) {
    const g = this.gpu;
    const from = this.get();
    if (!g || !from) return;
    const { ms, ease } = this.timing();
    if (!animate || ms <= 0) {
      this.glide = null;
      this.place(to);
      return;
    }
    this.glide = { from, to, start: performance.now(), ms, ease };
    g.request();
  }

  /** Called before each frame: advances the move in flight; true while it still runs. */
  step(now: number): boolean {
    const glide = this.glide;
    if (!glide || !this.gpu) return false;
    const t = (now - glide.start) / glide.ms;
    if (t >= 1) this.glide = null;
    this.place(mixPose(glide.from, glide.to, glide.ease(Math.min(1, Math.max(0, t)))));
    return this.glide !== null;
  }

  /** Ends the move in flight where it is, as when a person takes the camera. */
  stop() {
    this.glide = null;
  }

  /** Ends the move in flight at its end. */
  finish() {
    const glide = this.glide;
    if (!glide) return;
    this.glide = null;
    this.place(glide.to);
  }

  /**
   * After the controls moved the camera. A zoom toward the pointer moves the camera along the pointer's
   * ray; the target then stays on the plane it was on, across the line of sight, so that the distance
   * to the target stays the distance to what is looked at, zoom after zoom (D118).
   */
  moved() {
    const g = this.gpu;
    if (!g || this.placing) return;
    const k = g.controls;
    const last = this.focus;
    this.focus = k.target.toArray() as V3;
    if (!last || !k.zoomToCursor || !k.screenSpacePanning) return;
    const forward = g.camera.getWorldDirection(new Vector3());
    const d = new Vector3(...last).sub(g.camera.position).dot(forward);
    if (d <= 1e-6) return;
    k.target.copy(g.camera.position).addScaledVector(forward, d);
    this.focus = k.target.toArray() as V3;
  }

  /** 2D looks straight down and does not turn out of the plane; 3D turns freely. The buttons and fingers follow the settings. */
  mode(animate: boolean) {
    const g = this.gpu;
    if (!g) return;
    const s = this.model.settings;
    const twoD = this.model.mode === '2d';
    g.controls.enableRotate = !twoD || s.get('camera.rotateIn2d');
    // By default the left button and one finger pan in 2D; in 3D they turn the view.
    const m = twoD ? '2d' : '3d';
    // three.js types the buttons without "nothing", which it accepts.
    const buttons = g.controls.mouseButtons as Record<string, MOUSE | null>;
    buttons.LEFT = BUTTONS[s.get(`camera.mouse.${m}.left`)];
    buttons.MIDDLE = BUTTONS[s.get(`camera.mouse.${m}.middle`)];
    buttons.RIGHT = BUTTONS[s.get(`camera.mouse.${m}.right`)];
    const touches = g.controls.touches as Record<string, TOUCH | null>;
    touches.ONE = ONE[s.get(`camera.touch.${m}.one`)];
    touches.TWO = TWO[s.get(`camera.touch.${m}.two`)];
    if (!twoD || !s.get('camera.flattenIn2d')) return;
    const end = this.end()!;
    const offset = sub(end.position, end.target);
    // Already straight above: nothing to do, and a move in flight goes on.
    if (Math.hypot(offset[0], offset[1]) < 1e-9 * Math.max(1, length(offset)) && offset[2] > 0) return;
    this.go({ position: add(end.target, [0, 0, length(offset)]), target: end.target }, animate);
  }

  /** Moves the camera's centre to a unit over the transition, keeping its direction and distance. */
  centreOn(i: number) {
    const end = this.end();
    if (!end) return;
    const m = this.model;
    const target: V3 = [m.positions[2 * i], m.positions[2 * i + 1], 0];
    const position: V3 = [
      end.position[0] + target[0] - end.target[0],
      end.position[1] + target[1] - end.target[1],
      end.position[2] - end.target[2],
    ];
    this.go({ position, target }, true);
  }

  /** Shows the whole graph from straight above; a person's Fit moves there over the transition. */
  fit(animate = false) {
    const g = this.gpu;
    if (!g) return;
    const s = this.model.settings;
    // The vertical field of view is fixed; a canvas narrower than tall needs more distance for the width.
    const half = Math.tan(((g.camera.fov / 2) * Math.PI) / 180);
    // With a scope, its units' box; else the whole extent (6.21).
    const box = this.scopeBox();
    const d =
      (((box?.side ?? this.model.extent) / 2 / half) * s.get('camera.fitMargin')) / Math.min(1, g.camera.aspect);
    const centre: V3 = [box?.cx ?? 0, box?.cy ?? 0, 0];
    g.camera.near = s.get('camera.near');
    // Far enough for the place the camera leaves, too.
    const from = this.get()!;
    g.camera.far = Math.max(d, length(sub(from.position, centre))) * s.get('camera.farPerFit');
    g.camera.updateProjectionMatrix();
    this.go({ position: [centre[0], centre[1], d], target: centre }, animate);
  }

  /** The centre and larger side of the scope's units, or null without a scope; a tenth of the extent at least. */
  private scopeBox(): { cx: number; cy: number; side: number } | null {
    const m = this.model;
    const inside = m.inScope();
    if (!inside) return null;
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    inside.forEach((v, i) => {
      if (!v) return;
      const [x, y] = [m.positions[2 * i], m.positions[2 * i + 1]];
      [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    });
    if (x0 > x1) return null;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, side: Math.max(x1 - x0, y1 - y0, m.extent / 10) };
  }

  /**
   * Moves the camera by keyboard: a pan by a share of the view, a zoom by a factor, or in 3D a turn
   * around the camera's up axis, as the settings of the group "Keyboard" say. 2D does not turn, as
   * with the mouse. Each step starts where the last one ends, so that keys pressed in a row add up.
   */
  nudge(move: Nudge) {
    const g = this.gpu;
    const end = this.end();
    if (!g || !end) return;
    const s = this.model.settings;
    const target = new Vector3(...end.target);
    const offset = new Vector3(...end.position).sub(target);
    if (move === 'in' || move === 'out') {
      const f = s.get('keyboard.zoomFactor');
      offset.multiplyScalar(move === 'in' ? 1 / f : f);
    } else if (move === 'turn-left' || move === 'turn-right') {
      if (this.model.mode === '2d' && !s.get('camera.rotateIn2d')) return;
      const a = ((move === 'turn-left' ? -1 : 1) * s.get('keyboard.turnStep') * Math.PI) / 180;
      offset.applyAxisAngle(g.camera.up, a);
    } else {
      // The view's height is twice the distance times the tangent of half the field of view.
      const step = 2 * s.get('keyboard.panStep') * offset.length() * Math.tan(((g.camera.fov / 2) * Math.PI) / 180);
      const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[move];
      // The camera's own right and up directions, so that a pan follows the screen in 3D too.
      const right = new Vector3().setFromMatrixColumn(g.camera.matrix, 0);
      const up = new Vector3().setFromMatrixColumn(g.camera.matrix, 1);
      target.add(right.multiplyScalar(dx * step)).add(up.multiplyScalar(dy * step));
    }
    this.go({ position: target.clone().add(offset).toArray() as V3, target: target.toArray() as V3 }, true);
  }

  get(): Pose | null {
    const g = this.gpu;
    return g ? { position: g.camera.position.toArray() as V3, target: g.controls.target.toArray() as V3 } : null;
  }

  set(position: V3, target: V3) {
    if (!this.gpu) return;
    this.glide = null;
    this.place({ position, target });
  }
}
