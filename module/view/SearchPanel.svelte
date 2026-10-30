<!-- Search (specification 6.19 and 7.11): the results of the bar's search field, by rank, each with
     its class or type, where the text matched, and what can be done with it. -->
<script lang="ts">
  import type { Key } from '../core/index.ts';
  import type { GraphModel } from '../model/model.ts';
  import { watch } from './watch.svelte.ts';
  import { say } from './words.ts';

  let { model }: { model: GraphModel } = $props();
  const t = (text: string, vars?: Record<string, string | number>) => say(model, text, vars);
  const w = watch(() => model, ['search', 'root', 'highlight']);

  const view = $derived.by(() => {
    void w.v;
    const { text, results } = model.search;
    const found = new Set(model.highlights.find((g) => g.name === 'Search results')?.keys ?? []);
    return {
      text: text.trim(),
      rootless: model.root === null,
      rows: results.map((r) => ({
        ...r,
        label: model.label(r.key),
        type: model.unitType(r.key)?.label ?? null,
        highlighted: found.has(r.key),
      })),
    };
  });

  const show = (k: Key) => {
    model.showNeighbourhood([k]);
    model.inspect({ kind: 'unit', key: k });
  };
</script>

<div class="gv-panel-body" data-testid="search-panel">
  {#if !view.text}
    <p class="gv-note">{t('Type in the search field above the canvas.')}</p>
  {:else if !view.rows.length}
    <p class="gv-note">{t('No result for "{text}"', { text: view.text })}</p>
  {:else}
    <ol class="gv-results">
      {#each view.rows as r (r.key)}
        <li data-key={JSON.stringify(r.key)}>
          <p class="gv-result-head">
            <strong>{r.label}</strong>
            <span class="gv-note"
              >{[r.type, t('matched in {where}', { where: t(r.where) })].filter(Boolean).join(' · ')}</span
            >
          </p>
          <div class="gv-row gv-actions">
            <button type="button" onclick={() => show(r.key)}>{t('Show')}</button>
            <button type="button" onclick={() => model.setRoot(r.key)}>{t('Root')}</button>
            <button type="button" disabled={view.rootless} onclick={() => model.setTarget(r.key)}
              >{t('Paths to')}</button
            >
            <button type="button" aria-pressed={r.highlighted} onclick={() => model.highlightResult(r.key)}
              >{t('Highlight')}</button
            >
            <button type="button" onclick={() => model.inspect({ kind: 'unit', key: r.key })}>{t('Inspect')}</button>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>
