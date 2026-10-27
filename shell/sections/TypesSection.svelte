<!-- Types: the module's types panel, with the numbers of types that Generate adds. -->
<script lang="ts">
  import { Section, TypesPanel } from '../../module/index.ts';
  import { MAX_RELATION_TYPES, MAX_UNIT_TYPES } from '../lib/decorate.ts';
  import type { Shell } from '../lib/shell.svelte.ts';

  let { shell }: { shell: Shell } = $props();
</script>

<Section id="types" title="Types" testid="section-types" bind:open={shell.open.types}>
  <TypesPanel model={shell.model}>
    {#snippet unitExtra()}
      <label class="gv-field"
        >Unit types to add <input
          class="param"
          type="number"
          min="1"
          max={MAX_UNIT_TYPES}
          bind:value={shell.deco.unitTypes}
          disabled={!shell.addTypes}
        /></label
      >
    {/snippet}
    {#snippet keypairExtra()}
      <label class="gv-field"
        >Relation types to add <input
          class="param"
          type="number"
          min="1"
          max={MAX_RELATION_TYPES}
          bind:value={shell.deco.relationTypes}
          disabled={!shell.addTypes}
        /></label
      >
    {/snippet}
  </TypesPanel>
</Section>
