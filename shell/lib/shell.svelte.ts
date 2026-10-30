// The shell's state and actions, shared by its sections: where the graph came from, the open file,
// the messages, and the Generate settings. The shell plays the host (specification 8): it prepares
// each graph as JSON and hands it to the viewer, GraphView, as a source; it learns what the viewer
// shows from the viewer's model.
import { goto } from '$app/navigation';
import { untrack } from 'svelte';
import {
  DocumentSource,
  fingerprint,
  JsonFileSource,
  type CanvasHandle,
  type GraphModel,
  type GraphSource,
  type ViewSettings,
  viewCss,
} from '../../module/index.ts';
import { breakRules, NO_BREAKS, type BreakOptions } from './breakRules.ts';
import { decorate, DECORATE_DEFAULTS, type DecorateOptions } from './decorate.ts';
import { examples, exampleSource } from './examples.ts';
import { canPick, pickFile, saveFile, type FileHandle } from './files.ts';
import { FAMILIES, generate, type Family, type Params } from './generate.ts';
import { importDoc } from './importer.ts';
import { throughInterfaces } from './interfaces.ts';
import { SAMPLE_ID } from './sample.ts';
import { LINK_GRAPH_ERROR, makeLink, readLink, type Source } from './share.ts';
import { wearTokens } from './theme.ts';
import { hostSettings } from './twin.ts';

/** What the shell needs of the viewer: its model and its canvas. */
export interface Viewer {
  readonly model: GraphModel;
  getCanvas(): CanvasHandle | undefined;
}

/** A source that reads another and prepares its document, as a host's data module does. */
class PreparedSource implements GraphSource {
  readonly name: string;
  private from: GraphSource;
  private prepare: (doc: unknown) => unknown;
  constructor(from: GraphSource, prepare: (doc: unknown) => unknown) {
    this.name = from.name;
    this.from = from;
    this.prepare = prepare;
  }
  async load() {
    return this.prepare(await this.from.load());
  }
}

const wide = () => typeof innerWidth === 'number' && innerWidth > 900;

const paramsText = (p: Params) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]));

const paramsValue = (p: Record<string, string>): Params =>
  Object.fromEntries(
    Object.entries(p).map(([k, v]) => [
      k,
      k === 'degrees'
        ? v
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(Number)
        : Number(v),
    ]),
  );

/** The view settings a file carries in meta.view, if any. */
function settingsOf(doc: unknown): Partial<ViewSettings> {
  const meta = (doc as { meta?: { view?: unknown } } | null)?.meta;
  const v = meta && typeof meta === 'object' ? meta.view : undefined;
  return v && typeof v === 'object' ? (v as Partial<ViewSettings>) : {};
}

export class Shell {
  /** The viewer's model and canvas, once the viewer is on the page. */
  model: GraphModel | null = null;
  private viewer: Viewer | null = null;
  /** What the viewer shows, for the headline and the sections. */
  info = $state({ name: 'Graph', units: 0, relations: 0, issues: 0, refused: false, hasDoc: false });
  /** The viewer's text and panel properties (--gv-*), which the host tools wear too, as they use the module's controls. */
  css = $state('');

  // ---------------------------------------------------------------- page
  leftOpen = $state(wide());
  open = $state({ data: true, generate: true });

  // ---------------------------------------------------------------- what the viewer is handed
  /** The graph's source, the view to apply to it, the viewer's base values for it, and those of its look. */
  graphSource: GraphSource | null = $state.raw(null);
  view: Partial<ViewSettings> = $state.raw({});
  base: Record<string, unknown> = $state.raw({});
  theme: 'light' | 'dark' | 'system' | undefined = $state();
  motion: 'on' | 'off' | 'system' | undefined = $state();

  // ---------------------------------------------------------------- data
  source: Source | null = $state(null);
  fileHandle: FileHandle | null = $state.raw(null);
  fileName = $state('');
  message = $state('');
  shareLink = $state('');

