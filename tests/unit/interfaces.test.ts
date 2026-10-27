// Interface graphs: the kind field, the model's kinds, ends and checks, the halves' colours, the
// unit shapes, the generator's transform and its share links (specification 3.8, 6.17, 8.16).
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { fingerprint, keyId, loadGraph, type Key } from '../../module/core/index.ts';
import { findKinds } from '../../module/model/kinds.ts';
import { GraphModel } from '../../module/model/model.ts';
import { consolidate } from '../../module/model/topology.ts';
import { OTHER } from '../../module/model/typeRegistry.ts';
import { halvesOf } from '../../module/render/looks.ts';
import { shapeSlot, shapesGlsl } from '../../module/render/shapes.ts';
import { issueWords } from '../../module/view/words.ts';
import { graphWorker } from '../../module/workers/index.ts';
import { throughInterfaces } from '../../shell/lib/interfaces.ts';
import { makeLink, readLink } from '../../shell/lib/share.ts';
import { NO_BREAKS } from '../../shell/lib/breakRules.ts';

const FORMAT = 'graphview-graph/1';
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../shell/examples/${name}.json`, import.meta.url), 'utf8'));

/** Every keypair both ways: rows for the relations a–b. */
const both = (pairs: [Key, Key][]) =>
  pairs.flatMap(([a, b]) => [
    { from: a, to: b },
    { from: b, to: a },
  ]);

function kindsOf(doc: unknown) {
  const loaded = loadGraph(doc);
  if (!loaded.ok) throw new Error('refused');
  const g = loaded.graph;
  const index = new Map(g.units.map((k, i) => [keyId(k), i]));
  return { g, kinds: findKinds(g, consolidate(g, index).relations) };
}

async function modelOf(doc: unknown) {
  const m = new GraphModel(graphWorker);
  await m.load(doc);
  return m;
}

describe('§3.8 Kinds of unit', () => {
  test('a row with "interface": true is an interface; anything else is plain, and the fingerprint ignores it', () => {
    const rows = [{ key: 1 }, { key: 2, interface: true }, { key: 3, interface: 'yes' }, { key: 4, interface: false }];
    const doc = {
      format: FORMAT,
      vertices: rows,
      edges: both([
        [1, 2],
        [2, 3],
        [3, 4],
      ]),
    };
    const { g, kinds } = kindsOf(doc);
    expect(g.units.map((k) => g.unitInfo.get(keyId(k))?.interface ?? false)).toEqual([false, true, false, false]);
    expect(kinds.of).toEqual(['plain', 'interface', 'plain', 'plain']);
    const plain = { ...doc, vertices: rows.map(({ key }) => ({ key })) };
    expect(fingerprint(kindsOf(doc).g)).toBe(fingerprint(kindsOf(plain).g));
  });

  test('the fully interfaced example: three interfaces, each joining two plain units, no issues', () => {
    const { g, kinds } = kindsOf(example('interfaces-full'));
    expect(kinds.of).toEqual(['plain', 'plain', 'plain', 'interface', 'interface', 'interface']);
    const ends = [...kinds.ends].map(([i, e]) => [g.units[i], e.map((j) => g.units[j])]);
    expect(ends).toEqual([
      [10, [1, 2]],
      [11, [2, 3]],
      [12, [1, 3]],
    ]);
    expect(kinds.issues).toEqual([]);
  });

  test('the partly interfaced example: one interface, direct relations raise no issue', () => {
    const { g, kinds } = kindsOf(example('interfaces-partial'));
    expect(kinds.of.filter((k) => k === 'interface')).toHaveLength(1);
    expect([...kinds.ends].map(([i, e]) => [g.units[i], e.map((j) => g.units[j])])).toEqual([[10, [1, 2]]]);
    expect(kinds.issues).toEqual([]);
  });

  test('the broken example: ends other than two, then interfaces related directly', async () => {
    const m = await modelOf(example('broken-interfaces'));
    expect(m.issues).toEqual([
      { code: 'interface-ends', key: 10, ends: 3 },
      { code: 'interface-ends', key: 11, ends: 1 },
      { code: 'interface-pair', keypair: [12, 13] },
    ]);
    expect(m.issues.map((i) => issueWords(i, (k) => m.label(k)))).toEqual([
      'The interface i joins 3 units, not 2.',
      'The interface j joins 1 unit, not 2.',
      'The interfaces k and l are related directly; an interface joins two plain units.',
    ]);
    expect(m.kindOf(10)).toBe('interface');
    expect(m.kindOf(1)).toBe('plain');
    expect(m.endsOf(10)).toEqual([1, 2, 3]);
    expect(m.endsOf(1)).toBeNull();
  });

  test("the core's issues come first; a lone interface is an orphan and joins no units", async () => {
    const doc = {
      format: FORMAT,
      vertices: [{ key: 1 }, { key: 2 }, { key: 'x', interface: true }],
      edges: both([[1, 2]]),
    };
    const m = await modelOf(doc);
    expect(m.issues).toEqual([
      { code: 'orphan', key: 'x' },
      { code: 'interface-ends', key: 'x', ends: 0 },
    ]);
    expect(issueWords(m.issues[1], (k) => m.label(k))).toBe('The interface "x" joins no units, not 2.');
  });
});

describe('§6.17 Interfaces in the picture', () => {
  test('each half takes the colour of an end: two ends, one end, none, and an end that is an interface', async () => {
    const m = await modelOf(example('broken-interfaces'));
    const halves = halvesOf(m);
    const slot = (k: Key) => m.types.unitSlot[m.index.get(keyId(k))!];
    const of = (k: Key) => {
      const i = m.index.get(keyId(k))!;
      return [halves[2 * i], halves[2 * i + 1]];
    };
    expect(of(1)).toEqual([slot(1), slot(1)]);
    expect(of(10)).toEqual([OTHER, OTHER]);
    expect(of(11)).toEqual([slot(4), slot(4)]);
    expect(of(12)).toEqual([slot(1), OTHER]);
    expect(of(13)).toEqual([OTHER, slot(4)]);
    const full = await modelOf(example('interfaces-full'));
    const h = halvesOf(full);
    const i = full.index.get(keyId(10))!;
    expect([h[2 * i], h[2 * i + 1]]).toEqual([full.types.unitSlot[0], full.types.unitSlot[1]]);
  });

  test('the unit shader holds every shape; an unknown shape draws as the disc', () => {
    expect(shapeSlot('disc')).toBe(0);
    expect(shapeSlot('divided')).toBe(1);
    expect(shapeSlot('no such shape')).toBe(0);
    const glsl = shapesGlsl();
    expect(glsl).toContain('if (shape < 0.5)');
    expect(glsl).toContain('if (shape < 1.5)');
    expect(glsl).toContain('vSplit');
  });
});

describe('§8.16 Relations through interfaces', () => {
  const triangle = () => ({
    format: FORMAT,
    meta: { name: 'Triangle' },
    vertices: [
      { key: 1, pos: { x: 0, y: 0 } },
      { key: 2, pos: { x: 200, y: 0 } },
      { key: 'i1', pos: { x: 100, y: 100 } },
    ],
    edges: [
      { from: 1, to: 2, attrs: { type: 'rel_ab', weight: 0.5 } },
      { from: 2, to: 1, attrs: { type: 'rel_ba' } },
      ...both([[2, 'i1']]),
      { from: 'i1', to: 1, superseded: true },
      { from: 1, to: 'i1', superseded: true },
    ],
  });

  test('share 0 leaves the document as it is', () => {
    const doc = triangle();
    expect(throughInterfaces(doc, 0, 1)).toBe(doc);
  });

  test("share 1 puts every relation through a fresh interface, with the rows' fields, halfway between its units", () => {
    const out = throughInterfaces(triangle(), 1, 1) as ReturnType<typeof triangle>;
    // The text key i1 exists, so the interfaces take i2, i3 and i4.
    expect(out.vertices.slice(3)).toEqual([
      { key: 'i2', label: 'i2', interface: true, pos: { x: 100, y: 0 } },
      { key: 'i3', label: 'i3', interface: true, pos: { x: 150, y: 50 } },
      { key: 'i4', label: 'i4', interface: true, pos: { x: 50, y: 50 }, superseded: true },
    ]);
    expect(out.edges.slice(0, 4)).toEqual([
      { from: 1, to: 'i2', attrs: { type: 'rel_ab', weight: 0.5 } },
      { from: 'i2', to: 2, attrs: { type: 'rel_ab', weight: 0.5 } },
      { from: 2, to: 'i2', attrs: { type: 'rel_ba' } },
      { from: 'i2', to: 1, attrs: { type: 'rel_ba' } },
    ]);
    expect(out.edges).toHaveLength(12);
    const { kinds } = kindsOf(out);
    expect(kinds.of.filter((k) => k === 'interface')).toHaveLength(3);
    expect([...kinds.ends.values()].every((e) => e.length === 2)).toBe(true);
    expect(kinds.issues).toEqual([]);
  });

  test('a share between 0 and 1 takes some relations, the same ones for the same seed', () => {
    const grid = {
      format: FORMAT,
      vertices: Array.from({ length: 30 }, (_, i) => ({ key: i + 1 })),
      edges: both(Array.from({ length: 29 }, (_, i) => [i + 1, i + 2] as [Key, Key])),
    };
    const count = (d: unknown) => (d as { vertices: unknown[] }).vertices.length - 30;
    const half = throughInterfaces(grid, 0.5, 4);
    expect(count(half)).toBeGreaterThan(5);
    expect(count(half)).toBeLessThan(24);
    expect(throughInterfaces(grid, 0.5, 4)).toEqual(half);
    expect(count(throughInterfaces(grid, 1, 4))).toBe(29);
    expect(throughInterfaces(grid, 0.5, 5)).not.toEqual(half);
  });

  test('rows that are not edges stay as they are, in their places', () => {
    const doc = {
      format: FORMAT,
      vertices: [{ key: 1 }, { key: 2 }],
      edges: [7, ...both([[1, 2]]), { from: 1, to: 1 }],
    };
    const out = throughInterfaces(doc, 1, 1) as { edges: unknown[] };
    expect(out.edges[0]).toBe(7);
    expect(out.edges.at(-1)).toEqual({ from: 1, to: 1 });
    expect(out.edges).toHaveLength(6);
  });
});

describe('§8.13 Share links with interfaces', () => {
  const base = 'https://example.test/graphview/';
  const view = { mode: '2d' as const, root: null, target: null, path: null };

  test('the share travels with an example and a generated graph, and reads back', () => {
    const ex = { kind: 'example' as const, id: 'sample', decorate: null, interfaces: 0.5 };
    expect(readLink(new URL(makeLink(base, ex, view)).search).source).toEqual(ex);
    const gen = {
      kind: 'generated' as const,
      family: 'cycle' as const,
      params: { n: 6 },
      seed: 2,
      breaks: NO_BREAKS,
      decorate: null,
      interfaces: 1,
    };
    expect(readLink(new URL(makeLink(base, gen, view)).search).source).toEqual(gen);
  });

  test('a share outside 0 to 1, or not a number, is not read', () => {
    for (const bad of ['1.5', '-0.1', 'x']) {
      expect(readLink(`?example=sample&interfaces=${bad}&mode=2d`).error).toBe(
        'The graph in the link could not be read.',
      );
    }
    expect(readLink('?example=sample&interfaces=0&mode=2d').source).toEqual({
      kind: 'example',
      id: 'sample',
      decorate: null,
    });
  });
});
