<!-- The control of a setting, picked by the setting's control (D79). -->
<script lang="ts">
  import type { Component } from 'svelte';
  import type { Control } from '../../settings/setting.svelte.ts';
  import CheckboxControl from './CheckboxControl.svelte';
  import ColourControl from './ColourControl.svelte';
  import type { ControlProps } from './control.ts';
  import JsonControl from './JsonControl.svelte';
  import KeysControl from './KeysControl.svelte';
  import NumberControl from './NumberControl.svelte';
  import OrderControl from './OrderControl.svelte';
  import PaletteControl from './PaletteControl.svelte';
  import RangeControl from './RangeControl.svelte';
  import SelectControl from './SelectControl.svelte';
  import SetControl from './SetControl.svelte';
  import SliderControl from './SliderControl.svelte';
  import TextControl from './TextControl.svelte';
  import ThemeColourControl from './ThemeColourControl.svelte';

  // Each control takes its own class of setting; the table pairs them by the setting's control.
  const CONTROLS = {
    checkbox: CheckboxControl,
    slider: SliderControl,
    number: NumberControl,
    range: RangeControl,
    select: SelectControl,
    text: TextControl,
    colour: ColourControl,
    'theme-colour': ThemeColourControl,
    palette: PaletteControl,
    order: OrderControl,
    set: SetControl,
    keys: KeysControl,
    json: JsonControl,
  } as unknown as Record<Control, Component<ControlProps>>;

  let props: ControlProps = $props();
  const Shown = $derived(CONTROLS[props.setting.control]);
</script>

<Shown {...props} />
