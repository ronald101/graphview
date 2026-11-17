<!-- Root and depth (specification 7.2): the root by name, and how many units sit
     on each plane behind it. The four planes always show; without a root they read "none". -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import UnitField from './UnitField.svelte';
  import { watch } from './watch.svelte.ts';
  import { say } from './words.ts';

  let { model }: { model: GraphModel } = $props();
  const t = (text: string, vars?: Record<string, string | number>) => say(model, text, vars);
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
      note = text.trim()
        ? t('No unit has the label or key {text}.', { text: text.trim() })
        : t('Type a label or a key.');
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

  const n = (v: number) => (planes.root ? v.toLocaleString(model.settings.get('words.locale')) : t('none'));
</script>

<div class="gv-panel-body" data-testid="root-panel">
  <UnitField id="gv-root" label={t('Root')} {model} bind:value={text} onset={set} onreset={reset} />
  {#if note}<p class="gv-note" role="status">{note}</p>{/if}
  <dl class="gv-dl gv-planes">
    <dt>{t('First plane')}</dt>
    <dd class="gv-num" data-testid="plane-first">{n(planes.first)}</dd>
    <dt>{t('Second plane')}</dt>
    <dd class="gv-num" data-testid="plane-second">{n(planes.second)}</dd>
    <dt>{t('Third plane')}</dt>
    <dd class="gv-num" data-testid="plane-third">{n(planes.third)}</dd>
    <dt>{t('Far back planes')}</dt>
    <dd class="gv-num" data-testid="plane-far">{n(planes.farBack)}</dd>
  </dl>
  <p>
    {t('Deepest plane at degree:')}
    <span class="gv-num" data-testid="deepest">{planes.deepest === null ? t('none') : planes.deepest}</span>
  </p>
</div>
