// Data from a host (specification 3.8, 3.9, 5.7 and 5.8): sources, a profile as JSON, and the two rules
// a profile may change, on an invented family: courses and the people who teach them, a revision that
// replaces a course, a class unit that defines itself, and two people related directly.
import { describe, expect, test } from 'vitest';
import { keyId, keypairId, type Key } from '../../module/core/index.ts';
import { GraphModel } from '../../module/model/model.ts';
import { PUBLIC_PROFILE } from '../../module/model/profile.ts';
import { profileFromJson } from '../../module/model/profileJson.ts';
import { DocumentSource, JsonFileSource, type GraphSource } from '../../module/model/source.ts';
import { isProfileJson, type ProfileJson } from '../../module/settings/profileJson.ts';
import { REFUSAL_TEXTS } from '../../module/settings/words.ts';
import { fill, issueOf } from '../../module/view/words.ts';

type Vertex = { key: Key; label?: string; interface?: boolean; attrs?: Record<string, unknown> };
type Edge = { from: Key; to: Key; attrs?: Record<string, unknown> };

const row = (from: Key, to: Key, pairType?: string): Edge => ({ from, to, ...(pairType && { attrs: { pairType } }) });

/** The class unit Course, which defines itself; two courses and two people; a teaching, with its member pair; a revision, with pair types on its keypairs. */
const school = (): { format: string; vertices: Vertex[]; edges: Edge[] } => ({
  format: 'graphview-graph/1',
  vertices: [
    { key: 'course', label: 'Course', attrs: { class: 'Class', classUnit: true } },
    { key: 'alg', label: 'Algebra', attrs: { class: 'Course' } },
    { key: 'alg2', label: 'Algebra II', attrs: { class: 'Course' } },
    { key: 'ada', label: 'Ada', attrs: { class: 'Person' } },
    { key: 'ben', label: 'Ben', attrs: { class: 'Person' } },
    {
      key: 't1',
      label: 't1',
      interface: true,
      attrs: {
        class: 'Teaching',
        pair: {
          type: 'teaching',
          perspectives: [
            { type: 'teaches', from: 'ada', to: 'alg' },
            { type: 'taughtBy', from: 'alg', to: 'ada' },
          ],
        },
      },
    },
    { key: 'r1', label: 'r1', interface: true, attrs: { class: 'Revision' } },
    { key: 'd1', label: 'd1', interface: true, attrs: { class: 'Definition' } },
  ],
  edges: [
    row('ada', 't1'),
    row('t1', 'alg'),
    row('alg', 't1'),
    row('t1', 'ada'),
    row('alg', 'r1', 'replacedBy'),
    row('r1', 'alg2'),
    row('alg2', 'r1', 'replaces'),
    row('r1', 'alg'),
    row('course', 'd1', 'defines'),
    row('d1', 'course'),
    row('ada', 'ben'),
    row('ben', 'ada'),
  ],
});

async function loaded(json: ProfileJson | null, doc: unknown = school()) {
  const m = new GraphModel(undefined, json ? profileFromJson(json) : PUBLIC_PROFILE);
  expect(await m.load(doc)).toBe(true);
  return m;
}

const info = (m: GraphModel, k: Key) => m.graph!.unitInfo.get(keyId(k));
const gone = (m: GraphModel) => m.graph!.units.filter((_, i) => m.superseded[i] === 1);

/** A fetch that answers every request with one status and body, and keeps the requests. */
function answer(status: number, body: string) {
  const asked: [string, RequestInit | undefined][] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    asked.push([String(input), init]);
    return new Response(body, { status });
  }) as typeof fetch;
  return { fetcher, asked };
}

