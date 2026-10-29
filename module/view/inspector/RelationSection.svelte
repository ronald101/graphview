<!-- The inspector's relation, one line: both of its keypairs side by side, or that one is missing. -->
<script lang="ts">
  import { say } from '../words.ts';
  import KeypairRecord from './KeypairRecord.svelte';
  import { keypairRecord } from './record.ts';
  import type { SectionProps, Shown } from './sections.ts';

  let { model, inspected, version }: SectionProps<Shown & { kind: 'relation' }> = $props();

  const records = $derived.by(() => {
    void version;
    return [keypairRecord(model, inspected.a, inspected.b), keypairRecord(model, inspected.b, inspected.a)];
  });
</script>

<h3 data-kind="relation">
  {say(model, 'Relation between {a} and {b}', { a: model.label(inspected.a), b: model.label(inspected.b) })}
</h3>
<div class="gv-pair">
  {#each records as rec, i (i)}
    <div class="gv-col" data-col={i}>
      <h4>{say(model, '{from} to {to}', { from: model.label(rec.from), to: model.label(rec.to) })}</h4>
      <KeypairRecord {rec} {model} />
    </div>
  {/each}
</div>
