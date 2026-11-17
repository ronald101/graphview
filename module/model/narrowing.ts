// What narrows and marks the view (specification 6.7 and 6.19 to 6.21): the filter rules, the search,
// the selection, the highlight groups and the scope. The model owns one, changes it through its
// commands, and tells its listeners; each change here says whether anything changed.
import { keyId, type Graph, type Key } from '../core/index.ts';
import type { FilterRule, HighlightGroup, ModelIssue, Scope, SearchResult, SelectHow } from './contracts.ts';
import { withRule } from './filterRules.ts';
import { adjacency, neighbourhood, outsideCounts, stepsFrom } from './reach.ts';
import { searchUnits, type SearchFacts } from './search.ts';
import type { Relation } from './topology.ts';

/** The graph held, as the narrowing reads it. */
export interface Held {
  graph: Graph | null;
  index: ReadonlyMap<string, number>;
  relations: readonly Relation[];
  issues: readonly ModelIssue[];
}

/** The groups every graph has, in their order (6.20). */
export const GROUPS = ['Selection', 'Search results', 'Neighbours', 'Issues'] as const;

/** The units an issue names: its key, and the units of its keypair. */
function namedBy(issue: ModelIssue): Key[] {
  const i = issue as { key?: unknown; keypair?: unknown };
  const out: Key[] = [];
  const add = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && out.push(v);
  add(i.key);
  if (Array.isArray(i.keypair)) i.keypair.forEach(add);
  return out;
}

export class Narrowing {
  selection: Key[] = [];
  rules: FilterRule[] = [];
  scope: Scope | null = null;
  searchText = '';
  results: SearchResult[] = [];
  /** The results a person highlighted: the group Search results (6.19, 6.20). */
  found: Key[] = [];
  private on: Record<string, boolean> = { Selection: true };
  private saved: HighlightGroup[] = [];
  private held: Held = { graph: null, index: new Map(), relations: [], issues: [] };
  private adj: number[][] = [];

  /** A new graph: the selection, the search, the scope and the saved groups go; the rules stay when kept. */
  hold(held: Held, keepRules: boolean) {
    this.held = held;
    this.adj = adjacency(held.graph?.units.length ?? 0, held.relations);
    this.selection = [];
    this.searchText = '';
    this.results = [];
    this.found = [];
    this.scope = null;
    this.saved = [];
    if (!keepRules) this.rules = [];
  }

  private get units(): readonly Key[] {
    return this.held.graph?.units ?? [];
  }
  private has = (k: Key) => this.held.index.has(keyId(k));
  private known = (keys: readonly Key[]) => keys.filter(this.has);
  private indices = (keys: readonly Key[]) => this.known(keys).map((k) => this.held.index.get(keyId(k))!);
  private unique = (keys: readonly Key[]) => [...new Map(keys.map((k) => [keyId(k), k])).values()];

  /** A unit's number of relations, by index. */
  relations(i: number): number {
    return this.adj[i]?.length ?? 0;
  }

  // ---------------------------------------------------------------- selection (6.20)

  select(keys: readonly Key[], how: SelectHow): boolean {
    const before = this.selection.map(keyId).join();
    const ids = new Set(this.known(keys).map(keyId));
    const had = new Set(this.selection.map(keyId));
    if (how === 'clear') this.selection = [];
    else if (how === 'replace') this.selection = this.unique(this.known(keys));
    else if (how === 'add') this.selection = this.unique([...this.selection, ...this.known(keys)]);
    else if (how === 'remove') this.selection = this.selection.filter((k) => !ids.has(keyId(k)));
    else
      this.selection = [
        ...this.selection.filter((k) => !ids.has(keyId(k))),
        ...this.unique(this.known(keys)).filter((k) => !had.has(keyId(k))),
      ];
    return this.selection.map(keyId).join() !== before;
  }

  // ---------------------------------------------------------------- highlight groups (6.20)

  /** Every group with its units now: the four of every graph, then those a person saved. */
  groups(hops: number): HighlightGroup[] {
    const sel = this.known(this.selection);
    const steps = sel.length ? stepsFrom(this.adj, this.indices(sel), hops) : null;
    const issues = this.unique(this.held.issues.flatMap(namedBy).filter(this.has));
    const built: [string, Key[]][] = [
      ['Selection', sel],
      ['Search results', this.known(this.found)],
      ['Neighbours', steps ? this.units.filter((_, i) => steps[i] > 0) : []],
      ['Issues', issues],
    ];
    return [
      ...built.map(([name, keys]) => ({ name, keys, on: this.on[name] ?? false, saved: false })),
      ...this.saved.map((g) => ({ ...g, keys: this.known(g.keys) })),
    ];
  }

  setHighlight(name: string, on: boolean): boolean {
    const g = this.saved.find((x) => x.name === name);
    if (g) {
      if (g.on === on) return false;
      g.on = on;
      return true;
    }
    if (!(GROUPS as readonly string[]).includes(name) || (this.on[name] ?? false) === on) return false;
    this.on[name] = on;
    return true;
  }