describe('§5.8 Sources', () => {
  test('JsonFileSource fetches an address, asks for JSON, parses the answer and takes its name from the address', async () => {
    const { fetcher, asked } = answer(200, JSON.stringify(school()));
    const s = new JsonFileSource('/graphview/examples/school%20graph.json?v=2', fetcher);
    expect(s.name).toBe('school graph.json');
    expect(await s.load()).toEqual(school());
    expect(asked).toEqual([
      ['/graphview/examples/school%20graph.json?v=2', { headers: { accept: 'application/json' } }],
    ]);
    expect(new JsonFileSource(new URL('https://example.org/data/graph.json#top'), fetcher).name).toBe('graph.json');
  });

  test('JsonFileSource reads a file or a blob', async () => {
    const file = new File([JSON.stringify(school())], 'mine.json', { type: 'application/json' });
    expect(new JsonFileSource(file).name).toBe('mine.json');
    expect(await new JsonFileSource(file).load()).toEqual(school());
    const blob = new Blob(['{"format":"graphview-graph/1","vertices":[],"edges":[]}']);
    expect(new JsonFileSource(blob).name).toBe('graph.json');
    expect(await new JsonFileSource(blob).load()).toEqual({ format: 'graphview-graph/1', vertices: [], edges: [] });
  });

  test('JsonFileSource rejects an address that answers with an error, and text that is not JSON', async () => {
    await expect(new JsonFileSource('/missing.json', answer(404, 'Not found').fetcher).load()).rejects.toThrow(
      'the address answered 404',
    );
    await expect(new JsonFileSource('/broken.json', answer(200, '{"format":').fetcher).load()).rejects.toThrow(
      'it is not JSON',
    );
    await expect(new JsonFileSource(new Blob(['not json'])).load()).rejects.toThrow('it is not JSON');
  });

  test('DocumentSource hands over a document in memory', async () => {
    const doc = school();
    expect(await new DocumentSource(doc).load()).toBe(doc);
    expect(new DocumentSource(doc).name).toBe('graph');
    expect(new DocumentSource(doc, 'school').name).toBe('school');
  });

  test('loadFrom loads the document of a source as load does, and keeps the source', async () => {
    const m = new GraphModel();
    const source = new DocumentSource(school(), 'school');
    expect(await m.loadFrom(source)).toBe(true);
    expect(m.source).toBe(source);
    expect(m.refused).toBeNull();
    expect(m.graph!.units).toHaveLength(8);
    expect(m.relationCount()).toBe(6);
    expect(await m.load(school())).toBe(true);
    expect(m.source).toBeNull();
  });

  test('a source that fails gives the refusal "source" with its reason, in the words of the settings', async () => {
    const m = new GraphModel();
    await m.loadFrom(new DocumentSource(school()));
    const events: string[][] = [];
    m.subscribe((a) => events.push([...a]));
    expect(await m.loadFrom(new JsonFileSource('/missing.json', answer(404, '').fetcher))).toBe(true);
    expect(m.refused).toEqual({
      code: 'source',
      message: 'The graph could not be read: the address answered 404.',
      reason: 'the address answered 404',
    });
    expect(fill(m.settings.get('words.refusals')[m.refused!.code], { reason: m.refused!.reason! })).toBe(
      m.refused!.message,
    );
    expect(REFUSAL_TEXTS.source).toBe('The graph could not be read: {reason}.');
    expect(m.graph).toBeNull();
    expect(m.issues).toEqual([]);
    expect(events.some((a) => a.includes('graph'))).toBe(true);
  });

  test('a newer load wins over a source that answers late', async () => {
    let release = () => {};
    const slow: GraphSource = {
      name: 'slow',
      load: () => new Promise((done) => (release = () => done(school()))),
    };
    const m = new GraphModel();
    const first = m.loadFrom(slow);
    const second = m.load({ format: 'graphview-graph/1', vertices: [{ key: 1 }, { key: 2 }], edges: [] });
    release();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(m.graph!.units).toEqual([1, 2]);
    expect(m.source).toBeNull();
  });
});

