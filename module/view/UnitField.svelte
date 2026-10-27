<!-- One row: a label, a field for a unit's label or key, Set and Reset. The field offers the
     unit names of the datalist "gv-units", which the canvas keeps. -->
<script lang="ts">
  interface Props {
    id: string;
    label: string;
    value: string;
    disabled?: boolean;
    onset: () => void;
    onreset: () => void;
  }
  let { id, label, value = $bindable(), disabled = false, onset, onreset }: Props = $props();
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
    placeholder="label or key"
    autocomplete="off"
    {disabled}
    bind:value
  />
  <button type="submit" {disabled}>Set</button>
  <button type="button" onclick={onreset}>Reset</button>
</form>
