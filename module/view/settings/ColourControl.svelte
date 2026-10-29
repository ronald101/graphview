<!-- A colour, or a token's name, whose colour then follows the theme. -->
<script lang="ts">
  import { isToken, TOKEN_NAMES, type ColourSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import { sixDigits, type ControlProps } from './control.ts';

  let { setting, model, id, label, set }: ControlProps<ColourSetting<string>> = $props();
  const token = $derived(isToken(setting.value) ? setting.value : '');
</script>

{#if setting.tokens}
  <select
    {id}
    value={token}
    onchange={(e) => {
      const v = (e.target as HTMLSelectElement).value;
      set(v || model.colour(setting.value));
    }}
  >
    <option value="">{say(model, 'Own colour')}</option>
    {#each TOKEN_NAMES as t (t)}<option value={t}>{t}</option>{/each}
  </select>
{/if}
<input
  id={setting.tokens ? undefined : id}
  type="color"
  aria-label={setting.tokens ? say(model, '{label}: own colour', { label }) : undefined}
  value={sixDigits(model.colour(setting.value))}
  oninput={(e) => set((e.target as HTMLInputElement).value.toUpperCase())}
/>
