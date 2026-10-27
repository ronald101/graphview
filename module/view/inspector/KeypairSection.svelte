<!-- The inspector's keypair, one chevron: its type and other attributes, and whether it has a reverse. -->
<script lang="ts">
  import { fmt, keypairRecord, typeName } from './record.ts';
  import type { SectionProps, Shown } from './sections.ts';

  let { model, inspected, version }: SectionProps<Shown & { kind: 'keypair' }> = $props();

  const view = $derived.by(() => {
    void version;
    return {
      ...keypairRecord(model, inspected.from, inspected.to),
      reverse: keypairRecord(model, inspected.to, inspected.from),
    };
  });
</script>

<h3 data-kind="keypair">Keypair from {model.label(view.from)} to {model.label(view.to)}</h3>
<dl class="gv-dl" data-testid="record-attrs">
  <dt>Type</dt>
  <dd data-field="type">{typeName(view.type)}</dd>
  {#each view.attrs as [k, v] (k)}<dt>{k}</dt>
    <dd data-field={k}>{fmt(v)}</dd>{/each}
</dl>
<p class="gv-note">
  {view.reverse.exists ? 'Its reverse is the other chevron of this line.' : 'This keypair has no reverse.'}
</p>