  // ---------------------------------------------------------------- generate
  /** "example:<id>" or "family:<id>": what Generate makes. Choosing does nothing until Generate. */
  choice = $state(`example:${SAMPLE_ID}`);
  params: Record<string, string> = $state({});
  seed = $state(1);
  breaks: BreakOptions = $state({ ...NO_BREAKS });
  addTypes = $state(false);
  deco: DecorateOptions = $state(structuredClone(DECORATE_DEFAULTS));
  /** The share of relations that go through an interface, from 0 to 1. */
  interfaces = $state(0);
  /** Random by degrees: the degrees each unit reached, next to the ones asked. */
  reached: number[] | null = $state(null);
  /** The family whose parameters the fields hold. */
  paramsFor = '';
  chosenFamily = $derived(this.choice.startsWith('family:') ? (this.choice.slice(7) as Family) : null);
  chosenExample = $derived(this.choice.startsWith('example:') ? this.choice.slice(8) : null);

  // ---------------------------------------------------------------- tests
  private readyCount = 0;
  private waiters: (() => void)[] = [];

  /** The shell's effects; call once while the page component starts. */
  connect() {
    // A newly chosen family starts from its own parameters.
    $effect(() => {
      const f = this.chosenFamily;
      if (f && f !== this.paramsFor) {
        this.paramsFor = f;
        this.params = paramsText(FAMILIES.find((x) => x.id === f)!.params);
      }
    });
  }

  /** Takes the viewer once it is on the page: follows its model, wears its colours, and exposes the test hook. */
  attach(viewer: Viewer) {
    this.viewer = viewer;
    this.model = viewer.model;
    viewer.model.subscribe((a) => untrack(() => this.follow(a)));
    this.follow();
    this.expose();
  }

  /** The headline's facts, and the page's colours, which follow the viewer's theme (8.9). */
  private follow(a?: ReadonlySet<string>) {
    const m = this.model!;
    const info = {
      name: this.graphName(),
      units: m.graph?.units.length ?? 0,
      relations: m.relationCount(),
      issues: m.issues.length,
      refused: m.refused !== null,
      hasDoc: m.doc !== null,
    };
    if (JSON.stringify(info) !== JSON.stringify(this.info)) this.info = info;
    if (!a || a.has('theme') || a.has('settings')) {
      wearTokens(m.theme, m.colours(m.theme));
      this.css = viewCss(m);
    }
  }

  /** The graph's name, for the headline and file names. */
  graphName(): string {
    const g = this.model?.graph;
    return g && typeof g.meta.name === 'string' ? g.meta.name : 'Graph';
  }

  // ---------------------------------------------------------------- loading

  /** Hands a graph to the viewer, with view settings to apply; resolves when the viewer has shown it. */
  private show(source: GraphSource, from: Source, view: Partial<ViewSettings> = {}): Promise<void> {
    this.source = from;
    this.shareLink = '';
    const shown = new Promise<void>((r) => this.waiters.push(r));
    // The invented family opens with its profile and by perspectives, as its host would set them (8.10).
    this.base = hostSettings(from.kind === 'example' ? from.id : null);
    this.view = view;
    this.graphSource = source;
    return shown;
  }

