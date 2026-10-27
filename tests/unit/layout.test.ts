// Gate G9, layouts: the same graph, settings and seed give the same positions.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { keyId, loadGraph } from '../../module/core/index.ts';
import { givenLayout, startPositions } from '../../module/model/layout.ts';
import { GraphModel } from '../../module/model/model.ts';
import { forceLayout } from '../../module/workers/force.ts';

const graph = (name: string) => {
  const r = loadGraph(JSON.parse(readFileSync(new URL(`../../fixtures/graphs/${name}.json`, import.meta.url), 'utf8')));
  if (!r.ok) throw new Error('refused');
  return r.graph;
};

function force(name: string, seed: number) {
  const g = graph(name);
  const ids = g.units.map(keyId);
  const index = new Map(ids.map((id, i) => [id, i]));
  const start = startPositions(g.units, seed);
  return forceLayout({
    units: ids,
    links: g.keypairs.map(([a, b]) => [index.get(keyId(a))!, index.get(keyId(b))!] as [number, number]),
    start: ids.map((id) => start.get(id)!),
    pinned: [],
    settings: {},
  });
}

describe('§6.1 Layout (G9): layouts are deterministic', () => {
  test('G9 force: the same seed gives the same positions, another seed others', () => {
    const a = force('database-2026-07-24', 1);
    const b = force('database-2026-07-24', 1);
    const c = force('database-2026-07-24', 2);
    expect(b.positions).toEqual(a.positions);
    expect(c.positions).not.toEqual(a.positions);
    expect(a.positions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  test('G9 force: a pinned unit does not move', () => {
    const g = graph('petersen');
    const ids = g.units.map(keyId);
    const index = new Map(ids.map((id, i) => [id, i]));
    const start = startPositions(g.units, 3);
    const out = forceLayout({
      units: ids,
      links: g.keypairs.map(([a, b]) => [index.get(keyId(a))!, index.get(keyId(b))!] as [number, number]),
      start: ids.map((id) => start.get(id)!),
      pinned: [4],
      settings: {},
    });
    expect(out.positions[4]).toEqual(start.get(ids[4]));
  });

  test('G9 given positions and starting positions are the same twice', () => {
    const grid = graph('grid-3x3');
    expect([...givenLayout(grid).values()]).toEqual(grid.units.map((k) => grid.unitInfo.get(keyId(k))!.pos));
    const g = graph('database-2026-07-24');
    expect([...startPositions(g.units, 1)]).toEqual([...startPositions(g.units, 1)]);
    expect([...startPositions(g.units, 2)]).not.toEqual([...startPositions(g.units, 1)]);
  });

  test('given positions count only when every unit has one; otherwise the force layout runs', async () => {
    const doc = (placed: number[]) => ({
      format: 'graphview-graph/1',
      vertices: [1, 2, 3].map((key) => ({ key, ...(placed.includes(key) ? { pos: { x: 100 * key, y: 0 } } : {}) })),
      edges: [
        [1, 2],
        [2, 1],
        [2, 3],
        [3, 2],
      ].map(([from, to]) => ({ from, to })),
    });
    const load = async (placed: number[]) => {
      const m = new GraphModel();
      expect(await m.load(doc(placed))).toBe(true);
      return [...m.positions];
    };
    // Every unit placed: the row stays a row, in key order.
    const [x1, y1, x2, y2, x3, y3] = await load([1, 2, 3]);
    expect([y1, y2, y3].every((y) => Math.abs(y) < 1e-9)).toBe(true);
    expect(x1 < x2 && x2 < x3).toBe(true);
    // Some units placed: their positions are not used, as if none were.
    expect(await load([1, 2])).toEqual(await load([]));
  });
});
