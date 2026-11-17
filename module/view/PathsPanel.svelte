<!-- Paths (specification 7.3): from the root to a unit, the shortest paths and
     those one and two steps longer. One path is active; its table lists each step's keypairs. -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import UnitField from './UnitField.svelte';
  import { watch } from './watch.svelte.ts';
  import { say } from './words.ts';

  let { model }: { model: GraphModel } = $props();
  const t = (text: string, vars?: Record<string, string | number>) => say(model, text, vars);
  const ends = watch(() => model, ['root', 'paths']);
  const all = watch(() => model, ['root', 'paths', 'types', 'filters']);
  let text = $state('');
  let note = $state('');
  let busy = $state(false);

  // The field follows the target: a Shift-click on a unit shows its label here.
  $effect(() => {
    void ends.v;
    text = model.target === null ? '' : model.label(model.target);
    note = '';
  });

  const view = $derived.by(() => {
    void all.v;
    return {
      root: model.root,
      target: model.target,
      paths: model.paths,
      choice: model.choice,
      steps: model.pathSteps(),
    };
  });

  async function set() {
    if (model.root === null) {
      note = t('Set a root first: paths run from the root.');
      return;
    }
    const k = model.find(text);
    if (k === null) {
      note = text.trim()
        ? t('No unit has the label or key {text}.', { text: text.trim() })
        : t('Type a label or a key.');
      return;
    }
    note = '';
    busy = true;
    await model.setTarget(k);
    busy = false;
    model.inspect({ kind: 'unit', key: k });
  }

  function reset() {
    void model.setTarget(null);
    model.inspect(null);
    text = '';
    note = '';
  }

  async function reverse() {
    busy = true;
    await model.reversePath();
    busy = false;
  }

  function choose(value: string) {
    const [length, index] = value.split(':').map(Number);
    model.choosePath({ length, index });
  }

  const offset = (n: number) => (n === 0 ? t('Shortest') : t('Shortest + {n}', { n }));
  const weight = (w: number | null | undefined) =>
    w === null || w === undefined ? '' : String(+w.toFixed(model.settings.get('paths.weightDecimals')));
  const listed = $derived(model.settings.get('paths.menuListed'));
  const separator = $derived(model.settings.get('paths.separator'));
</script>

<div class="gv-panel-body" data-testid="paths-panel">
  <div class="gv-row">
    <span class="gv-grow" data-testid="path-ends"
      >{t('From')} <strong>{view.root === null ? t('no root') : model.label(view.root)}</strong>
      {t('to')}
      <strong>{view.target === null ? t('no unit') : model.label(view.target)}</strong></span
    >
    <button type="button" disabled={view.root === null || view.target === null || busy} onclick={reverse}
      >{t('Reverse path')}</button
    >
  </div>
  <UnitField id="gv-target" label={t('Paths to')} {model} bind:value={text} onset={set} onreset={reset} />
  {#if note}<p class="gv-note" role="status">{note}</p>{/if}
  {#if view.paths}
    {#if view.paths.reason === 'unreachable'}
      <p>{t('No path leads from the root to this unit.')}</p>
    {:else if view.paths.reason === 'same-unit'}
      <p>{t('The root and this unit are the same.')}</p>
    {:else}
      <label class="gv-field gv-block"
        >{t('Path')}
        <select
          data-testid="path-choice"
          value={view.choice ? `${view.choice.length}:${view.choice.index}` : ''}
          onchange={(e) => choose((e.target as HTMLSelectElement).value)}
        >
          {#each view.paths.lengths as l, n (l.length)}
            <optgroup
              label={t(
                l.exact
                  ? '{offset}: length {length}, {count} {paths}'
                  : '{offset}: length {length}, at least {count} {paths}',
                {
                  offset: offset(n),
                  length: l.length,
                  count: l.count,
                  paths: l.count === 1 ? t('path') : t('paths'),
                },
              )}
            >
              {#each l.paths.slice(0, listed) as p, i (i)}
                <option value="{l.length}:{i}">{offset(n)}: {p.map((k) => model.label(k)).join(separator)}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      {#if view.steps.length}
        <table class="gv-table" data-testid="path-table">
          <caption class="gv-note"
            >{t('Each row: a unit, the keypair to the next unit, and the keypair back from it.')}</caption
          >
          <thead>
            <tr>
              <th scope="col">{t('Unit label')}</th>
              <th scope="col">{t('To label')}</th>
              <th scope="col">{t('To weight')}</th>
              <th scope="col">{t('From label')}</th>
              <th scope="col">{t('From weight')}</th>
            </tr>
          </thead>
          <tbody>
            {#each view.steps as s, i (i)}
              <tr>
                <th scope="row">{s.label}</th>
                <td>{s.to?.type ?? ''}</td>
                <td class="gv-num">{weight(s.to?.weight)}</td>
                <td>{s.from?.type ?? ''}</td>
                <td class="gv-num">{weight(s.from?.weight)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  {:else}
    <p class="gv-note">{t('With a root, Shift-click a unit, or type it above, for the paths to it.')}</p>
  {/if}
</div>
