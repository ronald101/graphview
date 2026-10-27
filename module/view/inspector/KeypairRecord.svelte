<!-- One keypair in the inspector: its type and other attributes, or that it is missing. -->
<script lang="ts">
  import IssueIcon from '../IssueIcon.svelte';
  import { fmt, typeName, type KeypairRecord } from './record.ts';

  let { rec }: { rec: KeypairRecord } = $props();
</script>

{#if rec.exists}
  <dl class="gv-dl">
    <dt>Type</dt>
    <dd data-field="type">{typeName(rec.type)}</dd>
    {#each rec.attrs as [k, v] (k)}<dt>{k}</dt>
      <dd data-field={k}>{fmt(v)}</dd>{/each}
  </dl>
{:else}
  <p class="gv-note"><IssueIcon /> Missing</p>
{/if}
