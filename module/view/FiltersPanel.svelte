<!-- Filters (specification 7.5): a time window and a weight threshold, compounded. -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import RangeSlider from './RangeSlider.svelte';
  import { watch } from './watch.svelte.ts';

  let { model }: { model: GraphModel } = $props();
  const w = watch(() => model, ['filters']);
  const DAY = 86400000;

  const view = $derived.by(() => {
    void w.v;
    const f = model.filters;
    return {
      filters: { ...f },
      schema: model.schema,
      time: model.fieldRange(f.timeField, 'time'),
      weight: model.fieldRange(f.weightField, 'weight'),
    };
  });

  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
</script>

<div class="gv-panel-body" data-testid="filters-panel">
  {#if view.schema.timeFields.length}
    {#if view.schema.timeFields.length > 1}
      <label class="gv-field"
        >Time field
        <select
          value={view.filters.timeField ?? ''}
          onchange={(e) =>
            model.setFilters({ timeField: (e.target as HTMLSelectElement).value || null, from: null, to: null })}
        >
          {#each view.schema.timeFields as f (f)}<option value={f}>{f}</option>{/each}
        </select>
      </label>
    {/if}
    {#if view.time}
      {@const t = view.time}
      <RangeSlider
        label="Time window"
        testid="time-window"
        min={t.min}
        max={t.max}
        step={Math.max(1, Math.min(DAY, (t.max - t.min) / 200))}
        low={view.filters.from ?? t.min}
        high={view.filters.to ?? t.max}
        format={day}
        onchange={(lo, hi) => model.setFilters({ from: lo <= t.min ? null : lo, to: hi >= t.max ? null : hi })}
      />
    {/if}
  {:else}
    <p class="gv-note">No times in this graph.</p>
  {/if}
  {#if view.schema.weightFields.length}
    {#if view.schema.weightFields.length > 1}
      <label class="gv-field"
        >Weight field
        <select
          value={view.filters.weightField ?? ''}
          onchange={(e) =>
            model.setFilters({ weightField: (e.target as HTMLSelectElement).value || null, threshold: null })}
        >
          {#each view.schema.weightFields as f (f)}<option value={f}>{f}</option>{/each}
        </select>
      </label>
    {/if}
    {#if view.weight}
      {@const r = view.weight}
      <label class="gv-field gv-block"
        >{#if view.filters.threshold === null}Threshold <span class="gv-num">off</span>{:else}At least <span
            class="gv-num">{+view.filters.threshold.toFixed(3)}</span
          >{/if}
        <input
          type="range"
          min={r.min}
          max={r.max}
          step={(r.max - r.min) / 100 || 1}
          value={view.filters.threshold ?? r.min}
          aria-label="Weight threshold"
          oninput={(e) => model.setFilters({ threshold: Number((e.target as HTMLInputElement).value) })}
        />
      </label>
      <p class="gv-note">Lines below the threshold stay as thin grey lines without chevrons.</p>
    {/if}
  {:else}
    <p class="gv-note">No weights in this graph.</p>
  {/if}
  <button type="button" onclick={() => model.setFilters({ from: null, to: null, threshold: null })}
    >Clear filters</button
  >
</div>
