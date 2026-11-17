// The relation drawings (specification 6.18): which chevrons each drawing draws, where they point, the
// perspective and pair type each carries, and the shapes of class units and interfaces, on the shell's
// invented family and on graphs with broken interfaces.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { loadGraph, type Key } from '../../module/core/index.ts';
import { CHEVRON_AT } from '../../module/model/depth.ts';
import { drawnChevrons } from '../../module/model/drawing.ts';
import { GraphModel } from '../../module/model/model.ts';
import { profileFromJson } from '../../module/model/profileJson.ts';
import { Scene } from '../../module/render/scene.ts';
import { TWIN_PROFILE } from '../../shell/lib/twin.ts';

const twin = () =>
  JSON.parse(readFileSync(new URL('../../shell/examples/classes-and-perspectives.json', import.meta.url), 'utf8'));

async function open(doc: unknown, drawing: 'keypairs' | 'perspectives' = 'perspectives', json = TWIN_PROFILE) {
  const m = new GraphModel(undefined, profileFromJson(json));
  m.setBaseSettings({ 'drawing.relations': drawing });
  const scene = new Scene(m);
  expect(await m.load(doc)).toBe(true);
  return { m, scene, snap: () => scene.snapshotForTests() };
}

/** The chevrons as [from, to, points, the perspective's from and to, its type]. */
const chevrons = (snap: ReturnType<Scene['snapshotForTests']>) =>
  snap.chevrons.map((c) => [c.from, c.to, c.points, c.perspective?.from ?? null, c.perspective?.to ?? null, c.type]);

