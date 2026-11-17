<!-- Keys, each bound to an action: change a key's action, take a key away, or bind another. -->
<script lang="ts">
  import type { KeysSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import type { ControlProps } from './control.ts';

  let { setting, model, label, set }: ControlProps<KeysSetting<string>> = $props();
  let key = $state('');
  let action = $state('');
  const t = (text: string, vars?: Record<string, string>) => say(model, text, vars);
  const rows = $derived(Object.entries(setting.value));

  function without(k: string) {
    const next = { ...setting.value };
    delete next[k];
    set(next);
  }
</script>

<table class="gv-keys" aria-label={label}>
  <thead><tr><th scope="col">{t('Key')}</th><th scope="col">{t('Action')}</th><th scope="col"></th></tr></thead>
  <tbody>
    {#each rows as [k, a] (k)}
      <tr>
        <th scope="row"><kbd>{k}</kbd></th>
        <td>
          <select
            aria-label={t('Action of the key {key}', { key: k })}
            value={a}
            onchange={(e) => set({ ...setting.value, [k]: (e.target as HTMLSelectElement).value })}
          >
            {#each setting.actions as [value, words] (value)}<option {value}>{t(words)}</option>{/each}
          </select>
        </td>
        <td
          ><button type="button" aria-label={t('Take the key {key} away', { key: k })} onclick={() => without(k)}
            >×</button
          ></td
        >
      </tr>
    {/each}
  </tbody>
</table>
<form
  class="gv-row"
  onsubmit={(e) => {
    e.preventDefault();
    if (!key || !action) return;
    set({ ...setting.value, [key]: action });
    key = '';
  }}
>
  <input
    type="text"
    aria-label={t('Key to bind, as the browser names it, such as a or ArrowUp')}
    placeholder={t('Key')}
    bind:value={key}
  />
  <select aria-label={t('Action of the new key')} bind:value={action}>
    <option value="">{t('Action')}</option>
    {#each setting.actions as [value, words] (value)}<option {value}>{t(words)}</option>{/each}
  </select>
  <button type="submit" disabled={!key || !action}>{t('Bind')}</button>
</form>