describe('§5.7 A profile from JSON', () => {
  test('isProfileJson takes known fields of their own kind only', () => {
    const full: ProfileJson = {
      kinds: [{ id: 'interface', field: 'interface', equals: true, joins: true }],
      classField: 'class',
      classUnitField: 'classUnit',
      pairField: 'pair',
      pairTypeField: 'pairType',
      pairs: [['replaces', 'replacedBy']],
      supersededBy: ['replacedBy'],
      selfRelations: 'allowed',
      directRelations: 'issue',
    };
    expect(isProfileJson({})).toBe(true);
    expect(isProfileJson(full)).toBe(true);
    for (const bad of [
      null,
      [],
      'profile',
      { colour: 'red' },
      { kinds: [{ id: 'link', field: 'shape', equals: 'link' }] },
      { kinds: [{ id: '', field: 'shape', equals: 'link', joins: true }] },
      { classField: '' },
      { pairs: [['replaces']] },
      { supersededBy: 'replacedBy' },
      { selfRelations: 'maybe' },
      { directRelations: true },
    ])
      expect(isProfileJson(bad), JSON.stringify(bad)).toBe(false);
  });

  test('without kinds it keeps the public interface kind; classes and class units come from their fields', async () => {
    const m = await loaded({});
    expect(m.kindOf('t1')).toBe('interface');
    expect(m.kindOf('ada')).toBe('plain');
    expect(m.endsOf('t1')).toEqual(['ada', 'alg']);
    expect(m.profile.classOf!(info(m, 'alg'), 'alg')).toBe('Course');
    expect(m.profile.classOf!(info(m, 't1'), 't1')).toBe('Teaching');
    expect(m.profile.classUnit!(info(m, 'course'), 'course')).toBe(true);
    expect(m.profile.classUnit!(info(m, 'alg'), 'alg')).toBe(false);
    expect(m.profile.pairOf!(info(m, 't1'))?.type).toBe('teaching');
    expect(m.profile.pairTypeOf!(m.graph!.keypairInfo.get(keypairId('alg', 'r1')))).toBe('replacedBy');
    expect(m.profile.pairTypeOf!(m.graph!.keypairInfo.get(keypairId('t1', 'alg')))).toBeNull();
  });

  test('perspective types come from the member pair, else from the pair type of the keypair into the interface', async () => {
    const m = await loaded({});
    expect(m.perspectivesOf('t1')).toEqual([
      { from: 'ada', to: 'alg', type: 'teaches' },
      { from: 'alg', to: 'ada', type: 'taughtBy' },
    ]);
    expect(m.perspectivesOf('r1')).toEqual([
      { from: 'alg', to: 'alg2', type: 'replacedBy' },
      { from: 'alg2', to: 'alg', type: 'replaces' },
    ]);
    expect(m.perspectivesOf('d1')).toEqual([{ from: 'course', to: 'course', type: 'defines' }]);
    expect(m.perspectivesOf('ada')).toBeNull();
  });

  test('a profile may rename every field', async () => {
    const renamed = JSON.parse(
      JSON.stringify(school())
        .replaceAll('"classUnit":', '"isType":')
        .replaceAll('"class":', '"category":')
        .replaceAll('"pairType":', '"side":')
        .replaceAll('"pair":', '"members":'),
    );
    const json = { classField: 'category', classUnitField: 'isType', pairField: 'members', pairTypeField: 'side' };
    const m = await loaded(json, renamed);
    expect(m.profile.classOf!(info(m, 'alg'), 'alg')).toBe('Course');
    expect(m.profile.classUnit!(info(m, 'course'), 'course')).toBe(true);
    expect(m.perspectivesOf('t1')!.map((p) => p.type)).toEqual(['teaches', 'taughtBy']);
    expect(m.perspectivesOf('r1')!.map((p) => p.type)).toEqual(['replacedBy', 'replaces']);
    // The default names find nothing in the renamed data.
    const plain = await loaded({}, renamed);
    expect(plain.profile.classOf!(info(plain, 'alg'), 'alg')).toBeNull();
    expect(plain.perspectivesOf('t1')!.map((p) => p.type)).toEqual([null, null]);
  });

  test('kinds by an attribute: the first kind whose field equals the value; "interface" reads the row\'s own mark', async () => {
    const doc = school();
    for (const v of doc.vertices) if (v.interface) [v.interface, v.attrs] = [undefined, { ...v.attrs, shape: 'link' }];
    const m = await loaded(
      {
        kinds: [
          { id: 'link', field: 'shape', equals: 'link', joins: true },
          { id: 'class', field: 'classUnit', equals: true, joins: false },
        ],
      },
      doc,
    );
    expect(m.kindOf('t1')).toBe('link');
    expect(m.endsOf('t1')).toEqual(['ada', 'alg']);
    expect(m.kindOf('course')).toBe('class');
    expect(m.endsOf('course')).toBeNull();
    expect(m.kindOf('ada')).toBe('plain');
    // The public kind finds no interface without the mark.
    const marked = await loaded({ kinds: [{ id: 'interface', field: 'interface', equals: true, joins: true }] }, doc);
    expect(marked.kindOf('t1')).toBe('plain');
  });

  test('a unit that starts a perspective of a superseding type is superseded, by the member pair or by the pair type', async () => {
    expect(gone(await loaded({}))).toEqual([]);
    expect(gone(await loaded({ supersededBy: ['replacedBy'] }))).toEqual(['alg']);
    expect(gone(await loaded({ supersededBy: ['replaces'] }))).toEqual(['alg2']);
    expect(gone(await loaded({ supersededBy: ['taughtBy'] }))).toEqual(['alg']);
    expect(gone(await loaded({ supersededBy: ['teaches', 'replaces'] }))).toEqual(['alg2', 'ada']);
  });

  test('the setting "Profile" chooses the profile at each load; empty, the model\'s own profile serves', async () => {
    const m = new GraphModel();
    await m.load(school());
    expect(m.issues.map((i) => i.code)).toEqual(['interface-ends']);
    expect(m.setSetting('extensions.profile', { directRelations: 'sometimes' })).toBe(
      'A profile as JSON, such as {"directRelations": "issue"}, or null',
    );
    expect(m.setSetting('extensions.profile', { selfRelations: 'allowed', directRelations: 'issue' })).toBeNull();
    expect(m.issues.map((i) => i.code)).toEqual(['interface-ends']);
    await m.load(school());
    expect(m.issues).toEqual([{ code: 'direct-relation', keypair: ['ada', 'ben'] }]);
    m.setSetting('extensions.profile', null);
    await m.load(school());
    expect(m.profile).toBe(PUBLIC_PROFILE);
    expect(m.issues.map((i) => i.code)).toEqual(['interface-ends']);
  });
});

