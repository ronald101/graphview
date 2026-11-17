// Gate G9, layouts: the same graph, settings and seed give the same positions.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
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

describe('§6.1 Layout: a newer graph gives up the layout before it', () => {
  /** A stand-in for a Web Worker: it keeps what it was sent, and answers when the test says so. */
  class Stand {
    static made: Stand[] = [];
    posted: { id: number }[] = [];
    ended = false;
    private listeners: ((e: { data: unknown }) => void)[] = [];
    constructor() {
      Stand.made.push(this);
    }
    addEventListener(_: string, fn: (e: { data: unknown }) => void) {
      this.listeners.push(fn);
    }
    postMessage(m: { id: number }) {
      this.posted.push(m);
    }
    terminate() {
      this.ended = true;
    }
    answer(n: number, out: unknown) {
      for (const fn of this.listeners) fn({ data: { id: this.posted[n].id, out } });
    }
  }
  afterEach(() => vi.unstubAllGlobals());

  test('its layout resolves to nothing and its worker ends, so that the next layout starts at once', async () => {
    vi.stubGlobal('Worker', Stand);
    vi.resetModules();
    const { runForce, cancelForce } = await import('../../module/workers/index.ts');
    const input = { units: ['1'], links: [], start: [{ x: 0, y: 0 }], pinned: [], settings: {} };
    const [mine, theirs] = [{}, {}];
    const first = runForce(input, false, mine);
    expect(Stand.made).toHaveLength(1);
    cancelForce(mine);
    expect(await first).toBeNull();
    expect(Stand.made[0].ended).toBe(true);
    // The next layout runs on a new worker, and resolves with its answer.
    const second = runForce(input, false, mine);
    expect(Stand.made).toHaveLength(2);
    const worker = Stand.made[1];
    const out = { positions: [{ x: 1, y: 2 }], iterations: 25 };
    worker.answer(0, out);
    expect(await second).toEqual(out);
    // While someone else waits for a layout, the worker goes on, and only the layout given up ends.
    const third = runForce(input, false, mine);
    const other = runForce(input, false, theirs);
    cancelForce(mine);
    expect(await third).toBeNull();
    expect(worker.ended).toBe(false);
    worker.answer(1, out);
    worker.answer(2, out);
    expect(await other).toEqual(out);
    // Giving up with nothing owed changes nothing.
    cancelForce(mine);
    expect(worker.ended).toBe(false);
  });

  test('a model that loads another graph gives the first one up: only the newer load reports true', async () => {
    const doc = (n: number) => ({
      format: 'graphview-graph/1',
      vertices: Array.from({ length: n }, (_, i) => ({ key: i + 1 })),
      edges: Array.from({ length: n - 1 }, (_, i) => [
        { from: i + 1, to: i + 2 },
        { from: i + 2, to: i + 1 },
      ]).flat(),
    });
    const m = new GraphModel();
    const [first, second] = await Promise.all([m.load(doc(40)), m.load(doc(5))]);
    expect([first, second]).toEqual([false, true]);
    expect(m.graph?.units).toHaveLength(5);
    expect(m.laidOut).toBe(true);
  });
});
