// The settings (specification 5.9 and 5.10): every class's check, the registry's defaults and layers,
// the settings file, the stores and the handler's revision rule.
import { describe, expect, test } from 'vitest';
import { PATH_DEFAULTS, tokens, type TokenName } from '../../module/core/index.ts';
import { createSettingsHandler } from '../../module/settings/handler.ts';
import { emptySettingsFile, readSettingsFile, SETTINGS_FORMAT, type SettingsFile } from '../../module/settings/file.ts';
import { SettingsRegistry, viewerSettings } from '../../module/settings/registry.ts';
import { mergeFiles, SettingsSaver } from '../../module/settings/saver.svelte.ts';
import {
  CheckboxSetting,
  ColourSetting,
  JsonSetting,
  KeysSetting,
  NumberSetting,
  OrderSetting,
  PaletteSetting,
  RangeSetting,
  SelectSetting,
  SetSetting,
  SliderSetting,
  TextSetting,
  ThemeColourSetting,
  type Setting,
} from '../../module/settings/setting.svelte.ts';
import {
  BrowserSettingsStore,
  FallbackSettingsStore,
  HttpSettingsStore,
  MemorySettingsStore,
  SettingsConflict,
} from '../../module/settings/stores.ts';

const common = { label: 'L', group: 'G', description: 'D' };

/** A stand-in for browser storage. */
class Stand implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('§5.9 Settings: each class checks its values', () => {
  const cases: [Setting, unknown[], unknown[]][] = [
    [new CheckboxSetting({ ...common, key: 'a', default: true }), [true, false], [1, 'true', null]],
    [
      new SliderSetting({ ...common, key: 'b', default: 12, min: 8, max: 24, step: 1 }),
      [8, 12.5, 24],
      [7.9, 25, '12', NaN, Infinity],
    ],
    [new NumberSetting({ ...common, key: 'c', default: 2, min: 1, whole: true }), [1, 2, 1e6], [0, 1.5, '2', null]],
    [
      new NumberSetting<'d', number | null>({ ...common, key: 'd', default: null, min: 0, none: 'no limit' }),
      [null, 0, 3.5],
      [-1, 'x'],
    ],
    [
      new RangeSetting({ ...common, key: 'e', default: [0.25, 3], min: 0, max: 10, step: 0.05 }),
      [
        [0, 10],
        [2, 2],
      ],
      [[3, 2], [0], [0, 11], 'x'],
    ],
    [
      new SelectSetting({
        ...common,
        key: 'f',
        default: 'a',
        options: [
          ['a', 'A'],
          ['b', 'B'],
        ],
      }),
      ['a', 'b'],
      ['c', 1],
    ],
    [new TextSetting({ ...common, key: 'g', default: 'x', pattern: /^.{1,3}$/ }), ['a', 'abc'], ['', 'abcd', 3]],
    [new TextSetting({ ...common, key: 'h', default: '^a', regex: true }), ['^a$', 'b|c'], ['(', 7]],
    [
      new ColourSetting({ ...common, key: 'i', default: 'ink-1' }),
      ['#FFF', '#2a78d6', 'surface'],
      ['red', '#12', 'ink-3'],
    ],
    [new ColourSetting({ ...common, key: 'j', default: '#FFFFFF', tokens: false }), ['#000000'], ['surface']],
    [
      new ThemeColourSetting({ ...common, key: 'k', default: { light: '#FFFFFF', dark: '#000000' } }),
      [{ light: '#111111', dark: '#EEE' }],
      [{ light: '#111111' }, { light: 'ink-1', dark: '#000' }, '#000'],
    ],
    [
      new PaletteSetting({ ...common, key: 'l', default: { light: ['#000'], dark: ['#FFF'] }, most: 2 }),
      [{ light: ['#000', '#111'], dark: ['#FFF'] }],
      [
        { light: [], dark: ['#FFF'] },
        { light: ['#000', '#111', '#222'], dark: ['#FFF'] },
        { light: ['x'], dark: ['#FFF'] },
      ],
    ],
    [
      new OrderSetting({
        ...common,
        key: 'm',
        default: ['a', 'b', 'c'],
        items: [
          ['a', 'A'],
          ['b', 'B'],
          ['c', 'C'],
        ],
        all: true,
      }),
      [['c', 'a', 'b']],
      [
        ['a', 'b'],
        ['a', 'a', 'b'],
        ['a', 'b', 'd'],
      ],
    ],
    [
      new OrderSetting({
        ...common,
        key: 'n',
        default: ['a'],
        items: [
          ['a', 'A'],
          ['b', 'B'],
        ],
        least: 1,
      }),
      [['b'], ['b', 'a']],
      [[], ['a', 'a']],
    ],
    [
      new SetSetting({
        ...common,
        key: 'o',
        default: [],
        items: [
          ['a', 'A'],
          ['b', 'B'],
        ],
      }),
      [[], ['b', 'a']],
      [['c'], 'a'],
    ],
    [
      new KeysSetting({ ...common, key: 'p', default: {}, actions: [['fit', 'Fit']] }),
      [{ '0': 'fit', F: 'fit' }, {}],
      [{ '0': 'zoom' }, { '': 'fit' }, ['fit']],
    ],
    [
      new JsonSetting({ ...common, key: 'q', default: [], test: (v) => Array.isArray(v) }),
      [[1, 'a', { b: null }]],
      [{}, [undefined], [() => 1]],
    ],
  ];
  for (const [s, allowed, refused] of cases) {
    test(`${s.control} ${s.key}: allowed values pass, refused ones give a reason`, () => {
      for (const v of allowed) expect(s.check(v), JSON.stringify(v)).not.toBeUndefined();
      for (const v of refused) expect(s.check(v), String(JSON.stringify(v))).toBeUndefined();
      expect(s.allowed().length).toBeGreaterThan(5);
    });
  }

  test('a set keeps its items’ order, and a default cannot be changed in place', () => {
    const s = new SetSetting({
      ...common,
      key: 'r',
      default: ['a'],
      items: [
        ['a', 'A'],
        ['b', 'B'],
      ],
    });
    expect(s.check(['b', 'a'])).toEqual(['a', 'b']);
    expect(() => (s.default as string[]).push('b')).toThrow();
  });
});

