<!-- Display (specification 6.8): factors for unit size, line width and opacity, applied in the shaders. -->
<script lang="ts">
  import type { Overrides } from '../model/contracts.ts';
  import type { GraphModel } from '../model/model.ts';
  import { watch } from './watch.svelte.ts';

  let { model }: { model: GraphModel } = $props();
  const w = watch(() => model, ['display']);
  const overrides = $derived.by(() => {
    void w.v;
    return { ...model.overrides };
  });
  const SLIDERS: [keyof Overrides, string, number][] = [
    ['size', 'Unit size', 3],
    ['width', 'Line width', 3],
    ['opacity', 'Opacity', 1],
  ];
</script>

<div class="gv-panel-body" data-testid="display-panel">
  {#each SLIDERS as [k, label, max] (k)}
    <label class="gv-field gv-block"
      >{label} <span class="gv-num">{overrides[k].toFixed(2)}</span>
      <input
        type="range"
        min="0.25"
        {max}
        step="0.05"
        value={overrides[k]}
        aria-label={label}
        oninput={(e) => model.setOverrides({ [k]: Number((e.target as HTMLInputElement).value) })}
      />
    </label>
  {/each}
</div>
