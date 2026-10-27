<!-- The inspector's interface: the units it joins and its keypairs, one each way between it and
     each end, in two columns, one for each perspective, with its pair type when the profile names
     one; then what any unit shows. -->
<script lang="ts">
  import { count } from '../words.ts';
  import KeypairRecord from './KeypairRecord.svelte';
  import { keypairRecord } from './record.ts';
  import type { SectionProps, UnitShown } from './sections.ts';
  import UnitSection from './UnitSection.svelte';

  let { model, inspected, version }: SectionProps<UnitShown> = $props();

  const view = $derived.by(() => {
    void version;
    const i = inspected.key;
    const ends = model.endsOf(i) ?? [];
    const rec = (a: typeof i, b: typeof i) => keypairRecord(model, a, b);
    // Two ends: from the first through the interface to the second, and back. Otherwise each end in turn.
    const columns =
      ends.length === 2
        ? [
            [rec(ends[0], i), rec(i, ends[1])],
            [rec(ends[1], i), rec(i, ends[0])],
          ]
        : ends.map((e) => [rec(e, i), rec(i, e)]);
    return { ends, columns, perspectives: model.perspectivesOf(i) };
  });
</script>

<h3 data-kind="interface">
  {view.ends.length === 2
    ? `Interface between ${model.label(view.ends[0])} and ${model.label(view.ends[1])}`
    : `Interface joining ${count(view.ends.length, 'unit', 'units')}`}
</h3>
<UnitSection {model} {inspected} {version} />
<div class="gv-pair">
  {#each view.columns as column, c (c)}
    <div class="gv-col" data-col={c}>
      {#if view.perspectives?.[c]?.type}
        <p class="gv-note" data-field="perspective">{view.perspectives[c].type}</p>
      {/if}
      {#each column as rec, r (r)}
        <h4>{model.label(rec.from)} to {model.label(rec.to)}</h4>
        <KeypairRecord {rec} />
      {/each}
    </div>
  {/each}
</div>
