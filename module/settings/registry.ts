// The registry of settings (specification 5.9): every setting by key, in the groups the Settings dialog
// shows, and the layers their values come from. The model owns one registry and is its only writer.
import { emptySettingsFile, type SettingsFile } from './file.ts';
import { pathSettings, displaySettings, filterSettings, motionSettings } from './groups/behaviour.ts';
import { drawingSettings } from './groups/drawing.ts';
import { extensionSettings } from './groups/extensions.ts';
import { highlightSettings, scopeSettings, searchSettings } from './groups/finding.ts';
import { layoutSettings, schemaSettings, viewSettings } from './groups/data.ts';
import { accessibilitySettings, cameraSettings, keyboardSettings, pointerSettings } from './groups/input.ts';
import { textSettings, themeSettings, typeSettings } from './groups/look.ts';
import { hullSettings, labelSettings } from './groups/overlay.ts';
import { panelSettings, pictureSettings, rendererSettings, speedSettings, wordSettings } from './groups/panels.ts';
import { chevronSettings, depthSettings, issueSettings, lineSettings, unitSettings } from './groups/picture.ts';
import { same, type Setting } from './setting.svelte.ts';

type ByKey<L extends readonly Setting<unknown, string>[]> = { [S in L[number] as S['key']]: S };

const byKey = <const L extends readonly Setting<unknown, string>[]>(list: L): ByKey<L> =>
  Object.fromEntries(list.map((s) => [s.key, s])) as ByKey<L>;

/** A new set of the viewer's settings, at their defaults, in the dialog's order. */
export const viewerSettings = () =>
  byKey([
    ...themeSettings(),
    ...typeSettings(),
    ...textSettings(),
    ...viewSettings(),
    ...schemaSettings(),
    ...layoutSettings(),
    ...depthSettings(),
    ...drawingSettings(),
    ...unitSettings(),
    ...lineSettings(),
    ...chevronSettings(),
    ...issueSettings(),
    ...hullSettings(),
    ...labelSettings(),
    ...pathSettings(),
    ...filterSettings(),
    ...searchSettings(),
    ...highlightSettings(),
    ...scopeSettings(),
    ...displaySettings(),
    ...motionSettings(),
    ...cameraSettings(),
    ...keyboardSettings(),
    ...pointerSettings(),
    ...accessibilitySettings(),
    ...panelSettings(),
    ...wordSettings(),
    ...pictureSettings(),
    ...rendererSettings(),
    ...speedSettings(),
    ...extensionSettings(),
  ]);

/** The groups of the Settings dialog, in their order. */
export const SETTING_GROUPS = [
  'Theme',
  'Types',
  'Text',
  'Starting view',
  'Reading the data',
  'Layout',
  'Root and depth',
  'Drawing',
  'Units',
  'Lines',
  'Chevrons',
  'Issues',
  'Hulls',
  'Labels',
  'Paths',
  'Filters',
  'Search',
  'Highlights',
  'Scope',
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
  'Extension points',
] as const;

export type ViewerSettings = ReturnType<typeof viewerSettings>;
export type SettingKey = keyof ViewerSettings & string;
export type SettingValue<K extends SettingKey> = ViewerSettings[K]['value'];
/** Values for some settings, by key, as a host's base values or a graph's layer give them. */
export type SettingValues = { [K in SettingKey]?: SettingValue<K> };

/** A value a layer could not take, and why. */
export interface Refusal {
  key: string;
  value: unknown;
  reason: string;
}

/** A registry of the viewer's settings, at their defaults. */
export const createRegistry = () => new SettingsRegistry();

/** The keys a graph's own view may hold while it is open (D81). */
export const GRAPH_LAYER: SettingKey[] = ['display.size', 'display.width', 'display.opacity', 'hulls.enabled'];

type Layer = Record<string, unknown>;