describe('§5.9 Settings: the registry', () => {
  test('every setting has a unique key, a label, a description and a known group, and its default passes its own check', () => {
    const r = new SettingsRegistry();
    const keys = r.list().map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(240);
    for (const s of r.list()) {
      expect(s.label.length, s.key).toBeGreaterThan(1);
      expect(s.description.endsWith('.'), s.key).toBe(true);
      expect(s.check(s.default), s.key).not.toBeUndefined();
      expect(s.value).toEqual(s.default);
    }
    expect(r.groups().map((g) => g.title)).toEqual([
      'Theme',
      'Types',
      'Text',
      'Starting view',
      'Reading the data',
      'Layout',
      'Root and depth',
      'Units',
      'Lines',
      'Chevrons',
      'Issues',
      'Hulls',
      'Labels',
      'Paths',
      'Filters',
      'Display',
      'Motion',
      'Camera',
      'Keyboard',
      'Pointer',
      'Accessibility',
      'Panels',
      'Words',
      'Picture',
      'Renderer',
      'Speed',
    ]);
  });

  test('the defaults equal the values sections 4 to 9 give', () => {
    const r = new SettingsRegistry();
    for (const name of Object.keys(tokens.light) as TokenName[])
      expect(r.setting(`theme.colours.${name}`)?.default).toEqual({
        light: tokens.light[name],
        dark: tokens.dark[name],
      });
    const expected: Record<string, unknown> = {
      'theme.scheme': 'system',
      'view.mode': '2d',
      'units.radius': 6,
      'lines.width': 1.5,
      'chevrons.size': 14,
      'chevrons.at.forward': 1 / 3,
      'chevrons.at.backward': 2 / 3,
      'chevrons.room': 1.5,
      'depth.spacing': 300,
      'depth.foreground': 0,
      'depth.maxPlanes': 6,
      'depth.second.scale': 0.6,
      'depth.second.opacity': 0.6,
      'depth.far.scale': 0.25,
      'depth.far.opacity': 0.15,
      'depth.path.scale': 1.2,
      'depth.dimmed': 0.05,
      'paths.extraSteps': 2,
      'paths.limits.count': PATH_DEFAULTS.count,
      'paths.limits.list': PATH_DEFAULTS.list,
      'paths.limits.timeMs': PATH_DEFAULTS.timeMs,
      'display.size': 1,
      'display.width': 1,
      'display.opacity': 1,
      'hulls.enabled': true,
      'hulls.autoOffAbove': 3000,
      'issues.supersededOpacity': 0.35,
      'labels.size': 12,
      'labels.gap': 2,
      'layout.extent': 1000,
      'motion.duration': 450,
      'motion.enabled': 'system',
      'typography.size': 14,
      'typography.sectionHeading.size': 15,
      'typography.panelHeading.size': 13,
      'typography.table': 13,
      'typography.note': 12,
      'types.slots': 64,
    };
    for (const [k, v] of Object.entries(expected)) expect(r.setting(k)?.default, k).toBe(v);
    expect(r.get('types.palette').light).toEqual([
      '#2A78D6',
      '#EB6834',
      '#1BAF7A',
      '#EDA100',
      '#E87BA4',
      '#008300',
      '#6250D6',
    ]);
  });

  test('a value set checks, writes the file only when it differs from below, and reports what changed', () => {
    const r = new SettingsRegistry();
    expect(r.set('labels.size', 30)).toEqual({ refused: 'From 8 to 28' });
    expect(r.set('nothing', 1)).toEqual({ refused: 'No setting is called nothing.' });
    expect(r.set('labels.size', 14)).toEqual({ changed: ['labels.size'] });
    expect(r.get('labels.size')).toBe(14);
    expect(r.file().values).toEqual({ 'labels.size': 14 });
    expect(r.set('labels.size', 12)).toEqual({ changed: ['labels.size'] });
    expect(r.file().values).toEqual({});
    expect(r.set('labels.size', 12)).toEqual({ changed: [] });
  });

  test('layers: defaults, the host’s base, the stored file, then the graph’s own view for display factors and hulls', () => {
    const r = new SettingsRegistry();
    const base = r.setBase({ 'labels.size': 16, 'display.size': 2, 'chevrons.size': 400, nothing: 1 });
    expect(base.changed.sort()).toEqual(['display.size', 'labels.size']);
    expect(base.refused.map((x) => x.key)).toEqual(['chevrons.size', 'nothing']);
    expect(r.get('labels.size')).toBe(16);
    // A person's value equal to the default still lies over the base.
    r.set('labels.size', 12);
    expect(r.file().values).toEqual({ 'labels.size': 12 });
    expect(r.get('labels.size')).toBe(12);
    // The graph's layer covers the display factors and hulls only, and ends with a person's change (D81).
    expect(r.setGraph({ 'display.size': 3, 'labels.size': 20, 'hulls.enabled': false }).sort()).toEqual([
      'display.size',
      'hulls.enabled',
    ]);
    expect(r.get('labels.size')).toBe(12);
    r.set('display.size', 1.5);
    expect(r.get('display.size')).toBe(1.5);
    expect(r.setGraph(null)).toEqual(['hulls.enabled']);
    expect(r.get('hulls.enabled')).toBe(true);
    expect(r.reset()).toEqual(['labels.size', 'display.size']);
    expect(r.get('display.size')).toBe(2);
    expect(r.get('labels.size')).toBe(16);
  });

  test('a stored file applies its values and pins; unknown keys and refused values stay in the file and are reported', () => {
    const r = new SettingsRegistry();
    const file: SettingsFile = {
      format: SETTINGS_FORMAT,
      revision: 3,
      values: { 'labels.size': 14, 'chevrons.size': 'big', 'no.such': [1] },
      pinned: ['display.size', 'gone.away'],
    };
    const changed = r.applyFile(file);
    expect(changed.sort()).toEqual(['display.size', 'labels.size']);
    expect(r.get('labels.size')).toBe(14);
    expect(r.get('chevrons.size')).toBe(14);
    expect(r.setting('display.size')?.pinned).toBe(true);
    expect(r.notes).toHaveLength(2);
    expect(r.revision).toBe(3);
    // The round trip keeps everything, pins included.
    expect(r.file()).toEqual(file);
  });

  test('a file arriving late never undoes a change not yet saved; an import replaces the person’s values', () => {
    const r = new SettingsRegistry();
    r.set('labels.size', 20);
    r.applyFile({ ...emptySettingsFile(4), values: { 'labels.size': 14, 'lines.width': 2 } });
    expect(r.get('labels.size')).toBe(20);
    expect(r.get('lines.width')).toBe(2);
    const seen: string[][] = [];
    r.subscribe((k) => seen.push(k));
    r.importFile({ ...emptySettingsFile(9), values: { 'chevrons.size': 20 }, pinned: ['labels.size'] });
    expect(r.get('labels.size')).toBe(12);
    expect(r.get('chevrons.size')).toBe(20);
    expect(r.setting('labels.size')?.pinned).toBe(true);
    expect(r.revision).toBe(4);
    expect(seen.length).toBe(1);
  });

  test('a new set of settings shares nothing with another', () => {
    const a = viewerSettings();
    const b = viewerSettings();
    expect(a['labels.size']).not.toBe(b['labels.size']);
  });
});

