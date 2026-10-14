// Gate G9, layouts: the same graph, settings and seed give the same positions.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { keyId, loadGraph } from '../../module/core/index.ts';
import { circleLayout, givenLayout, gridLayout, ringLayout, startPositions } from '../../module/ui/layouts.ts';
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

describe('G9 layouts are deterministic', () => {
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

  test('G9 rings, circle, grid and given positions are the same twice', () => {
    const g = graph('database-2026-07-24');
    expect([...ringLayout(g, 1).positions]).toEqual([...ringLayout(g, 1).positions]);
    expect([...circleLayout(g.units)]).toEqual([...circleLayout(g.units)]);
    expect([...gridLayout(g.units)]).toEqual([...gridLayout(g.units)]);
    expect([...givenLayout(g, new Map(), 1)]).toEqual([...givenLayout(g, new Map(), 1)]);
  });

  test('G9 given positions: a unit without a position gets a seeded offset near its neighbours', () => {
    const r = loadGraph({
      format: 'graphview-graph/1',
      vertices: [{ key: 1, pos: { x: 0, y: 0 } }, { key: 2, pos: { x: 100, y: 0 } }, { key: 3 }],
      edges: [
        { from: 1, to: 2 },
        { from: 2, to: 1 },
        { from: 2, to: 3 },
        { from: 3, to: 2 },
      ],
    });
    if (!r.ok) throw new Error('refused');
    const a = givenLayout(r.graph, new Map(), 1);
    expect([...givenLayout(r.graph, new Map(), 1)]).toEqual([...a]);
    expect(givenLayout(r.graph, new Map(), 2).get('3')).not.toEqual(a.get('3'));
    const p = a.get('3')!;
    expect(Math.hypot(p.x - 100, p.y)).toBeLessThan(40);
  });
});
