// Finding and narrowing (specification 6.7 and 6.19 to 6.21): filter rules, the search and its ranking,
// the selection and the highlight groups, and the scope with its steps, limit and growth.
import { describe, expect, test } from 'vitest';
import type { Key } from '../../module/core/index.ts';
import type { Aspect, FilterRule } from '../../module/model/contracts.ts';
import { isRule, keypairShare, unitShares, withRule, type RuleFacts } from '../../module/model/filterRules.ts';
import { GraphModel } from '../../module/model/model.ts';
import { adjacency, neighbourhood, stepsFrom } from '../../module/model/reach.ts';

type Row = { key: Key; label?: string; attrs?: Record<string, unknown>; superseded?: boolean };
const both = (pairs: [Key, Key][]) =>
  pairs.flatMap(([a, b]) => [
    { from: a, to: b },
    { from: b, to: a },
  ]);

/** Labels that test each rank of the search, and relations that break ties. */
const words = () => ({
  format: 'graphview-graph/1',
  vertices: [
    { key: 1, label: 'Kalpha' },
    { key: 2, label: 'Alphabet' },
    { key: 3, label: 'Big alpha' },
    { key: 4, label: 'alpha', attrs: { type: 'letter' } },
    { key: 5, label: 'Beta', attrs: { note: 'next to alpha', type: 'letter' } },
    { key: 6, label: 'Alphorn' },
    { key: 7, label: 'Gamma', attrs: { year: 1997 } },
  ] as Row[],
  edges: both([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [2, 6],
  ]),
});

async function model(doc: unknown) {
  const m = new GraphModel();
  expect(await m.load(doc)).toBe(true);
  const heard: Aspect[][] = [];
  m.subscribe((a) => heard.push([...a]));
  return { m, heard };
}

describe('§6.19 Search', () => {
  test('an exact label or key first, then labels that start with the text, then a word, then within, then other values', async () => {
    const { m, heard } = await model(words());
    m.setSearch('alpha');
    expect(m.search.text).toBe('alpha');
    expect(m.search.results.map((r) => [r.key, r.rank, r.where])).toEqual([
      [4, 0, 'label'],
      [2, 1, 'label'],
      [3, 2, 'label'],
      [1, 3, 'label'],
      [5, 4, 'note'],
    ]);
    expect(heard.at(-1)).toEqual(['search']);
    // A key, as JSON text or bare; numbers of attributes; class and type.
    m.setSearch('7');
    expect(m.search.results.map((r) => [r.key, r.where])).toEqual([[7, 'key']]);
    m.setSearch('199');
    expect(m.search.results.map((r) => [r.key, r.where])).toEqual([[7, 'year']]);
    m.setSearch('letter');
    expect(m.search.results.map((r) => [r.key, r.where])).toEqual([
      [4, 'type'],
      [5, 'type'],
    ]);
    m.setSearch('  ');
    expect(m.search.results).toEqual([]);
  });

  test('ties go to the unit with more relations, then to file order; the limit is a setting', async () => {
    const { m } = await model(words());
    // Alphabet and Alphorn both start with "alph": Alphabet has three relations, Alphorn three, so file order.
    m.setSearch('alph');
    expect(m.search.results.slice(0, 3).map((r) => r.key)).toEqual([2, 6, 4]);
    m.setSetting('search.limit', 2);
    m.setSearch('alph');
    expect(m.search.results).toHaveLength(2);
  });
});

