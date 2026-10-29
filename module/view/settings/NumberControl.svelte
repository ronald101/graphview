<script lang="ts">
  import type { NumberSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import type { ControlProps } from './control.ts';

  let { setting, model, id, label, set }: ControlProps<NumberSetting<string, number | null>> = $props();
  const finite = (n: number) => (Number.isFinite(n) ? n : undefined);
</script>

{#if setting.none !== null}
  <label class="gv-check"
    ><input
      type="checkbox"
      checked={setting.value === null}
      aria-label={say(model, '{label}: {none}', { label, none: setting.none })}
      onchange={(e) => set((e.target as HTMLInputElement).checked ? null : (finite(setting.min) ?? 0))}
    />
    {setting.none}</label
  >
{/if}
{#if setting.value !== null}
  <input
    {id}
    type="number"
    min={finite(setting.min)}
    max={finite(setting.max)}
    step={setting.step}
    value={setting.value}
    onchange={(e) => {
      const v = (e.target as HTMLInputElement).value;
      set(v.trim() === '' ? undefined : Number(v));
    }}
  />
  {#if setting.unit}<span>{setting.unit}</span>{/if}
{/if}
