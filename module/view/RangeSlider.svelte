<!-- A slider with two knobs, for the lowest and the highest value of a range. Each knob is a native
     range input, so that keyboards and screen readers work as with any slider. -->
<script lang="ts">
  interface Props {
    label: string;
    min: number;
    max: number;
    step: number;
    low: number;
    high: number;
    format?: (v: number) => string;
    disabled?: boolean;
    onchange: (low: number, high: number) => void;
    testid?: string;
  }
  let { label, min, max, step, low, high, format = String, disabled = false, onchange, testid }: Props = $props();

  const span = $derived(max - min || 1);
  const pct = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / span) * 100;

  function setLow(v: number) {
    onchange(Math.min(v, high), high);
  }
  function setHigh(v: number) {
    onchange(low, Math.max(v, low));
  }
</script>

<div class="gv-range" role="group" aria-label={label} data-testid={testid}>
  <div class="gv-range-head">
    <span>{label}</span>
    <span class="gv-num">{format(low)} to {format(high)}</span>
  </div>
  <div class="gv-range-track" class:gv-disabled={disabled}>
    <div class="gv-range-fill" style:left="{pct(low)}%" style:right="{100 - pct(high)}%"></div>
    <input
      type="range"
      {min}
      {max}
      {step}
      value={low}
      {disabled}
      aria-label="{label}, lowest"
      oninput={(e) => setLow(Number((e.target as HTMLInputElement).value))}
    />
    <input
      type="range"
      {min}
      {max}
      {step}
      value={high}
      {disabled}
      aria-label="{label}, highest"
      oninput={(e) => setHigh(Number((e.target as HTMLInputElement).value))}
    />
  </div>
</div>
