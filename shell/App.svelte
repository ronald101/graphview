<!-- The run shell: one model, drawn in 2D or 3D. Controls on the left, panels on the right; both
     sidebars and every section open and close. Every change goes to the model first; the shell's
     state and actions live in lib/shell.svelte.ts, the left sections in sections/. -->
<script lang="ts">
  import { tick } from 'svelte';
  import {
    GraphModel,
    GraphCanvas,
    RootPanel,
    PathsPanel,
    InspectorPanel,
    FiltersPanel,
    DisplayPanel,
    IssuesPanel,
    Section,
    count,
    viewCss,
  } from '../module/index.ts';
  import { Shell } from './lib/shell.svelte.ts';
  import DataSection from './sections/DataSection.svelte';
  import GenerateSection from './sections/GenerateSection.svelte';
  import LookSection from './sections/LookSection.svelte';
  import TypesSection from './sections/TypesSection.svelte';

  const model = new GraphModel();
  const shell = new Shell(model);
  shell.connect();
  void shell.start();

  /** The canvas's / key: opens the panels and the Root field, and puts the cursor in it. */
  async function findUnit() {
    shell.rightOpen = true;
    shell.open.root = true;
    await tick();
    document.getElementById('gv-root')?.focus();
  }

  const info = $derived.by(() => {
    void shell.version;
    return {
      mode: model.mode,
      hulls: model.hulls,
      units: model.graph?.units.length ?? 0,
      relations: model.relationCount(),
      issues: model.issues.length,
      refused: model.refused !== null,
      name: shell.graphName(),
    };
  });
  const headline = $derived(
    info.refused
      ? 'Refused file'
      : `${info.name}, ${count(info.units, 'unit', 'units')}, ${count(info.relations, 'relation', 'relations')}, ${count(info.issues, 'issue', 'issues')}`,
  );

  // The panels the shell lays out take the viewer's text and panel settings from here.
  const css = $derived.by(() => {
    void shell.version;
    return viewCss(model);
  });

  let dragging = $state(false);

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) await shell.openText(await f.text(), f.name, null);
  }
</script>

<div
  class="shell"
  style={css}
  class:dragging
  role="presentation"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <header class="top">
    <button
      type="button"
      class="toggle"
      aria-expanded={shell.leftOpen}
      aria-controls="controls"
      onclick={() => (shell.leftOpen = !shell.leftOpen)}>Controls</button
    >
    <h1>graphview</h1>
    <div class="modes" role="group" aria-label="View">
      <button type="button" aria-pressed={info.mode === '2d'} onclick={() => model.setMode('2d')}>2D</button>
      <button type="button" aria-pressed={info.mode === '3d'} onclick={() => model.setMode('3d')}>3D</button>
    </div>
    <label class="check"
      ><input
        type="checkbox"
        checked={info.hulls}
        onchange={(e) => model.setHulls((e.target as HTMLInputElement).checked)}
      /> Hulls</label
    >
    <button type="button" onclick={() => shell.canvas?.fit()}>Fit</button>
    <p class="headline" data-testid="headline">{headline}</p>
    <button
      type="button"
      class="toggle"
      aria-expanded={shell.rightOpen}
      aria-controls="panels"
      onclick={() => (shell.rightOpen = !shell.rightOpen)}>Panels</button
    >
  </header>
  {#if info.issues > 0 && model.settings.get('issues.banner')}
    <p class="banner" role="status" data-testid="rules-banner">
      This graph breaks the graph rules; the data issues panel lists each breach.
    </p>
  {/if}
  <div class="body">
    <aside id="controls" class="side left gv-ui" aria-label="Controls" hidden={!shell.leftOpen}>
      <DataSection {shell} refused={info.refused} />
      <GenerateSection {shell} />
      <TypesSection {shell} />
      <LookSection {shell} />
    </aside>

    <main class="main">
      <GraphCanvas bind:this={shell.canvas} {model} theme={shell.resolved} motion={shell.motion} onfind={findUnit} />
    </main>

    <aside id="panels" class="side right gv-ui" aria-label="Panels" hidden={!shell.rightOpen}>
      <Section id="root" title="Root and depth" testid="section-root" bind:open={shell.open.root}>
        <RootPanel {model} />
      </Section>
      <Section id="paths" title="Paths" testid="section-paths" bind:open={shell.open.paths}>
        <PathsPanel {model} />
      </Section>
      <Section id="inspector" title="Inspector" testid="section-inspector" bind:open={shell.open.inspector}>
        <InspectorPanel {model} />
      </Section>
      <Section id="filters" title="Filters" testid="section-filters" bind:open={shell.open.filters}>
        <FiltersPanel {model} />
      </Section>
      <Section id="display" title="Display" testid="section-display" bind:open={shell.open.display}>
        <DisplayPanel {model} />
      </Section>
      <Section id="issues" title="Data issues" testid="section-issues" bind:open={shell.open.issues}>
        <IssuesPanel {model} />
      </Section>
    </aside>
  </div>
</div>
