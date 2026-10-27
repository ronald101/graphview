// The instanced attributes of the three draws, and the geometry each instance repeats.
import * as THREE from 'three';

/** A unit's ends are an interface's two ends; other units leave them at zero. */
export interface UnitBuffers extends EndBuffers {
  posPrev: Float32Array;
  posNext: Float32Array;
  currentDegree: Float32Array;
  isOnActivePath: Float32Array;
  filterState: Float32Array;
  /** The palette slots of the unit's two halves (looks.ts). */
  halves: Float32Array;
  /** Marked with an outline (0 or 1); fade (1, or less when superseded); the slot of its shape (shapes.ts); unused. */
  look: Float32Array;
}

/** The look attribute's parts. */
export const LOOK = { marked: 0, fade: 1, shape: 2 } as const;

export interface EndBuffers {
  aPrevA: Float32Array;
  aNextA: Float32Array;
  aPrevB: Float32Array;
  aNextB: Float32Array;
  aStateA: Float32Array;
  aStateB: Float32Array;
}

export interface LineBuffers extends EndBuffers {
  /** Shown before and after; above the threshold before and after. */
  aLine: Float32Array;
  /** Strength before and after; on the path before and after. */
  aLine2: Float32Array;
  /** Opacity factor (1, or less for superseded parts); missing keypair (0 none, 1 (a, b), 2 (b, a)). */
  aStatic: Float32Array;
}

export interface ChevronBuffers extends EndBuffers {
  /** Place along the line, direction (1 or -1), palette slot, fade. */
  aChev: Float32Array;
  /** Flow before and after; shown before and after. */
  aChevState: Float32Array;
  /** Above the threshold before and after. */
  aAbove: Float32Array;
}

export const SIZES: Record<string, number> = {
  posPrev: 3,
  posNext: 3,
  currentDegree: 2,
  isOnActivePath: 2,
  filterState: 2,
  halves: 2,
  look: 4,
  aPrevA: 3,
  aNextA: 3,
  aPrevB: 3,
  aNextB: 3,
  aStateA: 4,
  aStateB: 4,
  aLine: 4,
  aLine2: 4,
  aStatic: 2,
  aChev: 4,
  aChevState: 4,
  aAbove: 2,
};

export function instanced(base: THREE.BufferGeometry, count: number, data: object): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.getAttribute('position'));
  for (const [name, arr] of Object.entries(data) as [string, Float32Array][]) {
    const a = new THREE.InstancedBufferAttribute(arr, SIZES[name]);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(name, a);
  }
  g.instanceCount = count;
  // The shaders move everything; a fixed, generous bound keeps three.js from culling.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  return g;
}

/** A quad strip from t = 0 to 1 along a line, y = −1 to 1 across it. */
export function lineQuad(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
