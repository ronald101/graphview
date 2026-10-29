// The viewer's model (specification 5.2): the single source of truth for the graph and everything a person
// sets about its view. Commands change the model first; listeners then redraw from it.
import {
  keyId,
  keypairId,
  loadGraph,
  type Graph,
  type Key,
  type PathLimits,
  type PathSetResult,
  type RefusalCode,
  type Theme,
  type TokenName,
} from '../core/index.ts';
import { DEFAULT_OVERRIDES, EXTRA_STEPS } from '../settings/defaults.ts';
import type { SettingsFile } from '../settings/file.ts';
import { SettingsRegistry, type Refusal } from '../settings/registry.ts';
import { isToken, TOKEN_NAMES } from '../settings/setting.svelte.ts';
import { graphWorker } from '../workers/index.ts';
import type {
  Aspect,
  Filters,
  GraphWorker,
  Inspected,
  Listener,
  Mode,
  ModelIssue,
  Overrides,
  PathChoice,
  PathStep,
  Perspective,
  PlaneCounts,
  TypeInfo,
  ViewSettings,
} from './contracts.ts';
import { DEFAULT_DEPTH, type DepthRules } from './depth.ts';
import { fieldRange, NO_FILTERS } from './filters.ts';
import { NO_KINDS, type Kind, type Kinds } from './kinds.ts';
import { EXTENT, placeUnits, type LayoutRules } from './placement.ts';
import { prepare, type Prepared } from './prepare.ts';
import { PUBLIC_PROFILE, type Profile } from './profile.ts';
import { activePath, findUnit, keypairsOf, labelOf, pathSteps, perspectivesOf, planeCounts } from './queries.ts';
import { EMPTY_SCHEMA, reflectSchema, typeText, type Schema, type SchemaRules } from './schema.ts';
import { noTopology, type Chevron, type Relation } from './topology.ts';
import { buildTypes, EMPTY_TYPES, type Custom, type TypeLook, type TypeRegistry } from './typeRegistry.ts';

export { EXTENT } from './placement.ts';
export type { Chevron, Relation } from './topology.ts';
export { DEFAULT_OVERRIDES, EXTRA_STEPS };

/** The keys whose change the model reports as a display change too. */
const DISPLAY_KEYS = ['display.size', 'display.width', 'display.opacity', 'hulls.enabled'];

export class GraphModel {
  // ---------------------------------------------------------------- the graph
  /** The document as loaded, for saving. */
  doc: unknown = null;
  /** The graph as loaded; and the graph the viewer shows, the same unless the profile projects it (5.7). */
  stored: Graph | null = null;
  graph: Graph | null = null;
  /** The core's issues, then the model's own (kinds.ts). */
  issues: ModelIssue[] = [];
  refused: { code: RefusalCode; message: string } | null = null;
  schema: Schema = EMPTY_SCHEMA;
  ids: string[] = [];
  index = new Map<string, number>();
  relations: Relation[] = [];
  relationOf = new Map<string, number>();
  chevrons: Chevron[] = [];
  /** Each unit's kind, and each interface's ends. */
  kinds: Kinds = NO_KINDS;
  /** Whether each unit is superseded, by its row or by the profile. */
  superseded: Uint8Array = new Uint8Array(0);
  types: TypeRegistry = EMPTY_TYPES;
  /** x and y of each unit, in world units, y pointing up; z comes from the depth rules. */
  positions = new Float32Array(0);
  laidOut = false;
  /** The extent the graph was laid out to, in world units. */
  extent: number = EXTENT;

  // ---------------------------------------------------------------- the view
  /** The settings (5.9); the model is the registry's only writer. */
  readonly settings = new SettingsRegistry();
  /** The keys of the last change of settings, which comes with the aspect "settings". */
  changedSettings: string[] = [];
  mode: Mode = '2d';
  root: Key | null = null;
  degrees: number[] | null = null;
  target: Key | null = null;
  paths: PathSetResult | null = null;
  choice: PathChoice | null = null;
  filters: Filters = { ...NO_FILTERS };
  /** The display factors in use (6.8): the settings of the group "Display", a graph's own view included. */
  overrides: Overrides = { ...DEFAULT_OVERRIDES };
  /** The depth rules in use, from the settings of the group "Root and depth". */
  depth: DepthRules = DEFAULT_DEPTH;
  inspected: Inspected = null;
  theme: Theme = 'light';

