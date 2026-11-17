<script lang="ts">
  import { num, type SliderSetting } from '../../settings/setting.svelte.ts';
  import type { ControlProps } from './control.ts';

  let { setting, id, set }: ControlProps<SliderSetting<string>> = $props();
</script>

<input
  {id}
  type="range"
  min={setting.min}
  max={setting.max}
  step={setting.step}
  value={setting.value}
  oninput={(e) => set(Number((e.target as HTMLInputElement).value))}
/>
<span class="gv-num">{num(setting.value)}{setting.unit ? ` ${setting.unit}` : ''}</span>
