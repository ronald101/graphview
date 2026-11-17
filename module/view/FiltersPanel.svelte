<!-- Filters (specification 7.5 and 6.7): a time window and a weight threshold, compounded, and the
     filter rules for kinds, superseded parts and relations per unit; the Types panel holds the rules of
     types. The sliders' steps, the threshold's decimals and the dates' format are settings of the group
     "Filters". -->
<script lang="ts">
  import type { FilterMode } from '../model/contracts.ts';
  import { modeOf } from '../model/filterRules.ts';
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
      rules: model.rules,
      kinds: [...new Set(model.kinds.of)],
      degree: model.rules.find((r) => r.field === 'degree') ?? null,
      most: Math.max(0, ...model.ids.map((_, i) => model.relationsOf(i))),
      superseded: model.superseded.some((x) => x === 1),
    };
  });

  const MODES: [FilterMode, string][] = [
    ['show', 'Shown'],
    ['fade', 'Faded'],
    ['hide', 'Hidden'],
  ];
  let degreeMode: FilterMode = $state('fade');
  const mode = (e: Event) => (e.target as HTMLSelectElement).value as FilterMode;

  /** Relations per unit: the range that stays shown; the whole range removes the rule. */
  function setDegree(lo: number, hi: number, m: FilterMode = degreeMode) {
    const all = lo <= 0 && hi >= view.most;
    model.setRule({ field: 'degree', value: null, range: [lo, hi], mode: all ? 'show' : m });
  }

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
  <h3>{t('Rules')}</h3>
  {#snippet modes(label: string, current: FilterMode, onpick: (m: FilterMode) => void)}
    <label class="gv-field"
      >{label}
      <select value={current} onchange={(e) => onpick(mode(e))}>
        {#each MODES as [m, words] (m)}<option value={m}>{t(words)}</option>{/each}
      </select>
    </label>
  {/snippet}
  {#each view.kinds as kind (kind)}
    {@render modes(say(model, 'Kind {kind}', { kind }), modeOf(view.rules, 'kind', kind), (m) =>
      model.setRule({ field: 'kind', value: kind, range: null, mode: m }),
    )}
  {/each}
  {#if view.superseded}
    {@render modes(t('Superseded'), modeOf(view.rules, 'superseded', null), (m) =>
      model.setRule({ field: 'superseded', value: null, range: null, mode: m }),
    )}
  {/if}
  {#if view.most > 0}
    {@const range = view.degree?.range ?? [0, view.most]}
    <RangeSlider
      label={t('Relations per unit')}
      testid="relations-per-unit"
      min={0}
      max={view.most}
      step={1}
      low={range[0]}
      high={range[1]}
      to={t('to')}
      lowest={t('lowest')}
      highest={t('highest')}
      onchange={(lo, hi) => setDegree(lo, hi)}
    />
    <label class="gv-field"
      >{t('Outside the range')}
      <select
        value={view.degree?.mode ?? degreeMode}
        onchange={(e) => {
          degreeMode = mode(e);
          if (view.degree) setDegree(range[0], range[1], degreeMode);
        }}
      >
        <option value="fade">{t('Faded')}</option>
        <option value="hide">{t('Hidden')}</option>
      </select>
    </label>
  {/if}
  <button type="button" onclick={() => model.clearRules()} disabled={!view.rules.length}>{t('Clear rules')}</button>
</div>
