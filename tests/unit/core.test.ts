// Unit tests for the core: cases the gate tests do not cover.
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import * as core from '../../module/core/index.ts';
import { sha256Hex, utf8 } from '../../module/core/sha256.ts';

const MAX = 2 ** 53 - 1;
const doc = (vertices: unknown[], edges: unknown[] = [], meta?: unknown) => ({
  format: 'graphview-graph/1',
  ...(meta === undefined ? {} : { meta }),
  vertices,
  edges,
});
const load = (d: unknown) => {
  const r = core.loadGraph(d);
  if (!r.ok) throw new Error(`refused: ${r.code}`);
  return r;
};
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../fixtures/graphs/${name}.json`, import.meta.url), 'utf8'));

describe('§2.3 and §3.2 Keys', () => {
  test('keys at the integer limits are accepted, one beyond is a bad key', () => {
    const r = load(doc([{ key: MAX }, { key: -MAX }, { key: MAX + 1 }, { key: -(MAX + 1) }]));
    expect(r.graph.units).toEqual([MAX, -MAX]);
    expect(r.issues.slice(0, 2)).toEqual([
      { code: 'bad-key', list: 'vertices', row: 2 },
      { code: 'bad-key', list: 'vertices', row: 3 },
    ]);
  });
  test('fractions, booleans, null, objects and the empty text are bad keys', () => {
    const r = load(doc([{ key: 1.5 }, { key: true }, { key: null }, { key: {} }, { key: '' }, { key: [1] }]));
    expect(r.graph.units).toEqual([]);
    expect(r.issues.filter((i) => i.code === 'bad-key').length).toBe(6);
  });
  test('a lone surrogate is a bad key, a surrogate pair is fine', () => {
    const r = load(doc([{ key: '\uD83D' }, { key: 'a\uDE00' }, { key: '😀' }]));
    expect(r.graph.units).toEqual(['😀']);
  });
  test('the number 1 and the text "1" are different units; −0 is the unit 0', () => {
    const r = load(doc([{ key: 1 }, { key: '1' }, { key: -0 }, { key: 0 }]));
    expect(r.graph.units.length).toBe(3);
    expect(Object.is(r.graph.units[2], 0)).toBe(true);
    expect(r.issues[0]).toEqual({ code: 'repeated-key', list: 'vertices', row: 3, key: 0 });
  });
  test('a row without key is a bad row, a key of null is a bad key', () => {
    const r = load(doc([{ label: 'x' }, { key: null }, 7]));
    expect(r.issues.slice(0, 3)).toEqual([
      { code: 'bad-row', list: 'vertices', row: 0 },
      { code: 'bad-key', list: 'vertices', row: 1 },
      { code: 'bad-row', list: 'vertices', row: 2 },
    ]);
  });
});

describe('§3.3 Refusals', () => {
  test('arrays, null and texts are not objects', () => {
    for (const d of [[], null, 'x', 3]) expect((core.loadGraph(d) as { code: string }).code).toBe('not-object');
  });
  test('format, vertices and edges are checked in that order', () => {
    expect((core.loadGraph({ format: 'graphview-graph/2' }) as { code: string }).code).toBe('format');
    expect((core.loadGraph({ format: 'graphview-graph/1', vertices: {} }) as { code: string }).code).toBe('vertices');
    expect((core.loadGraph({ format: 'graphview-graph/1', vertices: [] }) as { code: string }).code).toBe('edges');
  });
});

describe('§3.4 Fingerprint', () => {
  test('SHA-256 matches the standard test vectors', () => {
    expect(sha256Hex(utf8(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex(utf8('a'.repeat(1000)))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });
  test('the pair example gives the fingerprint of §3.1', () => {
    const r = load(
      doc(
        [{ key: 1 }, { key: 2 }],
        [
          { from: 1, to: 2 },
          { from: 2, to: 1 },
        ],
      ),
    );
    expect(core.fingerprint(r.graph)).toBe('sha256:96a576fab450b52c4c183d8ea58a5b1706722dca0e30502bb975e6e31189d9e0');
  });
  test('code-point order puts U+1F600 after U+FB00', () => {
    expect(core.compareCodePoints('😀', 'ﬀ')).toBeGreaterThan(0);
    expect(core.compareCodePoints('a', 'ab')).toBeLessThan(0);
  });
  test('labels, attributes, positions and row order do not change the fingerprint', () => {
    const a = load(
      doc(
        [{ key: 1 }, { key: 2 }],
        [
          { from: 1, to: 2 },
          { from: 2, to: 1 },
        ],
      ),
    );
    const b = load(
      doc(
        [
          { key: 2, label: 'b', pos: { x: 1, y: 2 } },
          { key: 1, attrs: { z: 1 } },
        ],
        [
          { from: 2, to: 1, attrs: { t: 'x' } },
          { from: 1, to: 2 },
        ],
      ),
    );
    expect(core.fingerprint(a.graph)).toBe(core.fingerprint(b.graph));
  });
  test('a stated fingerprint that is not a text is ignored', () => {
    expect(load(doc([{ key: 1 }], [], { fingerprint: 5 })).issues).toEqual([{ code: 'orphan', key: 1 }]);
  });
});

describe('§4.5 Path sets', () => {
  const complete = (n: number) => {
    const edges = [];
    for (let a = 1; a <= n; a++) for (let b = 1; b <= n; b++) if (a !== b) edges.push({ from: a, to: b });
    return load(
      doc(
        Array.from({ length: n }, (_, i) => ({ key: i + 1 })),
        edges,
      ),
    ).graph;
  };
  test('the time limit stops counting and marks the length "at least"', () => {
    const r = core.pathSet(complete(12), 1, 2, 10, { count: 1e12, timeMs: 20 });
    expect(r.stopped).toBe(true);
    expect(r.stoppedBy).toBe('time');
    expect(r.lengths[r.lengths.length - 1].exact).toBe(false);
  });
  test('extra steps are held between 0 and 20', () => {
    const g = load(fixture('path-4')).graph;
    expect(core.pathSet(g, 1, 2, 99).extra).toBe(20);
    expect(core.pathSet(g, 1, 2, -3).lengths.length).toBe(1);
  });
  test('a unit that is not in the graph is unreachable', () => {
    const r = core.pathSet(load(fixture('pair')).graph, 1, 'nowhere', 2);
    expect(r.reason).toBe('unreachable');
    expect(r.shortest).toBe(null);
  });
  test('the list limit keeps the first paths only, and the count stays exact', () => {
    const r = core.pathSet(complete(6), 1, 2, 2, { list: 3 });
    expect(r.lengths.map((l) => l.count)).toEqual([1, 4, 12]);
    expect(r.lengths[2].paths.length).toBe(3);
  });
});

describe('§3.5 and §4 Aids', () => {
  test('rings around a unit that is not in the graph put every unit beyond', () => {
    const g = load(fixture('pair')).graph;
    expect(core.rings(g, 9)).toEqual({ rings: [], beyond: [1, 2] });
  });
  test('the current graph drops keypairs that touch a superseded unit', () => {
    const r = load(
      doc(
        [{ key: 1 }, { key: 2, superseded: true }, { key: 3 }],
        [
          { from: 1, to: 2 },
          { from: 2, to: 1 },
          { from: 1, to: 3, superseded: true },
          { from: 3, to: 1 },
        ],
      ),
    );
    const cur = core.currentGraph(r.graph);
    expect(cur.units).toEqual([1, 3]);
    expect(cur.keypairs).toEqual([[3, 1]]);
    expect(core.relationCount(cur)).toBe(0);
  });
  test('each keypair keeps its own attributes', () => {
    const g = load(fixture('database-2026-07-24')).graph;
    expect(g.keypairInfo.get(core.keypairId(76, 80))?.attrs?.type).toBe('rel_cd');
    expect(g.keypairInfo.get(core.keypairId(80, 76))?.attrs?.type).toBe('rel_dc');
  });
});