  /** Saves the selection as a group under a name, on; a name of the four groups is refused. */
  saveHighlight(name: string): boolean {
    const n = name.trim();
    if (!n || (GROUPS as readonly string[]).includes(n) || !this.selection.length) return false;
    this.saved = [
      ...this.saved.filter((g) => g.name !== n),
      { name: n, keys: [...this.selection], on: true, saved: true },
    ];
    return true;
  }

  removeHighlight(name: string): boolean {
    const before = this.saved.length;
    this.saved = this.saved.filter((g) => g.name !== name);
    return this.saved.length !== before;
  }

  /** The units of the groups that are on, by index (1 or 0); null when they hold no unit. */
  emphasis(hops: number): Uint8Array | null {
    const on = this.groups(hops).filter((g) => g.on && g.keys.length);
    if (!on.length) return null;
    const out = new Uint8Array(this.units.length);
    for (const g of on) for (const i of this.indices(g.keys)) out[i] = 1;
    return out;
  }

  // ---------------------------------------------------------------- filter rules (6.7)

  setRule(rule: FilterRule): boolean {
    const before = JSON.stringify(this.rules);
    this.rules = withRule(this.rules, rule);
    return JSON.stringify(this.rules) !== before;
  }

  clearRules(): boolean {
    const had = this.rules.length > 0;
    this.rules = [];
    return had;
  }

  // ---------------------------------------------------------------- search (6.19)

  setSearch(text: string, facts: SearchFacts, limit: number): void {
    this.searchText = text;
    this.results = this.held.graph ? searchUnits(this.held.graph, text, facts, limit) : [];
  }

  /** Adds a unit to the group Search results, and turns the group on. */
  highlightResult(key: Key): boolean {
    if (!this.has(key) || (this.found.some((k) => keyId(k) === keyId(key)) && this.on['Search results'])) return false;
    this.found = this.unique([...this.found, key]);
    this.on['Search results'] = true;
    return true;
  }

  // ---------------------------------------------------------------- scope (6.21)

  private setScope(centres: readonly Key[], units: readonly number[]): boolean {
    const before = JSON.stringify(this.scope);
    const keep = new Set(units);
    // The scope keeps file order, so that its list does not depend on how it grew.
    this.scope = { centres: [...centres], units: this.units.filter((_, i) => keep.has(i)) };
    return JSON.stringify(this.scope) !== before;
  }

  /** The chosen units and those within `hops` steps of them, up to `limit`. */
  showNeighbourhood(keys: readonly Key[], hops: number, limit: number): boolean {
    const from = this.indices(this.unique(keys));
    if (!from.length) return false;
    return this.setScope(this.unique(this.known(keys)), neighbourhood(this.adj, from, hops, limit));
  }

  /** Adds the neighbours of the chosen units, more relations first, while the scope holds fewer than `limit`. */
  expand(keys: readonly Key[], limit: number): boolean {
    if (!this.scope) return false;
    const now = this.indices(this.scope.units);
    const inside = new Set(now);
    const from = this.indices(keys);
    const add = [...new Set(from.flatMap((i) => this.adj[i]))]
      .filter((j) => !inside.has(j))
      .sort((p, q) => this.adj[q].length - this.adj[p].length || p - q);
    const room = Math.max(0, limit - now.length);
    return this.setScope(this.scope.centres, [...now, ...from, ...add.slice(0, room)]);
  }

  /** Takes units out of the scope; without a scope, the scope becomes every other unit. */
  hide(keys: readonly Key[]): boolean {
    const gone = new Set(this.known(keys).map(keyId));
    if (!gone.size) return false;
    const now = this.scope ? this.indices(this.scope.units) : this.units.map((_, i) => i);
    const centres = (this.scope?.centres ?? []).filter((k) => !gone.has(keyId(k)));
    return this.setScope(
      centres,
      now.filter((i) => !gone.has(keyId(this.units[i]))),
    );
  }

  showAll(): boolean {
    const had = this.scope !== null;
    this.scope = null;
    return had;
  }

  /** A unit outside the scope that becomes the root, the target or the inspected unit joins it. */
  include(key: Key): boolean {
    if (!this.scope || !this.has(key) || this.scope.units.some((k) => keyId(k) === keyId(key))) return false;
    return this.setScope(this.scope.centres, [...this.indices(this.scope.units), this.held.index.get(keyId(key))!]);
  }

  /** Whether each unit is in the scope (1 or 0); null without a scope. */
  inScope(): Uint8Array | null {
    if (!this.scope) return null;
    const out = new Uint8Array(this.units.length);
    for (const i of this.indices(this.scope.units)) out[i] = 1;
    return out;
  }

  /** Each unit's relations to units outside the scope; null without a scope. */
  outside(): Uint32Array | null {
    const inside = this.inScope();
    return inside ? outsideCounts(this.adj, inside) : null;
  }
}