describe('§6.7 Filter rules', () => {
  const facts: RuleFacts = {
    classOf: (i) => ['a', 'b', null][i],
    typeOf: (i) => ['t', 't', 'u'][i],
    kindOf: (i) => (i === 2 ? 'interface' : 'plain'),
    superseded: (i) => i === 1,
    relations: (i) => [1, 3, 5][i],
    keypairType: (a) => (a === 'x' ? 'p' : null),
    keypairSuperseded: (a, b) => a === 'y' && b === 'z',
  };
  const rule = (field: FilterRule['field'], value: string | null, mode: FilterRule['mode'], range = null): FilterRule =>
    ({ field, value, range, mode }) as FilterRule;

  test('each rule shows, fades or hides what it names; a unit takes the strictest', () => {
    expect([...unitShares(3, [], facts, 0.15)]).toEqual([1, 1, 1]);
    expect([...unitShares(3, [rule('class', 'a', 'fade')], facts, 0.15)].map((x) => +x.toFixed(2))).toEqual([
      0.15, 1, 1,
    ]);
    expect(
      [...unitShares(3, [rule('type', 't', 'fade'), rule('class', 'a', 'hide')], facts, 0.15)].map(
        (x) => +x.toFixed(2),
      ),
    ).toEqual([0, 0.15, 1]);
    expect([...unitShares(3, [rule('kind', 'interface', 'hide')], facts, 0.15)]).toEqual([1, 1, 0]);
    expect([...unitShares(3, [rule('superseded', null, 'hide')], facts, 0.15)]).toEqual([1, 0, 1]);
    expect([...unitShares(3, [{ field: 'degree', value: null, range: [2, 4], mode: 'hide' }], facts, 0.15)]).toEqual([
      0, 1, 0,
    ]);
  });

  test('a keypair fails with either unit, by its pair type, or by its own superseded row', () => {
    expect(keypairShare([], facts, 'x', 'y', 1, 0.15)).toBe(1);
    expect(keypairShare([], facts, 'q', 'r', 0.15, 0.15)).toBe(0.15);
    expect(keypairShare([rule('pairType', 'p', 'hide')], facts, 'x', 'y', 1, 0.15)).toBe(0);
    expect(keypairShare([rule('superseded', null, 'fade')], facts, 'y', 'z', 1, 0.15)).toBe(0.15);
    expect(keypairShare([rule('superseded', null, 'fade')], facts, 'z', 'y', 1, 0.15)).toBe(1);
  });

  test('a rule replaces the rule for the same thing; one that shows removes it; others are refused', async () => {
    let rules = withRule([], rule('type', 't', 'fade'));
    rules = withRule(rules, rule('type', 'u', 'hide'));
    rules = withRule(rules, rule('type', 't', 'hide'));
    expect(rules.map((r) => [r.value, r.mode])).toEqual([
      ['u', 'hide'],
      ['t', 'hide'],
    ]);
    expect(withRule(rules, rule('type', 'u', 'show')).map((r) => r.value)).toEqual(['t']);
    for (const bad of [
      { field: 'colour', value: 'x', range: null, mode: 'hide' },
      { field: 'type', value: null, range: null, mode: 'hide' },
      { field: 'degree', value: null, range: [5, 2], mode: 'fade' },
      { field: 'superseded', value: 'x', range: null, mode: 'fade' },
      { field: 'type', value: 't', range: null, mode: 'dim' },
    ])
      expect(isRule(bad), JSON.stringify(bad)).toBe(false);
    const { m, heard } = await model(words());
    expect(m.setRule({ field: 'type', value: 'letter', range: null, mode: 'fade' })).toBeNull();
    expect(m.rules).toHaveLength(1);
    expect(heard.at(-1)).toEqual(['filters']);
    expect(m.setRule({ field: 'type', value: null, range: null, mode: 'fade' } as FilterRule)).toBe(
      'Not a filter rule',
    );
    m.clearRules();
    expect(m.rules).toEqual([]);
  });
});

describe('§6.20 Selection and highlights', () => {
  test('the selection is replaced, added to, toggled, taken from and cleared; unknown keys are left out', async () => {
    const { m, heard } = await model(words());
    m.select([2, 3, 99], 'replace');
    expect(m.selection).toEqual([2, 3]);
    expect(heard.at(-1)).toEqual(['selection', 'highlight']);
    m.select([3, 4], 'toggle');
    expect(m.selection).toEqual([2, 4]);
    m.select([5], 'add');
    m.select([2], 'remove');
    expect(m.selection).toEqual([4, 5]);
    const n = heard.length;
    m.select([4], 'add');
    expect(heard).toHaveLength(n);
    m.select([], 'clear');
    expect(m.selection).toEqual([]);
  });

  test('the groups: Selection on by default, Search results, Neighbours within the steps, Issues, and saved groups', async () => {
    const { m } = await model({
      ...words(),
      edges: [...words().edges, { from: 7, to: 99 }],
    });
    const group = (name: string) => m.highlights.find((g) => g.name === name)!;
    expect(m.highlights.map((g) => [g.name, g.on, g.saved])).toEqual([
      ['Selection', true, false],
      ['Search results', false, false],
      ['Neighbours', false, false],
      ['Issues', false, false],
    ]);
    expect(m.emphasis()).toBeNull();
    m.select([4], 'replace');
    expect([...m.emphasis()!]).toEqual([0, 0, 0, 1, 0, 0, 0]);
    expect(group('Neighbours').keys).toEqual([3, 5]);
    m.setSetting('highlight.hops', 2);
    expect(group('Neighbours').keys).toEqual([2, 3, 5, 6]);
    m.setSearch('gamma');
    expect(group('Search results').keys).toEqual([]);
    m.highlightResult(7);
    expect(group('Search results')).toEqual({ name: 'Search results', keys: [7], on: true, saved: false });
    m.setHighlight('Search results', false);
    expect(group('Issues').keys).toEqual([7]);
    m.setHighlight('Issues', true);
    m.setHighlight('Selection', false);
    expect([...m.emphasis()!]).toEqual([0, 0, 0, 0, 0, 0, 1]);
    // A saved group keeps the selection under its name, and starts on; the four names are taken.
    m.select([1, 2], 'replace');
    expect(m.saveHighlight('Start')).toBe(true);
    expect(m.saveHighlight('Issues')).toBe(false);
    expect(group('Start')).toEqual({ name: 'Start', keys: [1, 2], on: true, saved: true });
    m.removeHighlight('Start');
    expect(m.highlights).toHaveLength(4);
  });
});

