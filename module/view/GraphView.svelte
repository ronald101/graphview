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
  import { SECTIONS, type SectionId } from '../settings/groups/panels.ts';
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
  import { say } from './words.ts';

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
  // The side bar starts closed on a narrow page, and opens as a drawer over the canvas (8.1).
  let panelsOpen = $state(typeof innerWidth !== 'number' || innerWidth > 900);
  let background = $state(model.settings.get('picture.background'));
  const w = watch(() => model, ['graph', 'mode', 'display', 'theme', 'settings', 'search']);
  const t = (text: string) => say(model, text);

  const bar = $derived.by(() => {
    void w.v;
    return {
      mode: model.mode,
      hulls: model.hulls,
      drawing: model.settings.get('drawing.relations'),
      shows: new Set(model.settings.get('panels.bar')),
      sections: model.settings.get('panels.sections'),
      banner: model.issues.length > 0 && model.settings.get('issues.banner'),
      css: viewCss(model),
    };
  });
  // Which sections are open; the setting says which start open, read once.
  const openAtStart = new Set<string>(model.settings.get('panels.open'));
  const open: Record<SectionId, boolean> = $state(
    Object.fromEntries(SECTIONS.map(([id]) => [id, openAtStart.has(id)])) as Record<SectionId, boolean>,
  );

  /** The canvas's key for finding a unit: the search field in the bar, or else the Root field in the side bar. */
  async function findUnit() {
    const field = document.getElementById('gv-search');
    if (field) return field.focus();
    panelsOpen = true;
    open.root = true;
    await tick();
    document.getElementById('gv-root')?.focus();
  }

  /** The bar's search field searches as a person types (6.19); Enter shows the first result. */
  function search(text: string) {
    searchText = text;
    model.setSearch(text);
    if (text.trim()) open.search = true;
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
    return () => {
      void saver.flush();
      stop();
      told();
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

<div class="gv-view gv-ui" style={bar.css}>
  <div class="gv-bar" role="toolbar" aria-label={t('View')}>
    {#if bar.shows.has('modes')}
      <span class="gv-modes" role="group" aria-label={t('2D or 3D')}>
        <button type="button" aria-pressed={bar.mode === '2d'} onclick={() => setMode('2d')}>2D</button>
        <button type="button" aria-pressed={bar.mode === '3d'} onclick={() => setMode('3d')}>3D</button>
      </span>
    {/if}
    {#if bar.shows.has('hulls')}
      <label
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
        onkeydown={(e) => e.key === 'Enter' && showFirst()}
      />
    {/if}
    {#if bar.shows.has('select')}
      <label><input type="checkbox" bind:checked={boxSelect} /> {t('Box selection')}</label>
    {/if}
    <span class="gv-grow"></span>
    {#if bar.shows.has('panels')}
      <button
        type="button"
        aria-expanded={panelsOpen}
        aria-controls="gv-view-panels"
        onclick={() => (panelsOpen = !panelsOpen)}>{t('Panels')}</button
      >
    {/if}
    {#if bar.shows.has('settings')}
      <button type="button" aria-haspopup="dialog" onclick={() => (dialogOpen = true)}>{t('Settings')}</button>
    {/if}
  </div>
  {#if bar.banner}
    <p class="gv-banner" role="status" data-testid="rules-banner">
      {t('This graph breaks the graph rules; the data issues panel lists each breach.')}
    </p>
  {/if}
  <div class="gv-view-body">
    <div class="gv-view-canvas">
      <GraphCanvas bind:this={canvas} {model} {looks} {boxSelect} onfind={findUnit} />
    </div>
    <aside id="gv-view-panels" class="gv-view-panels" aria-label={t('Panels')} hidden={!panelsOpen}>
      {#each bar.sections as id (id)}
        {@const s = PANELS[id]}
        {#if id === 'inspector'}
          <Section id="gv-inspect-s" title={t('Inspector')} testid="section-{id}" bind:open={open[id]}
            ><InspectorPanel {model} {sections} /></Section
          >
        {:else if id === 'display'}
          <Section id="gv-display-s" title={t('Display')} testid="section-{id}" bind:open={open[id]}>
            <DisplayPanel {model} />
            <div class="gv-row gv-panel-body">
              <button type="button" onclick={savePicture}>{t('Save picture')}</button>
              <label><input type="checkbox" bind:checked={background} /> {t('Background')}</label>
            </div>
          </Section>
        {:else if s}
          <Section id="gv-{id}-s" title={t(s.title)} testid="section-{id}" bind:open={open[id]}
            ><s.panel {model} /></Section
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
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--gv-hairline);
  }
  .gv-search {
    min-width: 0;
    width: 14em;
  }
  .gv-banner {
    margin: 0;
    padding: 6px 10px;
    background: var(--gv-panel);
    border-bottom: 2px dashed var(--gv-issue);
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
  }
  .gv-view-panels[hidden] {
    display: none;
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
