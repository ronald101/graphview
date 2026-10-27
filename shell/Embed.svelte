<!-- The #embed page: the module's GraphView alone on a page, as the simplest host embeds it
     (specification 7.9). The browser tests drive GraphView through window.embed. -->
<script lang="ts">
  import { GraphView } from '../module/index.ts';
  import { exampleDoc } from './lib/examples.ts';
  import { SAMPLE_ID } from './lib/sample.ts';

  let graph: unknown = $state(null);
  let view: ReturnType<typeof GraphView> | undefined = $state();
  /** What GraphView told its host, in order. */
  const events: string[] = $state([]);
  void exampleDoc(SAMPLE_ID).then((doc) => (graph = doc));
  (window as unknown as { embed: object }).embed = { model: () => view?.model, events: () => [...events] };
</script>

<div class="embed">
  {#if graph}
    <GraphView
      bind:this={view}
      {graph}
      theme="light"
      motion="off"
      onready={(e) => events.push(`ready: ${e.units} units, ${e.issues} issues`)}
      onroot={(e) => events.push(`root: ${e.root}`)}
      oninspect={(e) => events.push(`inspect: ${e?.kind ?? 'nothing'}`)}
    />
  {/if}
</div>

<style>
  .embed {
    height: 100vh;
  }
</style>
