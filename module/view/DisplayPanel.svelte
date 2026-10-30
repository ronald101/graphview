<!-- Display (specification 6.8): factors for unit size, line width and opacity, applied in the shaders.
     The sliders' ranges, step and decimals are settings of the group "Display". -->
<script lang="ts">
  import type { Overrides } from '../model/contracts.ts';
  import type { GraphModel } from '../model/model.ts';
  import { watch } from './watch.svelte.ts';
  import { say } from './words.ts';

  let { model }: { model: GraphModel } = $props();
  const w = watch(() => model, ['display']);
  const view = $derived.by(() => {
    void w.v;
    const s = model.settings;
    return {
      overrides: { ...model.overrides },
      ranges: {
        size: s.get('display.ranges.size'),
        width: s.get('display.ranges.width'),
        opacity: s.get('display.ranges.opacity'),
      },
      step: s.get('display.step'),
      decimals: s.get('display.decimals'),
    };
  });
  const SLIDERS: [keyof Overrides, string][] = [
    ['size', 'Unit size'],
    ['width', 'Line width'],
    ['opacity', 'Opacity'],
  ];
</script>

<div class="gv-panel-body" data-testid="display-panel">
  {#each SLIDERS as [k, words] (k)}
    {@const label = say(model, words)}
    <label class="gv-field gv-block"
      >{label} <span class="gv-num">{view.overrides[k].toFixed(view.decimals)}</span>
      <input
        type="range"
        min={view.ranges[k][0]}
        max={view.ranges[k][1]}
        step={view.step}
        value={view.overrides[k]}
        aria-label={label}
        oninput={(e) => model.setOverrides({ [k]: Number((e.target as HTMLInputElement).value) })}
      />
    </label>
  {/each}
</div>
