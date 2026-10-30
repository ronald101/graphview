<script lang="ts">
  import type { CheckboxSetting } from '../../settings/setting.svelte.ts';
  import type { ControlProps } from './control.ts';

  let { setting, id, set }: ControlProps<CheckboxSetting<string>> = $props();
</script>

<input {id} type="checkbox" checked={setting.value} onchange={(e) => set((e.target as HTMLInputElement).checked)} />