describe('§5.9 Settings: the settings file and its stores', () => {
  test('a file of another format is set aside; missing parts read as empty', () => {
    expect(readSettingsFile({ format: 'other' })).toEqual({
      ok: false,
      reason: 'The settings file is not in the format graphview-settings/1.',
    });
    expect(readSettingsFile({ format: SETTINGS_FORMAT })).toEqual({ ok: true, file: emptySettingsFile() });
    expect(readSettingsFile({ format: SETTINGS_FORMAT, revision: -1 }).ok).toBe(false);
  });

  test('memory and browser stores raise the revision and refuse another revision', async () => {
    for (const store of [new MemorySettingsStore(), new BrowserSettingsStore('k', new Stand())]) {
      expect(await store.load()).toBeNull();
      const one = await store.save({ ...emptySettingsFile(), values: { 'labels.size': 14 } });
      expect(one.revision).toBe(1);
      expect(await store.load()).toEqual(one);
      await expect(store.save(emptySettingsFile(0))).rejects.toBeInstanceOf(SettingsConflict);
    }
  });

  test('the fallback store takes the second store once the first cannot be reached', async () => {
    const down = new HttpSettingsStore('/api/settings', async () => new Response('Not found', { status: 404 }));
    const second = new MemorySettingsStore();
    const store = new FallbackSettingsStore(down, second);
    expect(await store.load()).toBeNull();
    expect(store.fellBack).toBe('The settings route answered 404.');
    expect((await store.save({ ...emptySettingsFile(), values: { 'labels.size': 13 } })).revision).toBe(1);
    expect(second.file?.values).toEqual({ 'labels.size': 13 });
  });

  test('the saver saves after the last change, and merges its changes over another viewer’s revision', async () => {
    const store = new MemorySettingsStore({ ...emptySettingsFile(5), values: { 'lines.width': 2 }, pinned: [] });
    const r = new SettingsRegistry();
    const applied: SettingsFile[] = [];
    const saver = new SettingsSaver(r, store, (f) => applied.push(f) && r.applyFile(f), 10);
    const stop = saver.start();
    r.set('labels.size', 14);
    r.pin('labels.size', true);
    await saver.flush();
    expect(saver.state).toEqual({ kind: 'saved' });
    expect(store.file).toEqual({
      format: SETTINGS_FORMAT,
      revision: 6,
      values: { 'lines.width': 2, 'labels.size': 14 },
      pinned: ['labels.size'],
    });
    expect(r.get('lines.width')).toBe(2);
    expect(applied).toHaveLength(1);
    stop();
    expect(mergeFiles(emptySettingsFile(), { ...emptySettingsFile(), values: { a: 1 } }, ['a', 'b']).values).toEqual({
      a: 1,
    });
  });
});

