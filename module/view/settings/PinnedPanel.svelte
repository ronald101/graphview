<!-- Pinned settings (specification 7.10): the settings pinned in the Settings dialog, with the same controls. -->
<script lang="ts">
  import type { GraphModel } from '../../model/model.ts';
  import { watch } from '../watch.svelte.ts';
  import { say } from '../words.ts';
  import SettingRow from './SettingRow.svelte';

  let { model }: { model: GraphModel } = $props();
  const w = watch(() => model, []);
  const pinned = $derived.by(() => {
    void w.v;
    return model.settings.list().filter((s) => s.pinned);
  });
</script>

<div class="gv-panel-body" data-testid="pinned-panel">
  {#each pinned as s (s.key)}
    <SettingRow setting={s} {model} prefix="gv-pin" />
  {:else}
    <p class="gv-note">{say(model, 'Pin a setting in the Settings dialog to keep it here.')}</p>
  {/each}
</div>
