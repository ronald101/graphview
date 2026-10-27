<!-- Paths (specification 7.3): from the root to a unit, the shortest paths and
     those one and two steps longer. One path is active; its table lists each step's keypairs. -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import UnitField from './UnitField.svelte';
  import { watch } from './watch.svelte.ts';

  let { model }: { model: GraphModel } = $props();
  const ends = watch(() => model, ['root', 'paths']);
  const all = watch(() => model, ['root', 'paths', 'types', 'filters']);
  let text = $state('');
  let note = $state('');
  let busy = $state(false);

  /** Paths listed per length in the menu; the rest are counted. */
  const LISTED = 50;

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
      note = 'Set a root first: paths run from the root.';
      return;
    }
    const k = model.find(text);
    if (k === null) {
      note = text.trim() ? `No unit has the label or key ${text.trim()}.` : 'Type a label or a key.';
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

  const offset = (n: number) => (n === 0 ? 'Shortest' : `Shortest + ${n}`);
  const weight = (w: number | null | undefined) => (w === null || w === undefined ? '' : String(+w.toFixed(3)));
</script>

<div class="gv-panel-body" data-testid="paths-panel">
  <div class="gv-row">
    <span class="gv-grow" data-testid="path-ends"
      >From <strong>{view.root === null ? 'no root' : model.label(view.root)}</strong> to
      <strong>{view.target === null ? 'no unit' : model.label(view.target)}</strong></span
    >
    <button type="button" disabled={view.root === null || view.target === null || busy} onclick={reverse}
      >Reverse path</button
    >
  </div>
  <UnitField id="gv-target" label="Paths to" bind:value={text} onset={set} onreset={reset} />
  {#if note}<p class="gv-note" role="status">{note}</p>{/if}
  {#if view.paths}
    {#if view.paths.reason === 'unreachable'}
      <p>No path leads from the root to this unit.</p>
    {:else if view.paths.reason === 'same-unit'}
      <p>The root and this unit are the same.</p>
    {:else}
      <label class="gv-field gv-block"
        >Path
        <select
          data-testid="path-choice"
          value={view.choice ? `${view.choice.length}:${view.choice.index}` : ''}
          onchange={(e) => choose((e.target as HTMLSelectElement).value)}
        >
          {#each view.paths.lengths as l, n (l.length)}
            <optgroup
              label="{offset(n)}: length {l.length}, {l.exact ? l.count : `at least ${l.count}`} {l.count === 1
                ? 'path'
                : 'paths'}"
            >
              {#each l.paths.slice(0, LISTED) as p, i (i)}
                <option value="{l.length}:{i}">{offset(n)}: {p.map((k) => model.label(k)).join(' → ')}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      {#if view.steps.length}
        <table class="gv-table" data-testid="path-table">
          <caption class="gv-note"
            >Each row: a unit, the keypair to the next unit, and the keypair back from it.</caption
          >
          <thead>
            <tr>
              <th scope="col">Unit label</th>
              <th scope="col">To label</th>
              <th scope="col">To weight</th>
              <th scope="col">From label</th>
              <th scope="col">From weight</th>
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
    <p class="gv-note">With a root, Shift-click a unit, or type it above, for the paths to it.</p>
  {/if}
</div>
