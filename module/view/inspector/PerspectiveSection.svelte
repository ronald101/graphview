<!-- The inspector's perspective, a chevron of the perspective drawing (specification 6.18): its pair
     type, its two ends, the interface it runs through, and its two keypairs, from the unit it starts at
     into the interface and out to the other end. -->
<script lang="ts">
  import { say } from '../words.ts';
  import KeypairRecord from './KeypairRecord.svelte';
  import { keypairRecord, typeName } from './record.ts';
  import type { SectionProps, Shown } from './sections.ts';

  let { model, inspected, version }: SectionProps<Shown & { kind: 'perspective' }> = $props();

  const view = $derived.by(() => {
    void version;
    const { iface, from, to } = inspected;
    const id = model.perspectiveType(iface, from, to);
    const type = id === null ? null : (model.types.keypair.find((t) => t.id === id) ?? { id, label: id });
    return { type, records: [keypairRecord(model, from, iface), keypairRecord(model, iface, to)] };
  });
</script>

<h3 data-kind="perspective">
  {say(model, 'Perspective from {from} to {to}', {
    from: model.label(inspected.from),
    to: model.label(inspected.to),
  })}
</h3>
<dl class="gv-dl" data-testid="record-attrs">
  <dt>{say(model, 'Pair type')}</dt>
  <dd data-field="perspective">{typeName(view.type, model)}</dd>
  <dt>{say(model, 'Through')}</dt>
  <dd data-field="interface">{model.label(inspected.iface)}</dd>
</dl>
<div class="gv-pair">
  {#each view.records as rec, i (i)}
    <div class="gv-col" data-col={i}>
      <h4>{say(model, '{from} to {to}', { from: model.label(rec.from), to: model.label(rec.to) })}</h4>
      <KeypairRecord {rec} {model} />
    </div>
  {/each}
</div>
