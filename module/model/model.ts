// The viewer's model (specification 5.2): the single source of truth for the graph and everything a person
// sets about its view. Commands change the model first; listeners then redraw from it.
import {
  keyId,
  keypairId,
  loadGraph,
  PATH_DEFAULTS,
  type Graph,
  type Key,
  type PathSetResult,
  type RefusalCode,
  type Theme,
} from '../core/index.ts';
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
import { fieldRange, NO_FILTERS } from './filters.ts';
import { HULL_LIMIT } from './hulls.ts';
import { NO_KINDS, type Kind, type Kinds } from './kinds.ts';
import { placeUnits } from './placement.ts';
import { prepare, type Prepared } from './prepare.ts';
import { PUBLIC_PROFILE, type Profile } from './profile.ts';
import { activePath, findUnit, keypairsOf, labelOf, pathSteps, perspectivesOf, planeCounts } from './queries.ts';
import { EMPTY_SCHEMA, reflectSchema, typeText, type Schema } from './schema.ts';
import { noTopology, type Chevron, type Relation } from './topology.ts';
import { buildTypes, EMPTY_TYPES, type Custom, type TypeRegistry } from './typeRegistry.ts';

export { EXTENT } from './placement.ts';
export type { Chevron, Relation } from './topology.ts';

/** Path sets: the shortest paths and those one and two steps longer (specification 6.5). */
export const EXTRA_STEPS = 2;

export const DEFAULT_OVERRIDES: Overrides = { size: 1, width: 1, opacity: 1 };

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

  // ---------------------------------------------------------------- the view
  mode: Mode = '2d';
  root: Key | null = null;
  degrees: number[] | null = null;
  target: Key | null = null;
  paths: PathSetResult | null = null;
  choice: PathChoice | null = null;
  filters: Filters = { ...NO_FILTERS };
  overrides: Overrides = { ...DEFAULT_OVERRIDES };
  hulls = true;
  /** What the person chose last; graphs over HULL_LIMIT units still start without hulls. */
  private hullsWanted = true;
  inspected: Inspected = null;
  theme: Theme = 'light';

  private custom: { unit: Custom; keypair: Custom } = { unit: new Map(), keypair: new Map() };
  private listeners = new Set<Listener>();
  private worker: GraphWorker | null = null;
  private run = 0;
  private ranges = new Map<string, { min: number; max: number } | null>();

  private makeWorker: (units: Key[], keypairs: [Key, Key][]) => GraphWorker;
  /** What fits the model to a family of graphs: kinds, classes, pairs, checks, superseding, projection. */
  readonly profile: Profile;

  /** The worker factory is the contract for distances and paths; tests and hosts may hand in their own. */
  constructor(
    makeWorker: (units: Key[], keypairs: [Key, Key][]) => GraphWorker = graphWorker,
    profile: Profile = PUBLIC_PROFILE,
  ) {
    this.makeWorker = makeWorker;
    this.profile = profile;
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
    this.doc = doc;
    this.root = null;
    this.degrees = null;
    this.target = null;
    this.paths = null;
    this.choice = null;
    this.inspected = null;
    this.laidOut = false;
    this.ranges.clear();
    this.custom = { unit: customOf(settings.types?.unit), keypair: customOf(settings.types?.keypair) };
    if (settings.mode) this.mode = settings.mode;
    if (settings.overrides) this.overrides = { ...DEFAULT_OVERRIDES, ...settings.overrides };
    if (settings.hulls !== undefined) this.hulls = settings.hulls;
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
    if (settings.hulls === undefined) this.hulls = g.units.length > HULL_LIMIT ? false : this.hullsWanted;
    this.refused = null;
    this.hold(p, [...loaded.issues, ...p.issues]);
    this.filters = {
      ...NO_FILTERS,
      timeField: this.schema.timeFields[0] ?? null,
      weightField: this.schema.weightFields[0] ?? null,
      ...settings.filters,
    };
    this.worker = this.makeWorker(g.units, g.keypairs);
    this.emit('graph');
    const placed = await placeUnits(g, this.ids, this.relations, () => run === this.run);
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
    this.schema = p ? reflectSchema(p.graph) : EMPTY_SCHEMA;
    this.ids = p?.ids ?? [];
    this.index = p?.index ?? new Map();
    [this.relations, this.relationOf, this.chevrons] = [t.relations, t.relationOf, t.chevrons];
    this.kinds = p?.kinds ?? NO_KINDS;
    this.superseded = p?.superseded ?? new Uint8Array(0);
    this.types = p ? buildTypes(p.graph, this.schema, this.theme, this.custom, this.profile) : EMPTY_TYPES;
    this.positions = new Float32Array(2 * this.ids.length);
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
    const result = await this.worker.paths(from, key, EXTRA_STEPS, PATH_DEFAULTS);
    if (run !== this.run || this.root !== from || this.target === null || keyId(this.target) !== keyId(key))
      return null;
    this.paths = result;
    const first = result.lengths.find((l) => l.paths.length > 0);
    this.choice = first ? { length: first.length, index: 0 } : null;
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
    if (this.graph) this.types = buildTypes(this.graph, this.schema, this.theme, this.custom, this.profile);
    this.emit('types');
  }

  setOverrides(part: Partial<Overrides>) {
    this.overrides = { ...this.overrides, ...part };
    this.emit('display');
  }

  setHulls(on: boolean) {
    this.hulls = on;
    this.hullsWanted = on;
    this.emit('display');
  }

  inspect(what: Inspected) {
    this.inspected = what;
    this.emit('inspect');
  }

  setTheme(theme: Theme) {
    if (theme === this.theme) return;
    this.theme = theme;
    if (this.graph) this.types = buildTypes(this.graph, this.schema, this.theme, this.custom, this.profile);
    this.emit('theme', 'types');
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
    return planeCounts(this.degrees);
  }

  /** The range of a time field over all rows, or of a weight field over the keypairs. */
  fieldRange(field: string | null, kind: 'time' | 'weight'): { min: number; max: number } | null {
    const g = this.graph;
    if (!g || !field) return null;
    const key = `${kind}\t${field}`;
    if (!this.ranges.has(key)) this.ranges.set(key, fieldRange(g, field, kind));
    return this.ranges.get(key)!;
  }

  /** The view settings to save with the graph; the scene adds its camera. */
  settings(): Omit<ViewSettings, 'camera'> {
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
