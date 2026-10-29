// What a host may call on the canvas (specification 8.15): the commands GraphCanvas exports, which
// GraphView hands out through getCanvas().
import type { Inspected } from '../model/contracts.ts';
import type { V3 } from '../model/picking.ts';
import type { SceneSnapshot } from '../render/scene.ts';

export interface CanvasHandle {
  /** Does what a click at a canvas point does, and says what it hit. */
  clickAt(x: number, y: number, shift?: boolean): Promise<Inspected>;
  /** What lies under a canvas point, without acting on it. */
  pickAt(x: number, y: number): Inspected;
  fit(): void;
  getScene(): SceneSnapshot;
  whenSettled(): Promise<void>;
  getCamera(): { position: V3; target: V3 } | null;
  setCamera(position: V3, target: V3): void;
  /** The picture as it is on screen, with the background or without. */
  picture(background?: boolean): Promise<Blob | null>;
}
