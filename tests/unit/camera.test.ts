// The camera's moves (specification 6.10 and 6.14): the pose between two others, as Fit, the keys and a
// new root ease from one to the next.
import { describe, expect, test } from 'vitest';
import { mixPose, type Pose } from '../../module/render/camera.ts';

const distance = (p: Pose) => Math.hypot(...p.position.map((x, i) => x - p.target[i]));
const near = (a: number[], b: number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 6));

describe('§6.10 Transitions: the camera eases from one place to the next', () => {
  test('a move starts at its first pose and ends at its last', () => {
    const a: Pose = { position: [10, 20, 500], target: [10, 20, 0] };
    const b: Pose = { position: [300, -40, 80], target: [200, 0, 0] };
    expect(mixPose(a, b, 0)).toEqual(a);
    expect(mixPose(a, b, 1)).toEqual(b);
  });

  test('a pan keeps the direction and the distance to the target', () => {
    const a: Pose = { position: [0, 0, 100], target: [0, 0, 0] };
    const b: Pose = { position: [50, 20, 100], target: [50, 20, 0] };
    const half = mixPose(a, b, 0.5);
    near(half.target, [25, 10, 0]);
    near(half.position, [25, 10, 100]);
  });

  test('a zoom runs by equal factors: halfway it stands at the mean of the two distances by ratio', () => {
    const a: Pose = { position: [0, 0, 800], target: [0, 0, 0] };
    const b: Pose = { position: [0, 0, 100], target: [0, 0, 0] };
    expect(distance(mixPose(a, b, 0.5))).toBeCloseTo(Math.sqrt(800 * 100), 6);
    // Each quarter of the way changes the distance by the same factor.
    const d = [0, 0.25, 0.5, 0.75, 1].map((e) => distance(mixPose(a, b, e)));
    for (let i = 1; i + 1 < d.length; i++) expect(d[i + 1] / d[i]).toBeCloseTo(d[i] / d[i - 1], 6);
  });

  test('a turn follows the arc around the target and does not cut through the graph', () => {
    const a: Pose = { position: [100, 0, 0], target: [0, 0, 0] };
    const b: Pose = { position: [0, 0, 100], target: [0, 0, 0] };
    const half = mixPose(a, b, 0.5);
    expect(distance(half)).toBeCloseTo(100, 6);
    near(half.position, [Math.SQRT1_2 * 100, 0, Math.SQRT1_2 * 100]);
  });

  test('poses on opposite sides of the target have no shortest arc: the straight line serves', () => {
    const a: Pose = { position: [0, 0, 100], target: [0, 0, 0] };
    const b: Pose = { position: [0, 0, -100], target: [0, 0, 0] };
    near(mixPose(a, b, 0.25).position, [0, 0, 50]);
  });
});
