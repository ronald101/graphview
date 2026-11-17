<!-- GraphView (specification 7.9): the whole viewer in one component: a bar, the rule banner, the
     canvas, the side bar and the Settings dialog. It makes its own model and keeps its settings in a
     store; a host gives it a graph, or a source to read one from (5.8). -->
<script lang="ts">
  import { onMount, tick, type Component } from 'svelte';
  import type { Key } from '../core/index.ts';
  import type { Inspected, Mode, ViewSettings } from '../model/contracts.ts';
  import { GraphModel } from '../model/model.ts';
  import type { Profile } from '../model/profile.ts';
  import type { GraphSource } from '../model/source.ts';
  import type { Looks } from '../render/looks.ts';
  import type { SettingsFile } from '../settings/file.ts';
  import type { SectionId } from '../settings/groups/panels.ts';
  import { SettingsSaver } from '../settings/saver.svelte.ts';
  import { BrowserSettingsStore, type SettingsStore } from '../settings/stores.ts';
  import { viewCss } from './css.ts';
  import DisplayPanel from './DisplayPanel.svelte';
  import FiltersPanel from './FiltersPanel.svelte';
  import GraphCanvas from './GraphCanvas.svelte';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import InspectorPanel from './InspectorPanel.svelte';
  import type { CanvasHandle } from './handle.ts';
  import type { UnitSections } from './inspector/sections.ts';
  import IssuesPanel from './IssuesPanel.svelte';
  import PathsPanel from './PathsPanel.svelte';
  import RootPanel from './RootPanel.svelte';
  import ScopePanel from './ScopePanel.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import Section from './Section.svelte';
  import PinnedPanel from './settings/PinnedPanel.svelte';
  import SettingsDialog from './settings/SettingsDialog.svelte';
  import TypesPanel from './TypesPanel.svelte';
  import { watch } from './watch.svelte.ts';
  import { count, say } from './words.ts';

  interface Props {
    /** A document to show (3.1); a new one loads. */
    graph?: unknown;
    /** Or a source to read the graph from (5.8); a new one loads, and it wins over `graph`. */
    source?: GraphSource;
    /** The host's base values of settings, by key (5.9). */
    settings?: Record<string, unknown>;
    /** Where the settings file lives; browser storage unless given. */
    settingsStore?: SettingsStore;
    /** View settings to apply to the graph, as a saved file carries them (5.3). */
    view?: Partial<ViewSettings>;
    /** Base values of the settings "Colours" and "Motion". */
    theme?: 'light' | 'dark' | 'system';
    motion?: 'on' | 'off' | 'system';
    onready?: (e: { units: number; issues: number; refused: boolean }) => void;
    onroot?: (e: { root: Key | null }) => void;
    oninspect?: (e: Inspected) => void;
    /** The selected units after each change of the selection (6.20). */
    onselect?: (e: { keys: Key[] }) => void;
    /** The person's settings file after each change. */
    onsettings?: (file: SettingsFile) => void;
    /** Save picture hands the picture to the host; without this, the browser downloads it. */
    onpicture?: (picture: Blob) => void;
    /** What fits the viewer to a family of graphs (5.7): the model's profile, the kinds' looks, the inspector's sections. */
    profile?: Profile;
    looks?: Looks;
    sections?: UnitSections;
  }
  let {
    graph,
    source,
    settings,
    settingsStore,
    view,
    theme,
    motion,
    onready,
    onroot,
    oninspect,
    onselect,
    onsettings,
    onpicture,
    profile,
    looks,
    sections,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  export const model = new GraphModel(undefined, profile);
  // svelte-ignore state_referenced_locally
  const store = settingsStore ?? new BrowserSettingsStore('graphview-settings');
  const saver = new SettingsSaver(model.settings, store, (file) => model.applySettingsFile(file));
  let canvas: ReturnType<typeof GraphCanvas> | undefined = $state();
  let dialogOpen = $state(false);
  let boxSelect = $state(false);
  let searchText = $state('');
  let background = $state(model.settings.get('picture.background'));
  let panels: HTMLElement | undefined = $state();
  const w = watch(
    () => model,
    ['graph', 'mode', 'display', 'theme', 'settings', 'search', 'filters', 'selection', 'scope'],
  );
  const t = (text: string, vars?: Record<string, string | number>) => say(model, text, vars);

  const bar = $derived.by(() => {
    void w.v;
    const s = model.settings;
    const f = model.filters;
    const narrowed = model.rules.length + +(f.from !== null || f.to !== null) + +(f.threshold !== null);
    const pins = s.list().filter((x) => x.pinned).length;
    return {
      mode: model.mode,
      hulls: model.hulls,
      drawing: s.get('drawing.relations'),
      shows: new Set(s.get('panels.bar')),
      sections: s.get('panels.sections'),
      open: new Set<SectionId>(s.get('panels.open')),
      shown: s.get('panels.shown'),
      width: s.get('panels.width'),
      issues: model.issues.length,
      banner: model.issues.length > 0 && s.get('issues.banner'),
      css: viewCss(model),
      // What a closed section still says in its heading: how much it holds now.
      counts: {
        search: model.search.text.trim() ? model.search.results.length : null,
        scope: model.scope ? model.scope.units.length : null,
        highlights: model.selection.length || null,
        filters: narrowed || null,
        issues: model.issues.length || null,
        pinned: pins || null,
      } as Partial<Record<SectionId, number | null>>,
    };
  });

  // On a narrow page the side bar is a drawer over the canvas, which starts closed and is not kept (8.1);
  // on a wide one it shows as the setting "Side bar" says, which the Panels button changes.
  let narrow = $state(typeof innerWidth === 'number' && innerWidth <= 900);
  let drawer = $state(false);
  const panelsOpen = $derived(narrow ? drawer : bar.shown);
  function showPanels(on: boolean) {
    if (narrow) drawer = on;
    else if (bar.shown !== on) model.setSetting('panels.shown', on);
  }

  /** Opens or closes a section: the setting "Open sections" holds them, so that they start as they were left. */
  function setOpen(id: SectionId, on: boolean) {
    if (bar.open.has(id) === on) return;
    const next = new Set(bar.open);
    if (on) next.add(id);
    else next.delete(id);
    model.setSetting('panels.open', [...next]);
  }

  /** Opens a section in the side bar, when that shows, and brings it into view. */
  async function reveal(id: SectionId) {
    if (!panelsOpen || !bar.sections.includes(id)) return;
    setOpen(id, true);
    await tick();
    const section = panels?.querySelector(`[data-section="${id}"]`);
    if (!panels || !section) return;
    const [room, box] = [panels.getBoundingClientRect(), section.getBoundingClientRect()];
    // The top of a section that does not fit; else as little as shows it whole.
    const by =
      box.top < room.top || box.height > room.height
        ? box.top - room.top
        : box.bottom > room.bottom
          ? box.bottom - room.bottom
          : 0;
    if (!by) return;
    // The side bar moves as the picture does: smoothly, unless motion is off or the system asks for less.
    const motion = model.settings.get('motion.enabled');
    const still = motion === 'off' || (motion !== 'on' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    panels.scrollBy({ top: by, behavior: still ? 'instant' : 'smooth' });
  }

  /** The canvas's key for finding a unit: the search field in the bar, or else the Root field in the side bar. */
  async function findUnit() {
    const field = document.getElementById('gv-search');
    if (field) return field.focus();
    showPanels(true);
    setOpen('root', true);
    await tick();
    document.getElementById('gv-root')?.focus();
  }

  /** The bar's search field searches as a person types (6.19); Enter shows the first result. */
  function search(text: string) {
    searchText = text;
    model.setSearch(text);
    // The results show in the side bar's Search section, which opens for them.
    if (text.trim()) {
      showPanels(true);
      setOpen('search', true);
    }
  }
  function showFirst() {
    const first = model.search.results[0];
    if (!first) return;
    model.showNeighbourhood([first.key]);
    model.inspect({ kind: 'unit', key: first.key });
  }
  // A new graph empties the field, as the model's search starts again.
  $effect(() => {
    void w.v;
    if (!model.search.text) searchText = '';
  });

  // The props are base values of their settings (7.9); keys a new base no longer holds lose theirs.
  let based: string[] = [];
  $effect(() => {
    const values: Record<string, unknown> = { ...settings };
    if (theme !== undefined) values['theme.scheme'] = theme;
    if (motion !== undefined) values['motion.enabled'] = motion;
    for (const k of based) if (!(k in values)) values[k] = undefined;
    based = Object.keys(values).filter((k) => values[k] !== undefined);
    model.setBaseSettings(values);
  });

  $effect(() =>
    model.subscribe((a) => {
      if (a.has('root')) onroot?.({ root: model.root });
      if (a.has('inspect')) oninspect?.(model.inspected);
      if (a.has('selection')) onselect?.({ keys: [...model.selection] });
      // What was clicked shows in the inspector (6.11): the side bar opens it and brings it into view.
      if (a.has('inspect') && model.inspected && model.settings.get('panels.reveal')) void reveal('inspector');
    }),
  );

  // The stored settings come first, so that a graph opens with the settings of its load.
  let settingsReady: Promise<void> = Promise.resolve();
  onMount(() => {
    settingsReady = store.load().then(
      (file) => {
        if (file) model.applySettingsFile(file);
      },
      (e) => {
        saver.state = { kind: 'failed', reason: String(e?.message ?? e) };
      },
    );
    const stop = saver.start();
    const told = model.settings.subscribe(() => onsettings?.(model.settings.file()));
    // The page may grow or shrink across the width where the side bar becomes a drawer.
    const small = matchMedia('(max-width: 900px)');
    const resized = () => (narrow = small.matches);
    small.addEventListener('change', resized);
    resized();
    return () => {
      void saver.flush();
      stop();
      told();
      small.removeEventListener('change', resized);
      // The viewer made the model: it ends the model's worker and any layout it waits for.
      model.dispose();
    };
  });

  // A new source, or a new document, loads; the view settings and the camera come with it. Only the
  // newest load tells the host it is ready.
  let loaded: unknown = undefined;
  let loads = 0;
  $effect(() => {
    const [src, doc] = [source, graph];
    const from = src ?? doc;
    if (from === loaded || from === undefined) return;
    loaded = from;
    const mine = ++loads;
    void (async () => {
      await settingsReady;
      const v = $state.snapshot(view);
      const done = src ? await model.loadFrom(src, v) : await model.load($state.snapshot(doc), v);
      if (!done) return;
      await canvas?.whenSettled();
      if (mine !== loads) return;
      if (v?.camera) canvas?.setCamera(v.camera.position, v.camera.target);
      onready?.({
        units: model.graph?.units.length ?? 0,
        issues: model.issues.length,
        refused: model.refused !== null,
      });
    })();
  });

  const setMode = (m: Mode) => model.setMode(m);

  /** The scene as drawn now, for tests and hosts (5.5). */
  export function getScene() {
    return canvas?.getScene() ?? null;
  }

  /** The canvas's commands, for hosts and tests (8.15). */
  export function getCanvas(): CanvasHandle | undefined {
    return canvas;
  }

  async function savePicture() {
    const picture = await canvas?.picture(background);
    if (!picture) return;
    if (onpicture) return onpicture(picture);
    const url = URL.createObjectURL(picture);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graphview.${model.settings.get('picture.format').split('/')[1]}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------------------------------------------------------------- the side bar's width

  /** The side bar's width while its edge is dragged, in pixels; null otherwise. */
  let dragged: number | null = $state(null);
  const widthSetting = model.settings.all['panels.width'];
  const within = (px: number) => Math.min(widthSetting.max, Math.max(widthSetting.min, px));
  const setWidth = (px: number) => {
    if (within(px) !== bar.width) model.setSetting('panels.width', within(px));
  };

  function resizeStart(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const edge = e.currentTarget as HTMLElement;
    edge.setPointerCapture(e.pointerId);
    const right = panels?.getBoundingClientRect().right ?? e.clientX + bar.width;
    const move = (m: PointerEvent) => (dragged = within(right - m.clientX));
    const done = () => {
      edge.removeEventListener('pointermove', move);
      edge.removeEventListener('pointerup', done);
      edge.removeEventListener('pointercancel', done);
      // The setting moves in its own steps.
      if (dragged !== null) setWidth(Math.round(dragged / widthSetting.step) * widthSetting.step);
      dragged = null;
    };
    edge.addEventListener('pointermove', move);
    edge.addEventListener('pointerup', done);
    edge.addEventListener('pointercancel', done);
  }

  /** The arrows move the edge by one step; Home and End take it to its widest and narrowest. */
  function resizeKey(e: KeyboardEvent) {
    const to: Record<string, number> = {
      ArrowLeft: bar.width + widthSetting.step,
      ArrowRight: bar.width - widthSetting.step,
      Home: widthSetting.max,
      End: widthSetting.min,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    setWidth(to[e.key]);
  }

  const PANELS: Partial<Record<SectionId, { title: string; panel: Component<{ model: GraphModel }> }>> = {
    search: { title: 'Search', panel: SearchPanel },
    scope: { title: 'Scope', panel: ScopePanel },
    highlights: { title: 'Highlights', panel: HighlightsPanel },
    root: { title: 'Root and depth', panel: RootPanel },
    paths: { title: 'Paths', panel: PathsPanel },
    filters: { title: 'Filters', panel: FiltersPanel },
    types: { title: 'Types', panel: TypesPanel },
    issues: { title: 'Data issues', panel: IssuesPanel },
    pinned: { title: 'Pinned settings', panel: PinnedPanel },
  };
</script>

<div class="gv-view gv-ui" style="{bar.css}{dragged === null ? '' : ` --gv-panels-width: ${dragged}px;`}">
  <div class="gv-bar" role="toolbar" aria-label={t('View')}>
    {#if bar.shows.has('modes')}
      <span class="gv-modes gv-segmented" role="group" aria-label={t('2D or 3D')}>
        <button type="button" aria-pressed={bar.mode === '2d'} onclick={() => setMode('2d')}>2D</button>
        <button type="button" aria-pressed={bar.mode === '3d'} onclick={() => setMode('3d')}>3D</button>
      </span>
    {/if}
    {#if bar.shows.has('hulls')}
      <label class="gv-check"
        ><input
          type="checkbox"
          checked={bar.hulls}
          onchange={(e) => model.setHulls((e.target as HTMLInputElement).checked)}
        />
        {t('Hulls')}</label
      >
    {/if}
    {#if bar.shows.has('fit')}<button type="button" onclick={() => canvas?.fit()}>{t('Fit')}</button>{/if}
    {#if bar.shows.has('drawing')}
      <select
        aria-label={t('Drawing')}
        value={bar.drawing}
        onchange={(e) => model.setSetting('drawing.relations', (e.target as HTMLSelectElement).value)}
      >
        <option value="keypairs">{t('Keypairs')}</option>
        <option value="perspectives">{t('Perspectives')}</option>
      </select>
    {/if}
    {#if bar.shows.has('search')}
      <input
        id="gv-search"
        type="search"
        class="gv-search"
        aria-label={t('Search')}
        placeholder={t('Search…')}
        value={searchText}
        oninput={(e) => search(e.currentTarget.value)}
        onkeydown={(e) => {
          if (e.key === 'Enter') showFirst();
          // Escape empties the field, then gives the keys back to the canvas.
          else if (e.key === 'Escape') {
            e.preventDefault();
            if (searchText) search('');
            else (e.currentTarget.closest('.gv-view')?.querySelector('.gv-input') as HTMLElement | null)?.focus();
          }
        }}
      />
    {/if}
    {#if bar.shows.has('select')}
      <label class="gv-check"><input type="checkbox" bind:checked={boxSelect} /> {t('Box selection')}</label>
    {/if}
    <!-- Panels and Settings keep to the right edge, on whichever row they stand. -->
    <span class="gv-bar-end">
      {#if bar.shows.has('panels')}
        <button
          type="button"
          aria-expanded={panelsOpen}
          aria-controls="gv-view-panels"
          onclick={() => showPanels(!panelsOpen)}>{t('Panels')}</button
        >
      {/if}
      {#if bar.shows.has('settings')}
        <button type="button" aria-haspopup="dialog" onclick={() => (dialogOpen = true)}>{t('Settings')}</button>
      {/if}
    </span>
  </div>
  {#if bar.banner}
    <div class="gv-banner" role="status" data-testid="rules-banner">
      <p>{t('This graph breaks the graph rules; the data issues panel lists each breach.')}</p>
      <button
        type="button"
        onclick={() => {
          showPanels(true);
          void tick().then(() => reveal('issues'));
        }}
        >{t('Show {issues}', {
          issues: count(bar.issues, 'issue', 'issues', model.settings.get('words.locale')),
        })}</button
      >
    </div>
  {/if}
  <div class="gv-view-body">
    <div class="gv-view-canvas">
      <GraphCanvas bind:this={canvas} {model} {looks} {boxSelect} onfind={findUnit} />
    </div>
    {#if panelsOpen && !narrow}
      <!-- The side bar's edge: dragging it, or the arrow keys, changes the setting "Side bar width". -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="gv-resizer"
        class:gv-dragging={dragged !== null}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('Side bar width')}
        aria-controls="gv-view-panels"
        aria-valuenow={Math.round(dragged ?? bar.width)}
        aria-valuemin={widthSetting.min}
        aria-valuemax={widthSetting.max}
        tabindex="0"
        data-testid="panels-edge"
        onpointerdown={resizeStart}
        onkeydown={resizeKey}
      ></div>
    {/if}
    <aside id="gv-view-panels" class="gv-view-panels" aria-label={t('Panels')} hidden={!panelsOpen} bind:this={panels}>
      {#each bar.sections as id (id)}
        {@const s = PANELS[id]}
        {#if id === 'inspector'}
          <Section
            id="gv-inspect-s"
            title={t('Inspector')}
            testid="section-{id}"
            section={id}
            bind:open={() => bar.open.has(id), (on) => setOpen(id, on)}><InspectorPanel {model} {sections} /></Section
          >
        {:else if id === 'display'}
          <Section
            id="gv-display-s"
            title={t('Display')}
            testid="section-{id}"
            section={id}
            bind:open={() => bar.open.has(id), (on) => setOpen(id, on)}
          >
            <DisplayPanel {model} />
            <div class="gv-row gv-panel-body">
              <button type="button" onclick={savePicture}>{t('Save picture')}</button>
              <label class="gv-check"><input type="checkbox" bind:checked={background} /> {t('Background')}</label>
            </div>
          </Section>
        {:else if s}
          <Section
            id="gv-{id}-s"
            title={t(s.title)}
            testid="section-{id}"
            section={id}
            count={bar.counts[id] ?? null}
            bind:open={() => bar.open.has(id), (on) => setOpen(id, on)}><s.panel {model} /></Section
          >
        {/if}
      {/each}
    </aside>
  </div>
  <SettingsDialog {model} {saver} bind:open={dialogOpen} />
</div>

<style>
  .gv-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--gv-panel);
  }
  .gv-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--gv-hairline);
  }
  .gv-search {
    flex: 1 1 8em;
    min-width: 6em;
    max-width: 18em;
  }
  .gv-bar-end {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }
  .gv-bar label {
    white-space: nowrap;
  }
  .gv-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    padding: 6px 12px;
    background: var(--gv-panel);
    border-bottom: 2px dashed var(--gv-issue);
  }
  .gv-banner p {
    flex: 1 1 20em;
    margin: 0;
  }
  .gv-view-body {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
  }
  .gv-view-canvas {
    flex: 1 1 auto;
    min-width: 0;
  }
  .gv-view-panels {
    flex: 0 0 var(--gv-panels-width);
    overflow-y: auto;
    border-left: 1px solid var(--gv-hairline);
    background: var(--gv-panel);
    scrollbar-width: thin;
    scrollbar-color: var(--gv-ring) transparent;
  }
  .gv-view-panels[hidden] {
    display: none;
  }
  /* The side bar's edge lies over its border and takes no room of its own. */
  .gv-resizer {
    position: absolute;
    top: 0;
    bottom: 0;
    right: calc(var(--gv-panels-width) - 4px);
    z-index: 2;
    width: 7px;
    cursor: col-resize;
    touch-action: none;
  }
  .gv-resizer::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 1px;
    background: transparent;
    content: '';
  }
  .gv-resizer:hover::after,
  .gv-resizer.gv-dragging::after {
    left: 2px;
    width: 3px;
    background: var(--gv-ring);
  }
  .gv-resizer:focus-visible {
    outline: none;
  }
  .gv-resizer:focus-visible::after {
    left: 2px;
    width: 3px;
    background: var(--gv-focus);
  }
  @media (max-width: 900px) {
    .gv-view-panels {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 3;
      width: var(--gv-panels-width);
      max-width: 92%;
      box-shadow: 0 0 0 1px var(--gv-hairline);
    }
  }
</style>