export class SettingsRegistry {
  readonly all: ViewerSettings = viewerSettings();
  /** The host's base values, the person's values, and the open graph's own (5.9). */
  private base: Layer = {};
  private stored: Layer = {};
  private graph: Layer = {};
  /** Values of the stored file that name no setting or were refused: kept in the file, not applied. */
  private kept: Layer = {};
  private keptPins: string[] = [];
  /** What the last file could not apply, in words. */
  notes: string[] = [];
  /** The revision of the stored file these values came from. */
  revision = 0;
  /** Keys whose stored value or pin changed since the last save. */
  private dirty = new Set<string>();
  private listeners = new Set<(keys: string[]) => void>();

  get<K extends SettingKey>(key: K): SettingValue<K> {
    return this.all[key].value as SettingValue<K>;
  }

  /** The setting of a key, or undefined for a key that names none. */
  setting(key: string): Setting | undefined {
    return Object.hasOwn(this.all, key) ? (this.all[key as SettingKey] as Setting) : undefined;
  }

  list(): Setting[] {
    return Object.values(this.all) as Setting[];
  }

  /** The settings by group, in the dialog's order. */
  groups(): { title: string; settings: Setting[] }[] {
    const list = this.list();
    return SETTING_GROUPS.map((title) => ({ title, settings: list.filter((s) => s.group === title) }));
  }

  /** The value below the person's own: the host's base value, or the default. */
  below(key: string): unknown {
    return Object.hasOwn(this.base, key) ? this.base[key] : this.setting(key)?.default;
  }

  /** Whether the person's file holds a value for the key. */
  isStored(key: string): boolean {
    return Object.hasOwn(this.stored, key);
  }

  /** Whether the open graph's own view holds the key's value. */
  inGraphLayer(key: string): boolean {
    return Object.hasOwn(this.graph, key);
  }

  /** A person's value: checked, kept in the file unless it equals the value below, and over the graph's. */
  set(key: string, value: unknown): { changed: string[] } | { refused: string } {
    const s = this.setting(key);
    if (!s) return { refused: `No setting is called ${key}.` };
    const v = s.check(value);
    if (v === undefined) return { refused: s.allowed() };
    if (same(v, this.below(key))) delete this.stored[key];
    else this.stored[key] = v;
    delete this.graph[key];
    delete this.kept[key];
    this.touch([key]);
    return { changed: this.recompute([key]) };
  }

  /** Returns the keys, or every key, to the value below the person's own. */
  reset(keys?: string[]): string[] {
    const list = keys ?? [...Object.keys(this.stored), ...Object.keys(this.graph)];
    for (const k of list) {
      delete this.stored[k];
      delete this.graph[k];
    }
    this.touch(list);
    return this.recompute(list);
  }

