<!-- Filters (specification 7.5): a time window and a weight threshold, compounded. The sliders' steps,
     the threshold's decimals and the dates' format are settings of the group "Filters". -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import RangeSlider from './RangeSlider.svelte';
  import { watch } from './watch.svelte.ts';
  import { say } from './words.ts';

  let { model }: { model: GraphModel } = $props();
  const w = watch(() => model, ['filters']);
  const t = (text: string) => say(model, text);

  const view = $derived.by(() => {
    void w.v;
    const f = model.filters;
    const s = model.settings;
    return {
      filters: { ...f },
      schema: model.schema,
      time: model.fieldRange(f.timeField, 'time'),
      weight: model.fieldRange(f.weightField, 'weight'),
      timeSteps: s.get('filters.timeSteps'),
      timeMaxStep: s.get('filters.timeMaxStep'),
      weightSteps: s.get('filters.weightSteps'),
      decimals: s.get('filters.thresholdDecimals'),
      format: s.get('filters.dateFormat'),
    };
  });

  /** A time as the setting "Dates" writes it, in universal time. */
  function day(ms: number): string {
    const iso = new Date(ms).toISOString();
    const [date, clock] = [iso.slice(0, 10), iso.slice(11, 16)];
    if (view.format === 'YYYY-MM-DD HH:mm') return `${date} ${clock}`;
    if (view.format === 'DD-MM-YYYY') return date.split('-').reverse().join('-');
    return date;
  }
</script>

<div class="gv-panel-body" data-testid="filters-panel">
  {#if view.schema.timeFields.length}
    {#if view.schema.timeFields.length > 1}
      <label class="gv-field"
        >{t('Time field')}
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
      {@const span = view.time}
      <RangeSlider
        label={t('Time window')}
        testid="time-window"
        min={span.min}
        max={span.max}
        step={Math.max(1, Math.min(view.timeMaxStep, (span.max - span.min) / view.timeSteps))}
        low={view.filters.from ?? span.min}
        high={view.filters.to ?? span.max}
        format={day}
        to={t('to')}
        lowest={t('lowest')}
        highest={t('highest')}
        onchange={(lo, hi) => model.setFilters({ from: lo <= span.min ? null : lo, to: hi >= span.max ? null : hi })}
      />
    {/if}
  {:else}
    <p class="gv-note">{t('No times in this graph.')}</p>
  {/if}
  {#if view.schema.weightFields.length}
    {#if view.schema.weightFields.length > 1}
      <label class="gv-field"
        >{t('Weight field')}
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
        >{#if view.filters.threshold === null}{t('Threshold')} <span class="gv-num">{t('off')}</span>{:else}{t(
            'At least',
          )} <span class="gv-num">{+view.filters.threshold.toFixed(view.decimals)}</span>{/if}
        <input
          type="range"
          min={r.min}
          max={r.max}
          step={(r.max - r.min) / view.weightSteps || 1}
          value={view.filters.threshold ?? r.min}
          aria-label={t('Weight threshold')}
          oninput={(e) => model.setFilters({ threshold: Number((e.target as HTMLInputElement).value) })}
        />
      </label>
      <p class="gv-note">{t('Lines below the threshold stay as thin grey lines without chevrons.')}</p>
    {/if}
  {:else}
    <p class="gv-note">{t('No weights in this graph.')}</p>
  {/if}
  <button type="button" onclick={() => model.setFilters({ from: null, to: null, threshold: null })}
    >{t('Clear filters')}</button
  >
</div>
