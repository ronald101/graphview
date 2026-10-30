<script lang="ts">
  import { num, type RangeSetting } from '../../settings/setting.svelte.ts';
  import RangeSlider from '../RangeSlider.svelte';
  import { say } from '../words.ts';
  import type { ControlProps } from './control.ts';

  let { setting, model, label, set }: ControlProps<RangeSetting<string>> = $props();
</script>

<RangeSlider
  {label}
  min={setting.min}
  max={setting.max}
  step={setting.step}
  low={setting.value[0]}
  high={setting.value[1]}
  format={num}
  to={say(model, 'to')}
  lowest={say(model, 'lowest')}
  highest={say(model, 'highest')}
  onchange={(lo, hi) => set([lo, hi])}
/>
