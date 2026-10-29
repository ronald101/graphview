// The camera: 2D and 3D controls, moves over a transition, Fit, the keyboard and saved views
// (specification 6.3, 6.14).
import { MOUSE, TOUCH, Vector3 } from 'three';
import type { GraphModel } from '../model/model.ts';
import type { V3 } from '../model/picking.ts';
import type { Gpu } from './gpu.ts';

const BUTTONS = { pan: MOUSE.PAN, rotate: MOUSE.ROTATE, dolly: MOUSE.DOLLY, none: null } as const;
const ONE = { pan: TOUCH.PAN, rotate: TOUCH.ROTATE, none: null } as const;
const TWO = { 'dolly-pan': TOUCH.DOLLY_PAN, 'dolly-rotate': TOUCH.DOLLY_ROTATE, none: null } as const;

export type Nudge = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'turn-left' | 'turn-right';

export class CameraRig {
  gpu: Gpu | null = null;
  /** A move over the current transition, from one place and target to another. */
  private cam: { from: [V3, V3]; to: [V3, V3] } | null = null;
  private model: GraphModel;

  constructor(model: GraphModel) {
    this.model = model;
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
    const target = g.controls.target.toArray() as V3;
    const pos = g.camera.position.toArray() as V3;
    const dist = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
    const flat: [V3, V3] = [[target[0], target[1], target[2] + dist], target];
    if (animate) this.cam = { from: [pos, target], to: flat };
    else {
      this.cam = { from: flat, to: flat };
      this.move(1);
    }
  }

  /** Moves the camera's centre to a unit over the transition, keeping its direction and distance. */
  centreOn(i: number) {
    const g = this.gpu;
    if (!g) return;
    const m = this.model;
    const target: V3 = [m.positions[2 * i], m.positions[2 * i + 1], 0];
    const t0 = g.controls.target.toArray() as V3;
    const c0 = this.cam ? this.cam.to[0] : (g.camera.position.toArray() as V3);
    const tFrom = this.cam ? this.cam.to[1] : t0;
    const to: V3 = [c0[0] + target[0] - tFrom[0], c0[1] + target[1] - tFrom[1], c0[2] - tFrom[2]];
    this.cam = { from: [g.camera.position.toArray() as V3, t0], to: [to, target] };
  }

  /** Places the camera at a point e (0 to 1, eased) of the current move. */
  move(e: number) {
    const g = this.gpu;
    const cam = this.cam;
    if (!g || !cam) return;
    const mix = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
    g.camera.position.set(...mix(cam.from[0], cam.to[0]));
    g.controls.target.set(...mix(cam.from[1], cam.to[1]));
    g.controls.update();
    if (e >= 1) this.cam = null;
  }

  /** Shows the whole graph from straight above. */
  fit() {
    const g = this.gpu;
    if (!g) return;
    this.cam = null;
    const s = this.model.settings;
    // The vertical field of view is fixed; a canvas narrower than tall needs more distance for the width.
    const half = Math.tan(((g.camera.fov / 2) * Math.PI) / 180);
    const d = ((this.model.extent / 2 / half) * s.get('camera.fitMargin')) / Math.min(1, g.camera.aspect);
    g.controls.target.set(0, 0, 0);
    g.camera.position.set(0, 0, d);
    g.camera.near = s.get('camera.near');
    g.camera.far = d * s.get('camera.farPerFit');
    g.camera.updateProjectionMatrix();
    g.controls.update();
    g.request();
  }

  /**
   * Moves the camera by keyboard: a pan by a share of the view, a zoom by a factor, or in 3D a turn
   * around the camera's up axis, as the settings of the group "Keyboard" say. 2D does not turn, as
   * with the mouse.
   */
  nudge(move: Nudge) {
    const g = this.gpu;
    if (!g) return;
    this.cam = null;
    const s = this.model.settings;
    const pos = g.camera.position;
    const target = g.controls.target;
    const offset = pos.clone().sub(target);
    if (move === 'in' || move === 'out') {
      const f = s.get('keyboard.zoomFactor');
      pos.copy(target).add(offset.multiplyScalar(move === 'in' ? 1 / f : f));
    } else if (move === 'turn-left' || move === 'turn-right') {
      if (this.model.mode === '2d' && !s.get('camera.rotateIn2d')) return;
      const a = ((move === 'turn-left' ? -1 : 1) * s.get('keyboard.turnStep') * Math.PI) / 180;
      pos.copy(target).add(offset.applyAxisAngle(g.camera.up, a));
    } else {
      // The view's height is twice the distance times the tangent of half the field of view.
      const step = 2 * s.get('keyboard.panStep') * offset.length() * Math.tan(((g.camera.fov / 2) * Math.PI) / 180);
      const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[move];
      // The camera's own right and up directions, so that a pan follows the screen in 3D too.
      const right = new Vector3().setFromMatrixColumn(g.camera.matrix, 0);
      const up = new Vector3().setFromMatrixColumn(g.camera.matrix, 1);
      const shift = right.multiplyScalar(dx * step).add(up.multiplyScalar(dy * step));
      pos.add(shift);
      target.add(shift);
    }
    g.controls.update();
    g.request();
  }

  get(): { position: V3; target: V3 } | null {
    const g = this.gpu;
    return g ? { position: g.camera.position.toArray() as V3, target: g.controls.target.toArray() as V3 } : null;
  }

  set(position: V3, target: V3) {
    const g = this.gpu;
    if (!g) return;
    this.cam = null;
    g.camera.position.set(...position);
    g.controls.target.set(...target);
    g.controls.update();
    g.request();
  }
}