  /** The host's base values for the keys given; undefined takes a key's base value away. Refused ones are returned. */
  setBase(values: Layer): { changed: string[]; refused: Refusal[] } {
    const gone = Object.keys(values).filter((k) => values[k] === undefined);
    const { layer, refused } = this.checked(
      Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)),
    );
    for (const k of gone) delete this.base[k];
    Object.assign(this.base, layer);
    return { changed: this.recompute([...gone, ...Object.keys(layer)]), refused };
  }

  /** The open graph's own values, for the keys of GRAPH_LAYER only; null ends the layer. */
  setGraph(values: Layer | null): string[] {
    const own = Object.fromEntries(Object.entries(values ?? {}).filter(([k]) => (GRAPH_LAYER as string[]).includes(k)));
    const keys = [...Object.keys(this.graph), ...Object.keys(own)];
    this.graph = this.checked(own).layer;
    return this.recompute(keys);
  }

  /**
   * Takes a stored file: its values over the base, its pins and its revision. Keys changed since the
   * last save keep their values, so that a file arriving late never undoes a person's change.
   */
  applyFile(file: SettingsFile): string[] {
    const keep = this.dirty;
    const keys = [...Object.keys(this.stored), ...Object.keys(file.values)];
    const stored: Layer = {};
    for (const k of keep) if (Object.hasOwn(this.stored, k)) stored[k] = this.stored[k];
    this.take(file, stored, keep);
    this.revision = file.revision;
    return this.recomputeWithPins(keys, file, keep);
  }

  /** A person's import: the file's values and pins replace the person's own, and are saved. */
  importFile(file: SettingsFile): string[] {
    const keys = [...Object.keys(this.stored), ...Object.keys(file.values)];
    this.take(file, {}, new Set());
    const changed = this.recomputeWithPins(keys, file, new Set());
    this.touch([...new Set([...keys, ...this.list().map((s) => s.key)])]);
    return changed;
  }

  private take(file: SettingsFile, stored: Layer, keep: Set<string>) {
    this.kept = {};
    this.notes = [];
    for (const [k, v] of Object.entries(file.values)) {
      if (keep.has(k)) continue;
      const s = this.setting(k);
      const ok = s?.check(v);
      if (s && ok !== undefined) {
        if (!same(ok, this.below(k))) stored[k] = ok;
        continue;
      }
      this.kept[k] = v;
      this.notes.push(
        s
          ? `${s.label}: ${s.allowed()}; the stored value was kept but not used.`
          : `No setting is called ${k}; it was kept.`,
      );
    }
    this.stored = stored;
    this.keptPins = file.pinned.filter((k) => !this.setting(k));
  }

  /** Sets the pins from a file, except those of the keys kept, and recomputes; returns the keys that changed. */
  private recomputeWithPins(keys: string[], file: SettingsFile, keep: Set<string>): string[] {
    const pins = new Set(file.pinned);
    const pinned: string[] = [];
    for (const s of this.list()) {
      if (keep.has(s.key) || s.pinned === pins.has(s.key)) continue;
      s.pinned = pins.has(s.key);
      pinned.push(s.key);
    }
    return [...new Set([...this.recompute(keys), ...pinned])];
  }

  /** The file to store: the person's values, those kept from the file, and the pins. */
  file(): SettingsFile {
    return {
      ...emptySettingsFile(this.revision),
      values: { ...this.kept, ...this.stored },
      pinned: [
        ...this.list()
          .filter((s) => s.pinned)
          .map((s) => s.key),
        ...this.keptPins,
      ],
    };
  }

  pin(key: string, on: boolean): string[] {
    const s = this.setting(key);
    if (!s || s.pinned === on) return [];
    s.pinned = on;
    this.touch([key]);
    return [key];
  }

  /** The keys changed since the last save, which the saver merges on a conflict; taking them clears them. */
  takeDirty(): Set<string> {
    const d = this.dirty;
    this.dirty = new Set();
    return d;
  }

  /** Gives keys back after a save that failed. */
  giveDirty(keys: Iterable<string>) {
    for (const k of keys) this.dirty.add(k);
  }

  /** Reports the keys whose stored value or pin changed, for the saver. */
  subscribe(fn: (keys: string[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private touch(keys: string[]) {
    for (const k of keys) this.dirty.add(k);
    for (const fn of this.listeners) fn(keys);
  }

  private checked(values: Layer): { layer: Layer; refused: Refusal[] } {
    const layer: Layer = {};
    const refused: Refusal[] = [];
    for (const [key, value] of Object.entries(values)) {
      const s = this.setting(key);
      const v = s?.check(value);
      if (s && v !== undefined) layer[key] = v;
      else refused.push({ key, value, reason: s ? s.allowed() : `No setting is called ${key}.` });
    }
    return { layer, refused };
  }

  /** Sets each key's value from its top layer; returns the keys whose value changed. */
  private recompute(keys: string[]): string[] {
    const changed: string[] = [];
    for (const key of new Set(keys)) {
      const s = this.setting(key);
      if (!s) continue;
      const v = Object.hasOwn(this.graph, key)
        ? this.graph[key]
        : Object.hasOwn(this.stored, key)
          ? this.stored[key]
          : this.below(key);
      if (same(v, s.value)) continue;
      s.value = v;
      changed.push(key);
    }
    return changed;
  }
}
