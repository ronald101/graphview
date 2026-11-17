<!-- One keypair in the inspector: its type and other attributes, or that it is missing. -->
<script lang="ts">
  import type { GraphModel } from '../../model/model.ts';
  import IssueIcon from '../IssueIcon.svelte';
  import { say } from '../words.ts';
  import { fmt, typeName, type KeypairRecord } from './record.ts';

  let { rec, model }: { rec: KeypairRecord; model: GraphModel } = $props();
</script>

{#if rec.exists}
  <dl class="gv-dl">
    <dt>{say(model, 'Type')}</dt>
    <dd data-field="type">{typeName(rec.type, model)}</dd>
    {#each rec.attrs as [k, v] (k)}<dt>{k}</dt>
      <dd data-field={k}>{fmt(v)}</dd>{/each}
  </dl>
{:else}
  <p class="gv-note"><IssueIcon /> {say(model, 'Missing')}</p>
{/if}