  async openText(text: string, name: string, handle: FileHandle | null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.message = `The file ${name} is not valid JSON.`;
      return;
    }
    const { doc, converted } = importDoc(parsed);
    this.fileHandle = handle;
    this.fileName = name;
    this.message = converted ? `The file ${name} was read as rows with id, source and target.` : '';
    await this.show(new DocumentSource(doc, name), { kind: 'file', name }, settingsOf(doc));
  }

  /** Opens a file with the browser's picker; false where there is none, so that the page uses its file input. */
  async browse(): Promise<boolean> {
    if (!canPick()) return false;
    const picked = await pickFile();
    if (picked) await this.openText(await picked.file.text(), picked.file.name, picked.handle);
    return true;
  }

  async loadUrl(url: string, settings: Partial<ViewSettings> = {}) {
    this.message = `Loading ${url}`;
    let raw: unknown;
    try {
      raw = await new JsonFileSource(url).load();
    } catch {
      this.message = `The server at ${url} refused the request, or sent no JSON.`;
      return;
    }
    const { doc, converted } = importDoc(raw);
    this.fileHandle = null;
    this.fileName = '';
    this.message = converted ? 'The address was read as rows with id, source and target.' : '';
    await this.show(new DocumentSource(doc, url), { kind: 'url', url }, { ...settingsOf(doc), ...settings });
  }

  // ---------------------------------------------------------------- saving and sharing

  /** The graph with its view: mode, root, path, filters, display, types and camera. */
  private documentToSave(): unknown {
    const m = this.model!;
    const d = m.doc;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return d;
    const doc = d as Record<string, unknown>;
    const meta = doc.meta && typeof doc.meta === 'object' && !Array.isArray(doc.meta) ? doc.meta : {};
    const view: ViewSettings = { ...m.viewSettings(), camera: this.viewer?.getCanvas()?.getCamera() ?? null };
    const fp = m.stored ? { fingerprint: fingerprint(m.stored) } : {};
    return { ...doc, meta: { ...meta, ...fp, view } };
  }

  private fileStem() {
    return (
      (this.fileName || this.graphName())
        .replace(/\.json$/i, '')
        .replace(/[^\w.-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'graph'
    );
  }

  async save() {
    const blob = new Blob([JSON.stringify(this.documentToSave(), null, 1)], { type: 'application/json' });
    const saved = await saveFile(`${this.fileStem()}.json`, blob, 'graph', this.fileHandle, (n) =>
      confirm(`The file ${n} exists. Overwrite it?`),
    );
    if (!saved) return;
    this.fileHandle = saved.handle;
    this.fileName = saved.name;
    this.message =
      saved.how === 'overwritten'
        ? `Overwrote ${saved.name}.`
        : saved.how === 'saved'
          ? `Saved ${saved.name}.`
          : `Downloaded ${saved.name}.`;
  }

  /** The viewer's Save picture hands the picture to its host, which saves it as a file. */
  async savePicture(png: Blob) {
    const saved = await saveFile(`${this.fileStem()}.png`, png, 'picture', null, () => false);
    if (saved) this.message = saved.how === 'downloaded' ? `Downloaded ${saved.name}.` : `Saved ${saved.name}.`;
  }

  async share() {
    const m = this.model;
    if (!m) return;
    if (!this.source || this.source.kind === 'file') {
      this.shareLink = '';
      this.message = 'A graph opened from a file cannot travel in a link; save the file instead.';
      return;
    }
    this.shareLink = makeLink(`${location.origin}${location.pathname}`, this.source, {
      mode: m.mode,
      root: m.root,
      target: m.target,
      path: m.choice,
    });
    // The address bar shows the link, through the router, without a new page.
    await goto(this.shareLink, { shallow: true, replace: true });
    try {
      await navigator.clipboard.writeText(this.shareLink);
      this.message = 'The link is on the clipboard.';
    } catch {
      this.message = 'Copy the link below.';
    }
  }

  // ---------------------------------------------------------------- generating

  /** Sets the Generate section to a family with its parameters, seed and broken rules. */
  chooseFamily(f: Family, p: Params, seed: number, breaks: BreakOptions) {
    this.choice = `family:${f}`;
    this.paramsFor = f;
    this.params = paramsText(p);
    this.seed = seed;
    this.breaks = { ...breaks };
  }

  /** Makes the chosen example or family and hands it to the viewer, with view settings to apply. */
  async generateNow(view: Partial<ViewSettings> = {}) {
    this.message = '';
    this.reached = null;
    const options = this.addTypes ? $state.snapshot(this.deco) : null;
    const seed = this.seed;
    const interfaces = Math.min(1, Math.max(0, Number(this.interfaces) || 0));
    const share = interfaces > 0 ? { interfaces } : {};
    try {
      if (this.chosenExample) {
        const id = this.chosenExample;
        // An example comes as JSON from the shell's route; types and interfaces are added on the way.
        const plain = !options && interfaces === 0;
        const source = plain
          ? exampleSource(id)
          : new PreparedSource(exampleSource(id), (raw) =>
              throughInterfaces(options ? decorate(raw, seed, options) : raw, interfaces, seed),
            );
        this.fileHandle = null;
        this.fileName = '';
        await this.show(source, { kind: 'example', id, decorate: options, ...share }, view);
      } else if (this.chosenFamily) {
        const family = this.chosenFamily;
        const p = paramsValue(this.params);
        const g = generate(family, p, seed);
        this.reached = g.reached ?? null;
        const breaks = $state.snapshot(this.breaks);
        const broken = breakRules(options ? decorate(g.doc, seed, options) : g.doc, breaks, seed);
        const doc = throughInterfaces(broken, interfaces, seed);
        this.fileHandle = null;
        this.fileName = '';
        const from = { family, params: p, seed, breaks: { ...breaks }, decorate: options, ...share };
        await this.show(new DocumentSource(doc, family), { kind: 'generated', ...from }, view);
      }
    } catch (err) {
      this.message = `Cannot generate: ${(err as Error).message}.`;
    }
  }

  // ---------------------------------------------------------------- start: a link, or the sample

  async start() {
    const link = readLink(location.search);
    let note = link.error;
    const mode = link.view.mode ? { mode: link.view.mode } : {};
    let view: Partial<ViewSettings> = {
      ...mode,
      root: link.view.root ?? null,
      target: link.view.target ?? null,
      path: link.view.path ?? null,
    };
    let s = link.source;
    const id = s?.kind === 'example' ? s.id : null;
    if (id !== null && !examples.some((e) => e.id === id)) {
      // An unknown example: the sample graph, in the link's mode, without the view that belonged to the other one.
      note = LINK_GRAPH_ERROR;
      s = null;
      view = mode;
    }
    // The link's message joins whatever loading the graph says.
    const tell = () => {
      if (note) this.message = this.message ? `${this.message} ${note}` : note;
    };
    if (s?.kind === 'url') return this.loadUrl(s.url, view).then(tell);
    if (s?.kind === 'generated') this.chooseFamily(s.family, s.params, s.seed, s.breaks);
    else if (s?.kind === 'example') this.choice = `example:${s.id}`;
    if (s?.kind === 'generated' || s?.kind === 'example') {
      this.addTypes = s.decorate !== null;
      if (s.decorate) this.deco = { ...s.decorate };
      this.interfaces = s.interfaces ?? 0;
    }
    await this.generateNow(view);
    tell();
  }

  // ---------------------------------------------------------------- for browser tests and the console

  /** The viewer showed a graph: GraphView's onready. */
  ready() {
    this.readyCount++;
    const w = this.waiters;
    this.waiters = [];
    w.forEach((f) => f());
  }

  /** The hook of specification 8.15 on window.graphview. */
  private expose() {
    (window as unknown as Record<string, unknown>).graphview = {
      model: this.model,
      canvas: () => this.viewer?.getCanvas(),
      ready: () => this.readyCount,
      nextReady: () => new Promise<void>((r) => this.waiters.push(r)),
      /** Chooses an example and generates it, as the Generate section does. */
      loadExample: async (id: string, withAttributes = false, interfaces = 0) => {
        this.choice = `example:${id}`;
        this.addTypes = withAttributes;
        this.interfaces = interfaces;
        await this.generateNow();
      },
      generate: async (
        f: Family,
        p: Params,
        s: number,
        b: BreakOptions = NO_BREAKS,
        withAttributes = false,
        interfaces = 0,
      ) => {
        this.chooseFamily(f, p, s, b);
        this.addTypes = withAttributes;
        this.interfaces = interfaces;
        await this.generateNow();
      },
      /** Sets the viewer's settings theme.scheme and motion.enabled, as base values. */
      setLook: (look: { theme?: Shell['theme']; motion?: Shell['motion'] }) => {
        if (look.theme) this.theme = look.theme;
        if (look.motion) this.motion = look.motion;
      },
    };
  }
}
