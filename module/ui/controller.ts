// The module's state and behaviour, independent of Svelte: data, view state, geometry,
// hit-testing, the scene, commands and events (specification Parts D and E).
import {
  currentGraph,
  degrees,
  fingerprint,
  keyId,
  keypairId,
  loadGraph,
  ringIndex,
  tokens as baseTokens,
  type Graph,
  type Issue,
  type Key,
  type PathSetResult,
  type RefusalCode,
  type TokenName,
} from '../core/index.ts';
import type { Engine } from '../engine/index.ts';
import { runForce, runPathSet } from '../workers/index.ts';
import type {
  DeepPartial,
  GraphViewEvents,
  HalfRole,
  IssueItem,
  LayoutName,
  Look,
  Overlay,
  Release2,
  Scene,
  SceneHalf,
  SceneUnit,
  ViewState,
} from '../types.ts';
import { clone, defaultLook, defaultViewState, merge } from './defaults.ts';
import { placeLabels, type PlacedLabel } from './labels.ts';
import {
  circleLayout,
  givenLayout,
  gridLayout,
  placeMissing,
  ringLayout,
  SPACING,
  startPositions,
  type Positions,
  type RingLayout,
} from './layouts.ts';

export const UNIT_RADIUS = 6;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 40;
export const FIT_MARGIN = 24;
export const CLICK_HALF_WIDTH = 12;
export const SHORT_HALF = 24;
export const ICON_MIN_HALF = 40;
const RELEASE_2: Release2 = { ok: false, reason: 'release-2' };

export interface Relation {
  id: string;
  a: Key;
  b: Key;
  ia: string;
  ib: string;
  /** Whether the keypair (a, b) and (b, a) exist in the graph in use. */
  ab: boolean;
  ba: boolean;
}

interface Anim {
  from: Positions;
  to: Positions;
  start: number;
  duration: number;
  resolve: () => void;
}

export type Theme = 'light' | 'dark';

export class Controller {
  // Data
  doc: unknown = null;
  stored: Graph | null = null;
  issues: Issue[] = [];
  refused: { code: RefusalCode; message: string } | null = null;
  graph: Graph | null = null;
  fingerprint = '';
  relations: Relation[] = [];
  relationOf = new Map<string, Relation>();
  unitIndex = new Map<string, number>();
  neighbours = new Map<string, Set<string>>();
  out = new Map<string, Key[]>();
  inc = new Map<string, Key[]>();
  degree = new Map<string, number>();
  issueUnits = new Set<string>();