describe('§6.18 Relation drawings', () => {
  test('by keypairs, every keypair is a chevron along it, coloured by its pair type', async () => {
    const { m, snap } = await open(twin(), 'keypairs');
    const s = snap();
    expect(s.drawing).toBe('keypairs');
    expect(s.chevrons).toHaveLength(m.graph!.keypairs.length);
    expect(s.chevrons.every((c) => c.points === c.to && c.perspective === null)).toBe(true);
    const ada = s.chevrons.find((c) => c.from === 'ada' && c.to === 't-ada-algebra')!;
    expect(ada.type).toBe('teaches');
    expect(ada.colour).toBe(m.types.keypair.find((t) => t.id === 'teaches')!.colour);
    expect([...new Set(s.units.map((u) => u.shape))].sort()).toEqual(['disc', 'divided']);
  });

  test('by perspectives, a relation through an interface keeps its two chevrons into the interface, each pointing at the unit whose perspective it carries', async () => {
    const { snap } = await open(twin());
    const s = snap();
    expect(s.drawing).toBe('perspectives');
    // Eight interfaces with two ends give two chevrons each; the two self-definitions one each.
    expect(s.chevrons).toHaveLength(18);
    const of = (iface: Key) => chevrons(s).filter((c) => c[0] === iface || c[1] === iface);
    expect(of('t-ada-algebra')).toEqual([
      ['ada', 't-ada-algebra', 'algebra', 'algebra', 'ada', 'taughtBy'],
      ['algebra', 't-ada-algebra', 'ada', 'ada', 'algebra', 'teaches'],
    ]);
    expect(of('r-algebra')).toEqual([
      ['algebra', 'r-algebra', 'algebra-2', 'algebra-2', 'algebra', 'replaces'],
      ['algebra-2', 'r-algebra', 'algebra', 'algebra', 'algebra-2', 'replacedBy'],
    ]);
    // An interface with one end keeps the chevron back to its end, pointing at it.
    expect(of('course-def')).toEqual([['course-def', 'course', 'course', 'course', 'course', 'defines']]);
    // The two chevrons of a relation sit a third of the way from each end, on its side.
    const line = (a: Key, b: Key) => s.lines.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))!;
    const fromEnd = s.chevrons
      .filter((c) => c.to === 't-ada-algebra')
      .map((c) => (line(c.from, c.to).a === c.from ? c.at : 1 - c.at));
    expect(fromEnd).toHaveLength(2);
    for (const share of fromEnd) expect(share).toBeCloseTo(CHEVRON_AT.forward, 12);
  });

  test('by perspectives, class units are boxes and interfaces ovals in their own type colour', async () => {
    const { snap } = await open(twin());
    const s = snap();
    const shape = (k: Key) => s.units.find((u) => u.key === k)!;
    expect(['course', 'person'].map((k) => shape(k).shape)).toEqual(['box', 'box']);
    expect(['ada', 'algebra'].map((k) => shape(k).shape)).toEqual(['disc', 'disc']);
    expect(shape('t-ada-algebra').shape).toBe('oval');
    expect(shape('t-ada-algebra').halves[0]).toBe(shape('t-ada-algebra').halves[1]);
    expect(shape('course-def').shape).toBe('oval');
  });

  test('switching the drawing draws other chevrons and shapes at once, where the units stand', async () => {
    const { m, snap } = await open(twin(), 'keypairs');
    const before = snap().units.map((u) => [u.x, u.y]);
    expect(m.setSetting('drawing.relations', 'perspectives')).toBeNull();
    const s = snap();
    expect(s.drawing).toBe('perspectives');
    expect(s.chevrons).toHaveLength(18);
    expect(s.units.map((u) => [u.x, u.y])).toEqual(before);
    m.setSetting('drawing.relations', 'keypairs');
    expect(snap().chevrons).toHaveLength(36);
    expect(m.setSetting('drawing.relations', 'sideways')).toBe('One of Keypairs, Perspectives');
  });

  test('the shapes and the class labels are settings', async () => {
    const { m, snap } = await open(twin());
    m.setSetting('drawing.classShape', 'disc');
    m.setSetting('drawing.interfaceShape', 'divided');
    const s = snap();
    expect(s.units.find((u) => u.key === 'course')!.shape).toBe('disc');
    expect(s.units.find((u) => u.key === 't-ada-algebra')!.shape).toBe('divided');
    // A shape the shader does not hold draws as the first one.
    m.setSetting('drawing.interfaceShape', 'hexagon');
    expect(snap().units.find((u) => u.key === 't-ada-algebra')!.shape).toBe('disc');
  });

  test('direct relations, relations between two interfaces, and interfaces with three ends draw by keypairs', async () => {
    const both = (a: Key, b: Key) => [
      { from: a, to: b },
      { from: b, to: a },
    ];
    // 1 and 2 related directly; i joins 1, 2 and 3; j joins 3 and 4 and is related to i directly.
    const doc = {
      format: 'graphview-graph/1',
      vertices: [1, 2, 3, 4]
        .map((key) => ({ key }))
        .concat(['i', 'j'].map((key) => ({ key, interface: true }) as never)),
      edges: [
        ...both(1, 2),
        ...both(1, 'i'),
        ...both(2, 'i'),
        ...both(3, 'i'),
        ...both(3, 'j'),
        ...both('j', 4),
        ...both('i', 'j'),
      ],
    };
    const r = loadGraph(doc);
    expect(r.ok).toBe(true);
    const { m, snap } = await open(doc, 'perspectives', {});
    const s = snap();
    const kept = (a: Key, b: Key) =>
      s.chevrons.filter((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a));
    // The direct relation and the relation between the two interfaces keep both keypairs, as keypairs.
    for (const [a, b] of [
      [1, 2],
      ['i', 'j'],
    ] as const)
      expect(kept(a, b).map((c) => [c.from, c.to, c.points, c.perspective])).toEqual([
        [a, b, b, null],
        [b, a, a, null],
      ]);
    // i joins three units: its relations draw by keypairs.
    expect(kept(3, 'i')).toHaveLength(2);
    expect(kept(3, 'i').every((c) => c.perspective === null)).toBe(true);
    // j joins 3, 4 and i: three ends, by keypairs too.
    expect(m.endsOf('j')).toHaveLength(3);
    expect(kept('j', 4)).toHaveLength(2);
    // The model's pure function draws the same chevrons.
    const again = drawnChevrons(m.graph!, m.relations, m.chevrons, m.kinds, 'perspectives', () => null);
    expect(again.map((c) => [c.from, c.to, c.points])).toEqual(s.chevrons.map((c) => [c.from, c.to, c.points]));
  });

  test('a perspective without a pair type of the profile takes the type of its keypair into the interface (3.9)', async () => {
    const doc = twin();
    for (const v of doc.vertices) if (v.attrs) delete v.attrs.pair;
    for (const e of doc.edges) e.attrs = { type: e.attrs.pairType };
    const m = new GraphModel();
    await m.load(doc);
    expect(m.perspectivesOf('t-ada-algebra')).toEqual([
      { from: 'ada', to: 'algebra', type: 'teaches' },
      { from: 'algebra', to: 'ada', type: 'taughtBy' },
    ]);
    expect(m.perspectiveType('course-def', 'course', 'course')).toBe('defines');
  });

  test("a profile from JSON makes the pair type the keypairs' type when they carry it (6.6)", async () => {
    const { m } = await open(twin(), 'keypairs');
    expect(m.schema.keypairTypeField).toBe('pairType');
    expect(m.types.pairs.slice(0, 3)).toEqual([
      { forward: 'memberOf', backward: 'hasMember' },
      { forward: 'teaches', backward: 'taughtBy' },
      { forward: 'replaces', backward: 'replacedBy' },
    ]);
    // Without the field in the data, the schema's own type field stays.
    const plain = new GraphModel(undefined, profileFromJson({}));
    await plain.load({
      format: 'graphview-graph/1',
      vertices: [{ key: 1 }, { key: 2 }],
      edges: [
        { from: 1, to: 2, attrs: { type: 'a' } },
        { from: 2, to: 1, attrs: { type: 'b' } },
      ],
    });
    expect(plain.schema.keypairTypeField).toBe('type');
  });
});
