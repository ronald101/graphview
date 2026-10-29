<!-- Any of the items, each with its checkbox. -->
<script lang="ts">
  import type { SetSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import type { ControlProps } from './control.ts';

  let { setting, model, label, set }: ControlProps<SetSetting<string>> = $props();
</script>

<div class="gv-set" role="group" aria-label={label}>
  {#each setting.items as [item, words] (item)}
    <label class="gv-check"
      ><input
        type="checkbox"
        checked={setting.value.includes(item)}
        onchange={(e) =>
          set(
            (e.target as HTMLInputElement).checked ? [...setting.value, item] : setting.value.filter((i) => i !== item),
          )}
      />
      {say(model, words)}</label
    >
  {/each}
</div>
