// A profile with invented names fits the module to another family of graphs without editing it: a
// third kind with its own shape, look, check and inspector section; classes; declared pairs; a
// superseded rule; pair types of perspectives; and a projection that folds interfaces into lines
// (specification 5.7).
import type { Component } from 'svelte';
import { describe, expect, test } from 'vitest';
import { keyId, keypairId, type Graph, type Key, type KeypairInfo, type UnitInfo } from '../../module/core/index.ts';
import type { Kinds } from '../../module/model/kinds.ts';
import { GraphModel } from '../../module/model/model.ts';
import { INTERFACE, PUBLIC_PROFILE, type Check, type Profile } from '../../module/model/profile.ts';
import { PUBLIC_LOOKS, type Looks } from '../../module/render/looks.ts';
import { SUPERSEDED } from '../../module/render/rules.ts';
import { Scene } from '../../module/render/scene.ts';
import { shapeSlot, UNIT_SHAPES } from '../../module/render/shapes.ts';
import { unitFs } from '../../module/render/shaders/unit.ts';
import { sectionFor, UNIT_SECTIONS, type SectionProps, type UnitShown } from '../../module/view/inspector/sections.ts';
import { issueWords } from '../../module/view/words.ts';
import { graphWorker } from '../../module/workers/index.ts';

// An invented family: towns in regions, a hub, and a crossing between two towns.
const attr = (info: UnitInfo | undefined, field: string) => info?.attrs?.[field];

const HUB_FEW: Check = {
  codes: ['hub-few'],
  find: (g, kinds, relations) => {
    const count = new Map<number, number>();
    for (const r of relations) for (const i of [r.a, r.b]) count.set(i, (count.get(i) ?? 0) + 1);
    return kinds.of.flatMap((k, i) =>
      k === 'hub' && (count.get(i) ?? 0) < 3
        ? [{ code: 'hub-few', key: g.units[i], relations: count.get(i) ?? 0 }]
        : [],
    );
  },
  words: (i, name) => `The hub ${name(i.key as Key)} has ${i.relations} relations, fewer than 3.`,
};

const TOWNS: Profile = {
  kinds: [INTERFACE, { id: 'hub', claims: (info) => attr(info, 'role') === 'hub', joins: false }],
  classOf: (info) => {
    const r = attr(info, 'region');
    return typeof r === 'string' ? r : null;
  },
  pairs: [['road-out', 'road-in']],
  checks: [HUB_FEW],
  superseded: (g, key) => attr(g.unitInfo.get(keyId(key)), 'closed') === true,
  perspective: (g, iface, from) => {
    const toll = g.keypairInfo.get(keypairId(from, iface))?.attrs?.toll;
    return typeof toll === 'string' ? toll : null;
  },
};

const TOWN_LOOKS: Looks = {
  kinds: { ...PUBLIC_LOOKS.kinds, hub: { shape: 'square', hulls: false } },
  shapes: [...UNIT_SHAPES, { name: 'square', glsl: 'return max(abs(uv.x), abs(uv.y));' }],
};

const both = (pairs: [Key, Key][], attrs: Record<string, unknown>) =>
  pairs.flatMap(([p, q]) => [
    { from: p, to: q, attrs },
    { from: q, to: p, attrs },
  ]);

// Ash and Birch joined through a crossing, a hub joined to both, and Cedar, which is closed.
const towns = () => ({
  format: 'graphview-graph/1',
  vertices: [
    { key: 'a', label: 'Ash', attrs: { region: 'north' } },
    { key: 'b', label: 'Birch', attrs: { region: 'south' } },
    { key: 'h', label: 'Hub', attrs: { role: 'hub', region: 'north' } },
    { key: 'x', label: 'Crossing', interface: true },
    { key: 'c', label: 'Cedar', attrs: { region: 'south', closed: true } },
  ],
  edges: [
    { from: 'a', to: 'x', attrs: { type: 'road-out', toll: 'eastbound' } },
    { from: 'x', to: 'b', attrs: { type: 'road-out' } },
    { from: 'b', to: 'x', attrs: { type: 'road-in', toll: 'westbound' } },
    { from: 'x', to: 'a', attrs: { type: 'road-in' } },
    ...both(
      [
        ['h', 'a'],
        ['h', 'b'],
        ['b', 'c'],
      ],
      { type: 'lane' },
    ),
  ],
});

