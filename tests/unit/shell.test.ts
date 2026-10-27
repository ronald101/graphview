// The shell's libraries (specification section 8): types, weights and times for generated graphs,
// the explanations of the Generate section, the examples, share links and the importer.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { keyId, keypairId, loadGraph } from '../../module/core/index.ts';
import { pairTypes } from '../../module/model/typeRegistry.ts';
import { exampleId, SAMPLE_ID, SAMPLE_SOURCE } from '../../shell/lib/sample.ts';
import { NO_BREAKS } from '../../shell/lib/breakRules.ts';
import { decorate, DECORATE_DEFAULTS, relationTypeNames } from '../../shell/lib/decorate.ts';
import { explainBreaks, explainDecoration, explainExample, explainFamily } from '../../shell/lib/explain.ts';
import { FAMILIES, generate, paramLabel, type Family } from '../../shell/lib/generate.ts';
import { importDoc } from '../../shell/lib/importer.ts';
import { makeLink, readLink } from '../../shell/lib/share.ts';
import { leaks, PRIVATE_TERMS, termList } from './privateWords.ts';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../fixtures/graphs/${name}.json`, import.meta.url), 'utf8'));
type Row = { key?: number; from?: number; to?: number; attrs?: Record<string, unknown> };

describe('§8.7 Types, weights and times', () => {
  const g = generate('small-world', { n: 30, k: 4, beta: 0.1 }, 1).doc;
  const options = {
    unitTypes: 3,
    relationTypes: 2,
    weights: [0.25, 0.5] as [number, number],
    times: [Date.UTC(2026, 2, 1), Date.UTC(2026, 2, 31)] as [number, number],
  };

  test('the same graph, options and seed give the same result; another seed another', () => {
    expect(decorate(g, 1, options)).toEqual(decorate(g, 1, options));
    expect(decorate(g, 2, options)).not.toEqual(decorate(g, 1, options));
  });

  test('units get type_1 to type_n; weights and dates fall inside their ranges', () => {
    const d = decorate(g, 1, options);
    const born = new Map(d.vertices.map((v) => [v.key, Date.parse(String(v.attrs!.created))]));
    for (const v of d.vertices) {
      expect(['type_1', 'type_2', 'type_3']).toContain(v.attrs!.type);
      expect(born.get(v.key)! >= options.times[0] && born.get(v.key)! <= options.times[1]).toBe(true);
    }
    for (const e of d.edges) {
      const w = e.attrs!.weight as number;
      expect(w >= 0.25 && w <= 0.5).toBe(true);
      const t = Date.parse(String(e.attrs!.created));
      expect(t >= born.get(e.from)! && t >= born.get(e.to)! && t <= options.times[1]).toBe(true);
    }
  });

  test('a relation type is a complementary pair: a keypair and its reverse carry rel_ab and rel_ba', () => {
    const d = decorate(g, 1, options);
    const typeOf = new Map(d.edges.map((e) => [keypairId(e.from, e.to), e.attrs!.type]));
    for (const e of d.edges) {
      const [t, u] = [typeOf.get(keypairId(e.from, e.to)), typeOf.get(keypairId(e.to, e.from))];
      const pair = [relationTypeNames(0), relationTypeNames(1)].find((p) => p.includes(t as string))!;
      expect(pair).toBeDefined();
      expect(u).toBe(pair[0] === t ? pair[1] : pair[0]);
    }
    const r = loadGraph(d);
    if (!r.ok) throw new Error('refused');
    expect(pairTypes(r.graph, 'type').map((p) => [p.forward, p.backward].sort())).toEqual(
      [
        ['rel_ab', 'rel_ba'],
        ['rel_cd', 'rel_dc'],
      ].filter((p) => d.edges.some((e) => e.attrs!.type === p[0])),
    );
  });

  test('relation type names run rel_ab and rel_ba, rel_cd and rel_dc, and so on', () => {
    expect([0, 1, 2, 12].map(relationTypeNames)).toEqual([
      ['rel_ab', 'rel_ba'],
      ['rel_cd', 'rel_dc'],
      ['rel_ef', 'rel_fe'],
      ['rel_yz', 'rel_zy'],
    ]);
  });

  test('only what a row lacks is added: the public sample keeps its types and weights and gains times', () => {
    const sample = fixture(SAMPLE_SOURCE) as { vertices: Row[]; edges: Row[] };
    const d = decorate(sample, 1, DECORATE_DEFAULTS);
    expect(d.vertices.map((v) => v.attrs!.type)).toEqual(sample.vertices.map((v) => v.attrs!.type));
    expect(d.edges.map((e) => [e.attrs!.type, e.attrs!.weight])).toEqual(
      sample.edges.map((e) => [e.attrs!.type, e.attrs!.weight]),
    );
    expect(d.vertices.every((v) => typeof v.attrs!.created === 'string')).toBe(true);
  });

  test('each row that lacks a value gets one; rows with their own keep theirs', () => {
    const g = {
      format: 'graphview/1',
      vertices: [
        { key: 1, attrs: { kind: 'red', created: '2026-03-01' } },
        { key: 2 },
        { key: 3, attrs: { kind: 'blue' } },
      ],
      edges: [
        { from: 1, to: 2, attrs: { kind: 'owns', weight: 0.5 } },
        { from: 2, to: 1 },
        { from: 2, to: 3 },
        { from: 3, to: 2 },
      ],
    };
    const d = decorate(g, 1, DECORATE_DEFAULTS) as { vertices: Row[]; edges: Row[] };
    const [u1, u2, u3] = d.vertices.map((v) => v.attrs!);
    expect([u1.kind, u3.kind]).toEqual(['red', 'blue']);
    expect(u2.kind).toMatch(/^type_\d+$/);
    expect(d.vertices.every((v) => v.attrs!.type === undefined)).toBe(true);
    expect(u1.created).toBe('2026-03-01');
    expect([u2.created, u3.created].every((t) => /^2026-\d{2}-\d{2}$/.test(String(t)))).toBe(true);
    const [e12, e21, e23, e32] = d.edges.map((e) => e.attrs!);
    expect([e12.kind, e12.weight]).toEqual(['owns', 0.5]);
    // The reverse of a typed keypair keeps what it has; an untyped relation takes a complementary pair.
    expect(e21.kind).toBeUndefined();
    const pair = relationTypeNames(['rel_ab', 'rel_cd', 'rel_ef', 'rel_gh'].indexOf(String(e23.kind)));
    expect([e23.kind, e32.kind]).toEqual(pair);
    expect([e21, e23, e32].every((e) => typeof e.weight === 'number')).toBe(true);
    // A keypair's date is no earlier than its units' dates.
    expect(String(e21.created) >= '2026-03-01').toBe(true);
    expect(String(e12.created) >= String(u2.created)).toBe(true);
  });
});

describe('§8.8 Explanation', () => {
  test('every family explains itself and each parameter, with the current values', () => {
    for (const f of FAMILIES) {
      const params = Object.fromEntries(Object.entries(f.params).map(([k, v]) => [k, String(v)]));
      const [family, settings] = explainFamily(f.id, params, 7);
      expect(family.heading).toMatch(/^Family: /);
      expect(family.text.length).toBeGreaterThan(40);
      expect(settings.heading).toBe('Parameters');
      expect(family.heading).toBe(`Family: ${f.name}`);
      expect(family.text, f.id).toMatch(/relations/);
      for (const [k, v] of Object.entries(params)) {
        const item = settings.items!.find((i) => i.name === paramLabel(f.id, k))!;
        expect(item.value).toBe(v);
        expect(item.text.length, `${f.id} ${k}`).toBeGreaterThan(10);
      }
      expect(settings.items!.find((i) => i.name === 'seed')!.value).toBe('7');
    }
  });

  test('examples name their family where they have one; broken and refused ones say so', () => {
    expect(explainExample('path-4', 'Path of four', 'Four units in a row.', 4)[0].text).toContain('family Path');
    expect(explainExample('broken-loop', 'Loop', 'A loop.', 2)[0].text).toContain('breaks a rule');
    expect(explainExample('load-error-format', 'Format', '', null)[0].text).toContain('refuses');
    expect(explainExample(SAMPLE_ID, 'Sample graph', '', 81)[0].text).toContain('family Tree');
    expect(explainExample('complete-4', 'Complete', '', 4)[0].text).toContain('family Complete.');
    expect(explainExample('text-keys', 'Keys', '', 9)[0].text).toContain('family Cycle');
    expect(explainExample('superseded', 'Superseded', '', 6)[0].text).toContain('no generator family');
  });

  test('parameter fields show readable names', () => {
    expect(
      ['tree', 'small-world', 'preferential'].map((f) =>
        paramLabel(f as Family, Object.keys(FAMILIES.find((x) => x.id === f)!.params).at(-1)!),
      ),
    ).toEqual(['branching b', 'β', 'm₀']);
    expect(paramLabel('communities', 'pIn')).toBe('p-in');
    expect(paramLabel('path', 'n')).toBe('n');
  });

  test('types, weights and times, and broken rules, list their settings', () => {
    expect(explainDecoration(false, DECORATE_DEFAULTS).items).toBeUndefined();
    const on = explainDecoration(true, { ...DECORATE_DEFAULTS, relationTypes: 3 });
    expect(on.items!.map((i) => i.name)).toEqual(['unit types', 'relation types', 'weights', 'times']);
    expect(on.items![1].text).toContain('rel_ef');
    expect(explainBreaks(NO_BREAKS)).toBeNull();
    expect(explainBreaks({ ...NO_BREAKS, loneUnits: 2 })!.items!.map((i) => [i.name, i.value])).toEqual([
      ['lone units', '2'],
    ]);
  });
});

describe('§8.10 Examples', () => {
  test('the private-term scan finds listed phrases in any case and spacing, and nothing else', () => {
    expect(PRIVATE_TERMS.full.size).toBeGreaterThan(100);
    const list = termList(['quiet harbour light', 'zebra']);
    expect(leaks('A QUIET  harbour-light; zebras and a zebra.', list).sort()).toEqual(['quiet harbour light', 'zebra']);
    expect(leaks('quiet harbours light', list)).toEqual([]);
  });

  test('the shell calls the database fixture the sample graph; other examples keep their names', () => {
    expect(exampleId(SAMPLE_SOURCE)).toBe(SAMPLE_ID);
    expect(exampleId('petersen')).toBe('petersen');
    expect(fixture(SAMPLE_SOURCE).meta.name).toBe('Sample graph');
  });

  test('no example carries a private name; keypair types pair into complements', () => {
    for (const e of JSON.parse(readFileSync(new URL('../../fixtures/index.json', import.meta.url), 'utf8')))
      expect(leaks(JSON.stringify(fixture(e.fixture))), e.fixture).toEqual([]);
    const r = loadGraph(fixture(SAMPLE_SOURCE));
    if (!r.ok) throw new Error('refused');
    expect(pairTypes(r.graph, 'type')).toEqual([
      { forward: 'rel_ab', backward: 'rel_ba' },
      { forward: 'rel_cd', backward: 'rel_dc' },
      { forward: 'rel_ef', backward: 'rel_fe' },
    ]);
  });
});

describe('§11.1 The repository', () => {
  // Every text file, as committed: the build has its own check in the browser tests.
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const skip = new Set(['node_modules', '.git', 'dist', 'test-results', 'playwright-report']);
  const binary = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i;
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      if (skip.has(name)) return [];
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : binary.test(name) ? [] : [path];
    });

  test('no text file carries a private name', () => {
    const found = files(root)
      .map((f) => [f.slice(root.length), leaks(readFileSync(f, 'utf8')).length] as const)
      .filter(([, n]) => n > 0);
    expect(found).toEqual([]);
  });
});

describe('§8.13 Share links', () => {
  test('a link carries the source and the view, and reads back the same', () => {
    const base = 'https://example.test/graphview/';
    const source = {
      kind: 'generated' as const,
      family: 'tree' as const,
      params: { n: 15, b: 2 },
      seed: 3,
      breaks: { ...NO_BREAKS, loneUnits: 1 },
      decorate: { ...DECORATE_DEFAULTS, unitTypes: 2 },
    };
    const view = { mode: '3d' as const, root: 1, target: '"x"', path: { length: 4, index: 1 } };
    const read = readLink(new URL(makeLink(base, source, view)).search);
    expect(read).toEqual({ source, view, error: null });
    expect(readLink('?example=sample&mode=2d')).toEqual({
      source: { kind: 'example', id: 'sample', decorate: null },
      view: { mode: '2d' },
      error: null,
    });
    expect(readLink('?gen=%7Bnot%20json').error).toBe('The graph in the link could not be read.');
  });

  test('a link with an unknown family, a bad setting or a bad seed is not read, and drops its view', () => {
    const view = encodeURIComponent(JSON.stringify({ mode: '3d', root: 1, target: null, path: null }));
    const gen = (g: object) => `?gen=${encodeURIComponent(JSON.stringify(g))}&mode=3d&view=${view}`;
    const good = { family: 'tree', params: { n: 15, b: 2 }, seed: 3, breaks: NO_BREAKS, decorate: null };
    expect(readLink(gen(good)).error).toBeNull();
    for (const bad of [
      {},
      { ...good, family: 'moon' },
      { ...good, seed: 1.5 },
      { ...good, params: { n: 'many', b: 2 } },
      { ...good, breaks: { ...NO_BREAKS, loneUnits: 'x' } },
      { ...good, decorate: { ...DECORATE_DEFAULTS, weights: [] } },
    ]) {
      expect(readLink(gen(bad)), JSON.stringify(bad)).toEqual({
        source: null,
        view: { mode: '3d' },
        error: 'The graph in the link could not be read.',
      });
    }
    // Settings a link leaves out take the family's own.
    const read = readLink(gen({ family: 'grid', seed: 2 }));
    expect(read.source).toMatchObject({ family: 'grid', params: { rows: 4, columns: 5 }, breaks: NO_BREAKS });
    expect(readLink(gen({ ...good, family: 'random-degrees', params: { degrees: [2, 'x'] } })).error).not.toBeNull();
  });
});

describe('§3.7 Importer', () => {
  test('rows with id, source and target become a graph; other fields become attributes', () => {
    const { doc, converted } = importDoc({
      vertices: [
        { id: 'a', name: 'Alpha', type: 'person' },
        { id: 'b', type: 'place', x: 1, y: 2 },
      ],
      edges: [
        { source: 'a', target: 'b', type: 'visits', weight: 3 },
        { source: 'b', target: 'a', type: 'hosts' },
      ],
    });
    expect(converted).toBe(true);
    const r = loadGraph(doc);
    if (!r.ok) throw new Error('refused');
    expect(r.issues).toEqual([]);
    expect(r.graph.unitInfo.get(keyId('a'))?.label).toBe('Alpha');
    expect(r.graph.unitInfo.get(keyId('b'))?.pos).toEqual({ x: 1, y: 2 });
  });

  test('orphan edges and repeated ids are flagged by the loader; a format-named document passes unchanged', () => {
    const { doc } = importDoc({
      vertices: [{ id: 1 }, { id: 2 }, { id: 2 }],
      edges: [
        { source: 1, target: 2 },
        { source: 2, target: 1 },
        { source: 1, target: 9 },
      ],
    });
    const r = loadGraph(doc);
    if (!r.ok) throw new Error('refused');
    expect(r.issues.map((i) => i.code).sort()).toEqual(['repeated-key', 'unknown-unit']);
    const own = { format: 'graphview-graph/1', vertices: [], edges: [] };
    expect(importDoc(own)).toEqual({ doc: own, converted: false });
  });
});
