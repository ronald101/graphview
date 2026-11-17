<!-- Highlights (specification 6.20 and 7.11): one row per group, with its switch, its name and its
     number of units; saving the selection as a group; clearing the selection; and the Direction switch. -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import { watch } from './watch.svelte.ts';
  import { say } from './words.ts';

  let { model }: { model: GraphModel } = $props();
  const t = (text: string, vars?: Record<string, string | number>) => say(model, text, vars);
  const w = watch(() => model, ['highlight', 'selection', 'search', 'scope']);
  let name = $state('');
  let note = $state('');

  const view = $derived.by(() => {
    void w.v;
    return {
      groups: model.highlights,
      selected: model.selection.length,
      direction: model.settings.get('highlight.direction'),
    };
  });

  function save() {
    note = model.saveHighlight(name)
      ? ''
      : view.selected
        ? t('Choose another name.')
        : t('Select units first: a group saves the selection.');
    if (!note) name = '';
  }
</script>

<div class="gv-panel-body" data-testid="highlights-panel">
  <ul class="gv-groups">
    {#each view.groups as g (g.name)}
      <li data-group={g.name}>
        <label
          ><input
            type="checkbox"
            checked={g.on}
            onchange={(e) => model.setHighlight(g.name, e.currentTarget.checked)}
          />
          {g.saved ? g.name : t(g.name)}</label
        >
        <span class="gv-num gv-count">{g.keys.length}</span>
        {#if g.saved}
          <button
            type="button"
            aria-label={t('Remove {name}', { name: g.name })}
            onclick={() => model.removeHighlight(g.name)}>×</button
          >
        {/if}
      </li>
    {/each}
  </ul>
  <form
    class="gv-row"
    onsubmit={(e) => {
      e.preventDefault();
      save();
    }}
  >
    <input type="text" class="gv-grow" aria-label={t('Name of the group')} placeholder={t('Name')} bind:value={name} />
    <button type="submit">{t('Save selection as…')}</button>
  </form>
  {#if note}<p class="gv-note" role="status">{note}</p>{/if}
  <div class="gv-row">
    <button type="button" disabled={!view.selected} onclick={() => model.select([], 'clear')}
      >{t('Clear selection')}</button
    >
    <label
      ><input
        type="checkbox"
        checked={view.direction}
        onchange={(e) => model.setSetting('highlight.direction', e.currentTarget.checked)}
      />
      {t('Direction')}</label
    >
  </div>
</div>
