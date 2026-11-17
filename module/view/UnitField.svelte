<!-- One row: a label, a field for a unit's label or key, Set and Reset. The field offers the
     unit names of the datalist "gv-units", which the canvas keeps. -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import { say } from './words.ts';

  interface Props {
    id: string;
    label: string;
    value: string;
    /** The model whose settings give the words. */
    model?: GraphModel;
    disabled?: boolean;
    onset: () => void;
    onreset: () => void;
  }
  let { id, label, value = $bindable(), model, disabled = false, onset, onreset }: Props = $props();
  const t = (text: string) => (model ? say(model, text) : text);
</script>

<form
  class="gv-row"
  onsubmit={(e) => {
    e.preventDefault();
    onset();
  }}
>
  <label for={id}>{label}</label>
  <input
    {id}
    class="gv-unit-input"
    list="gv-units"
    placeholder={t('label or key')}
    autocomplete="off"
    {disabled}
    bind:value
  />
  <button type="submit" {disabled}>{t('Set')}</button>
  <button type="button" onclick={onreset}>{t('Reset')}</button>
</form>
