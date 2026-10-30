<!-- A list of colours for each theme: change one, add one at the end, or take the last away. -->
<script lang="ts">
  import type { PaletteSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import { sixDigits, type ControlProps } from './control.ts';

  let { setting, model, label, set }: ControlProps<PaletteSetting<string>> = $props();

  function change(theme: 'light' | 'dark', list: string[]) {
    set({ ...setting.value, [theme]: list });
  }
</script>

{#each ['light', 'dark'] as const as theme (theme)}
  {@const list = setting.value[theme]}
  {@const name = say(model, theme === 'light' ? '{label}, light' : '{label}, dark', { label })}
  <div class="gv-palette" role="group" aria-label={name}>
    {#each list as colour, i (i)}
      <input
        type="color"
        aria-label={say(model, '{name}, colour {n}', { name, n: i + 1 })}
        value={sixDigits(colour)}
        oninput={(e) =>
          change(
            theme,
            list.map((c, j) => (j === i ? (e.target as HTMLInputElement).value.toUpperCase() : c)),
          )}
      />
    {/each}
    <button
      type="button"
      aria-label={say(model, '{name}: add a colour', { name })}
      disabled={list.length >= setting.most}
      onclick={() => change(theme, [...list, list[list.length - 1]])}>+</button
    >
    <button
      type="button"
      aria-label={say(model, '{name}: take the last colour away', { name })}
      disabled={list.length <= 1}
      onclick={() => change(theme, list.slice(0, -1))}>−</button
    >
  </div>
{/each}