/** Folds each interface with two ends into a relation between its ends, with the keypairs' attributes from each end. */
function fold(g: Graph, kinds: Kinds): Graph {
  const gone = new Set<string>();
  kinds.ends.forEach((e, i) => e.length === 2 && gone.add(keyId(g.units[i])));
  const keep = ([a, b]: [Key, Key]) => !gone.has(keyId(a)) && !gone.has(keyId(b));
  const keypairs = g.keypairs.filter(keep);
  const keypairInfo = new Map<string, KeypairInfo>(
    keypairs.map(([a, b]) => [keypairId(a, b), g.keypairInfo.get(keypairId(a, b))!]),
  );
  kinds.ends.forEach((e, i) => {
    if (e.length !== 2) return;
    const x = g.units[i];
    const [a, b] = e.map((j) => g.units[j]);
    for (const [p, q] of [
      [a, b],
      [b, a],
    ]) {
      keypairs.push([p, q]);
      keypairInfo.set(keypairId(p, q), { ...g.keypairInfo.get(keypairId(p, x))!, superseded: false });
    }
  });
  return {
    ...g,
    units: g.units.filter((k) => !gone.has(keyId(k))),
    keypairs,
    unitInfo: new Map([...g.unitInfo].filter(([id]) => !gone.has(id))),
    keypairInfo,
  };
}

async function load(profile: Profile, looks?: Looks) {
  const m = new GraphModel(graphWorker, profile);
  const scene = looks ? new Scene(m, looks) : null;
  await m.load(towns());
  return { m, scene };
}

describe('§5.7 Profiles', () => {
  test('the public profile is the default: the interface kind, and no classes, pairs, checks or projection', async () => {
    const m = new GraphModel(graphWorker);
    expect(m.profile).toBe(PUBLIC_PROFILE);
    await m.load(towns());
    expect(m.stored).toBe(m.graph);
    expect(m.kindOf('h')).toBe('plain');
    expect(m.issues).toEqual([]);
  });

  test('a profile adds a kind and a check, with words, and gives classes, declared pairs, superseding and pair types', async () => {
    const { m } = await load(TOWNS);
    expect(['a', 'h', 'x'].map((k) => m.kindOf(k))).toEqual(['plain', 'hub', 'interface']);
    expect(m.issues).toEqual([{ code: 'hub-few', key: 'h', relations: 2 }]);
    expect(issueWords(m.issues[0], (k) => m.label(k), m.profile.checks)).toBe(
      'The hub Hub has 2 relations, fewer than 3.',
    );
    expect(m.types.unit.map((t) => [t.id, t.count])).toEqual([
      ['north', 2],
      ['south', 2],
    ]);
    expect(m.unitType('x')).toBeNull();
    expect(m.types.pairs.slice(0, 2)).toEqual([
      { forward: 'road-out', backward: 'road-in' },
      { forward: 'lane', backward: 'lane' },
    ]);
    expect([...m.superseded]).toEqual([0, 0, 0, 0, 1]);
    expect(m.perspectivesOf('x')).toEqual([
      { from: 'a', to: 'b', type: 'eastbound' },
      { from: 'b', to: 'a', type: 'westbound' },
    ]);
    expect(m.perspectivesOf('a')).toBeNull();
  });

  test("the scene draws each kind with its look's shape, and fades what the profile supersedes", async () => {
    const { scene } = await load(TOWNS, TOWN_LOOKS);
    const units = scene!.snapshotForTests().units;
    const of = (k: Key) => units.find((u) => u.key === k)!;
    expect(['a', 'h', 'x'].map((k) => of(k).shape)).toEqual(['disc', 'square', 'divided']);
    expect(of('c').opacity).toBeCloseTo(SUPERSEDED, 5);
    expect(of('a').opacity).toBeCloseTo(1, 5);
    expect(shapeSlot('square', TOWN_LOOKS.shapes)).toBe(UNIT_SHAPES.length);
    const fs = unitFs(TOWN_LOOKS.shapes);
    expect(fs).toContain(`if (shape < ${UNIT_SHAPES.length}.5)`);
    expect(fs).toContain('max(abs(uv.x), abs(uv.y))');
  });

  test("the inspector takes a host's section for its kind, and plain's for a kind without one", async () => {
    const { m } = await load(TOWNS);
    const hub = (() => null) as unknown as Component<SectionProps<UnitShown>>;
    expect(sectionFor(m, { kind: 'unit', key: 'h' }, { hub })).toBe(hub);
    expect(sectionFor(m, { kind: 'unit', key: 'h' })).toBe(UNIT_SECTIONS.plain);
    expect(sectionFor(m, { kind: 'unit', key: 'x' })).toBe(UNIT_SECTIONS.interface);
  });

  test("a projection folds each interface into its relation's line; issues and the fingerprint stay the stored graph's", async () => {
    const { m } = await load({ ...TOWNS, project: fold });
    expect(m.stored!.units).toContain('x');
    expect(m.graph!.units).not.toContain('x');
    expect(m.kinds.of).not.toContain('interface');
    const ab = m.relations.find((r) => [r.ka, r.kb].join() === 'a,b' || [r.ka, r.kb].join() === 'b,a');
    expect(ab && ab.ab && ab.ba).toBe(true);
    expect(m.keypairType('a', 'b')?.id).toBe('road-out');
    expect(m.issues).toEqual([{ code: 'hub-few', key: 'h', relations: 2 }]);
  });
});
