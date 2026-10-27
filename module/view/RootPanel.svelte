<!-- Root and depth (specification 7.2): the root by name, and how many units sit
     on each plane behind it. The four planes always show; without a root they read "none". -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import UnitField from './UnitField.svelte';
  import { watch } from './watch.svelte.ts';

  let { model }: { model: GraphModel } = $props();
  const counts = watch(() => model, ['root']);
  let text = $state('');
  let note = $state('');

  // The field follows the root: a click on a unit shows its label here.
  $effect(() => {
    void counts.v;
    text = model.root === null ? '' : model.label(model.root);
    note = '';
  });

  const planes = $derived.by(() => {
    void counts.v;
    return { ...model.planeCounts(), root: model.root !== null };
  });

  async function set() {
    const k = model.find(text);
    if (k === null) {
      note = text.trim() ? `No unit has the label or key ${text.trim()}.` : 'Type a label or a key.';
      return;
    }
    note = '';
    await model.setRoot(k);
    model.inspect({ kind: 'unit', key: k });
  }

  function reset() {
    void model.setRoot(null);
    model.inspect(null);
    text = '';
    note = '';
  }

  const n = (v: number) => (planes.root ? v.toLocaleString('en') : 'none');
</script>

<div class="gv-panel-body" data-testid="root-panel">
  <UnitField id="gv-root" label="Root" bind:value={text} onset={set} onreset={reset} />
  {#if note}<p class="gv-note" role="status">{note}</p>{/if}
  <dl class="gv-dl gv-planes">
    <dt>First plane</dt>
    <dd class="gv-num" data-testid="plane-first">{n(planes.first)}</dd>
    <dt>Second plane</dt>
    <dd class="gv-num" data-testid="plane-second">{n(planes.second)}</dd>
    <dt>Third plane</dt>
    <dd class="gv-num" data-testid="plane-third">{n(planes.third)}</dd>
    <dt>Far back planes</dt>
    <dd class="gv-num" data-testid="plane-far">{n(planes.farBack)}</dd>
  </dl>
  <p>
    Deepest plane at degree: <span class="gv-num" data-testid="deepest"
      >{planes.deepest === null ? 'none' : planes.deepest}</span
    >
  </p>
</div>
