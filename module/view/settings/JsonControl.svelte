<!-- Any JSON value, as text: it takes effect when the field loses focus, if it reads as JSON. -->
<script lang="ts">
  import type { JsonSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import type { ControlProps } from './control.ts';

  let { setting, model, id, set }: ControlProps<JsonSetting<string>> = $props();
  let wrong = $state('');
  const text = $derived(JSON.stringify(setting.value, null, 1));
</script>

<textarea
  {id}
  rows={Math.min(8, text.split('\n').length)}
  spellcheck="false"
  value={text}
  onchange={(e) => {
    try {
      set(JSON.parse((e.target as HTMLTextAreaElement).value));
      wrong = '';
    } catch {
      wrong = say(model, 'This is not JSON.');
    }
  }}></textarea>
{#if wrong}<p class="gv-note" role="status">{wrong}</p>{/if}