  // View
  view: ViewState = defaultViewState();
  look: Look = defaultLook();
  overlays: Overlay[] = [];
  positions: Positions = new Map();
  extent = { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  ring: RingLayout | null = null;
  distance = new Map<string, number>();
  hover: { unit: Key | null; keypair: [Key, Key] | null } = { unit: null, keypair: null };
  cursor = -1;
  flyTarget: string | null = null;
  pathResult: PathSetResult | null = null;
  pathHover: { length: number; index: number } | null = null;
  pathFrom: Key | null = null;
  systemDark = false;
  reducedMotion = false;
  width = 0;
  height = 0;
  labels: PlacedLabel[] = [];
  announcement = '';

  private engine: Engine | null = null;
  private anim: Anim | null = null;
  private camAnim: {
    from: ViewState['camera'];
    to: ViewState['camera'];
    start: number;
    duration: number;
    resolve: () => void;
  } | null = null;
  private listeners = new Set<() => void>();
  private events: GraphViewEvents = {};
  private cameraTimer: ReturnType<typeof setTimeout> | null = null;
  private cameraLast = 0;
  private viewTimer: ReturnType<typeof setTimeout> | null = null;
  private frame = 0;
  private layoutRun = 0;
  private measureCache = new Map<string, number>();
  measure: (text: string, bold: boolean) => number = (t) => t.length * 7;

  // ---------------------------------------------------------------- wiring

  setEvents(events: GraphViewEvents) {
    this.events = events;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Tells the panels that something changed. */
  notify() {
    for (const fn of this.listeners) fn();
  }

  attach(engine: Engine) {
    this.engine = engine;
    engine.onRender(() => this.afterRender?.());
    this.pushItems();
  }

  afterRender: (() => void) | null = null;

  detach() {
    this.engine = null;
    if (this.cameraTimer) clearTimeout(this.cameraTimer);
    if (this.viewTimer) clearTimeout(this.viewTimer);
    cancelAnimationFrame(this.frame);
  }

  get motion(): boolean {
    return this.look.motion === 'on' || (this.look.motion === 'system' && !this.reducedMotion);
  }

  get theme(): Theme {
    return this.look.theme === 'system' ? (this.systemDark ? 'dark' : 'light') : this.look.theme;
  }

  /** The colour tokens in use: the theme's, with the host's overrides. */
  get colours(): Record<TokenName, string> {
    return { ...baseTokens[this.theme], ...this.look.tokens } as Record<TokenName, string>;
  }

  // ---------------------------------------------------------------- data

  /** Loads a document. With `stable`, units that stay keep their places (V11). */
  setGraph(doc: unknown, stable: boolean) {
    this.doc = doc;
    const before = new Map(this.positions);
    const r = loadGraph(doc);
    if (!r.ok) {
      this.refused = { code: r.code, message: r.message };
      this.stored = this.graph = null;
      this.issues = [];
      this.relations = [];
      this.positions = new Map();
      this.pushItems();
      this.emit('onissues', [{ code: 'refused', refusal: r.code }]);
      this.notify();
      return;
    }
    this.refused = null;
    this.stored = r.graph;
    this.issues = r.issues;
    this.issueUnits = new Set();
    for (const i of r.issues) {
      if (i.code === 'orphan') this.issueUnits.add(keyId(i.key));
      if (i.code === 'missing-reverse') this.issueUnits.add(keyId(i.keypair[0]));
    }
    this.useGraph();
    const keep = stable && before.size > 0;
    if (keep) {
      const kept: Positions = new Map();
      for (const k of this.graph!.units) {
        const p = before.get(keyId(k));
        if (p) kept.set(keyId(k), p);
      }
      this.positions = placeMissing(this.graph!, kept, this.view.layout.seed);
      this.pushItems();
      this.refreshDerived();
      this.layoutSettled();
    } else {
      const allPlaced = this.graph!.units.every((k) => this.graph!.unitInfo.get(keyId(k))?.pos);
      if (!this.viewGiven) this.view.layout.name = allPlaced ? 'given' : 'force';
      this.positions = new Map();
      void this.runLayout(false);
    }
    this.emit('onissues', this.issueItems());
    this.notify();
  }

  /** True once a host has given a layout through the view state. */
  viewGiven = false;
  /** A camera given before the first layout finished; it wins over fitting. */
  pendingCamera: ViewState['camera'] | null = null;

  issueItems(): IssueItem[] {
    const items: IssueItem[] = [...this.issues];
    const fp = this.fingerprint;
    for (const o of this.overlays) if (o.graph !== fp) items.push({ code: 'overlay-mismatch', overlay: o.id });
    return items;
  }

  setOverlays(overlays: Overlay[]) {
    this.overlays = overlays;
    if (overlays.some((o) => o.graph !== this.fingerprint)) this.emit('onissues', this.issueItems());
  }

  /** Chooses the stored or the current graph, and rebuilds the indexes (B4). */
  private useGraph() {
    if (!this.stored) return;
    this.graph = this.look.superseded === 'hide' ? currentGraph(this.stored) : this.stored;
    const g = this.graph;
    this.fingerprint = fingerprint(g);
    this.unitIndex = new Map(g.units.map((k, i) => [keyId(k), i]));
    this.relations = [];
    this.relationOf = new Map();
    this.neighbours = new Map(g.units.map((k) => [keyId(k), new Set<string>()]));
    this.out = new Map(g.units.map((k) => [keyId(k), []]));
    this.inc = new Map(g.units.map((k) => [keyId(k), []]));
    const pairs = new Set(g.keypairs.map(([a, b]) => keypairId(a, b)));
    for (const [a, b] of g.keypairs) {
      const ia = keyId(a);
      const ib = keyId(b);
      this.out.get(ia)!.push(b);
      this.inc.get(ib)!.push(a);
      this.neighbours.get(ia)!.add(ib);
      this.neighbours.get(ib)!.add(ia);
      if (this.relationOf.has(keypairId(a, b))) continue;
      const rel: Relation = { id: keypairId(a, b), a, b, ia, ib, ab: true, ba: pairs.has(keypairId(b, a)) };
      this.relations.push(rel);
      this.relationOf.set(keypairId(a, b), rel);
      this.relationOf.set(keypairId(b, a), rel);
    }
    this.degree = new Map(degrees(g).map((d) => [keyId(d.key), d.relations]));
    // Drop selections and ends that no longer exist.
    const has = (k: Key) => this.unitIndex.has(keyId(k));
    this.view.selection = {
      units: this.view.selection.units.filter(has),
      keypairs: this.view.selection.keypairs.filter(([a, b]) => pairs.has(keypairId(a, b))),
    };
    if (this.view.focus !== null && !has(this.view.focus)) this.view.focus = null;
  }

  /** Recomputes what depends on the focus. */
  refreshDerived() {
    this.distance = new Map();
    if (this.graph && this.view.focus !== null) {
      const d = ringIndex(this.graph, this.view.focus);
      this.graph.units.forEach((k, i) => {
        if (d[i] >= 0) this.distance.set(keyId(k), d[i]);
      });
    }
  }

  // ---------------------------------------------------------------- layouts

  /** Runs the layout of the view state, keeping pinned units in place. */
  async runLayout(animate = true): Promise<void> {
    const g = this.graph;
    if (!g) return;
    const run = ++this.layoutRun;
    const L = this.view.layout;
    const pinned: Positions = new Map(L.pinned.map((p) => [keyId(p.key), { x: p.x, y: p.y }]));
    let target: Positions;
    this.ring = null;
    switch (L.name) {
      case 'circle':
        target = circleLayout(g.units);
        break;
      case 'grid':
        target = gridLayout(g.units);
        break;
      case 'rings': {
        const focus = this.view.focus ?? this.view.selection.units[0] ?? g.units[0];
        if (focus === undefined) return;
        if (this.view.focus === null) this.view.focus = focus;
        this.ring = ringLayout(g, focus);
        target = this.ring.positions;
        break;
      }
      case 'given':
        target = givenLayout(g, pinned, L.seed);
        break;
      case 'force': {
        const start = startPositions(g.units, L.seed);
        for (const [id, p] of pinned) start.set(id, p);
        const ids = g.units.map(keyId);
        const out = await runForce({
          units: ids,
          links: this.relations.map((r) => [this.unitIndex.get(r.ia)!, this.unitIndex.get(r.ib)!] as [number, number]),
          start: ids.map((id) => start.get(id)!),
          pinned: ids.flatMap((id, i) => (pinned.has(id) ? [i] : [])),
          settings: L.settings,
        });
        if (run !== this.layoutRun) return;
        target = new Map(ids.map((id, i) => [id, out.positions[i]]));
        break;
      }
    }
    for (const [id, p] of pinned) if (target.has(id)) target.set(id, p);
    this.refreshDerived();
    const first = this.positions.size === 0;
    this.setExtentFrom(target, L.name === 'force' ? pinned : new Map());
    if (first) {
      this.positions = new Map(target);
      this.pushItems();
      this.view.camera = this.pendingCamera ?? this.fitCamera(this.visibleIds());
      this.pendingCamera = null;
      this.applyCamera();
    } else {
      this.pushItems();
      await this.moveTo(target, animate && this.motion ? 400 : 0);
      this.view.camera = { ...this.view.camera, ...this.fitCamera(this.visibleIds()), angle: this.view.camera.angle };
      this.applyCamera();
    }
    this.layoutSettled();
    this.changed();
  }

  private layoutSettled() {
    if (!this.graph) return;
    this.emit('onlayoutsettled', {
      name: this.view.layout.name,
      positions: this.graph.units.map((k) => ({ key: k, ...this.positions.get(keyId(k))! })),
    });
  }

  private setExtentFrom(positions: Positions, _pinned: Positions) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of positions.values()) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX)) minX = minY = maxX = maxY = 0;
    // A single point or a line still needs an area.
    const pad = Math.max(maxX - minX, maxY - minY) * 0.0 + (maxX - minX < 1e-9 && maxY - minY < 1e-9 ? 50 : 0);
    this.extent = { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    this.engine?.setExtent(this.extent);
  }

  /** Moves units to new places over a duration, or at once. */
  private moveTo(target: Positions, duration: number): Promise<void> {
    if (this.anim) this.anim.resolve();
    if (duration <= 0) {
      this.positions = new Map(target);
      this.engine?.setPositions(this.positions);
      this.applyCamera();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.anim = { from: new Map(this.positions), to: target, start: performance.now(), duration, resolve };
      this.tick();
    });
  }

  private tick = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame((now) => {
      let more = false;
      if (this.anim) {
        const a = this.anim;
        const t = Math.min(1, (now - a.start) / a.duration);
        const e = 1 - Math.pow(1 - t, 3);
        const next: Positions = new Map();
        for (const [id, to] of a.to) {
          const from = a.from.get(id) ?? to;
          next.set(id, { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
        }
        this.positions = next;
        this.engine?.setPositions(next);
        if (t >= 1) {
          this.anim = null;
          a.resolve();
        } else more = true;
      }
      if (this.camAnim) {
        const c = this.camAnim;
        const t = Math.min(1, (now - c.start) / c.duration);
        const e = 1 - Math.pow(1 - t, 3);
        const lerp = (x: number, y: number) => x + (y - x) * e;
        const zoom = Math.exp(lerp(Math.log(c.from.zoom), Math.log(c.to.zoom)));
        let da = c.to.angle - c.from.angle;
        da = ((((da + 180) % 360) + 360) % 360) - 180;
        this.view.camera = { x: lerp(c.from.x, c.to.x), y: lerp(c.from.y, c.to.y), zoom, angle: c.from.angle + da * e };
        if (t >= 1) {
          this.view.camera = { ...c.to };
          this.camAnim = null;
          c.resolve();
        } else more = true;
      }
      this.applyCamera();
      if (more) this.tick();
    });
  };

  // ---------------------------------------------------------------- engine sync

  /** Sends units and halves to the engine, with their styles. */
  pushItems() {
    const e = this.engine;
    if (!e) return;
    if (!this.graph) {
      e.setItems([], []);
      e.render();
      return;
    }
    {
      const units = this.graph.units.map((k) => {
        const id = keyId(k);
        const p = this.positions.get(id) ?? { x: 0, y: 0 };
        return { id, x: p.x, y: p.y, color: '#000', hidden: false };
      });
      const segs = [];
      const draw = this.look.relations.draw;
      for (const r of this.relations) {
        if (draw === 'lines') {
          segs.push({
            id: r.id,
            from: r.ia,
            to: r.ib,
            shape: 'line' as const,
            relation: r.id,
            color: '#000',
            width: 1.5,
            hidden: false,
          });
          continue;
        }
        if (r.ab) segs.push(this.seg(r, r.a, r.b, draw));
        if (r.ba) segs.push(this.seg(r, r.b, r.a, draw));
      }
      e.setItems(units, segs);
      e.setExtent(this.extent);
    }
    this.restyle();
  }

  private seg(r: Relation, from: Key, to: Key, draw: Look['relations']['draw']) {
    return {
      id: keypairId(from, to),
      from: keyId(from),
      to: keyId(to),
      shape: draw === 'arrows' ? ('arc' as const) : ('half' as const),
      relation: r.id,
      color: '#000',
      width: 1.5,
      hidden: false,
    };
  }

  /** Recomputes colours and visibility, and sends them to the engine. */
  restyle() {
    const e = this.engine;
    if (!e || !this.graph) return;
    const st = this.styles();
    e.setStyles(st.units, st.segments);
    e.render();
  }

  applyCamera() {
    if (!this.engine) return;
    this.engine.setCamera(this.view.camera);
    this.engine.render();
    this.cameraMoved();
  }

  // ---------------------------------------------------------------- states

  visibleIds(): string[] {
    if (!this.graph) return [];
    const v = this.visibility();
    return this.graph.units.map(keyId).filter((id) => v.get(id));
  }

  /** Whether each unit is visible after the radius, the superseded setting and the filters (V14, V16). */
  visibility(): Map<string, boolean> {
    const out = new Map<string, boolean>();
    if (!this.graph) return out;
    const beyondHidden = this.view.beyond === 'hide';
    for (const k of this.graph.units) out.set(keyId(k), !(beyondHidden && this.isBeyond(keyId(k))));
    if (this.view.filters.hideLoneUnits) {
      const hasVisibleRelation = new Set<string>();
      for (const r of this.relations) {
        if (out.get(r.ia) && out.get(r.ib)) {
          hasVisibleRelation.add(r.ia);
          hasVisibleRelation.add(r.ib);
        }
      }
      for (const [id, vis] of out) if (vis && !hasVisibleRelation.has(id)) out.set(id, false);
    }
    return out;
  }

  isBeyond(id: string): boolean {
    if (this.view.focus === null || this.view.radius === null) return false;
    const d = this.distance.get(id);
    return d === undefined || d > this.view.radius;
  }

  isSuperseded(id: string): boolean {
    return this.stored?.unitInfo.get(id)?.superseded === true;
  }

  isKeypairSuperseded(a: Key, b: Key): boolean {
    return (
      this.stored?.keypairInfo.get(keypairId(a, b))?.superseded === true ||
      this.isSuperseded(keyId(a)) ||
      this.isSuperseded(keyId(b))
    );
  }

  /** Units and keypairs lit by the hover (V12), or null when nothing is hovered. */
  lit(): { units: Set<string>; keypairs: Set<string> } | null {
    const h = this.hover;
    if (h.unit !== null) {
      const id = keyId(h.unit);
      const units = new Set([id, ...(this.neighbours.get(id) ?? [])]);
      const keypairs = new Set<string>();
      for (const b of this.out.get(id) ?? []) keypairs.add(keypairId(h.unit, b));
      for (const a of this.inc.get(id) ?? []) keypairs.add(keypairId(a, h.unit));
      return { units, keypairs };
    }
    if (h.keypair) {
      const [a, b] = h.keypair;
      return { units: new Set([keyId(a), keyId(b)]), keypairs: new Set([keypairId(a, b), keypairId(b, a)]) };
    }
    return null;
  }

  /** Keypairs of the lit path or paths, with use counts per relation for "show all" (V17). */
  pathLit(): { keypairs: Set<string>; uses: Map<string, number>; max: number } {
    const keypairs = new Set<string>();
    const uses = new Map<string, number>();
    const res = this.pathResult;
    if (!res) return { keypairs, uses, max: 0 };
    const add = (p: Key[]) => {
      for (let i = 0; i + 1 < p.length; i++) {
        keypairs.add(keypairId(p[i], p[i + 1]));
        const rel = this.relationOf.get(keypairId(p[i], p[i + 1]));
        if (rel) uses.set(rel.id, (uses.get(rel.id) ?? 0) + 1);
      }
    };
    const one = this.pathHover ?? this.view.paths.lit;
    if (this.view.paths.showAll !== null) {
      const l = res.lengths.find((x) => x.length === this.view.paths.showAll);
      for (const p of l?.paths ?? []) add(p);
    } else if (one) {
      const p = res.lengths.find((x) => x.length === one.length)?.paths[one.index];
      if (p) add(p);
    }
    return { keypairs, uses, max: Math.max(0, ...uses.values()) };
  }

  /** Colour by keypair attribute: the three most frequent values take the three hues (D5). */
  attrColours(): Map<string, number> | null {
    const c = this.look.relations.colour;
    if (typeof c !== 'object' || !this.graph) return null;
    const counts = new Map<string, number>();
    for (const [a, b] of this.graph.keypairs) {
      const v = this.graph.keypairInfo.get(keypairId(a, b))?.attrs?.[c.attr];
      if (v === undefined) continue;
      const s = JSON.stringify(v);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const top = [...counts].sort((x, y) => y[1] - x[1]).slice(0, 3);
    return new Map(top.map(([v], i) => [v, i]));
  }

  /** The role of the half that shows keypair (from, to) (V18). */
  halfRole(from: Key, to: Key, missing: boolean, path: Set<string>, attr: Map<string, number> | null): HalfRole {
    if (missing) return 'issue';
    const id = keypairId(from, to);
    if (path.has(id)) return 'path';
    const c = this.look.relations.colour;
    if (c === 'around-selection') {
      const sel = new Set(this.view.selection.units.map(keyId));
      if (sel.has(keyId(from))) return 'outgoing';
      if (sel.has(keyId(to))) return 'incoming';
    } else if (typeof c === 'object' && attr && this.graph) {
      const v = this.graph.keypairInfo.get(id)?.attrs?.[c.attr];
      if (v !== undefined && attr.has(JSON.stringify(v))) return `attr:${String(v)}`;
    }
    return 'context';
  }

  roleColour(role: HalfRole, attr: Map<string, number> | null): string {
    const t = this.colours;
    if (role === 'outgoing' || role === 'incoming' || role === 'path' || role === 'issue') return t[role];
    if (role.startsWith('attr:') && attr) {
      const value = role.slice(5);
      for (const [v, i] of attr) {
        const plain = (() => {
          try {
            return String(JSON.parse(v));
          } catch {
            return v;
          }
        })();
        if (plain === value) return [t.outgoing, t.incoming, t.path][i];
      }
    }
    return t.context;
  }

  /** Styles for the engine. */
  styles() {
    const t = this.colours;
    const vis = this.visibility();
    const lit = this.lit();
    const path = this.pathLit();
    const attr = this.attrColours();
    const selKeypairs = new Set(this.view.selection.keypairs.map(([a, b]) => keypairId(a, b)));
    const units = new Map<string, { color: string; hidden: boolean }>();
    const alpha = (id: string) => {
      if (lit && !lit.units.has(id)) return 0.2;
      if ((this.isSuperseded(id) && this.look.superseded === 'fade') || this.isBeyond(id)) return 0.35;
      return 1;
    };
    for (const k of this.graph!.units) {
      const id = keyId(k);
      units.set(id, { color: rgba(t.context, alpha(id)), hidden: !vis.get(id) });
    }
    const segments = new Map<string, { color: string; width: number; hidden: boolean }>();
    const draw = this.look.relations.draw;
    for (const r of this.relations) {
      const hidden = !vis.get(r.ia) || !vis.get(r.ib);
      const relFaded = this.isBeyond(r.ia) || this.isBeyond(r.ib);
      const style = (from: Key, to: Key) => {
        const id = keypairId(from, to);
        const role = this.halfRole(from, to, false, path.keypairs, attr);
        let a = 1;
        if (lit && !lit.keypairs.has(id)) a = 0.2;
        else if ((this.look.superseded === 'fade' && this.isKeypairSuperseded(from, to)) || relFaded) a = 0.35;
        let width = selKeypairs.has(id) || role === 'path' ? 3 : 1.5;
        if (this.view.paths.showAll !== null && path.uses.has(r.id)) {
          width = 2 + (4 * ((path.uses.get(r.id) ?? 1) - 1)) / Math.max(1, path.max - 1);
        }
        return { color: rgba(this.roleColour(role, attr), a), width, hidden };
      };
      if (draw === 'lines') {
        const s = style(r.a, r.b);
        segments.set(r.id, { ...s, color: rgba(t.context, lit && !lit.units.has(r.ia) ? 0.2 : 1) });
        continue;
      }
      if (r.ab) segments.set(keypairId(r.a, r.b), style(r.a, r.b));
      if (r.ba) segments.set(keypairId(r.b, r.a), style(r.b, r.a));
    }
    return { units, segments };
  }

  // ---------------------------------------------------------------- camera

  /** The camera that shows the given units with a margin of 24 pixels (V03). */
  fitCamera(ids: string[]): ViewState['camera'] {
    const angle = this.view.camera.angle;
    const pts = ids.map((id) => this.positions.get(id)).filter((p) => p !== undefined);
    if (!pts.length || !this.engine) return { x: 0, y: 0, zoom: 1, angle };
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Rotated coordinates: screen x = x cos − y sin, screen y = x sin + y cos.
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of pts) {
      const u = p.x * cos - p.y * sin;
      const v = p.x * sin + p.y * cos;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const cu = (minU + maxU) / 2;
    const cv = (minV + maxV) / 2;
    const x = cu * cos + cv * sin;
    const y = -cu * sin + cv * cos;
    const s1 = this.scaleAtZoom1();
    const room = FIT_MARGIN + UNIT_RADIUS + 1;
    const zw = maxU - minU > 1e-9 ? (this.width - 2 * room) / ((maxU - minU) * s1) : Infinity;
    const zh = maxV - minV > 1e-9 ? (this.height - 2 * room) / ((maxV - minV) * s1) : Infinity;
    let zoom = Math.min(zw, zh);
    if (!Number.isFinite(zoom)) zoom = Math.max(1, Math.min(4, this.view.camera.zoom));
    return { x, y, zoom: clamp(zoom, ZOOM_MIN, ZOOM_MAX), angle };
  }

  /** Pixels per graph unit now. */
  pixelScale(): number {
    return this.engine?.scale() ?? 1;
  }

  /** Pixels per graph unit at zoom 1. */
  scaleAtZoom1(): number {
    if (!this.engine) return 1;
    return this.engine.scale() / this.view.camera.zoom;
  }

  animateCamera(to: ViewState['camera'], duration: number): Promise<void> {
    to = { ...to, zoom: clamp(to.zoom, ZOOM_MIN, ZOOM_MAX) };
    if (this.camAnim) this.camAnim.resolve();
    if (!this.motion || duration <= 0) {
      this.camAnim = null;
      this.view.camera = to;
      this.applyCamera();
      this.changed();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.camAnim = {
        from: { ...this.view.camera },
        to,
        start: performance.now(),
        duration,
        resolve: () => {
          resolve();
          this.changed();
        },
      };
      this.tick();
    });
  }

  setCamera(c: Partial<ViewState['camera']>) {
    this.view.camera = { ...this.view.camera, ...c };
    this.view.camera.zoom = clamp(this.view.camera.zoom, ZOOM_MIN, ZOOM_MAX);
    this.applyCamera();
    this.changed(false);
  }

  /** Pans by screen pixels. */
  panBy(dx: number, dy: number) {
    const s = this.engine?.scale() ?? 1;
    const rad = (this.view.camera.angle * Math.PI) / 180;
    // Undo the rotation: screen to graph direction.
    const gx = (dx * Math.cos(rad) + dy * Math.sin(rad)) / s;
    const gy = (-dx * Math.sin(rad) + dy * Math.cos(rad)) / s;
    this.setCamera({ x: this.view.camera.x - gx, y: this.view.camera.y - gy });
  }

  /** Zooms by a factor around a screen point, which stays where it is (V02). */
  zoomAround(factor: number, sx: number, sy: number) {
    if (!this.engine) return;
    const before = this.engine.unproject(sx, sy);
    const zoom = clamp(this.view.camera.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    this.view.camera = { ...this.view.camera, zoom };
    this.engine.setCamera(this.view.camera);
    const after = this.engine.unproject(sx, sy);
    this.setCamera({ x: this.view.camera.x + before.x - after.x, y: this.view.camera.y + before.y - after.y });
  }

  rotateBy(deg: number) {
    this.setCamera({ angle: normAngle(this.view.camera.angle + deg) });
  }

  private cameraMoved() {
    const fire = () => {
      this.cameraLast = performance.now();
      this.cameraTimer = null;
      this.emit('oncamera', { ...this.view.camera });
    };
    const since = performance.now() - this.cameraLast;
    if (since >= 100) fire();
    else if (!this.cameraTimer) this.cameraTimer = setTimeout(fire, 100 - since);
  }

  // ---------------------------------------------------------------- geometry

  /** Screen position of a unit. */
  screen(id: string): { x: number; y: number } | null {
    const p = this.positions.get(id);
    if (!p || !this.engine) return null;
    return this.engine.project(p.x, p.y);
  }

  /** Every relation's screen geometry. */
  relationGeometry(points: Map<string, { x: number; y: number }>) {
    const out: {
      r: Relation;
      pa: { x: number; y: number };
      pb: { x: number; y: number };
      len: number;
      half: number;
    }[] = [];
    for (const r of this.relations) {
      const pa = points.get(r.ia);
      const pb = points.get(r.ib);
      if (!pa || !pb) continue;
      const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      out.push({ r, pa, pb, len, half: len / 2 - UNIT_RADIUS });
    }
    return out;
  }

  projectAll(): Map<string, { x: number; y: number }> {
    const out = new Map<string, { x: number; y: number }>();
    if (!this.engine || !this.graph) return out;
    for (const k of this.graph.units) {
      const id = keyId(k);
      const p = this.positions.get(id);
      if (p) out.set(id, this.engine.project(p.x, p.y));
    }
    return out;
  }

  /** What is under a screen point: a unit, a keypair, a whole relation, or nothing (V13, G11). */
  hit(x: number, y: number): { unit: Key } | { keypair: [Key, Key] } | { relation: [Key, Key][] } | null {
    if (!this.graph) return null;
    const pts = this.projectAll();
    const vis = this.visibility();
    // A click inside a unit's circle picks the unit. Outside it, the nearer of a unit's edge
    // (within 3 pixels) and a line (within 12 pixels) wins.
    let best: Key | null = null;
    let bestD = 3;
    for (const k of this.graph.units) {
      const id = keyId(k);
      if (!vis.get(id)) continue;
      const p = pts.get(id)!;
      const d = Math.hypot(p.x - x, p.y - y) - UNIT_RADIUS;
      if (d <= 0) return { unit: k };
      if (d <= bestD) {
        bestD = d;
        best = k;
      }
    }
    let line: ReturnType<Controller['relationGeometry']>[number] | null = null;
    let lineD = CLICK_HALF_WIDTH;
    let lineT = 0;
    for (const g of this.relationGeometry(pts)) {
      if (!vis.get(g.r.ia) || !vis.get(g.r.ib) || g.len < 1e-6) continue;
      const dx = g.pb.x - g.pa.x;
      const dy = g.pb.y - g.pa.y;
      const t = ((x - g.pa.x) * dx + (y - g.pa.y) * dy) / (g.len * g.len);
      if (t < 0 || t > 1) continue;
      const d = Math.abs((x - g.pa.x) * dy - (y - g.pa.y) * dx) / g.len;
      if (d <= lineD) {
        lineD = d;
        line = g;
        lineT = t;
      }
    }
    if (best !== null && (!line || bestD <= lineD)) return { unit: best };
    if (!line) return null;
    const r = line.r;
    const both: [Key, Key][] = [];
    if (r.ab) both.push([r.a, r.b]);
    if (r.ba) both.push([r.b, r.a]);
    if (line.half < SHORT_HALF) return { relation: both };
    const [from, to] = lineT < 0.5 ? [r.a, r.b] : [r.b, r.a];
    const exists = lineT < 0.5 ? r.ab : r.ba;
    if (!exists) return { relation: both };
    return { keypair: [from, to] };
  }

  // ---------------------------------------------------------------- interaction

  select(units: Key[], keypairs: [Key, Key][], announce = true) {
    this.view.selection = { units, keypairs };
    this.cursor = -1;
    if (units.length === 2) void this.setPathEnds(units[0], units[1]);
    else if (this.pathFrom !== null && units.length === 1 && keyId(units[0]) !== keyId(this.pathFrom)) {
      const from = this.pathFrom;
      this.pathFrom = null;
      void this.setPathEnds(from, units[0]);
    }
    this.emit('onselect', { units: [...units], keypairs: keypairs.map(([a, b]) => [a, b] as [Key, Key]) });
    if (announce) this.say(this.describeSelection());
    this.restyle();
    this.changed();
  }

  describeSelection(): string {
    const { units, keypairs } = this.view.selection;
    if (!units.length && !keypairs.length) return 'Selection cleared';
    if (units.length === 1 && !keypairs.length) return `Selected unit ${this.name(units[0])}`;
    if (keypairs.length === 1 && !units.length) {
      return `Selected keypair from ${this.name(keypairs[0][0])} to ${this.name(keypairs[0][1])}`;
    }
    const parts = [];
    if (units.length) parts.push(`${units.length} ${units.length === 1 ? 'unit' : 'units'}`);
    if (keypairs.length) parts.push(`${keypairs.length} ${keypairs.length === 1 ? 'keypair' : 'keypairs'}`);
    return `Selected ${parts.join(' and ')}`;
  }

  /** Handles a click result, with Shift adding to the selection (V13). */
  click(h: ReturnType<Controller['hit']>, shift: boolean) {
    const sel = this.view.selection;
    if (!h) {
      if (!shift && (sel.units.length || sel.keypairs.length)) this.select([], []);
      return;
    }
    if ('unit' in h) {
      const id = keyId(h.unit);
      if (shift) {
        const has = sel.units.some((u) => keyId(u) === id);
        this.select(has ? sel.units.filter((u) => keyId(u) !== id) : [...sel.units, h.unit], sel.keypairs);
      } else this.select([h.unit], []);
      return;
    }
    const pairs = 'keypair' in h ? [h.keypair] : h.relation;
    if (shift) {
      const ids = new Set(sel.keypairs.map(([a, b]) => keypairId(a, b)));
      const add = pairs.filter(([a, b]) => !ids.has(keypairId(a, b)));
      this.select(sel.units, [...sel.keypairs, ...add]);
    } else this.select([], pairs);
  }

  setHover(h: ReturnType<Controller['hit']>) {
    const unit = h && 'unit' in h ? h.unit : null;
    const keypair = h && 'keypair' in h ? h.keypair : h && 'relation' in h ? (h.relation[0] ?? null) : null;
    const same =
      (unit === null ? this.hover.unit === null : this.hover.unit !== null && keyId(unit) === keyId(this.hover.unit)) &&
      (keypair === null
        ? this.hover.keypair === null
        : this.hover.keypair !== null && keypairId(...keypair) === keypairId(...this.hover.keypair));
    if (same) return;
    this.hover = { unit, keypair };
    this.emit('onhover', { unit, keypair });
    this.restyle();
    this.notify();
  }

  /** The keypairs of the one selected unit, outgoing first, each in file order (V13). */
  tabList(): [Key, Key][] {
    const u = this.view.selection.units;
    if (u.length !== 1 || this.view.selection.keypairs.length) return [];
    const id = keyId(u[0]);
    return [
      ...(this.out.get(id) ?? []).map((b) => [u[0], b] as [Key, Key]),
      ...(this.inc.get(id) ?? []).map((a) => [a, u[0]] as [Key, Key]),
    ];
  }

  /** Steps the keypair cursor; returns false when there is nothing to step through. */
  step(delta: 1 | -1): boolean {
    const list = this.tabList();
    if (!list.length) return false;
    this.cursor =
      this.cursor < 0 ? (delta > 0 ? 0 : list.length - 1) : (this.cursor + delta + list.length) % list.length;
    const kp = list[this.cursor];
    this.hover = { unit: null, keypair: kp };
    this.emit('onhover', { unit: null, keypair: kp });
    this.say(`Keypair from ${this.name(kp[0])} to ${this.name(kp[1])}, ${this.cursor + 1} of ${list.length}`);
    this.restyle();
    this.notify();
    return true;
  }

  activate() {
    const list = this.tabList();
    if (this.cursor >= 0 && list[this.cursor]) {
      this.emit('onactivate', { keypair: list[this.cursor] });
      return;
    }
    const { units, keypairs } = this.view.selection;
    if (units.length === 1) this.emit('onactivate', { unit: units[0] });
    else if (keypairs.length === 1) this.emit('onactivate', { keypair: keypairs[0] });
  }

  activateHit(h: ReturnType<Controller['hit']>) {
    if (!h) return;
    if ('unit' in h) this.emit('onactivate', { unit: h.unit });
    else if ('keypair' in h) this.emit('onactivate', { keypair: h.keypair });
    else if (h.relation[0]) this.emit('onactivate', { keypair: h.relation[0] });
  }

  setFocus(focus: Key | null, radius: number | null = this.view.radius) {
    this.view.focus = focus;
    this.view.radius = radius === null ? null : Math.max(0, Math.round(radius));
    this.refreshDerived();
    this.emit('onfocus', { focus, radius: this.view.radius });
    this.say(
      focus === null
        ? 'No focus'
        : `Focus on ${this.name(focus)}${this.view.radius === null ? '' : `, radius ${this.view.radius}`}`,
    );
    if (this.view.layout.name === 'rings') void this.runLayout();
    this.restyle();
    this.changed();
  }

  pin(key: Key, on: boolean) {
    const id = keyId(key);
    const rest = this.view.layout.pinned.filter((p) => keyId(p.key) !== id);
    const p = this.positions.get(id);
    this.view.layout.pinned = on && p ? [...rest, { key, x: p.x, y: p.y }] : rest;
    this.changed();
  }

  isPinned(id: string): boolean {
    return this.view.layout.pinned.some((p) => keyId(p.key) === id);
  }

  /** Moves a unit to a screen point while dragging (V10). */
  dragUnit(key: Key, sx: number, sy: number) {
    if (!this.engine) return;
    const g = this.engine.unproject(sx, sy);
    this.positions.set(keyId(key), g);
    this.engine.setPositions(new Map([[keyId(key), g]]));
    this.engine.render();
  }

  // ---------------------------------------------------------------- paths

  async setPathEnds(from: Key, to: Key, extra = this.view.paths.extra): Promise<PathSetResult | null> {
    if (!this.graph) return null;
    this.view.paths = { ends: [from, to], extra, lit: null, showAll: null };
    const lim = this.look.limits;
    const n = clamp(Math.round(extra), 0, lim.maxExtra);
    this.view.paths.extra = n;
    const result = await runPathSet(this.graph.units, this.graph.keypairs, from, to, n, {
      count: lim.pathCount,
      list: lim.pathList,
      timeMs: lim.pathTimeMs,
    });
    const ends = this.view.paths.ends;
    if (!ends || keyId(ends[0]) !== keyId(from) || keyId(ends[1]) !== keyId(to) || this.view.paths.extra !== n)
      return result;
    this.pathResult = result;
    this.emit('onpathset', result);
    this.say(
      result.reason === 'same-unit'
        ? 'The two ends are the same unit'
        : result.reason === 'unreachable'
          ? `No path from ${this.name(from)} to ${this.name(to)}`
          : `${result.stopped ? 'At least ' : ''}${result.total} ${result.total === 1 ? 'path' : 'paths'} from ${this.name(from)} to ${this.name(to)}`,
    );
    this.restyle();
    this.changed();
    return result;
  }

  setPathExtra(extra: number) {
    const ends = this.view.paths.ends;
    this.view.paths.extra = extra;
    if (ends) void this.setPathEnds(ends[0], ends[1], extra);
    else this.changed();
  }

  litPath(lit: { length: number; index: number } | null, keep: boolean) {
    if (keep) {
      this.view.paths.lit = lit;
      this.view.paths.showAll = null;
      this.changed();
    } else this.pathHover = lit;
    this.restyle();
    this.notify();
  }

  showAll(length: number | null) {
    this.view.paths.showAll = length;
    this.view.paths.lit = null;
    this.restyle();
    this.changed();
  }

  clearPaths() {
    this.view.paths = { ends: null, extra: this.view.paths.extra, lit: null, showAll: null };
    this.pathResult = null;
    this.pathHover = null;
    this.restyle();
    this.changed();
  }

  // ---------------------------------------------------------------- commands

  fit(target: 'all' | 'selection' = 'all'): Promise<void> {
    const vis = this.visibility();
    let ids = this.visibleIds();
    if (target === 'selection') {
      const sel = new Set(this.view.selection.units.map(keyId));
      for (const [a, b] of this.view.selection.keypairs) {
        sel.add(keyId(a));
        sel.add(keyId(b));
      }
      const chosen = [...sel].filter((id) => vis.get(id));
      if (chosen.length) ids = chosen;
    }
    return this.animateCamera(this.fitCamera(ids), 400);
  }

  flyTo(key: Key): Promise<void> {
    const id = keyId(key);
    const p = this.positions.get(id);
    if (!p) return Promise.resolve();
    this.flyTarget = id;
    // Far enough in that the label shows: the nearest neighbour at least 120 pixels away.
    let nearest = Infinity;
    for (const [other, q] of this.positions)
      if (other !== id) nearest = Math.min(nearest, Math.hypot(q.x - p.x, q.y - p.y));
    const s1 = this.scaleAtZoom1();
    const want = Number.isFinite(nearest) && nearest > 0 ? 120 / (nearest * s1) : this.view.camera.zoom;
    const zoom = clamp(Math.max(this.view.camera.zoom, Math.min(want, 8)), ZOOM_MIN, ZOOM_MAX);
    return this.animateCamera({ ...this.view.camera, x: p.x, y: p.y, zoom }, 400);
  }

  rotateTo(angle: number): Promise<void> {
    return this.animateCamera({ ...this.view.camera, angle: normAngle(angle) }, 400);
  }

  async setLayout(layout: Partial<ViewState['layout']> & { name: LayoutName }): Promise<void> {
    this.view.layout = { ...this.view.layout, ...layout };
    await this.runLayout(true);
  }

  async showPaths(from: Key, to: Key, extra: number): Promise<PathSetResult> {
    const r = await this.setPathEnds(from, to, extra);
    return (
      r ?? {
        from,
        to,
        extra,
        shortest: null,
        reason: 'unreachable',
        lengths: [],
        total: 0,
        stopped: false,
        stoppedBy: null,
      }
    );
  }

  release2(): Release2 {
    return { ...RELEASE_2 };
  }

  getViewState(): ViewState {
    return clone({ ...this.view, graph: this.graph ? this.fingerprint : null });
  }

  async setViewState(partial: Partial<ViewState>): Promise<void> {
    const before = this.view;
    const next = merge(before, partial as DeepPartial<ViewState>);
    // Lists replace, they do not merge.
    if (partial.selection) next.selection = clone(partial.selection);
    if (partial.layout?.pinned) next.layout.pinned = clone(partial.layout.pinned);
    this.view = next;
    if (partial.layout) this.viewGiven = true;
    this.refreshDerived();
    const layoutChanged =
      partial.layout &&
      (partial.layout.name !== undefined || partial.layout.seed !== undefined || partial.layout.settings !== undefined);
    if (layoutChanged && this.graph) await this.runLayout(false);
    if (partial.camera) {
      this.view.camera = { ...this.view.camera, ...partial.camera };
      this.view.camera.zoom = clamp(this.view.camera.zoom, ZOOM_MIN, ZOOM_MAX);
      this.view.camera.angle = normAngle(this.view.camera.angle);
      if (this.positions.size === 0) this.pendingCamera = { ...this.view.camera };
      this.applyCamera();
    }
    if (partial.paths?.ends)
      await this.setPathEnds(partial.paths.ends[0], partial.paths.ends[1], this.view.paths.extra).then(() => {
        if (partial.paths?.lit !== undefined) this.view.paths.lit = partial.paths.lit;
        if (partial.paths?.showAll !== undefined) this.view.paths.showAll = partial.paths.showAll;
      });
    else if (partial.paths && partial.paths.ends === null) this.clearPaths();
    if (partial.focus !== undefined || partial.radius !== undefined) {
      this.emit('onfocus', { focus: this.view.focus, radius: this.view.radius });
    }
    if (partial.selection) this.emit('onselect', clone(this.view.selection));
    this.restyle();
    this.applyCamera();
    this.changed();
  }

  setLook(look: DeepPartial<Look> | undefined) {
    const before = this.look;
    this.look = merge(defaultLook(), look as DeepPartial<Look>);
    if (look?.tokens) this.look.tokens = { ...look.tokens } as Look['tokens'];
    else this.look.tokens = {};
    const graphChanged =
      before.superseded !== this.look.superseded &&
      (before.superseded === 'hide') !== (this.look.superseded === 'hide');
    if (graphChanged && this.stored) {
      this.useGraph();
      this.refreshDerived();
      const missing = this.graph!.units.some((k) => !this.positions.has(keyId(k)));
      if (missing) this.positions = placeMissing(this.graph!, new Map(this.positions), this.view.layout.seed);
      this.pushItems();
      this.emit('onissues', this.issueItems());
    } else if (before.relations.draw !== this.look.relations.draw) this.pushItems();
    else this.restyle();
    this.notify();
  }

  // ---------------------------------------------------------------- scene

  /** A read-only description of the picture, in CSS pixels (D8). */
  getScene(): Scene {
    const pts = this.projectAll();
    const vis = this.visibility();
    const lit = this.lit();
    const path = this.pathLit();
    const attr = this.attrColours();
    const sel = new Set(this.view.selection.units.map(keyId));
    const selKp = new Set(this.view.selection.keypairs.map(([a, b]) => keypairId(a, b)));
    const labelOf = new Map(this.labels.map((l) => [l.index, l.box]));
    const units: SceneUnit[] = (this.graph?.units ?? []).map((k, i) => {
      const id = keyId(k);
      const p = pts.get(id) ?? { x: 0, y: 0 };
      const box = labelOf.get(i) ?? null;
      const d = this.distance.get(id);
      return {
        key: k,
        x: p.x,
        y: p.y,
        r: UNIT_RADIUS,
        visible: vis.get(id) === true,
        state: {
          focus: this.view.focus !== null && keyId(this.view.focus) === id,
          selected: sel.has(id),
          hovered: this.hover.unit !== null && keyId(this.hover.unit) === id,
          dimmed: lit !== null && !lit.units.has(id),
          faded: (this.isSuperseded(id) && this.look.superseded === 'fade') || this.isBeyond(id),
          pinned: this.isPinned(id),
          issue: this.issueUnits.has(id),
          superseded: this.isSuperseded(id),
          ring: this.view.focus !== null && d !== undefined ? d : null,
        },
        label: {
          text: this.labelText(k),
          visible: box !== null && vis.get(id) === true,
          angle: 0,
          box: box ? { ...box } : null,
        },
      };
    });
    const halves: SceneHalf[] = [];
    const icons = this.iconUnits();
    for (const g of this.relationGeometry(pts)) {
      const r = g.r;
      const mid = { x: (g.pa.x + g.pb.x) / 2, y: (g.pa.y + g.pb.y) / 2 };
      const visible = vis.get(r.ia) === true && vis.get(r.ib) === true;
      for (const [from, to, pf, exists] of [
        [r.a, r.b, g.pa, r.ab],
        [r.b, r.a, g.pb, r.ba],
      ] as const) {
        const id = keypairId(from, to);
        const dx = mid.x - pf.x;
        const dy = mid.y - pf.y;
        const l = Math.hypot(dx, dy) || 1;
        const start = { x: pf.x + (dx / l) * UNIT_RADIUS, y: pf.y + (dy / l) * UNIT_RADIUS };
        const role = this.halfRole(from, to, !exists, path.keypairs, attr);
        let width = exists && (selKp.has(id) || role === 'path') ? 3 : exists ? 1.5 : 2;
        if (exists && this.view.paths.showAll !== null && path.uses.has(r.id)) {
          width = 2 + (4 * ((path.uses.get(r.id) ?? 1) - 1)) / Math.max(1, path.max - 1);
        }
        halves.push({
          from,
          to,
          start,
          end: mid,
          visible,
          missing: !exists,
          style: exists ? 'solid' : 'dashed',
          role,
          width,
          selected: selKp.has(id),
          hovered: lit !== null && this.hover.keypair !== null && lit.keypairs.has(id),
          icon: exists && this.showIcon(g.half, keyId(from), keyId(to), icons),
          superseded: this.isKeypairSuperseded(from, to),
          faded:
            (this.look.superseded === 'fade' && this.isKeypairSuperseded(from, to)) ||
            this.isBeyond(r.ia) ||
            this.isBeyond(r.ib),
        });
      }
    }
    const rings: Scene['rings'] = [];
    if (this.ring && this.view.layout.name === 'rings' && this.engine && this.view.focus !== null) {
      const s = this.pixelScale();
      for (let k = 1; k <= this.ring.depth; k++) rings.push({ index: k, radius: k * SPACING * s });
    }
    return {
      graph: this.look.superseded === 'hide' ? 'current' : 'stored',
      fingerprint: this.fingerprint,
      width: this.width,
      height: this.height,
      camera: { ...this.view.camera },
      units,
      halves,
      rings,
    };
  }

  /** Units around which chevrons always show: the hovered and the selected ones (V18). */
  iconUnits(): Set<string> {
    const s = new Set(this.view.selection.units.map(keyId));
    if (this.hover.unit !== null) s.add(keyId(this.hover.unit));
    return s;
  }

  showIcon(halfLength: number, from: string, to: string, around: Set<string>): boolean {
    const mode = this.look.relations.icons;
    if (this.look.relations.draw !== 'halves' || mode === 'never') return false;
    if (mode === 'always') return true;
    return halfLength >= ICON_MIN_HALF || around.has(from) || around.has(to);
  }

  labelText(k: Key): string {
    const id = keyId(k);
    const f = this.look.labels.field;
    const info = this.graph?.unitInfo.get(id);
    if (f === 'key') return typeof k === 'string' ? k : String(k);
    if (f.startsWith('attrs.')) {
      const v = info?.attrs?.[f.slice(6)];
      if (v !== undefined && v !== null) return typeof v === 'string' ? v : JSON.stringify(v);
    }
    if (f === 'label' && info?.label !== undefined) return info.label;
    return typeof k === 'string' ? k : String(k);
  }

  /** A unit's name for messages: its label, or its key. */
  name(k: Key): string {
    return this.graph?.unitInfo.get(keyId(k))?.label ?? (typeof k === 'string' ? k : String(k));
  }

  /** Places the labels for the current picture (V19). */
  layoutLabels(pts: Map<string, { x: number; y: number }>) {
    this.labels = [];
    if (!this.graph || this.look.labels.show === 'never') return;
    const vis = this.visibility();
    const forced = new Set(this.view.selection.units.map(keyId));
    if (this.view.focus !== null) forced.add(keyId(this.view.focus));
    if (this.hover.unit !== null) forced.add(keyId(this.hover.unit));
    if (this.flyTarget) forced.add(this.flyTarget);
    const all = this.look.labels.show === 'always';
    const cands = [];
    const order = this.labelOrder();
    for (const i of order) {
      const k = this.graph.units[i];
      const id = keyId(k);
      if (!vis.get(id)) continue;
      const p = pts.get(id);
      if (!p) continue;
      if (p.x < -50 || p.y < -20 || p.x > this.width + 50 || p.y > this.height + 20) continue;
      cands.push({
        index: i,
        x: p.x,
        y: p.y,
        r: UNIT_RADIUS,
        text: this.labelText(k),
        forced: forced.has(id) || (all && cands.length < 2000),
      });
      if (cands.length > 4000) break;
    }
    this.labels = placeLabels(cands, (t) => this.measureCached(t), this.width, this.height);
  }

  private labelOrderCache: { graph: Graph | null; order: number[] } = { graph: null, order: [] };

  /** Units by relations, most first, then in file order. */
  labelOrder(): number[] {
    if (this.labelOrderCache.graph === this.graph) return this.labelOrderCache.order;
    const g = this.graph!;
    const order = g.units.map((_, i) => i);
    order.sort(
      (a, b) => (this.degree.get(keyId(g.units[b])) ?? 0) - (this.degree.get(keyId(g.units[a])) ?? 0) || a - b,
    );
    this.labelOrderCache = { graph: g, order };
    return order;
  }

  private measureCached(t: string): number {
    let w = this.measureCache.get(t);
    if (w === undefined) {
      w = this.measure(t, true);
      this.measureCache.set(t, w);
    }
    return w;
  }

  // ---------------------------------------------------------------- events

  emit<K extends keyof GraphViewEvents>(name: K, payload: Parameters<NonNullable<GraphViewEvents[K]>>[0]) {
    const fn = this.events[name] as ((p: unknown) => void) | undefined;
    if (fn) fn(payload);
  }

  say(text: string) {
    this.announcement = text;
  }

  /** The view state changed: tell the panels now and the host 250 ms later (D6). */
  changed(notify = true) {
    if (notify) this.notify();
    if (this.viewTimer) clearTimeout(this.viewTimer);
    this.viewTimer = setTimeout(() => {
      this.viewTimer = null;
      this.emit('onviewstate', this.getViewState());
    }, 250);
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function normAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

function rgba(hex: string, a: number): string {
  if (a >= 1) return hex;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