describe('§5.10 The settings handler', () => {
  const handler = () => {
    let text: string | null = null;
    const h = createSettingsHandler({ read: async () => text, write: async (t) => void (text = t) });
    const put = (body: unknown) =>
      h.PUT({ request: new Request('http://x/api/settings', { method: 'PUT', body: JSON.stringify(body) }) });
    const get = () => h.GET({ request: new Request('http://x/api/settings') });
    return { h, put, get, text: () => text };
  };

  test('GET answers an empty file of revision 0, then the stored file', async () => {
    const { get, put } = handler();
    expect(await (await get()).json()).toEqual(emptySettingsFile());
    await put({ ...emptySettingsFile(), values: { 'labels.size': 14 } });
    expect(await (await get()).json()).toEqual({ ...emptySettingsFile(1), values: { 'labels.size': 14 } });
  });

  test('read and write learn whose file it is from the request', async () => {
    const files = new Map<string, string>();
    const whose = (e: { request: Request }) => new URL(e.request.url).searchParams.get('who') ?? '';
    const h = createSettingsHandler({
      read: async (e) => files.get(whose(e)) ?? null,
      write: async (t, e) => void files.set(whose(e), t),
    });
    const body = JSON.stringify({ ...emptySettingsFile(), values: { 'labels.size': 20 } });
    await h.PUT({ request: new Request('http://x/s?who=a', { method: 'PUT', body }) });
    expect((await (await h.GET({ request: new Request('http://x/s?who=a') })).json()).revision).toBe(1);
    expect((await (await h.GET({ request: new Request('http://x/s?who=b') })).json()).revision).toBe(0);
  });

  test('PUT stores a file of the stored revision with its revision raised; another revision gets 409 and the stored file', async () => {
    const { put, text } = handler();
    const ok = await put({ ...emptySettingsFile(), pinned: ['display.size'] });
    expect(ok.status).toBe(200);
    expect((await ok.json()).revision).toBe(1);
    const stale = await put(emptySettingsFile(0));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ ...emptySettingsFile(1), pinned: ['display.size'] });
    expect(JSON.parse(text()!).revision).toBe(1);
    expect((await put({ format: 'other' })).status).toBe(400);
  });

  test('two saves at once: one is stored, the other gets 409', async () => {
    const { put } = handler();
    const [a, b] = await Promise.all([put(emptySettingsFile(0)), put(emptySettingsFile(0))]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });
});