describe('§3.8 The rules a profile may change', () => {
  test('an interface with one end raises interface-ends unless the profile allows self-relations', async () => {
    expect((await loaded({})).issues).toEqual([{ code: 'interface-ends', key: 'd1', ends: 1 }]);
    expect((await loaded({ selfRelations: 'issue' })).issues).toEqual([{ code: 'interface-ends', key: 'd1', ends: 1 }]);
    expect((await loaded({ selfRelations: 'allowed' })).issues).toEqual([]);
  });

  test('a self-relation joins its end both ways; one keypair alone still raises interface-ends', async () => {
    const doc = school();
    doc.edges = doc.edges.filter((e) => !(e.from === 'd1' && e.to === 'course'));
    const codes = (await loaded({ selfRelations: 'allowed' }, doc)).issues.map((i) => i.code);
    expect(codes).toEqual(['missing-reverse', 'interface-ends']);
  });

  test('direct relations are allowed unless the profile asks for interfaces everywhere; then each raises an issue in relation order', async () => {
    expect((await loaded({ selfRelations: 'allowed' })).issues).toEqual([]);
    const doc = school();
    doc.vertices.push({ key: 'cy', label: 'Cy', attrs: { class: 'Person' } });
    doc.edges.push(row('cy', 'alg'), row('alg', 'cy'));
    const m = await loaded({ selfRelations: 'allowed', directRelations: 'issue' }, doc);
    expect(m.issues).toEqual([
      { code: 'direct-relation', keypair: ['ada', 'ben'] },
      { code: 'direct-relation', keypair: ['cy', 'alg'] },
    ]);
    expect(issueOf(m, m.issues[0])).toBe(
      'The units Ada and Ben are related directly; every relation runs through an interface.',
    );
  });

  test("the issues of the profile's rules follow the interface issues", async () => {
    const doc = school();
    doc.vertices.push({ key: 'k', label: 'k', interface: true, attrs: { class: 'Teaching' } });
    doc.edges.push(row('k', 't1'), row('t1', 'k'));
    const m = await loaded({ directRelations: 'issue' }, doc);
    expect(m.issues.map((i) => i.code)).toEqual([
      'interface-ends',
      'interface-ends',
      'interface-ends',
      'interface-pair',
      'direct-relation',
    ]);
  });
});