  private custom: { unit: Custom; keypair: Custom } = { unit: new Map(), keypair: new Map() };
  /** Hulls a person turned on or off while this graph is open; null until then. */
  private hullsChosen: boolean | null = null;
  private loads = 0;
  private listeners = new Set<Listener>();
  private worker: GraphWorker | null = null;
  private run = 0;
  private ranges = new Map<string, { min: number; max: number } | null>();

  private makeWorker: (units: Key[], keypairs: [Key, Key][]) => GraphWorker;
  /** What fits the model to a family of graphs: kinds, classes, pairs, checks, superseding, projection. */
  readonly profile: Profile;

  /**
   * The worker factory is the contract for distances and paths; tests and hosts may hand in their own.
   * The default one runs in a Web Worker, or on the page when the setting "Workers" says so.
   */
  constructor(makeWorker?: (units: Key[], keypairs: [Key, Key][]) => GraphWorker, profile: Profile = PUBLIC_PROFILE) {
    this.makeWorker = makeWorker ?? ((u, k) => graphWorker(u, k, this.settings.get('performance.workers') === 'off'));
    this.profile = profile;
    this.mode = this.settings.get('view.mode');
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(...aspects: Aspect[]) {
    const set = new Set(aspects);
    for (const fn of this.listeners) fn(set);
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.listeners.clear();
  }

  // ---------------------------------------------------------------- loading

  /**
   * Loads a graph and lays it out, then applies saved view settings. Resolves to false when a
   * newer graph replaced this one first.
   */
  async load(doc: unknown, settings: Partial<ViewSettings> = {}): Promise<boolean> {
    const run = ++this.run;
    this.worker?.terminate();
    this.worker = null;
    const loaded = loadGraph(doc);
    const keep = new Set<string>(this.loads++ > 0 ? this.settings.get('view.keep') : []);
    const before = { filters: this.filters, schema: this.schema };
    this.doc = doc;
    this.root = null;
    this.degrees = null;
    this.target = null;
    this.paths = null;
    this.choice = null;
    this.inspected = null;
    this.laidOut = false;
    this.ranges.clear();
    if (!keep.has('types') || settings.types)
      this.custom = { unit: customOf(settings.types?.unit), keypair: customOf(settings.types?.keypair) };
    if (settings.mode) this.mode = settings.mode;
    else if (!keep.has('mode') && this.loads > 1) this.mode = this.settings.get('view.mode');
    // A graph's own display factors and hulls lie over the settings while it is open (D81).
    const o = settings.overrides;
    this.settings.setGraph({
      ...(o?.size !== undefined && { 'display.size': o.size }),
      ...(o?.width !== undefined && { 'display.width': o.width }),
      ...(o?.opacity !== undefined && { 'display.opacity': o.opacity }),
      ...(settings.hulls !== undefined && { 'hulls.enabled': settings.hulls }),
    });
    this.hullsChosen = null;
    this.cache();
    if (!loaded.ok) {
      this.refused = { code: loaded.code, message: loaded.message };
      this.hold(null, []);
      this.filters = { ...NO_FILTERS };
      this.laidOut = true;
      this.emit('graph');
      return true;
    }
    const p = prepare(loaded.graph, this.profile);
    const g = p.graph;
    this.refused = null;
    this.hold(p, [...loaded.issues, ...p.issues]);
    // Kept filters stay when the new graph has their fields.
    const kept =
      keep.has('filters') &&
      (before.filters.timeField === null || this.schema.timeFields.includes(before.filters.timeField)) &&
      (before.filters.weightField === null || this.schema.weightFields.includes(before.filters.weightField)) &&
      before.schema !== EMPTY_SCHEMA;
    this.filters = {
      ...NO_FILTERS,
      timeField: this.schema.timeFields[0] ?? null,
      weightField: this.schema.weightFields[0] ?? null,
      ...(kept ? before.filters : {}),
      ...settings.filters,
    };
    this.worker = this.makeWorker(g.units, g.keypairs);
    this.emit('graph');
    const layout = this.layoutRules();
    this.extent = layout.extent;
    const placed = await placeUnits(g, this.ids, this.relations, () => run === this.run, layout);
    if (!placed || run !== this.run) return false;
    this.positions = placed;
    this.laidOut = true;
    this.emit('layout');
    if (settings.root !== undefined && settings.root !== null) {
      await this.setRoot(settings.root);
      if (run !== this.run) return false;
      if (settings.target !== undefined && settings.target !== null) await this.setTarget(settings.target);
      if (run !== this.run) return false;
      if (settings.path) this.choosePath(settings.path);
    }
    return run === this.run;
  }

  /** Holds a prepared graph, or nothing for a refused file. */
  private hold(p: Prepared | null, issues: ModelIssue[]) {
    const t = p?.topology ?? noTopology();
    this.stored = p?.stored ?? null;
    this.graph = p?.graph ?? null;
    this.issues = issues;
    this.schema = p ? reflectSchema(p.graph, this.schemaRules()) : EMPTY_SCHEMA;
    this.ids = p?.ids ?? [];
    this.index = p?.index ?? new Map();
    [this.relations, this.relationOf, this.chevrons] = [t.relations, t.relationOf, t.chevrons];
    this.kinds = p?.kinds ?? NO_KINDS;
    this.superseded = p?.superseded ?? new Uint8Array(0);
    this.types = p ? this.buildTypes(p.graph, this.settings.get('types.slots')) : EMPTY_TYPES;
    this.positions = new Float32Array(2 * this.ids.length);
  }

  /** The types with the colours of the settings; the slots stay those of the graph's load. */
  private buildTypes(g: Graph, slots = this.types.look.slots): TypeRegistry {
    return buildTypes(g, this.schema, this.theme, this.custom, this.profile, this.typeLook(slots));
  }

  // ---------------------------------------------------------------- commands

  setMode(mode: Mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.emit('mode');
  }

  /** Makes a unit the root, or clears the root. A new root drops the path, which ran from the old one. */
  async setRoot(key: Key | null): Promise<void> {
    if (key !== null && !this.index.has(keyId(key))) return;
    const run = this.run;
    this.root = key;
    this.target = null;
    this.paths = null;
    this.choice = null;
    if (key === null) {
      this.degrees = null;
      this.emit('root', 'paths');
      return;
    }
    const d = await this.worker!.distances(key);
    if (run !== this.run || this.root === null || keyId(this.root) !== keyId(key)) return;
    this.degrees = d;
    this.emit('root', 'paths');
  }

  /** Paths from the root to a unit: the shortest, and those one and two steps longer. */
  async setTarget(key: Key | null): Promise<PathSetResult | null> {
    if (key === null) {
      this.target = null;
      this.paths = null;
      this.choice = null;
      this.emit('paths');
      return null;
    }
    if (this.root === null || !this.worker || !this.index.has(keyId(key))) return null;
    const run = this.run;
    const from = this.root;
    this.target = key;
    const result = await this.worker.paths(from, key, this.settings.get('paths.extraSteps'), this.pathLimits());
    if (run !== this.run || this.root !== from || this.target === null || keyId(this.target) !== keyId(key))
      return null;
    this.paths = result;
    const first = result.lengths.find((l) => l.paths.length > 0);
    this.choice =
      first && this.settings.get('paths.autoChoose') === 'first' ? { length: first.length, index: 0 } : null;
    this.emit('paths');
    return result;
  }

  /** Swaps the path's ends: the target becomes the root, and the paths run back. */
  async reversePath(): Promise<void> {
    if (this.root === null || this.target === null) return;
    const [from, to] = [this.target, this.root];
    await this.setRoot(from);
    await this.setTarget(to);
  }

  choosePath(choice: PathChoice) {
    if (!this.paths?.lengths.find((l) => l.length === choice.length)?.paths[choice.index]) return;
    this.choice = { ...choice };
    this.emit('paths');
  }

  setFilters(part: Partial<Filters>) {
    this.filters = { ...this.filters, ...part };
    this.emit('filters');
  }

  setTypeLabel(kind: 'unit' | 'keypair', id: string, label: string) {
    this.setCustom(kind, id, { label: label.trim() || id });
  }

  setTypeColour(kind: 'unit' | 'keypair', id: string, colour: string) {
    this.setCustom(kind, id, { colour });
  }

  private setCustom(kind: 'unit' | 'keypair', id: string, part: { label?: string; colour?: string }) {
    const c = this.custom[kind];
    c.set(id, { ...c.get(id), ...part });
    if (this.graph) this.types = this.buildTypes(this.graph);
    this.emit('types');
  }

  /** The display factors (6.8): a person's change writes their settings. */
  setOverrides(part: Partial<Overrides>) {
    for (const k of ['size', 'width', 'opacity'] as const)
      if (part[k] !== undefined) this.settings.set(`display.${k}`, part[k]);
    this.cache();
    this.emit('display');
  }

  /** Hulls on or off (6.9): the setting, and this graph's choice, which beats the size rule. */
  setHulls(on: boolean) {
    this.hullsChosen = on;
    this.settings.set('hulls.enabled', on);
    this.emit('display');
  }

  /** Whether hulls show: a person's choice for this graph, else the graph's own view, else the setting; large graphs start without. */
  get hulls(): boolean {
    if (this.hullsChosen !== null) return this.hullsChosen;
    const large = (this.graph?.units.length ?? 0) > this.settings.get('hulls.autoOffAbove');
    return large && !this.settings.inGraphLayer('hulls.enabled') ? false : this.settings.get('hulls.enabled');
  }

  inspect(what: Inspected) {
    this.inspected = what;
    this.emit('inspect');
  }

  setTheme(theme: Theme) {
    if (theme === this.theme) return;
    this.theme = theme;
    if (this.graph) this.types = this.buildTypes(this.graph);
    this.emit('theme', 'types');
  }

  // ---------------------------------------------------------------- settings (5.9)

  /** A person's value for a setting. A refused value changes nothing; the reason comes back. */
  setSetting(key: string, value: unknown): string | null {
    const r = this.settings.set(key, value);
    if ('refused' in r) return r.refused;
    this.settingsChanged(r.changed);
    return null;
  }

  /** Returns the keys, or every key, to the values below the person's own. */
  resetSettings(keys?: string[]) {
    this.settingsChanged(this.settings.reset(keys));
  }

  /** Takes a stored settings file: its values, its pins and its revision. */
  applySettingsFile(file: SettingsFile) {
    this.settingsChanged(this.settings.applyFile(file));
  }

  /** A person's import of a settings file: its values and pins replace the person's own. */
  importSettings(file: SettingsFile) {
    this.settingsChanged(this.settings.importFile(file));
  }

  /** The host's base values (GraphView's `settings`); returns those refused. */
  setBaseSettings(values: Record<string, unknown>): Refusal[] {
    const r = this.settings.setBase(values);
    this.settingsChanged(r.changed);
    return r.refused;
  }

  /** Shows a setting in the side bar as well, or no longer. */
  pinSetting(key: string, on: boolean) {
    this.settingsChanged(this.settings.pin(key, on));
  }

  private settingsChanged(keys: string[]) {
    if (!keys.length) return;
    this.changedSettings = keys;
    this.cache();
    const aspects: Aspect[] = ['settings'];
    const has = (prefix: string) => keys.some((k) => k.startsWith(prefix));
    if (keys.some((k) => DISPLAY_KEYS.includes(k))) aspects.push('display');
    if (has('theme.colours.') || has('types.')) {
      if (this.graph) this.types = this.buildTypes(this.graph);
      aspects.push('types');
    }
    if (keys.includes('view.mode') && this.loads === 0) {
      this.mode = this.settings.get('view.mode');
      aspects.push('mode');
    }
    this.emit(...aspects);
    // A path set follows its settings: the extra steps and the limits.
    if (has('paths.extraSteps') || has('paths.limits.') || has('performance.pathClockEvery'))
      if (this.root !== null && this.target !== null) void this.setTarget(this.target);
  }

  /** Recomputes what the model keeps from its settings. */
  private cache() {
    const s = this.settings;
    this.overrides = { size: s.get('display.size'), width: s.get('display.width'), opacity: s.get('display.opacity') };
    this.depth = {
      spacing: s.get('depth.spacing'),
      foreground: s.get('depth.foreground'),
      second: { scale: s.get('depth.second.scale'), opacity: s.get('depth.second.opacity') },
      far: { scale: s.get('depth.far.scale'), opacity: s.get('depth.far.opacity') },
      path: { scale: s.get('depth.path.scale'), opacity: s.get('depth.path.opacity'), glow: s.get('depth.path.glow') },
      dimmed: s.get('depth.dimmed'),
      maxPlanes: s.get('depth.maxPlanes'),
      frontDegrees: s.get('depth.frontDegrees'),
    };
  }

  /** The colour tokens of a theme, from the settings of the group "Theme". */
  colours(theme: Theme = this.theme): Record<TokenName, string> {
    return Object.fromEntries(TOKEN_NAMES.map((t) => [t, this.settings.get(`theme.colours.${t}`)[theme]])) as Record<
      TokenName,
      string
    >;
  }

  /** A colour setting's value as a colour: a token name gives the token's colour in the theme. */
  colour(value: string, theme: Theme = this.theme): string {
    return isToken(value) ? this.colours(theme)[value] : value;
  }

  private typeLook(slots: number): TypeLook {
    const s = this.settings;
    return {
      palette: s.get('types.palette')[this.theme],
      other: this.colour(s.get('types.otherColour')),
      surface: this.colour('surface'),
      tint: s.get('types.backwardTint'),
      slots,
    };
  }

  private schemaRules(): SchemaRules {
    const s = this.settings;
    return {
      typeFields: s.get('schema.typeFields'),
      timeNames: new RegExp(s.get('schema.timeFieldNames'), 'i'),
      datePattern: new RegExp(s.get('schema.datePattern')),
      weightMinDistinct: s.get('schema.weightMinDistinct'),
      weightFirst: s.get('schema.weightFirst'),
    };
  }

  private layoutRules(): LayoutRules {
    const s = this.settings;
    return {
      extent: s.get('layout.extent'),
      positions: s.get('layout.positions'),
      flipY: s.get('layout.flipY'),
      pinned: s.get('layout.pinned'),
      seed: s.get('layout.force.seed'),
      startSpacing: s.get('layout.force.startSpacing'),
      inline: s.get('performance.workers') === 'off',
      force: {
        batch: s.get('layout.force.batch'),
        tolerance: s.get('layout.force.tolerance'),
        maxIterations: s.get('layout.force.maxIterations'),
        barnesHutFrom: s.get('layout.force.barnesHutFrom'),
        barnesHutTheta: s.get('layout.force.barnesHutTheta'),
        large: {
          from: s.get('layout.force.large.from'),
          maxIterations: s.get('layout.force.large.maxIterations'),
          barnesHutTheta: s.get('layout.force.large.barnesHutTheta'),
        },
        gravity: s.get('layout.force.gravity'),
        strongGravityMode: s.get('layout.force.strongGravityMode'),
        scalingRatio: s.get('layout.force.scalingRatio'),
        slowDown: s.get('layout.force.slowDown'),
        linLogMode: s.get('layout.force.linLogMode'),
        outboundAttractionDistribution: s.get('layout.force.outboundAttractionDistribution'),
        adjustSizes: s.get('layout.force.adjustSizes'),
        edgeWeightInfluence: s.get('layout.force.edgeWeightInfluence'),
      },
    };
  }

  private pathLimits(): PathLimits {
    const s = this.settings;
    return {
      count: s.get('paths.limits.count'),
      list: s.get('paths.limits.list'),
      timeMs: s.get('paths.limits.timeMs'),
      clockEvery: s.get('performance.pathClockEvery'),
    };
  }

  // ---------------------------------------------------------------- queries

  /** A unit's name: its label, or its key as JSON text (1 for the number, "1" for the text). */
  label(k: Key): string {
    return labelOf(this.graph, k);
  }

  /** The unit a person typed: its label, or its key as JSON text, or a bare word for a text key. */
  find(text: string): Key | null {
    return findUnit(this.graph, this.index, text);
  }

  /** A unit's keypairs for stepping by keyboard: outgoing ones first, then incoming ones, each in file order. */
  keypairsOf(k: Key): [Key, Key][] {
    return keypairsOf(this.graph, k);
  }

  activePath(): Key[] | null {
    return activePath(this.paths, this.choice);
  }

  /** A unit's type: its class when the profile gives one, else its type field's value (6.6). */
  unitType(k: Key): TypeInfo | null {
    const i = this.index.get(keyId(k));
    const id = i === undefined ? null : (this.types.unitOf[i] ?? null);
    return id === null ? null : (this.types.unit.find((t) => t.id === id) ?? null);
  }

  keypairType(a: Key, b: Key): TypeInfo | null {
    const f = this.schema.keypairTypeField;
    const id = f ? typeText(this.graph?.keypairInfo.get(keypairId(a, b))?.attrs?.[f]) : null;
    return id === null ? null : (this.types.keypair.find((t) => t.id === id) ?? null);
  }

  /** The steps of the active path, each with the keypairs to the next unit and back. */
  pathSteps(): PathStep[] {
    const seq = this.activePath();
    const g = this.graph;
    if (!seq || !g) return [];
    const w = this.filters.weightField ?? this.schema.weightFields[0] ?? null;
    const typeLabel = (a: Key, b: Key) => this.keypairType(a, b)?.label ?? null;
    return pathSteps(g, seq, (k) => this.label(k), typeLabel, w);
  }

  /** A unit's kind: plain, or an interface. */
  kindOf(k: Key): Kind {
    const i = this.index.get(keyId(k));
    return i === undefined ? 'plain' : this.kinds.of[i];
  }

  /** The units an interface joins, in the order of its relations; null for a plain unit. */
  endsOf(k: Key): Key[] | null {
    const i = this.index.get(keyId(k));
    const e = i === undefined ? undefined : this.kinds.ends.get(i);
    return e && this.graph ? e.map((j) => this.graph!.units[j]) : null;
  }

  /** An interface's perspectives, from each end toward the other, with the profile's pair types (3.8). */
  perspectivesOf(k: Key): Perspective[] | null {
    const ends = this.endsOf(k);
    return ends && this.graph ? perspectivesOf(this.graph, k, ends, this.profile.perspective) : null;
  }

  /** Units per plane around the root (specification 7.2). */
  planeCounts(): PlaneCounts {
    return planeCounts(this.degrees, this.depth);
  }

  /** The range of a time field over all rows, or of a weight field over the keypairs. */
  fieldRange(field: string | null, kind: 'time' | 'weight'): { min: number; max: number } | null {
    const g = this.graph;
    if (!g || !field) return null;
    const key = `${kind}\t${field}`;
    if (!this.ranges.has(key)) this.ranges.set(key, fieldRange(g, field, kind, this.schema.rules));
    return this.ranges.get(key)!;
  }

  /** The view settings to save with the graph; the scene adds its camera. */
  viewSettings(): Omit<ViewSettings, 'camera'> {
    const out = (c: Custom) => Object.fromEntries(c);
    return {
      mode: this.mode,
      root: this.root,
      target: this.target,
      path: this.choice,
      filters: { ...this.filters },
      overrides: { ...this.overrides },
      hulls: this.hulls,
      types: { unit: out(this.custom.unit), keypair: out(this.custom.keypair) },
    };
  }

  /** Relations that both keypairs make, as the headline counts them. */
  relationCount(): number {
    return this.relations.filter((r) => r.ab && r.ba).length;
  }
}

const customOf = (rec: Record<string, { label?: string; colour?: string }> | undefined): Custom =>
  new Map(Object.entries(rec ?? {}));
