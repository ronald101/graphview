// The shell's state and actions, shared by its sections: where the graph came from, the open file,
// the messages, the Generate settings, the look, and which sidebars and sections are open. Every
// change to the graph goes through the model.
import { goto } from '$app/navigation';
import { untrack } from 'svelte';
import { fingerprint, type GraphCanvas, type GraphModel, type ViewSettings } from '../../module/index.ts';
import { breakRules, NO_BREAKS, type BreakOptions } from './breakRules.ts';
import { decorate, DECORATE_DEFAULTS, type DecorateOptions } from './decorate.ts';
import { exampleDoc, examples } from './examples.ts';
import { canPick, pickFile, saveFile, type FileHandle } from './files.ts';
import { FAMILIES, generate, type Family, type Params } from './generate.ts';
import { importDoc } from './importer.ts';
import { throughInterfaces } from './interfaces.ts';
import { SAMPLE_ID } from './sample.ts';
import { LINK_GRAPH_ERROR, makeLink, readLink, type Source } from './share.ts';
import { wearTokens } from './theme.ts';

type Canvas = ReturnType<typeof GraphCanvas>;

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
  readonly model: GraphModel;
  canvas: Canvas | undefined = $state();
  /** Counts the model's changes, so that derived values follow the model. */
  version = $state(0);

  // ---------------------------------------------------------------- page
  leftOpen = $state(wide());
  rightOpen = $state(wide());
  open = $state({
    data: true,
    generate: true,
    types: false,
    look: false,
    root: true,
    paths: true,
    inspector: true,
    filters: false,
    display: false,
    issues: true,
  });
  theme = $state<'light' | 'dark' | 'system'>('system');
  motion = $state<'on' | 'off' | 'system'>('system');
  systemDark = $state(matchMedia('(prefers-color-scheme: dark)').matches);
  resolved: 'light' | 'dark' = $derived(
    this.theme === 'dark' || (this.theme !== 'light' && this.systemDark) ? 'dark' : 'light',
  );

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

  constructor(model: GraphModel) {
    this.model = model;
    model.subscribe(() => untrack(() => this.version++));
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => (this.systemDark = e.matches));
  }

  /** The shell's effects; call once while the page component starts. */
  connect() {
    $effect(() => wearTokens(this.resolved, this.model.colours(this.resolved)));
    // A newly chosen family starts from its own parameters.
    $effect(() => {
      const f = this.chosenFamily;
      if (f && f !== this.paramsFor) {
        this.paramsFor = f;
        this.params = paramsText(FAMILIES.find((x) => x.id === f)!.params);
      }
    });
    // Adding types opens the Types section, where their numbers are set.
    $effect(() => {
      if (this.addTypes) untrack(() => (this.open.types = true));
    });
    $effect(() => this.expose());
  }

  /** The graph's name, for the headline and file names. */
  graphName(): string {
    const g = this.model.graph;
    return g && typeof g.meta.name === 'string' ? g.meta.name : 'Graph';
  }

  // ---------------------------------------------------------------- loading

  /** Loads a document into the model, with saved view settings; the panels follow the model. */
  async show(doc: unknown, from: Source, settings: Partial<ViewSettings> = {}) {
    this.source = from;
    this.shareLink = '';
    const done = await this.model.load(doc, settings);
    if (!done) return;
    await this.canvas?.whenSettled();
    if (settings.camera) this.canvas?.setCamera(settings.camera.position, settings.camera.target);
    this.ready();
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
    await this.show(doc, { kind: 'file', name }, settingsOf(doc));
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
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const { doc, converted } = importDoc(await res.json());
      this.fileHandle = null;
      this.fileName = '';
      this.message = converted ? 'The address was read as rows with id, source and target.' : '';
      await this.show(doc, { kind: 'url', url }, { ...settingsOf(doc), ...settings });
    } catch {
      this.message = `The server at ${url} refused the request, or sent no JSON.`;
    }
  }

  // ---------------------------------------------------------------- saving and sharing

  /** The graph with its view: mode, root, path, filters, display, types and camera. */
  private documentToSave(): unknown {
    const m = this.model;
    const d = m.doc;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return d;
    const doc = d as Record<string, unknown>;
    const meta = doc.meta && typeof doc.meta === 'object' && !Array.isArray(doc.meta) ? doc.meta : {};
    const view: ViewSettings = { ...m.viewSettings(), camera: this.canvas?.getCamera() ?? null };
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

  async savePicture(background: boolean) {
    const png = await this.canvas?.picture(background);
    if (!png) return;
    const saved = await saveFile(`${this.fileStem()}.png`, png, 'picture', null, () => false);
    if (saved) this.message = saved.how === 'downloaded' ? `Downloaded ${saved.name}.` : `Saved ${saved.name}.`;
  }

  async share() {
    const m = this.model;
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

  async generateNow() {
    this.message = '';
    this.reached = null;
    const options = this.addTypes ? $state.snapshot(this.deco) : null;
    const seed = this.seed;
    const interfaces = Math.min(1, Math.max(0, Number(this.interfaces) || 0));
    const share = interfaces > 0 ? { interfaces } : {};
    try {
      if (this.chosenExample) {
        const id = this.chosenExample;
        const raw = await exampleDoc(id);
        const doc = throughInterfaces(options ? decorate(raw, seed, options) : raw, interfaces, seed);
        this.fileHandle = null;
        this.fileName = '';
        await this.show(doc, { kind: 'example', id, decorate: options, ...share });
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
        await this.show(doc, { kind: 'generated', ...from });
      }
    } catch (err) {
      this.message = `Cannot generate: ${(err as Error).message}.`;
    }
  }

  // ---------------------------------------------------------------- start: a link, or the sample

  async start() {
    const m = this.model;
    const link = readLink(location.search);
    let note = link.error;
    if (link.view.mode) m.setMode(link.view.mode);
    let view = { root: link.view.root ?? null, target: link.view.target ?? null, path: link.view.path ?? null };
    let s = link.source;
    const id = s?.kind === 'example' ? s.id : null;
    if (id !== null && !examples.some((e) => e.id === id)) {
      // An unknown example: the sample graph, without the view that belonged to the other one.
      note = LINK_GRAPH_ERROR;
      s = null;
      view = { root: null, target: null, path: null };
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
    await this.generateNow();
    tell();
    if (view.root !== null) {
      await m.setRoot(view.root);
      if (view.target !== null) await m.setTarget(view.target);
      if (view.path) m.choosePath(view.path);
    }
  }

  // ---------------------------------------------------------------- for browser tests and the console

  private ready() {
    this.readyCount++;
    const w = this.waiters;
    this.waiters = [];
    w.forEach((f) => f());
  }

  /** The hook of specification 8.15 on window.graphview. */
  private expose() {
    (window as unknown as Record<string, unknown>).graphview = {
      model: this.model,
      canvas: () => this.canvas,
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
      setLook: (look: { theme?: Shell['theme']; motion?: Shell['motion'] }) => {
        if (look.theme) this.theme = look.theme;
        if (look.motion) this.motion = look.motion;
      },
    };
  }
}
