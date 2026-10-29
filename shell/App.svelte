<!-- The shell plays the host (specification 8.1): a top bar with the headline, the host tools on the
     left, and the viewer filling the rest with its own bar, canvas and side bar. The host prepares each
     graph and hands it to the viewer; its state and actions live in lib/shell.svelte.ts, its sections
     in sections/. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { BrowserSettingsStore, count, FallbackSettingsStore, GraphView, HttpSettingsStore } from '../module/index.ts';
  import { Shell } from './lib/shell.svelte.ts';
  import DataSection from './sections/DataSection.svelte';
  import GenerateSection from './sections/GenerateSection.svelte';

  const shell = new Shell();
  shell.connect();
  let view: ReturnType<typeof GraphView> | undefined = $state();
  // The settings file lives behind the shell's route, or in the browser where there is no server (8.17).
  const store = new FallbackSettingsStore(
    new HttpSettingsStore(resolve('/api/settings')),
    new BrowserSettingsStore('graphview-settings'),
  );

  onMount(() => {
    shell.attach(view!);
    void shell.start();
  });

  const headline = $derived.by(() => {
    const i = shell.info;
    return i.refused
      ? 'Refused file'
      : `${i.name}, ${count(i.units, 'unit', 'units')}, ${count(i.relations, 'relation', 'relations')}, ${count(i.issues, 'issue', 'issues')}`;
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
      aria-controls="host"
      onclick={() => (shell.leftOpen = !shell.leftOpen)}>Host</button
    >
    <h1>graphview</h1>
    <p class="headline" data-testid="headline">{headline}</p>
  </header>
  <div class="body">
    <aside id="host" class="side left gv-ui" aria-label="Host" hidden={!shell.leftOpen}>
      <DataSection {shell} />
      <GenerateSection {shell} />
    </aside>
    <main class="main">
      <GraphView
        bind:this={view}
        source={shell.graphSource ?? undefined}
        view={shell.view}
        settings={shell.base}
        settingsStore={store}
        theme={shell.theme}
        motion={shell.motion}
        onready={() => shell.ready()}
        onpicture={(png) => shell.savePicture(png)}
      />
    </main>
  </div>
</div>
