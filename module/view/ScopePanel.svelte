<!-- Scope (specification 6.21 and 7.11): all units, or the neighbourhood of chosen units, with its
     steps; the selection grows or shrinks it; Lay out scope places it alone; Show all ends it. -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import { watch } from './watch.svelte.ts';
  import { count, say } from './words.ts';

  let { model }: { model: GraphModel } = $props();
  const t = (text: string, vars?: Record<string, string | number>) => say(model, text, vars);
  const w = watch(() => model, ['scope', 'selection']);

  const view = $derived.by(() => {
    void w.v;
    const s = model.scope;
    const locale = model.settings.get('words.locale');
    return {
      scope: s,
      names: s ? s.centres.map((k) => model.label(k)).join(', ') : '',
      size: s ? count(s.units.length, 'unit', 'units', locale) : '',
      selected: [...model.selection],
      hops: model.settings.get('scope.hops'),
    };
  });
</script>

<div class="gv-panel-body" data-testid="scope-panel">
  <p data-testid="scope-words">
    {#if view.scope}
      {view.names
        ? t('Neighbourhood of {names}, {units}', { names: view.names, units: view.size })
        : t('Chosen units, {units}', { units: view.size })}
    {:else}
      {t('All units')}
    {/if}
  </p>
  <label class="gv-field"
    >{t('Steps')}
    <input
      class="gv-num"
      type="number"
      min="1"
      max="3"
      value={view.hops}
      onchange={(e) => model.setSetting('scope.hops', Number((e.target as HTMLInputElement).value))}
    />
  </label>
  <div class="gv-row gv-wrap">
    <button type="button" disabled={!view.selected.length} onclick={() => model.showNeighbourhood(view.selected)}
      >{t('Show neighbourhood')}</button
    >
    <button type="button" disabled={!view.scope || !view.selected.length} onclick={() => model.expand(view.selected)}
      >{t('Expand selected')}</button
    >
    <button type="button" disabled={!view.selected.length} onclick={() => model.hide(view.selected)}
      >{t('Hide selected')}</button
    >
    <button type="button" disabled={!view.scope} onclick={() => model.layOutScope()}>{t('Lay out scope')}</button>
    <button type="button" disabled={!view.scope} onclick={() => model.showAll()}>{t('Show all')}</button>
  </div>
</div>
