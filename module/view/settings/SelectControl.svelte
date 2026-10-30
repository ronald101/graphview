<script lang="ts">
  import type { SelectSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import type { ControlProps } from './control.ts';

  let { setting, model, id, set }: ControlProps<SelectSetting<string>> = $props();
</script>

<select {id} value={setting.value} onchange={(e) => set((e.target as HTMLSelectElement).value)}>
  {#each setting.options as [value, words] (value)}<option {value}>{say(model, words)}</option>{/each}
</select>
