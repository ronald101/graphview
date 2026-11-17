<!-- A colour for each theme. -->
<script lang="ts">
  import type { ThemeColourSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import { sixDigits, type ControlProps } from './control.ts';

  let { setting, model, id, label, set }: ControlProps<ThemeColourSetting<string>> = $props();
</script>

{#each ['light', 'dark'] as const as theme (theme)}
  <input
    id={theme === 'light' ? id : undefined}
    type="color"
    aria-label={say(model, theme === 'light' ? '{label}, light' : '{label}, dark', { label })}
    value={sixDigits(setting.value[theme])}
    oninput={(e) => set({ ...setting.value, [theme]: (e.target as HTMLInputElement).value.toUpperCase() })}
  />
{/each}
