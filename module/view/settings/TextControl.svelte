<script lang="ts">
  import type { TextSetting } from '../../settings/setting.svelte.ts';
  import type { ControlProps } from './control.ts';

  let { setting, id, set }: ControlProps<TextSetting<string>> = $props();
</script>

<input
  {id}
  type="text"
  value={setting.value}
  spellcheck="false"
  onchange={(e) => set((e.target as HTMLInputElement).value)}
/>
