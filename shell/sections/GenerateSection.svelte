<!-- Generate: an example or a family, its parameters and seed, broken rules, and added types,
     weights and times; then Generate, and an explanation of what it makes. -->
<script lang="ts">
  import { RangeSlider, Section } from '../../module/index.ts';
  import { examples } from '../lib/examples.ts';
  import {
    explainBreaks,
    explainDecoration,
    explainExample,
    explainFamily,
    explainInterfaces,
  } from '../lib/explain.ts';
  import { FAMILIES, paramLabel } from '../lib/generate.ts';
  import type { Shell } from '../lib/shell.svelte.ts';

  let { shell }: { shell: Shell } = $props();

  const DAY = 86400000;
  const TIME_MIN = Date.UTC(2024, 0, 1);
  const TIME_MAX = Date.UTC(2028, 11, 31);
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const GROUPS = [
    ['valid', 'Examples'],
    ['broken', 'Examples with issues'],
    ['refused', 'Files the viewer refuses'],
  ];

  const explained = $derived.by(() => {
    const family = shell.chosenFamily;
    const e = shell.chosenExample ? examples.find((x) => x.id === shell.chosenExample) : null;
    const parts = family
      ? explainFamily(family, shell.params, shell.seed)
      : e
        ? explainExample(e.id, e.name, e.description, e.units)
        : [];
    const b = family ? explainBreaks(shell.breaks) : null;
    return [
      ...parts,
      explainDecoration(shell.addTypes, shell.deco),
      explainInterfaces(shell.interfaces),
      ...(b ? [b] : []),
    ];
  });
</script>

<Section id="generate" title="Generate" testid="section-generate" bind:open={shell.open.generate}>
  <label class="gv-field gv-block"
    >Graph
    <select bind:value={shell.choice} data-testid="graph-choice">
      {#each GROUPS as [g, label] (g)}
        <optgroup {label}>
          {#each examples.filter((e) => e.group === g) as e (e.id)}
            <option value="example:{e.id}">{e.name}</option>
          {/each}
        </optgroup>
      {/each}
      <optgroup label="Families">
        {#each FAMILIES as f (f.id)}<option value="family:{f.id}">{f.name}</option>{/each}
      </optgroup>
    </select>
  </label>
  {#if shell.chosenFamily}
    {@const family = shell.chosenFamily}
    {#each Object.keys(shell.params) as k (k)}
      <label class="gv-field"
        >{paramLabel(family, k)} <input class="param" type="text" bind:value={shell.params[k]} /></label
      >
    {/each}
  {/if}
  <label class="gv-field">Seed <input class="param" type="number" bind:value={shell.seed} /></label>
  <label class="gv-field"
    >Relations through interfaces (share) <input
      class="param"
      type="number"
      min="0"
      max="1"
      step="0.05"
      data-testid="interfaces"
      bind:value={shell.interfaces}
    /></label
  >
  {#if shell.chosenFamily}
    <details class="breaks">
      <summary>Break the rules</summary>
      <label class="gv-field"
        >Drop reverse keypairs (share) <input
          class="param"
          type="number"
          min="0"
          max="1"
          step="0.05"
          bind:value={shell.breaks.dropReverse}
        /></label
      >
      <label class="gv-field"
        >Unknown keys <input class="param" type="number" min="0" bind:value={shell.breaks.unknownKeys} /></label
      >
      <label class="gv-field"
        >Repeated rows <input class="param" type="number" min="0" bind:value={shell.breaks.repeatRows} /></label
      >
      <label class="gv-field"
        >Lone units <input class="param" type="number" min="0" bind:value={shell.breaks.loneUnits} /></label
      >
    </details>
  {/if}
  <label class="check"><input type="checkbox" bind:checked={shell.addTypes} /> Add types, weights and times</label>
  <RangeSlider
    label="Weights"
    testid="weights"
    min={0}
    max={1}
    step={0.01}
    low={shell.deco.weights[0]}
    high={shell.deco.weights[1]}
    disabled={!shell.addTypes}
    onchange={(lo, hi) => (shell.deco.weights = [lo, hi])}
  />
  <RangeSlider
    label="Times"
    testid="times"
    min={TIME_MIN}
    max={TIME_MAX}
    step={DAY}
    low={shell.deco.times[0]}
    high={shell.deco.times[1]}
    format={day}
    disabled={!shell.addTypes}
    onchange={(lo, hi) => (shell.deco.times = [lo, hi])}
  />
  <button type="button" class="primary" data-testid="generate" onclick={() => shell.generateNow()}>Generate</button>
  {#if shell.reached}<p class="gv-note" data-testid="reached">Reached: {shell.reached.join(', ')}</p>{/if}
  <details class="explain" data-testid="explanation">
    <summary>Explanation</summary>
    {#each explained as x (x.heading)}
      <h4>{x.heading}</h4>
      <p>{x.text}</p>
      {#if x.items}
        <dl class="gv-dl">
          {#each x.items as i (i.name)}
            <dt><span class="name">{i.name}</span> <span class="gv-num">{i.value}</span></dt>
            <dd>{i.text}</dd>
          {/each}
        </dl>
      {/if}
    {/each}
  </details>
</Section>
