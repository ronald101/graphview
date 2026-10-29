<!-- GraphView (specification 7.9): the whole viewer in one component, for hosts that want no layout of
     their own: a bar, the canvas, the side bar and the Settings dialog. It makes its own model and keeps
     its settings in a store; a host gives it a graph. -->
<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import type { Key } from '../core/index.ts';
  import type { Inspected, Mode, ViewSettings } from '../model/contracts.ts';
  import { GraphModel } from '../model/model.ts';
  import type { Profile } from '../model/profile.ts';
  import type { Looks } from '../render/looks.ts';
  import type { SettingsFile } from '../settings/file.ts';
  import type { SectionId } from '../settings/groups/panels.ts';
  import { SettingsSaver } from '../settings/saver.svelte.ts';
  import { BrowserSettingsStore, type SettingsStore } from '../settings/stores.ts';
  import { viewCss } from './css.ts';
  import DisplayPanel from './DisplayPanel.svelte';
  import FiltersPanel from './FiltersPanel.svelte';
  import GraphCanvas from './GraphCanvas.svelte';
  import InspectorPanel from './InspectorPanel.svelte';
  import type { UnitSections } from './inspector/sections.ts';
  import IssuesPanel from './IssuesPanel.svelte';
  import PathsPanel from './PathsPanel.svelte';
  import RootPanel from './RootPanel.svelte';
  import Section from './Section.svelte';
  import PinnedPanel from './settings/PinnedPanel.svelte';
  import SettingsDialog from './settings/SettingsDialog.svelte';
  import TypesPanel from './TypesPanel.svelte';
  import { watch } from './watch.svelte.ts';
  import { say } from './words.ts';

  interface Props {
    graph: unknown;
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
  let panelsOpen = $state(true);
  let background = $state(model.settings.get('picture.background'));
  const w = watch(() => model, ['mode', 'display', 'theme']);
  const t = (text: string) => say(model, text);

  const bar = $derived.by(() => {
    void w.v;
    return {
      mode: model.mode,
      hulls: model.hulls,
      shows: new Set(model.settings.get('panels.bar')),
      sections: model.settings.get('panels.sections'),
      css: viewCss(model),
    };
  });
  // The sections that start open, read once.
  const openAtStart = new Set(model.settings.get('panels.open'));

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

  let loaded: unknown = undefined;
  $effect(() => {
    const g = graph;
    if (g === loaded) return;
    loaded = g;
    void (async () => {
      await settingsReady;
      if (!(await model.load($state.snapshot(g), $state.snapshot(view)))) return;
      await canvas?.whenSettled();
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

  const SECTIONS: Partial<Record<SectionId, { title: string; panel: Component<{ model: GraphModel }> }>> = {
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
  <div class="gv-view-body">
    <div class="gv-view-canvas">
      <GraphCanvas bind:this={canvas} {model} {looks} onfind={() => document.getElementById('gv-root')?.focus()} />
    </div>
    <aside id="gv-view-panels" class="gv-view-panels" aria-label={t('Panels')} hidden={!panelsOpen}>
      {#each bar.sections as id (id)}
        {@const s = SECTIONS[id]}
        {#if id === 'inspector'}
          <Section id="gv-inspect-s" title={t('Inspector')} open={openAtStart.has(id)}
            ><InspectorPanel {model} {sections} /></Section
          >
        {:else if id === 'display'}
          <Section id="gv-display-s" title={t('Display')} open={openAtStart.has(id)}>
            <DisplayPanel {model} />
            <div class="gv-row gv-panel-body">
              <button type="button" onclick={savePicture}>{t('Save picture')}</button>
              <label><input type="checkbox" bind:checked={background} /> {t('Background')}</label>
            </div>
          </Section>
        {:else if s}
          <Section id="gv-{id}-s" title={t(s.title)} open={openAtStart.has(id)}><s.panel {model} /></Section>
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
  .gv-view-body {
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
  }
</style>