describe('§6.21 Scope', () => {
  test('a neighbourhood: the chosen units, then nearer units, then more relations, then file order, up to the limit', () => {
    // 1 - 2 - 3, and 2 - 4 - 5, 4 - 6
    const adj = adjacency(6, [
      { a: 0, b: 1, ka: 1, kb: 2, ab: true, ba: true },
      { a: 1, b: 2, ka: 2, kb: 3, ab: true, ba: true },
      { a: 1, b: 3, ka: 2, kb: 4, ab: true, ba: true },
      { a: 3, b: 4, ka: 4, kb: 5, ab: true, ba: true },
      { a: 3, b: 5, ka: 4, kb: 6, ab: true, ba: true },
    ]);
    expect([...stepsFrom(adj, [0], 2)]).toEqual([0, 1, 2, 2, -1, -1]);
    expect(neighbourhood(adj, [0], 2, 10)).toEqual([0, 1, 3, 2]);
    expect(neighbourhood(adj, [0], 2, 3)).toEqual([0, 1, 3]);
    expect(neighbourhood(adj, [0], 3, 10)).toEqual([0, 1, 3, 2, 4, 5]);
  });

  test('show the neighbourhood, expand, hide and show all; a root, a target or an inspected unit outside joins it', async () => {
    const { m, heard } = await model(words());
    m.showNeighbourhood([4]);
    expect(m.scope).toEqual({ centres: [4], units: [3, 4, 5] });
    expect(heard.at(-1)).toEqual(['scope']);
    expect([...m.outside()!]).toEqual([0, 0, 1, 0, 1, 0, 0]);
    m.expand([5]);
    expect(m.scope!.units).toEqual([3, 4, 5, 6]);
    m.hide([3]);
    expect(m.scope!.units).toEqual([4, 5, 6]);
    m.inspect({ kind: 'unit', key: 1 });
    expect(heard.at(-1)).toEqual(['inspect', 'scope']);
    expect(m.scope!.units).toEqual([1, 4, 5, 6]);
    await m.setRoot(7);
    expect(m.scope!.units).toEqual([1, 4, 5, 6, 7]);
    m.showAll();
    expect(m.scope).toBeNull();
    expect(m.inScope()).toBeNull();
    // Hiding without a scope keeps every other unit; the steps and the limit are settings.
    m.hide([7]);
    expect(m.scope!.units).toEqual([1, 2, 3, 4, 5, 6]);
    m.setSetting('scope.hops', 2);
    m.setSetting('scope.limit', 3);
    m.showNeighbourhood([4]);
    expect(m.scope!.units).toEqual([3, 4, 5]);
  });

  test('Lay out scope moves only the units in the scope, inside the box they had', async () => {
    const { m } = await model(words());
    const before = Float32Array.from(m.positions);
    m.showNeighbourhood([4]);
    expect(await m.layOutScope()).toBe(true);
    const idx = [2, 3, 4];
    for (let i = 0; i < 7; i++)
      if (!idx.includes(i))
        expect([m.positions[2 * i], m.positions[2 * i + 1]]).toEqual([before[2 * i], before[2 * i + 1]]);
    const side = (p: Float32Array) => {
      const xs = idx.map((i) => p[2 * i]);
      const ys = idx.map((i) => p[2 * i + 1]);
      return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    };
    expect(side(m.positions)).toBeCloseTo(side(before), 3);
  });

  test('a new graph clears the selection, the search, the scope and the saved groups', async () => {
    const { m } = await model(words());
    m.select([1], 'replace');
    m.saveHighlight('One');
    m.setSearch('alpha');
    m.showNeighbourhood([1]);
    m.setRule({ field: 'type', value: 'letter', range: null, mode: 'hide' });
    await m.load(words());
    expect([m.selection, m.search.results, m.scope, m.highlights.length, m.rules]).toEqual([[], [], null, 4, []]);
  });
});
