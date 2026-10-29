// The model (specification sections 5 and 6): schema reflection, depth rules,
// filters, picking geometry, hull groups, the type registry and the model's commands.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LABEL_GAP, placeLabels } from '../../module/render/labels.ts';
import { keyId, loadGraph, pathSet, ringIndex, type Graph, type Key } from '../../module/core/index.ts';
import type { Aspect } from '../../module/model/contracts.ts';
import { CHEVRON_AT, DEPTH_RULES, depthState, FOREGROUND, plane, SPACING } from '../../module/model/depth.ts';
import { keypairPasses, lineWeight, NO_FILTERS, range, unitPasses, weightOf } from '../../module/model/filters.ts';
import { clusters, hullPoints, median } from '../../module/model/hulls.ts';
import { GraphModel } from '../../module/model/model.ts';
import { across, along, raySegment, type V3 } from '../../module/model/picking.ts';
import { reflectSchema, timeValue, typeText } from '../../module/model/schema.ts';
import { buildTypes, mixColour, pairTypes, TYPE_PALETTE } from '../../module/model/typeRegistry.ts';
import { graphWorker } from '../../module/workers/index.ts';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../fixtures/graphs/${name}.json`, import.meta.url), 'utf8'));

function graphOf(doc: unknown): Graph {
  const r = loadGraph(doc);
  if (!r.ok) throw new Error(r.message);
  return r.graph;
}

type Edge = { from: Key; to: Key; attrs?: Record<string, unknown> };
/** Both keypairs of each relation; attrs learns whether it makes the first keypair of the pair or its reverse. */
const both = (
  pairs: [number, number][],
  attrs?: (a: number, b: number, first: boolean) => Record<string, unknown>,
): Edge[] =>
  pairs.flatMap(([a, b]) => [
    { from: a, to: b, ...(attrs ? { attrs: attrs(a, b, true) } : {}) },
    { from: b, to: a, ...(attrs ? { attrs: attrs(b, a, false) } : {}) },
  ]);
const doc = (n: number, edges: Edge[], attrs: object[] = []) => ({
  format: 'graphview-graph/1',
  vertices: Array.from({ length: n }, (_, i) => ({
    key: i + 1,
    label: `u${i + 1}`,
    ...(attrs[i] ? { attrs: attrs[i] } : {}),
  })),
  edges,
});

async function model(d: unknown) {
  const m = new GraphModel();
  expect(await m.load(d)).toBe(true);
  return m;
}

describe('§6.6 Schema reflection', () => {
  test('the sample fixture: units and keypairs by type, one weight field, no times', () => {
    const s = reflectSchema(graphOf(fixture('database-2026-07-24')));
    expect(s.unitTypeField).toBe('type');
    expect(s.keypairTypeField).toBe('type');
    expect(s.weightFields).toEqual(['weight']);
    expect(s.timeFields).toEqual([]);
  });

  test('units by archetype, keypairs by type, two weight fields with weight first', () => {
    const edges = both(
      [
        [1, 2],
        [2, 3],
        [3, 4],
      ],
      (a, b, first) => ({ type: first ? 'x' : 'y', row: 10 * a + b, weight: first ? 0.5 : 1 }),
    );
    const s = reflectSchema(
      graphOf(
        doc(
          4,
          edges,
          [1, 1, 2, 2].map((archetype) => ({ archetype })),
        ),
      ),
    );
    expect(s.unitTypeField).toBe('archetype');
    expect(s.keypairTypeField).toBe('type');
    expect(s.weightFields).toEqual(['weight', 'row']);
    expect(s.timeFields).toEqual([]);
  });

  test('a field named type is the type; another name counts only when it names fewer groups than rows', () => {
    const named = (field: string, values: string[]) =>
      reflectSchema(
        graphOf(
          doc(
            3,
            both([[1, 2]]),
            values.map((v) => ({ [field]: v })),
          ),
        ),
      ).unitTypeField;
    expect(named('type', ['a', 'b', 'c'])).toBe('type');
    expect(named('group', ['a', 'b', 'c'])).toBeNull();
    expect(named('group', ['a', 'a', 'c'])).toBe('group');
  });

  test('timestamps and type texts', () => {
    expect(timeValue('2026-03-01', 'anything')).toBe(Date.UTC(2026, 2, 1));
    expect(timeValue(5, 'created')).toBe(5);
    expect(timeValue(5, 'weight')).toBeNull();
    expect(timeValue('soon', 'created')).toBeNull();
    expect(typeText(3)).toBe('3');
    expect(typeText(true)).toBe('true');
    expect(typeText(null)).toBeNull();
  });
});

describe('§6.4 Depth rules', () => {
  const at = (degree: number, more: Partial<Parameters<typeof depthState>[0]> = {}) =>
    depthState({ degree, onPath: false, hasRoot: true, hasPath: false, depth: true, ...more });

  test('planes: the root and degree 1 in front, then one plane per degree, units out of reach deepest', () => {
    expect([0, 1, 2, 3, 4, 9, 40, -1].map((d) => plane(d))).toEqual([0, 0, 1, 2, 3, 6, 6, 6]);
  });

  test('with a root, in 3D: degree 1 in front, degree 2 one plane back at 60 percent, degree 3 and more far back', () => {
    expect(at(1)).toEqual({ z: 0, scale: 1, opacity: 1, glow: 0 });
    expect(at(2)).toEqual({ z: -SPACING, scale: 0.6, opacity: 0.6, glow: 0 });
    expect(at(3)).toEqual({ z: -2 * SPACING, scale: DEPTH_RULES.far.scale, opacity: 0.15, glow: 0 });
    expect(at(-1).z).toBe(-DEPTH_RULES.maxPlanes * SPACING);
  });

  test('in 2D every unit stays on z = 0 and keeps its size and opacity rules', () => {
    for (const d of [0, 1, 2, 3, 7, -1]) {
      const flat = at(d, { depth: false });
      expect(flat.z).toBe(0);
      expect([flat.scale, flat.opacity]).toEqual([at(d).scale, at(d).opacity]);
    }
  });

  test('without a root everything is in front at full size', () => {
    for (const d of [-1, 0, 2, 5]) expect(at(d, { hasRoot: false })).toEqual({ z: 0, scale: 1, opacity: 1, glow: 0 });
  });

  test('the active path comes to the foreground at 1.2 times and glows; the rest dims to 0.05', () => {
    for (const d of [0, 2, 4, -1]) {
      expect(at(d, { hasPath: true, onPath: true })).toEqual({ z: FOREGROUND, scale: 1.2, opacity: 1, glow: 1 });
      const off = at(d, { hasPath: true });
      expect(off.opacity).toBe(0.05);
      expect(off.z).toBe(at(d).z);
    }
    expect(CHEVRON_AT).toEqual({ forward: 1 / 3, backward: 2 / 3 });
  });
});

describe('§6.7 Filters', () => {
  const g = graphOf(
    doc(
      3,
      [
        { from: 1, to: 2, attrs: { created: '2026-02-01', weight: 0.2 } },
        { from: 2, to: 1, attrs: { created: '2026-02-01', weight: 0.9 } },
        { from: 2, to: 3, attrs: { created: '2026-08-01', weight: 0.5 } },
        { from: 3, to: 2 },
      ],
      [{ created: '2026-01-01' }, { created: '2026-06-01' }, {}],
    ),
  );

  test('a time window keeps the rows inside it, and rows without a time', () => {
    const f = { ...NO_FILTERS, timeField: 'created', from: Date.parse('2026-03-01'), to: Date.parse('2026-12-31') };
    expect([1, 2, 3].map((k) => unitPasses(g, k, f))).toEqual([false, true, true]);
    expect([keypairPasses(g, 1, 2, f), keypairPasses(g, 2, 3, f), keypairPasses(g, 3, 2, f)]).toEqual([
      false,
      true,
      true,
    ]);
  });

  test('weights, ranges and the threshold', () => {
    expect(weightOf(g, 2, 1, 'weight')).toBe(0.9);
    expect(range([0.2, null, 0.9])).toEqual({ min: 0.2, max: 0.9 });
    expect(range([null])).toBeNull();
    const f = { ...NO_FILTERS, weightField: 'weight', threshold: 0.5 };
    expect(lineWeight(0.2, 0.9, f, { min: 0, max: 1 })).toEqual({ above: true, strength: 0.9 });
    expect(lineWeight(0.2, 0.4, f, { min: 0, max: 1 })).toEqual({ above: false, strength: 0 });
    expect(lineWeight(0.2, 0.4, { ...f, threshold: null }, null)).toEqual({ above: true, strength: 0 });
  });
});

describe('§6.9 and §6.11 Picking geometry and hull groups', () => {
  test('a ray and a segment; a chevron capsule across its line', () => {
    const h = raySegment([0, 0, 10], [0, 0, -1], [-1, 2, 0], [1, 2, 0]);
    expect([h.distance, h.s, h.t].map((v) => +v.toFixed(6))).toEqual([2, 10, 0.5]);
    expect(raySegment([0, 0, 10], [0, 0, -1], [3, 4, 0], [3, 4, 0]).distance).toBeCloseTo(5);
    const axis = across([0, 0, 0], [10, 0, 0], [5, 0, 0], [5, 0, 50], 2)!;
    expect(Math.abs(axis[0][1] - axis[1][1])).toBeCloseTo(4);
    expect(across([0, 0, 0], [0, 0, -10], [0, 0, -5], [0, 0, 50], 2)).toBeNull();
    expect(along([0, 0, 0], [3, 6, 9], 1 / 3)).toEqual([1, 2, 3]);
  });

  test('close points share a hull group, through chains; distant ones do not', () => {
    const pts: V3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [10, 0, 0],
      [10, 1, 0],
      [30, 30, 30],
    ];
    const groups = clusters(pts, 1.5).map((g) => g.sort((a, b) => a - b));
    groups.sort((a, b) => a[0] - b[0]);
    expect(groups).toEqual([[0, 1, 2], [3, 4], [5]]);
    expect(hullPoints([[1, 2, 3]], 5)).toContainEqual([1, 2, -2]);
    expect([median([3, 1, 2]), median([4, 1, 2, 3]), median([])]).toEqual([2, 2.5, 0]);
  });
});

describe('§6.6 Type registry', () => {
  const g = graphOf(
    doc(
      4,
      [
        ...both(
          [
            [1, 2],
            [2, 3],
          ],
          (a, b, first) => ({ type: first ? 'contains' : 'inside' }),
        ),
        ...both([[3, 4]], () => ({ type: 'near' })),
      ],
      [{ type: 'b' }, { type: 'a' }, { type: 'a' }, {}],
    ),
  );

  test('keypair types pair with the type their reverses carry; a type that is its own reverse pairs with itself', () => {
    expect(pairTypes(g, 'type')).toEqual([
      { forward: 'contains', backward: 'inside' },
      { forward: 'near', backward: 'near' },
    ]);
  });

  test('pairs follow how often two types meet, the most frequent pair first; a type left alone comes last', () => {
    const meet = (t: string, u: string, times: number, start: number): Edge[] =>
      Array.from({ length: times }, (_, i) => start + 2 * i).flatMap((a) => [
        { from: a, to: a + 1, attrs: { type: t } },
        { from: a + 1, to: a, attrs: { type: u } },
      ]);
    // A–B ×3, A–C ×3, A–D ×3 and E–B ×4: B and E pair first; A then takes C, the earliest free partner.
    const h = graphOf(
      doc(26, [...meet('A', 'B', 3, 1), ...meet('A', 'C', 3, 7), ...meet('A', 'D', 3, 13), ...meet('E', 'B', 4, 19)]),
    );
    expect(pairTypes(h, 'type')).toEqual([
      { forward: 'B', backward: 'E' },
      { forward: 'A', backward: 'C' },
      { forward: 'D', backward: null },
    ]);
    // Within a pair, the type met first in the file goes forward, however often the other occurs.
    expect(pairTypes(graphOf(doc(6, [...meet('Y', 'X', 1, 1), ...meet('X', 'Y', 2, 3)])), 'type')).toEqual([
      { forward: 'Y', backward: 'X' },
    ]);
  });

  test('the most frequent type takes the first colour; a backward type shares its hue, lighter', () => {
    const t = buildTypes(g, reflectSchema(g), 'light', { unit: new Map(), keypair: new Map() });
    expect(t.unit.map((x) => [x.id, x.count, x.colour])).toEqual([
      ['a', 2, TYPE_PALETTE.light[0]],
      ['b', 1, TYPE_PALETTE.light[1]],
    ]);
    const k = Object.fromEntries(t.keypair.map((x) => [x.id, x.colour]));
    expect(k.contains).toBe(TYPE_PALETTE.light[0]);
    expect(k.inside).toBe(mixColour(TYPE_PALETTE.light[0], '#F6F8F9', 0.42));
    expect(k.near).toBe(TYPE_PALETTE.light[1]);
  });

  test('custom labels and colours replace the defaults', () => {
    const t = buildTypes(g, reflectSchema(g), 'dark', {
      unit: new Map([['a', { label: 'leaf', colour: '#123456' }]]),
      keypair: new Map(),
    });
    expect(t.unit[0]).toMatchObject({ id: 'a', label: 'leaf', colour: '#123456' });
    expect(t.unit[1].colour).toBe(TYPE_PALETTE.dark[1]);
  });

  test("a complement's default colour follows its forward type's own colour", () => {
    const t = buildTypes(g, reflectSchema(g), 'light', {
      unit: new Map(),
      keypair: new Map([['contains', { colour: '#336699' }]]),
    });
    const k = Object.fromEntries(t.keypair.map((x) => [x.id, x.colour]));
    expect(k.contains).toBe('#336699');
    expect(k.inside).toBe(mixColour('#336699', '#F6F8F9', 0.42));
  });
});

describe('§5.4 The graph worker, inline where there are no workers', () => {
  test('distances and path sets match the core', async () => {
    const g = graphOf(
      doc(
        6,
        both([
          [1, 2],
          [2, 3],
          [3, 4],
          [4, 5],
          [5, 6],
          [6, 1],
        ]),
      ),
    );
    const w = graphWorker(g.units, g.keypairs);
    expect(await w.distances(1)).toEqual(ringIndex(g, 1));
    const limits = { count: 100, list: 10, timeMs: 1000 };
    expect(await w.paths(1, 4, 2, limits)).toEqual(pathSet(g, 1, 4, 2, limits));
  });
});

describe('§5.2 The model: one source of truth', () => {
  test('two keypairs of a relation become one line with two chevrons; a lone keypair keeps one', async () => {
    const m = await model(doc(3, [...both([[1, 2]]), { from: 2, to: 3 }]));
    expect(m.relations.map((r) => [r.ka, r.kb, r.ab, r.ba])).toEqual([
      [1, 2, true, true],
      [2, 3, true, false],
    ]);
    expect(m.chevrons).toHaveLength(3);
    expect(m.relationCount()).toBe(1);
  });

  test('every change reaches the listeners first through the model, by aspect', async () => {
    const m = await model(
      doc(
        4,
        both([
          [1, 2],
          [2, 3],
          [3, 4],
        ]),
      ),
    );
    const seen: Aspect[][] = [];
    m.subscribe((a) => seen.push([...a]));
    m.setMode('3d');
    await m.setRoot(1);
    await m.setTarget(4);
    m.setFilters({ threshold: 0.5 });
    m.setTypeLabel('unit', 'x', 'y');
    m.setHulls(false);
    m.inspect({ kind: 'unit', key: 2 });
    expect(seen).toEqual([['mode'], ['root', 'paths'], ['paths'], ['filters'], ['types'], ['display'], ['inspect']]);
  });

  test('a root gives every unit its degree, and the planes count them', async () => {
    const d = doc(
      7,
      both([
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
      ]),
    );
    const m = await model(d);
    await m.setRoot(1);
    expect(m.degrees).toEqual(ringIndex(graphOf(d), 1));
    expect(m.planeCounts()).toEqual({ first: 1, second: 1, third: 1, farBack: 2, deepest: 5 });
    await m.setRoot(null);
    expect(m.planeCounts()).toEqual({ first: 0, second: 0, third: 0, farBack: 0, deepest: null });
  });

  test('paths from the root: the shortest first, then one and two steps longer; a new root drops them', async () => {
    const m = await model(
      doc(
        6,
        both([
          [1, 2],
          [2, 3],
          [3, 4],
          [1, 5],
          [5, 6],
          [6, 3],
        ]),
      ),
    );
    expect(await m.setTarget(4)).toBeNull();
    await m.setRoot(1);
    const res = (await m.setTarget(4))!;
    expect(res.lengths.map((l) => l.length)).toEqual([3, 4, 5]);
    expect(m.choice).toEqual({ length: 3, index: 0 });
    expect(m.activePath()).toEqual([1, 2, 3, 4]);
    m.choosePath({ length: 4, index: 0 });
    expect(m.activePath()).toEqual([1, 5, 6, 3, 4]);
    await m.setRoot(2);
    expect([m.target, m.paths, m.choice]).toEqual([null, null, null]);
  });

  test('reversing a path swaps its ends', async () => {
    const m = await model(
      doc(
        4,
        both([
          [1, 2],
          [2, 3],
          [3, 4],
        ]),
      ),
    );
    await m.setRoot(1);
    await m.setTarget(4);
    await m.reversePath();
    expect([m.root, m.target, m.activePath()]).toEqual([4, 1, [4, 3, 2, 1]]);
  });

  test("the path's steps carry the type labels and weights of the keypairs to the next unit and back", async () => {
    const d = doc(
      3,
      both(
        [
          [1, 2],
          [2, 3],
        ],
        (a, b, first) => ({ type: first ? 'rel_ab' : 'rel_ba', weight: a * 10 + b }),
      ),
    );
    const m = await model(d);
    await m.setRoot(1);
    await m.setTarget(3);
    m.setTypeLabel('keypair', 'rel_ab', 'parent of');
    expect(m.pathSteps()).toEqual([
      { key: 1, label: 'u1', to: { type: 'parent of', weight: 12 }, from: { type: 'rel_ba', weight: 21 } },
      { key: 2, label: 'u2', to: { type: 'parent of', weight: 23 }, from: { type: 'rel_ba', weight: 32 } },
      { key: 3, label: 'u3', to: null, from: null },
    ]);
  });

  test('a unit is found by its label or by its key as JSON text; the number 1 and the text "1" differ', async () => {
    const m = await model({
      format: 'graphview-graph/1',
      vertices: [{ key: 1, label: 'one' }, { key: '1' }, { key: 'plain' }],
      edges: [
        { from: 1, to: '1' },
        { from: '1', to: 1 },
        { from: '1', to: 'plain' },
        { from: 'plain', to: '1' },
      ],
    });
    expect(m.find('one')).toBe(1);
    expect(m.find('1')).toBe(1);
    expect(m.find('"1"')).toBe('1');
    expect(m.find('plain')).toBe('plain');
    expect(m.find('nothing')).toBeNull();
    expect([m.label(1), m.label('1')]).toEqual(['one', '"1"']);
  });

  test('a new graph starts afresh: no root, no path, no inspection, filters from its own fields', async () => {
    const m = await model(
      doc(
        3,
        both([
          [1, 2],
          [2, 3],
        ]),
      ),
    );
    await m.setRoot(1);
    await m.setTarget(3);
    m.inspect({ kind: 'unit', key: 1 });
    await m.load(
      doc(
        2,
        both([[1, 2]], () => ({ weight: 1, created: '2026-01-01' })),
      ),
    );
    expect([m.root, m.target, m.paths, m.inspected]).toEqual([null, null, null, null]);
    expect([m.filters.weightField, m.filters.timeField]).toEqual([null, 'created']);
  });

  test('saved view settings bring a graph back as it was left', async () => {
    const d = doc(
      4,
      both([
        [1, 2],
        [2, 3],
        [3, 4],
      ]),
      [{ type: 'a' }, { type: 'a' }, { type: 'b' }, { type: 'b' }],
    );
    const a = await model(d);
    a.setMode('3d');
    await a.setRoot(1);
    await a.setTarget(4);
    a.setOverrides({ size: 2 });
    a.setHulls(false);
    a.setTypeLabel('unit', 'a', 'first kind');
    const b = new GraphModel();
    await b.load(d, a.viewSettings());
    expect(b.viewSettings()).toEqual(a.viewSettings());
    expect(b.activePath()).toEqual([1, 2, 3, 4]);
    expect(b.types.unit.find((t) => t.id === 'a')!.label).toBe('first kind');
  });

  test('a refused file leaves an empty graph and says why', async () => {
    const m = new GraphModel();
    expect(await m.load([1, 2])).toBe(true);
    expect(m.refused?.code).toBe('not-object');
    expect([m.graph, m.relations.length]).toEqual([null, 0]);
  });

  test('a newer graph wins over one still laying out', async () => {
    const m = new GraphModel();
    const first = m.load(
      doc(
        3,
        both([
          [1, 2],
          [2, 3],
        ]),
      ),
    );
    const second = m.load(doc(2, both([[1, 2]])));
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(m.graph!.units.map(keyId)).toEqual(['1', '2']);
  });

  test('a graph above 3,000 units starts without hulls; the switch still turns them on', async () => {
    const big = {
      format: 'graphview-graph/1',
      vertices: Array.from({ length: 3001 }, (_, i) => ({ key: i + 1, pos: { x: i, y: 0 } })),
      edges: both(Array.from({ length: 3000 }, (_, i) => [i + 1, i + 2] as [number, number])),
    };
    const small = doc(
      3,
      both([
        [1, 2],
        [2, 3],
      ]),
    );
    const m = await model(big);
    expect(m.hulls).toBe(false);
    m.setHulls(true);
    expect(m.hulls).toBe(true);
    // A smaller graph follows the person's last choice; a large one starts without hulls again.
    expect(await m.load(small)).toBe(true);
    expect(m.hulls).toBe(true);
    m.setHulls(false);
    expect(await m.load(small)).toBe(true);
    expect(m.hulls).toBe(false);
    m.setHulls(true);
    expect(await m.load(big)).toBe(true);
    expect(m.hulls).toBe(false);
    expect(await m.load(small)).toBe(true);
    expect(m.hulls).toBe(true);
  });
});

describe('§6.12 Labels', () => {
  test('labels never come closer than 2 pixels or cover a unit; forced labels always show, first', () => {
    const rand = (() => {
      let a = 7;
      return () => (a = (a * 1103515245 + 12345) % 2147483648) / 2147483648;
    })();
    const units = Array.from({ length: 300 }, (_, index) => ({
      index,
      x: rand() * 600,
      y: rand() * 400,
      r: 4,
      text: `unit_${index}`,
      forced: index === 299 || index === 150,
    }));
    const obstacles = units.map((u) => ({ x: u.x - u.r, y: u.y - u.r, w: 2 * u.r, h: 2 * u.r, owner: u.index }));
    const placed = placeLabels(units, (t) => 7 * t.length, 600, 400, 300, obstacles);
    expect(
      placed
        .slice(0, 2)
        .map((p) => p.index)
        .sort(),
    ).toEqual([150, 299]);
    expect(placed.length).toBeGreaterThan(30);
    const apart = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
      a.x >= b.x + b.w + LABEL_GAP ||
      b.x >= a.x + a.w + LABEL_GAP ||
      a.y >= b.y + b.h + LABEL_GAP ||
      b.y >= a.y + a.h + LABEL_GAP;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) expect(apart(placed[i].box, placed[j].box)).toBe(true);
      // A forced label shows even where it cannot keep clear of a unit.
      if (units[placed[i].index].forced) continue;
      for (const o of obstacles) if (o.owner !== placed[i].index) expect(apart(placed[i].box, o)).toBe(true);
    }
  });
});
