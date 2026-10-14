<!-- GraphView: the module's component (specification Part D). Hosts use it directly, or through createGraphView. -->
<script lang="ts">
  import '@fontsource/atkinson-hyperlegible-next/400.css';
  import '@fontsource/atkinson-hyperlegible-next/600.css';
  import '@fontsource/atkinson-hyperlegible-next/700.css';
  import './graphview.css';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { keyId, type Key } from '../core/index.ts';
  import { createEngine, type Engine } from '../engine/index.ts';
  import type { GraphViewProps, LayoutName, ViewState } from '../types.ts';
  import { Controller } from './controller.ts';
  import { drawOverlay } from './overlay.ts';
  import Details from './Details.svelte';
  import Paths from './Paths.svelte';
  import KeyPanel from './KeyPanel.svelte';
  import Issues from './Issues.svelte';
  import { count, refusalWords } from './words.ts';

  let props: GraphViewProps = $props();

  const c = new Controller();
  let version = $state(0);
  let root: HTMLDivElement;
  let stage: HTMLDivElement;
  let engineEl: HTMLDivElement;
  let overlay: HTMLCanvasElement;
  let input: HTMLDivElement;
  let searchInput: HTMLInputElement | undefined = $state();
  let engine: Engine | null = null;
  let narrow = $state(false);
  let drawerOpen = $state(false);
  let searchOpen = $state(false);
  let query = $state('');
  let loadedGraph: unknown = undefined;

  c.subscribe(() => untrack(() => version++));

  // ---------------------------------------------------------------- inputs

  $effect(() => {
    c.setEvents({
      onselect: props.onselect,
      onhover: props.onhover,
      onactivate: props.onactivate,
      onfocus: props.onfocus,
      oncamera: props.oncamera,
      onviewstate: props.onviewstate,
      onlayoutsettled: props.onlayoutsettled,
      onpathset: props.onpathset,
      onexpandrequest: props.onexpandrequest,
      onissues: props.onissues,
    });
  });

  $effect(() => {
    c.setLook($state.snapshot(props.look) as GraphViewProps['look']);
    applyTheme();
  });

  $effect(() => {
    const g = props.graph;
    if (!engine || g === loadedGraph) return;
    const stable = loadedGraph !== undefined;
    loadedGraph = g;
    c.setGraph($state.snapshot(g), stable);
  });

  $effect(() => {
    const v = props.view;
    if (!engine || !v) return;
    void c.setViewState($state.snapshot(v) as Partial<ViewState>);
  });

  $effect(() => {
    const o = props.overlays;
    if (!engine) return;
    c.setOverlays(($state.snapshot(o) as GraphViewProps['overlays']) ?? []);
  });

  // ---------------------------------------------------------------- mount

  let mounted = $state(false);
  onMount(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    c.systemDark = dark.matches;
    c.reducedMotion = reduced.matches;
    const onDark = () => ((c.systemDark = dark.matches), applyTheme(), c.restyle(), c.notify());
    const onReduced = () => (c.reducedMotion = reduced.matches);
    dark.addEventListener('change', onDark);
    reduced.addEventListener('change', onReduced);

    const ctx = overlay.getContext('2d')!;
    const measureCtx = document.createElement('canvas').getContext('2d')!;
    c.measure = (t, bold) => {
      measureCtx.font = `${bold ? 700 : 400} 12px ${c.look.font}`;
      return measureCtx.measureText(t).width;
    };
    size();
    engine = createEngine(engineEl, () => c.colours.surface);
    c.afterRender = () => {
      drawOverlay(ctx, c, devicePixelRatio);
    };
    c.attach(engine);
    loadedGraph = props.graph;
    c.setGraph($state.snapshot(props.graph), false);
    if (props.view) void c.setViewState($state.snapshot(props.view) as Partial<ViewState>);
    c.setOverlays(($state.snapshot(props.overlays) as GraphViewProps['overlays']) ?? []);
    const ro = new ResizeObserver(() => {
      size();
      engine?.resize();
      c.applyCamera();
    });
    ro.observe(stage);
    ro.observe(root);
    mounted = true;
    return () => {
      ro.disconnect();
      dark.removeEventListener('change', onDark);
      reduced.removeEventListener('change', onReduced);
    };
  });

  onDestroy(() => {
    c.detach();
    engine?.destroy();
  });

  function size() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    c.width = w;
    c.height = h;
    overlay.width = Math.round(w * devicePixelRatio);
    overlay.height = Math.round(h * devicePixelRatio);
    // Below 960 pixels the panels become a drawer (F6).
    narrow = innerWidth < 960 || root.clientWidth < 520;
  }

  function applyTheme() {
    if (!root) return;
    const t = c.colours;
    for (const [k, v] of Object.entries(t)) root.style.setProperty(`--gv-${k}`, v);
    root.style.setProperty('--gv-font', c.look.font);
    root.dataset.theme = c.theme;
  }

  // ---------------------------------------------------------------- pointer

  let down: {
    x: number;
    y: number;
    button: number;
    mode: 'pan' | 'rotate' | 'unit' | 'pinch';
    key?: Key;
    moved: boolean;
    angle: number;
  } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;

  const local = (e: PointerEvent | MouseEvent | WheelEvent) => {
    const r = input.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onPointerDown(e: PointerEvent) {
    const p = local(e);
    pointers.set(e.pointerId, p);
    input.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      down = { ...p, button: 0, mode: 'pinch', moved: true, angle: 0 };
      return;
    }
    const g = c.look.gestures;
    const h = c.hit(p.x, p.y);
    const angle = Math.atan2(p.y - c.height / 2, p.x - c.width / 2);
    if (e.button === 2 && g.rotate) down = { ...p, button: 2, mode: 'rotate', moved: false, angle };
    else if (h && 'unit' in h && g.dragUnits)
      down = { ...p, button: 0, mode: 'unit', key: h.unit, moved: false, angle };
    else down = { ...p, button: e.button, mode: 'pan', moved: false, angle };
  }

  function onPointerMove(e: PointerEvent) {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (!down) {
      c.setHover(c.hit(p.x, p.y));
      input.style.cursor = c.hover.unit !== null || c.hover.keypair ? 'pointer' : 'default';
      return;
    }
    const dx = p.x - down.x;
    const dy = p.y - down.y;
    if (!down.moved && Math.hypot(dx, dy) < 4) return;
    down.moved = true;
    const g = c.look.gestures;
    if (down.mode === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.zoom && pinchDist > 0) c.zoomAround(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDist = d;
    } else if (down.mode === 'pan' && g.pan) {
      c.panBy(dx, dy);
      down.x = p.x;
      down.y = p.y;
    } else if (down.mode === 'rotate') {
      const a = Math.atan2(p.y - c.height / 2, p.x - c.width / 2);
      c.rotateBy(((a - down.angle) * 180) / Math.PI);
      down.angle = a;
    } else if (down.mode === 'unit' && down.key !== undefined) {
      c.dragUnit(down.key, p.x, p.y);
    }
  }

  function onPointerUp(e: PointerEvent) {
    const p = local(e);
    pointers.delete(e.pointerId);
    const d = down;
    down = null;
    if (!d) return;
    if (d.mode === 'unit' && d.moved && d.key !== undefined) {
      c.pin(d.key, true);
      c.restyle();
      return;
    }
    if (!d.moved && d.button === 0) c.click(c.hit(p.x, p.y), e.shiftKey);
  }

  function onWheel(e: WheelEvent) {
    if (!c.look.gestures.zoom) return;
    e.preventDefault();
    const p = local(e);
    c.zoomAround(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }

  function onDblClick(e: MouseEvent) {
    const p = local(e);
    c.activateHit(c.hit(p.x, p.y));
  }

  function onLeave() {
    if (!down) c.setHover(null);
  }

  // ---------------------------------------------------------------- keyboard (F7)

  function onKey(e: KeyboardEvent) {
    if (!c.look.gestures.keyboard) return;
    const step = (n: number) => n / 10;
    const k = e.key;
    let handled = true;
    if (k === 'ArrowLeft') c.panBy(step(c.width), 0);
    else if (k === 'ArrowRight') c.panBy(-step(c.width), 0);
    else if (k === 'ArrowUp') c.panBy(0, step(c.height));
    else if (k === 'ArrowDown') c.panBy(0, -step(c.height));
    else if ((k === '+' || k === '=') && e.shiftKey) radius(1);
    else if ((k === '-' || k === '_' || k === '−') && e.shiftKey) radius(-1);
    else if (k === '+' || k === '=') c.zoomAround(1.25, c.width / 2, c.height / 2);
    else if (k === '-' || k === '−') c.zoomAround(0.8, c.width / 2, c.height / 2);
    else if (k === '[') c.rotateBy(-15);
    else if (k === ']') c.rotateBy(15);
    else if (k === '0') void c.rotateTo(0);
    else if (k === 'f' || k === 'F') {
      if (c.view.selection.units.length === 1) c.setFocus(c.view.selection.units[0]);
    } else if (k === 'Escape') {
      c.pathFrom = null;
      c.select([], []);
    } else if (k === 'Tab') handled = c.step(e.shiftKey ? -1 : 1);
    else if (k === 'Enter') c.activate();
    else if (k === '/') openSearch();
    else handled = false;
    if (handled) e.preventDefault();
  }

  function radius(delta: number) {
    if (c.view.focus === null) return;
    const r = c.view.radius;
    const next = r === null ? (delta > 0 ? 1 : null) : r + delta < 0 ? null : r + delta;
    c.setFocus(c.view.focus, next);
  }

  // ---------------------------------------------------------------- search (V15)

  let suggestions = $derived.by(() => {
    void version;
    const q = query.trim().toLowerCase();
    if (!q || !c.graph) return [];
    const out: Key[] = [];
    for (const k of c.graph.units) {
      const label = c.graph.unitInfo.get(keyId(k))?.label ?? '';
      const key = typeof k === 'string' ? k : String(k);
      if (label.toLowerCase().includes(q) || key.toLowerCase().includes(q)) out.push(k);
      if (out.length >= 10) break;
    }
    return out;
  });

  function openSearch() {
    searchOpen = true;
    queueMicrotask(() => searchInput?.focus());
  }

  function choose(k: Key) {
    c.select([k], []);
    void c.flyTo(k);
    searchOpen = false;
    query = '';
    input.focus();
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && suggestions.length) {
      choose(suggestions[0]);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      searchOpen = false;
      query = '';
      input.focus();
    }
  }

  // ---------------------------------------------------------------- commands (D7)

  export function fit(target: 'all' | 'selection' = 'all') {
    return c.fit(target);
  }
  export function flyTo(key: Key) {
    return c.flyTo(key);
  }
  export function rotateTo(angle: number) {
    return c.rotateTo(angle);
  }
  export function setLayout(layout: Partial<ViewState['layout']> & { name: LayoutName }) {
    return c.setLayout(layout);
  }
  export function showPaths(from: Key, to: Key, extra: number) {
    return c.showPaths(from, to, extra);
  }
  export function spotlight(..._args: unknown[]) {
    return c.release2();
  }
  export function play() {
    return c.release2();
  }
  export function pause() {
    return c.release2();
  }
  export function step(_delta: number) {
    return c.release2();
  }
  export function seek(_frame: number) {
    return c.release2();
  }
  export function getViewState() {
    return c.getViewState();
  }
  export function setViewState(partial: Partial<ViewState>) {
    return c.setViewState(partial);
  }
  export function getScene() {
    return c.getScene();
  }
  export function exportPicture(options: { scale?: 1 | 2; background?: boolean } = {}): Promise<Blob> {
    const s = options.scale ?? 1;
    const out = document.createElement('canvas');
    out.width = Math.round(c.width * s);
    out.height = Math.round(c.height * s);
    const ctx = out.getContext('2d')!;
    if (options.background !== false) {
      ctx.fillStyle = c.colours.surface;
      ctx.fillRect(0, 0, out.width, out.height);
    }
    engine?.render();
    for (const cv of engine?.canvases() ?? []) ctx.drawImage(cv, 0, 0, out.width, out.height);
    const layer = document.createElement('canvas');
    layer.width = out.width;
    layer.height = out.height;
    drawOverlay(layer.getContext('2d')!, c, s);
    ctx.drawImage(layer, 0, 0);
    return new Promise((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/png'),
    );
  }

  // ---------------------------------------------------------------- display

  let summary = $derived.by(() => {
    void version;
    if (c.refused) return 'Graph: refused file';
    if (!c.graph) return 'Graph';
    return `Graph: ${count(c.graph.units.length, 'unit', 'units')}, ${count(c.relations.filter((r) => r.ab && r.ba).length, 'relation', 'relations')}`;
  });
  let announcement = $derived.by(() => {
    void version;
    return c.announcement;
  });
  let panels = $derived(c.look.panels);
  let anyPanel = $derived.by(() => {
    void version;
    const p = c.look.panels;
    return p.details || p.paths || p.issues || p.key;
  });

  const controls: { label: string; run: () => void; icon: string }[] = [
    { label: 'Fit', run: () => void c.fit('all'), icon: 'M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4' },
    { label: 'Zoom in', run: () => c.zoomAround(1.25, c.width / 2, c.height / 2), icon: 'M10 4v12M4 10h12' },
    { label: 'Zoom out', run: () => c.zoomAround(0.8, c.width / 2, c.height / 2), icon: 'M4 10h12' },
    { label: 'Rotate left', run: () => c.rotateBy(-15), icon: 'M6 6a6 6 0 1 1-1.5 6M6 2v4h4' },
    { label: 'Rotate right', run: () => c.rotateBy(15), icon: 'M14 6a6 6 0 1 0 1.5 6M14 2v4h-4' },
    { label: 'North', run: () => void c.rotateTo(0), icon: 'M10 3l4 12-4-3-4 3z' },
  ];
</script>

<div class="gv" bind:this={root} class:gv-narrow={narrow} data-mounted={mounted}>
  <div class="gv-stage" bind:this={stage}>
    <div class="gv-engine" bind:this={engineEl}></div>
    <canvas class="gv-overlay" bind:this={overlay} aria-hidden="true"></canvas>
    <!-- The canvas takes the role "application" (F7); the linter does not count that role as interactive. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="gv-input"
      bind:this={input}
      tabindex="0"
      role="application"
      aria-label={summary}
      aria-describedby="gv-help"
      data-testid="canvas"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onpointerleave={onLeave}
      onwheel={onWheel}
      ondblclick={onDblClick}
      oncontextmenu={(e) => e.preventDefault()}
      onkeydown={onKey}
    ></div>
    <p id="gv-help" class="gv-sr">
      Arrows pan, plus and minus zoom, brackets rotate, 0 returns to north, F sets the focus, Shift with plus and minus
      sets the radius, Escape clears, Tab steps through keypairs, Enter activates, slash opens the search.
    </p>
    {#if c.refused}
      <div class="gv-refused" role="alert" data-testid="refused" data-code={c.refused.code}>
        <p><strong>This file was refused.</strong></p>
        <p>{refusalWords(c.refused.code)}</p>
      </div>
    {/if}
    <div class="gv-search">
      {#if searchOpen}
        <input
          bind:this={searchInput}
          bind:value={query}
          type="search"
          placeholder="Find a unit"
          aria-label="Find a unit"
          aria-controls="gv-suggestions"
          onkeydown={onSearchKey}
        />
        {#if suggestions.length}
          <ul id="gv-suggestions" class="gv-suggestions" role="listbox" aria-label="Suggestions">
            {#each suggestions as k (keyId(k))}
              <li role="option" aria-selected="false">
                <button type="button" onclick={() => choose(k)}
                  >{c.name(k)}<span class="gv-note gv-num"> {typeof k === 'string' ? k : String(k)}</span></button
                >
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        <button type="button" class="gv-tool" onclick={openSearch} aria-label="Find a unit" title="Find a unit (/)">
          <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"
            ><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" stroke-width="1.6" /><path
              d="M12.5 12.5L17 17"
              stroke="currentColor"
              stroke-width="1.6"
            /></svg
          >
        </button>
      {/if}
    </div>
    <div class="gv-controls" role="toolbar" aria-label="Camera">
      {#each controls as b (b.label)}
        <button type="button" class="gv-tool" aria-label={b.label} title={b.label} onclick={b.run}>
          <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"
            ><path d={b.icon} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg
          >
        </button>
      {/each}
    </div>
    <div class="gv-sr" aria-live="polite" data-testid="live">{announcement}</div>
    {#if narrow && anyPanel}
      <button
        type="button"
        class="gv-drawer-toggle"
        aria-expanded={drawerOpen}
        onclick={() => (drawerOpen = !drawerOpen)}>{drawerOpen ? 'Hide panels' : 'Panels'}</button
      >
    {/if}
  </div>
  {#if anyPanel}
    <aside class="gv-panels" class:gv-drawer={narrow} class:gv-open={drawerOpen} aria-label="Graph panels">
      {#if panels.details}<Details {c} {version} />{/if}
      {#if panels.paths}<Paths {c} {version} />{/if}
      {#if panels.key}<KeyPanel {c} {version} />{/if}
      {#if panels.issues}<Issues {c} {version} />{/if}
    </aside>
  {/if}
</div>
