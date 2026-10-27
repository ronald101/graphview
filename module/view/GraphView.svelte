<!-- GraphView: the whole viewer in one component, for hosts that want no layout of their own: the
     canvas, a bar with 2D, 3D, hulls and fit, and the panels. It makes its own model. -->
<script lang="ts">
  import { cssVariables, type Key } from '../core/index.ts';
  import type { Inspected, Mode, ViewSettings } from '../model/contracts.ts';
  import { GraphModel } from '../model/model.ts';
  import type { Profile } from '../model/profile.ts';
  import type { Looks } from '../render/looks.ts';
  import type { UnitSections } from './inspector/sections.ts';
  import DisplayPanel from './DisplayPanel.svelte';
  import FiltersPanel from './FiltersPanel.svelte';
  import GraphCanvas from './GraphCanvas.svelte';
  import InspectorPanel from './InspectorPanel.svelte';
  import IssuesPanel from './IssuesPanel.svelte';
  import PathsPanel from './PathsPanel.svelte';
  import RootPanel from './RootPanel.svelte';
  import Section from './Section.svelte';
  import { watch } from './watch.svelte.ts';

  interface Props {
    graph: unknown;
    settings?: Partial<ViewSettings>;
    theme?: 'light' | 'dark' | 'system';
    motion?: 'on' | 'off' | 'system';
    onready?: (e: { units: number; issues: number; refused: boolean }) => void;
    onroot?: (e: { root: Key | null }) => void;
    oninspect?: (e: Inspected) => void;
    /** What fits the viewer to a family of graphs (5.7): the model's profile, the kinds' looks, the inspector's sections. */
    profile?: Profile;
    looks?: Looks;
    sections?: UnitSections;
  }
  let {
    graph,
    settings,
    theme = 'system',
    motion = 'system',
    onready,
    onroot,
    oninspect,
    profile,
    looks,
    sections,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  export const model = new GraphModel(undefined, profile);
  let canvas: ReturnType<typeof GraphCanvas> | undefined = $state();
  const w = watch(() => model, ['mode', 'display', 'theme']);
  const bar = $derived.by(() => {
    void w.v;
    return { mode: model.mode, hulls: model.hulls, theme: model.theme };
  });

  $effect(() =>
    model.subscribe((a) => {
      if (a.has('root')) onroot?.({ root: model.root });
      if (a.has('inspect')) oninspect?.(model.inspected);
    }),
  );

  let loaded: unknown = undefined;
  $effect(() => {
    const g = graph;
    if (g === loaded) return;
    loaded = g;
    void (async () => {
      if (!(await model.load($state.snapshot(g), settings))) return;
      await canvas?.whenSettled();
      onready?.({
        units: model.graph?.units.length ?? 0,
        issues: model.issues.length,
        refused: model.refused !== null,
      });
    })();
  });

  const setMode = (m: Mode) => model.setMode(m);
</script>

<div class="gv-view gv-ui" style={cssVariables(bar.theme)}>
  <div class="gv-bar" role="toolbar" aria-label="View">
    <span class="gv-modes" role="group" aria-label="2D or 3D">
      <button type="button" aria-pressed={bar.mode === '2d'} onclick={() => setMode('2d')}>2D</button>
      <button type="button" aria-pressed={bar.mode === '3d'} onclick={() => setMode('3d')}>3D</button>
    </span>
    <label
      ><input
        type="checkbox"
        checked={bar.hulls}
        onchange={(e) => model.setHulls((e.target as HTMLInputElement).checked)}
      />
      Hulls</label
    >
    <button type="button" onclick={() => canvas?.fit()}>Fit</button>
  </div>
  <div class="gv-view-body">
    <div class="gv-view-canvas">
      <GraphCanvas
        bind:this={canvas}
        {model}
        {theme}
        {motion}
        {looks}
        onfind={() => document.getElementById('gv-root')?.focus()}
      />
    </div>
    <aside class="gv-view-panels" aria-label="Panels">
      <Section id="gv-root-s" title="Root and depth"><RootPanel {model} /></Section>
      <Section id="gv-paths-s" title="Paths"><PathsPanel {model} /></Section>
      <Section id="gv-inspect-s" title="Inspector"><InspectorPanel {model} {sections} /></Section>
      <Section id="gv-filters-s" title="Filters"><FiltersPanel {model} /></Section>
      <Section id="gv-display-s" title="Display" open={false}><DisplayPanel {model} /></Section>
      <Section id="gv-issues-s" title="Data issues"><IssuesPanel {model} /></Section>
    </aside>
  </div>
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
    flex: 0 0 340px;
    overflow-y: auto;
    border-left: 1px solid var(--gv-hairline);
  }
</style>
