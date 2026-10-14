<!-- The run shell (specification Part G): load, generate, break, set every parameter, save and share. -->
<script lang="ts">
  import {
    GraphView,
    components,
    defaultLook,
    fingerprint,
    loadGraph,
    relationCount,
    type DeepPartial,
    type Key,
    type LayoutName,
    type Overlay,
    type Look,
    type ViewState,
  } from '../module/index.ts';
  import { examples, exampleDoc } from './lib/examples.ts';
  import { FAMILIES, generate, type Family, type Params } from './lib/generate.ts';
  import { breakRules, NO_BREAKS, type BreakOptions } from './lib/breakRules.ts';

  type Source =
    | { kind: 'example'; id: string }
    | { kind: 'url'; url: string }
    | { kind: 'generated'; family: Family; params: Params; seed: number; breaks: BreakOptions }
    | { kind: 'file'; name: string };

  let doc: unknown = $state.raw(null);
  /** Changes for each new source, so that a new example starts fresh; a replacement keeps places (V11). */
  let generation = $state(0);
  let overlays: Overlay[] = $state.raw([]);
  let source: Source | null = $state(null);
  let look: Look = $state(defaultLook());
  let viewState: ViewState | null = $state(null);
  let initialView: Partial<ViewState> | undefined = $state.raw(undefined);
  let gv: ReturnType<typeof GraphView> | undefined = $state();
  let message = $state('');
  let leftOpen = $state(false);
  let reached: number[] | null = $state(null);
  let urlInput = $state('');
  let dragging = $state(false);
  let shareLink = $state('');
  let pictureScale: 1 | 2 = $state(1);
  let pictureBackground = $state(true);

  // Generator form
  let family: Family = $state('small-world');
  let params: Record<string, string> = $state(paramsText(FAMILIES.find((f) => f.id === 'small-world')!.params));
  let seed = $state(1);
  let breaks: BreakOptions = $state({ ...NO_BREAKS });

  function paramsText(p: Params): Record<string, string> {
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]));
  }
  function paramsValue(p: Record<string, string>): Params {
    return Object.fromEntries(
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
  }

  // ---------------------------------------------------------------- what the shell holds

  let loaded = $derived.by(() => {
    const r = loadGraph(doc);
    if (!r.ok) return { ok: false as const, code: r.code };
    return {
      ok: true as const,
      name: typeof r.graph.meta.name === 'string' ? r.graph.meta.name : 'Graph',
      units: r.graph.units.length,
      relations: relationCount(r.graph),
      issues: r.issues.length,
      parts: components(r.graph).sizes.length,
      fingerprint: fingerprint(r.graph),
      rosetta: r.graph.meta.rosetta !== false,
    };
  });

  const plural = (n: number, one: string, many: string) =>
    n === 0 ? `no ${many}` : `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
  let headline = $derived(
    loaded.ok
      ? `${loaded.name}, ${plural(loaded.units, 'unit', 'units')}, ${plural(loaded.relations, 'relation', 'relations')}, ${plural(loaded.issues, 'issue', 'issues')}`
      : 'Refused file',
  );

  // ---------------------------------------------------------------- loading (G2)

  async function loadExample(id: string, view?: Partial<ViewState>) {
    message = '';
    initialView = view;
    const next = await exampleDoc(id);
    generation++;
    doc = next;
    source = { kind: 'example', id };
    reached = null;
  }

  function loadText(text: string, name: string) {
    try {
      initialView = undefined;
      const next = JSON.parse(text);
      generation++;
      doc = next;
      source = { kind: 'file', name };
      message = '';
      reached = null;
    } catch {
      message = `The file ${name} is not valid JSON.`;
    }
  }

  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) loadText(await f.text(), f.name);
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) loadText(await f.text(), f.name);
  }

  async function loadUrl(url: string, view?: Partial<ViewState>) {
    message = `Loading ${url}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      initialView = view;
      const next = await res.json();
      generation++;
      doc = next;
      source = { kind: 'url', url };
      message = '';
      reached = null;
    } catch {
      message = `The server at ${url} refused the request, or sent no JSON.`;
    }
  }

  // ---------------------------------------------------------------- generating (G3, G4)

  function runGenerator(view?: Partial<ViewState>) {
    try {
      const p = paramsValue(params);
      const g = generate(family, p, seed);
      initialView = view;
      generation++;
      doc = breakRules(g.doc, breaks, seed);
      reached = g.reached ?? null;
      source = { kind: 'generated', family, params: p, seed, breaks: { ...breaks } };
      message = '';
    } catch (err) {
      message = `Cannot generate: ${(err as Error).message}.`;
    }
  }

  function chooseFamily(id: Family) {
    family = id;
    params = paramsText(FAMILIES.find((f) => f.id === id)!.params);
  }

  // ---------------------------------------------------------------- saving and sharing (G6, V23)

  function download(name: string, blob: Blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function saveGraph() {
    let out = doc;
    if (loaded.ok && doc && typeof doc === 'object' && !Array.isArray(doc)) {
      const d = doc as Record<string, unknown>;
      const meta = d.meta && typeof d.meta === 'object' && !Array.isArray(d.meta) ? d.meta : {};
      out = { ...d, meta: { ...meta, fingerprint: loaded.fingerprint } };
    }
    download('graph.json', new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  }

  function saveView() {
    if (!gv) return;
    download('view.json', new Blob([JSON.stringify(gv.getViewState(), null, 1)], { type: 'application/json' }));
  }

  async function loadView(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f || !gv) return;
    try {
      await gv.setViewState(JSON.parse(await f.text()));
      message = '';
    } catch {
      message = `The file ${f.name} is not a view state.`;
    }
  }

  async function savePicture() {
    if (gv) download('graph.png', await gv.exportPicture({ scale: pictureScale, background: pictureBackground }));
  }

  function makeShareLink(): string {
    const q = new URLSearchParams();
    const s = source;
    if (s?.kind === 'example') q.set('example', s.id);
    else if (s?.kind === 'url') q.set('url', s.url);
    else if (s?.kind === 'generated')
      q.set('gen', JSON.stringify({ family: s.family, params: s.params, seed: s.seed, breaks: s.breaks }));
    if (gv) q.set('view', JSON.stringify(gv.getViewState()));
    return `${location.origin}${location.pathname}?${q.toString()}`;
  }

  async function share() {
    shareLink = makeShareLink();
    history.replaceState(null, '', shareLink);
    try {
      await navigator.clipboard.writeText(shareLink);
      message = 'The link is on the clipboard.';
    } catch {
      message = 'Copy the link below.';
    }
  }

  // ---------------------------------------------------------------- start

  async function start() {
    const q = new URLSearchParams(location.search);
    let view: Partial<ViewState> | undefined;
    try {
      view = q.get('view') ? JSON.parse(q.get('view')!) : undefined;
    } catch {
      view = undefined;
    }
    if (q.get('gen')) {
      try {
        const g = JSON.parse(q.get('gen')!);
        family = g.family;
        params = paramsText(g.params);
        seed = g.seed;
        breaks = { ...NO_BREAKS, ...g.breaks };
        runGenerator(view);
        return;
      } catch {
        message = 'The generator in the link could not be read.';
      }
    }
    if (q.get('url')) return loadUrl(q.get('url')!, view);
    await loadExample(q.get('example') ?? 'database-2026-07-24', view);
  }
  void start();

  // ---------------------------------------------------------------- parameters (G5)

  function setLook(part: DeepPartial<Look>) {
    look = mergeLook(look, part);
  }
  function mergeLook(base: Look, part: DeepPartial<Look>): Look {
    const out = structuredClone($state.snapshot(base)) as Look;
    for (const [k, v] of Object.entries(part)) {
      const cur = (out as unknown as Record<string, unknown>)[k];
      (out as unknown as Record<string, unknown>)[k] =
        v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' ? { ...cur, ...v } : v;
    }
    return out;
  }
  function resetAll() {
    look = defaultLook();
    void gv?.setViewState({
      focus: null,
      radius: null,
      beyond: 'fade',
      selection: { units: [], keypairs: [] },
      filters: { hideLoneUnits: false },
      paths: { ends: null, extra: 2, lit: null, showAll: null },
    });
    void gv?.fit('all');
  }
  function parseKey(text: string): Key | null {
    const t = text.trim();
    if (!t) return null;
    try {
      const v = JSON.parse(t);
      if (typeof v === 'number' || typeof v === 'string') return v;
    } catch {
      /* a bare word is a text key */
    }
    return t;
  }
  const keyInput = (k: Key | null) => (k === null ? '' : JSON.stringify(k));
  async function setView(part: Partial<ViewState>) {
    await gv?.setViewState(part);
  }
  async function setLayoutName(name: LayoutName) {
    await gv?.setLayout({ name, seed: viewState?.layout.seed ?? 1 });
  }
  let colourMode = $derived(typeof look.relations.colour === 'object' ? 'attr' : look.relations.colour);
  let colourAttr = $derived(typeof look.relations.colour === 'object' ? look.relations.colour.attr : 'type');
  let json = $derived(JSON.stringify({ view: viewState, look }, null, 1));

  // The shell's own colours follow the theme setting.
  $effect(() => {
    if (look.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = look.theme;
  });

  // For browser tests and the console: the component's commands, and a log of its events.
  const log: { name: string; payload: unknown }[] = [];
  let settledCount = 0;
  let waiters: (() => void)[] = [];
  const record = (name: string) => (payload: unknown) => {
    log.push({ name, payload: JSON.parse(JSON.stringify(payload ?? null)) });
    if (name === 'layoutsettled') {
      settledCount++;
      viewState = gv?.getViewState() ?? viewState;
      const w = waiters;
      waiters = [];
      w.forEach((f) => f());
    }
    if (name === 'viewstate') viewState = payload as ViewState;
  };
  const nextSettled = () => new Promise<void>((r) => waiters.push(r));
  $effect(() => {
    (window as unknown as Record<string, unknown>).graphview = {
      view: gv,
      log,
      settled: () => settledCount,
      nextSettled,
      setOverlays: (list: Overlay[]) => (overlays = list),
      /** Replaces the graph in place, with stable change (V11). */
      replace: async (next: unknown) => {
        const done = nextSettled();
        doc = next;
        await done;
      },
      loadExample: async (id: string, view?: Partial<ViewState>) => {
        const done = nextSettled();
        await loadExample(id, view);
        if (examples.find((e) => e.id === id)?.group !== 'refused') await done;
      },
      setLook,
      generate: (f: Family, p: Params, s: number, b: BreakOptions = NO_BREAKS) => {
        family = f;
        params = paramsText(p);
        seed = s;
        breaks = { ...b };
        runGenerator();
      },
    };
  });

  function scrollTo(id: string) {
    leftOpen = true;
    queueMicrotask(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }
</script>

<div
  class="shell"
  class:dragging
  role="presentation"
  ondragover={(e) => (e.preventDefault(), (dragging = true))}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <header class="top">
    <button
      type="button"
      class="menu"
      aria-expanded={leftOpen}
      aria-controls="left"
      onclick={() => (leftOpen = !leftOpen)}>Controls</button
    >
    <h1>graphview</h1>
    <nav aria-label="Main">
      <button type="button" onclick={() => scrollTo('data')}>Load</button>
      <button type="button" onclick={() => scrollTo('generate')}>Generate</button>
      <label class="examples"
        ><span class="sr">Examples</span>
        <select
          aria-label="Examples"
          value={source?.kind === 'example' ? source.id : ''}
          onchange={(e) => loadExample((e.target as HTMLSelectElement).value)}
        >
          <option value="" disabled>Examples</option>
          {#each ['valid', 'broken', 'refused'] as g (g)}
            <optgroup label={g === 'valid' ? 'Valid' : g === 'broken' ? 'Broken' : 'Refused'}>
              {#each examples.filter((x) => x.group === g) as x (x.id)}
                <option value={x.id}>{x.name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
    </nav>
    <p class="headline" data-testid="headline">{headline}</p>
  </header>
  {#if loaded.ok && !loaded.rosetta}
    <p class="banner" role="status" data-testid="not-rosetta">Not Rosetta data</p>
  {/if}
  <div class="body">
    <aside id="left" class="left" class:open={leftOpen} aria-label="Controls">
      <section id="data">
        <h2>Data</h2>
        {#if source?.kind === 'example'}
          {@const x = examples.find((e) => e.id === (source as { id: string }).id)}
          {#if x}<p class="note">{x.description}</p>{/if}
        {/if}
        <label class="field">Open a file <input type="file" accept=".json,application/json" onchange={onFile} /></label>
        <p class="note">Or drop a file on the page.</p>
        <form
          class="row"
          onsubmit={(e) => {
            e.preventDefault();
            if (urlInput) void loadUrl(urlInput);
          }}
        >
          <label class="grow"
            ><span class="sr">Web address</span><input
              type="url"
              placeholder="Web address"
              bind:value={urlInput}
            /></label
          >
          <button type="submit">Fetch</button>
        </form>
        {#if message}<p class="message" role="status" data-testid="message">{message}</p>{/if}
        {#if loaded.ok}
          <p class="note num">
            {plural(loaded.units, 'unit', 'units')}, {plural(loaded.relations, 'relation', 'relations')}, {plural(
              loaded.parts,
              'component',
              'components',
            )}
          </p>
        {/if}
        <div class="buttons">
          <button type="button" onclick={saveGraph}>Save graph</button>
          <button type="button" onclick={share}>Share link</button>
          <button type="button" onclick={saveView}>Save view</button>
          <label class="file-button">Load view <input type="file" accept=".json" onchange={loadView} /></label>
        </div>
        {#if shareLink}<input class="link" readonly value={shareLink} aria-label="Share link" />{/if}
        <div class="row">
          <button type="button" onclick={savePicture}>Save picture</button>
          <label
            >Scale <select bind:value={pictureScale} aria-label="Picture scale"
              ><option value={1}>1</option><option value={2}>2</option></select
            ></label
          >
          <label><input type="checkbox" bind:checked={pictureBackground} /> Background</label>
        </div>
      </section>

      <section id="generate">
        <h2>Generate</h2>
        <label class="field"
          >Family
          <select value={family} onchange={(e) => chooseFamily((e.target as HTMLSelectElement).value as Family)}>
            {#each FAMILIES as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
          </select>
        </label>
        {#each Object.keys(params) as k (family + k)}
          <label class="field"
            >{k === 'degrees' ? 'Degrees' : k}<input
              type="text"
              inputmode={k === 'degrees' ? 'text' : 'decimal'}
              bind:value={params[k]}
            /></label
          >
        {/each}
        <label class="field">Seed <input type="number" bind:value={seed} /></label>
        <details>
          <summary>Break the rules</summary>
          <label class="field"
            >Share without reverse <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              bind:value={breaks.dropReverse}
            /></label
          >
          <label class="field"
            >Keypairs with unknown key <input type="number" min="0" bind:value={breaks.unknownKeys} /></label
          >
          <label class="field">Repeated rows <input type="number" min="0" bind:value={breaks.repeatRows} /></label>
          <label class="field"
            >Units without relation <input type="number" min="0" bind:value={breaks.loneUnits} /></label
          >
        </details>
        <button type="button" class="primary" onclick={() => runGenerator()}>Generate</button>
        {#if reached}
          <p class="note num" data-testid="reached">Degrees asked: {params.degrees}. Reached: {reached.join(', ')}.</p>
        {/if}
      </section>

      <section id="layout">
        <h2>Layout</h2>
        <label class="field"
          >Layout
          <select
            value={viewState?.layout.name ?? 'force'}
            onchange={(e) => setLayoutName((e.target as HTMLSelectElement).value as LayoutName)}
          >
            <option value="force">Force</option>
            <option value="rings">Rings around the focus</option>
            <option value="circle">Circle</option>
            <option value="grid">Grid</option>
            <option value="given">Given positions</option>
          </select>
        </label>
        <label class="field"
          >Seed <input
            type="number"
            value={viewState?.layout.seed ?? 1}
            onchange={(e) =>
              gv?.setLayout({
                name: viewState?.layout.name ?? 'force',
                seed: Number((e.target as HTMLInputElement).value),
              })}
          /></label
        >
        <button type="button" onclick={() => gv?.setLayout({ name: viewState?.layout.name ?? 'force' })}
          >Run layout</button
        >
      </section>

      <section id="focus">
        <h2>Focus</h2>
        <label class="field"
          >Focus key <input
            type="text"
            placeholder="1 or &quot;text&quot;"
            value={keyInput(viewState?.focus ?? null)}
            onchange={(e) => setView({ focus: parseKey((e.target as HTMLInputElement).value) })}
          /></label
        >
        <label class="field"
          >Radius <input
            type="number"
            min="0"
            placeholder="none"
            value={viewState?.radius ?? ''}
            onchange={(e) => {
              const v = (e.target as HTMLInputElement).value;
              void setView({ radius: v === '' ? null : Number(v) });
            }}
          /></label
        >
        <label class="field"
          >Beyond the radius <select
            value={viewState?.beyond ?? 'fade'}
            onchange={(e) => setView({ beyond: (e.target as HTMLSelectElement).value as 'fade' | 'hide' })}
            ><option value="fade">Fade</option><option value="hide">Hide</option></select
          ></label
        >
        <label class="check"
          ><input
            type="checkbox"
            checked={viewState?.filters.hideLoneUnits ?? false}
            onchange={(e) => setView({ filters: { hideLoneUnits: (e.target as HTMLInputElement).checked } })}
          /> Hide lone units</label
        >
      </section>

      <section id="look">
        <h2>Look</h2>
        <label class="field"
          >Theme <select
            value={look.theme}
            onchange={(e) => setLook({ theme: (e.target as HTMLSelectElement).value as Look['theme'] })}
            ><option value="system">As the system</option><option value="light">Light</option><option value="dark"
              >Dark</option
            ></select
          ></label
        >
        <label class="field"
          >Relations <select
            value={look.relations.draw}
            onchange={(e) =>
              setLook({ relations: { draw: (e.target as HTMLSelectElement).value as Look['relations']['draw'] } })}
            ><option value="halves">Two halves</option><option value="arrows">Two arrows</option><option value="lines"
              >One line</option
            ></select
          ></label
        >
        <label class="field"
          >Chevrons <select
            value={look.relations.icons}
            onchange={(e) =>
              setLook({ relations: { icons: (e.target as HTMLSelectElement).value as Look['relations']['icons'] } })}
            ><option value="by-zoom">By zoom</option><option value="always">Always</option><option value="never"
              >Never</option
            ></select
          ></label
        >
        <label class="field"
          >Colour <select
            value={colourMode}
            onchange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setLook({
                relations: { colour: v === 'attr' ? { attr: colourAttr } : (v as 'neutral' | 'around-selection') },
              });
            }}
            ><option value="around-selection">Around the selection</option><option value="neutral">Neutral</option
            ><option value="attr">By keypair attribute</option></select
          ></label
        >
        {#if colourMode === 'attr'}
          <label class="field"
            >Attribute <input
              type="text"
              value={colourAttr}
              onchange={(e) => setLook({ relations: { colour: { attr: (e.target as HTMLInputElement).value } } })}
            /></label
          >
        {/if}
        <label class="field"
          >Superseded <select
            value={look.superseded}
            onchange={(e) => setLook({ superseded: (e.target as HTMLSelectElement).value as Look['superseded'] })}
            ><option value="fade">Fade</option><option value="show">Show</option><option value="hide">Hide</option
            ></select
          ></label
        >
        <label class="field"
          >Labels from <input
            type="text"
            value={look.labels.field}
            onchange={(e) =>
              setLook({ labels: { field: (e.target as HTMLInputElement).value as Look['labels']['field'] } })}
          /></label
        >
        <label class="field"
          >Show labels <select
            value={look.labels.show}
            onchange={(e) =>
              setLook({ labels: { show: (e.target as HTMLSelectElement).value as Look['labels']['show'] } })}
            ><option value="auto">Where they fit</option><option value="always">Always</option><option value="never"
              >Never</option
            ></select
          ></label
        >
        <label class="field"
          >Motion <select
            value={look.motion}
            onchange={(e) => setLook({ motion: (e.target as HTMLSelectElement).value as Look['motion'] })}
            ><option value="system">As the system</option><option value="on">On</option><option value="off">Off</option
            ></select
          ></label
        >
      </section>

      <section id="parameters">
        <h2>Parameters</h2>
        <fieldset>
          <legend>Gestures</legend>
          {#each Object.keys(look.gestures) as g (g)}
            <label class="check"
              ><input
                type="checkbox"
                checked={look.gestures[g as keyof Look['gestures']]}
                onchange={(e) => setLook({ gestures: { [g]: (e.target as HTMLInputElement).checked } })}
              />
              {g === 'dragUnits' ? 'drag units' : g}</label
            >
          {/each}
        </fieldset>
        <fieldset>
          <legend>Panels</legend>
          {#each Object.keys(look.panels) as p (p)}
            <label class="check"
              ><input
                type="checkbox"
                checked={look.panels[p as keyof Look['panels']]}
                onchange={(e) => setLook({ panels: { [p]: (e.target as HTMLInputElement).checked } })}
              />
              {p}</label
            >
          {/each}
        </fieldset>
        <fieldset>
          <legend>Path limits</legend>
          {#each [['pathCount', 'Count'], ['pathList', 'Listed per length'], ['pathTimeMs', 'Time in ms'], ['maxExtra', 'Most extra steps']] as [k, label] (k)}
            <label class="field"
              >{label}<input
                type="number"
                min="0"
                value={look.limits[k as keyof Look['limits']]}
                onchange={(e) => setLook({ limits: { [k]: Number((e.target as HTMLInputElement).value) } })}
              /></label
            >
          {/each}
        </fieldset>
        <label class="field"
          >Font <input
            type="text"
            value={look.font}
            onchange={(e) => setLook({ font: (e.target as HTMLInputElement).value })}
          /></label
        >
        <fieldset>
          <legend>Camera</legend>
          {#each ['x', 'y', 'zoom', 'angle'] as k (k)}
            <label class="field"
              >{k}<input
                type="number"
                step="any"
                value={viewState ? +viewState.camera[k as 'x'].toFixed(3) : 0}
                onchange={(e) =>
                  setView({ camera: { ...viewState!.camera, [k]: Number((e.target as HTMLInputElement).value) } })}
              /></label
            >
          {/each}
        </fieldset>
        <button type="button" onclick={resetAll}>Reset to defaults</button>
        <details>
          <summary>All inputs as JSON</summary>
          <pre class="json" data-testid="json">{json}</pre>
        </details>
      </section>
    </aside>
    <main class="main">
      {#if doc !== null}
        {#key generation}
          <GraphView
            bind:this={gv}
            graph={doc}
            view={initialView}
            {look}
            {overlays}
            onselect={record('select')}
            onhover={record('hover')}
            onactivate={record('activate')}
            onfocus={record('focus')}
            oncamera={record('camera')}
            onviewstate={record('viewstate')}
            onlayoutsettled={record('layoutsettled')}
            onpathset={record('pathset')}
            onexpandrequest={record('expandrequest')}
            onissues={record('issues')}
          />
        {/key}
      {/if}
    </main>
  </div>
</div>
