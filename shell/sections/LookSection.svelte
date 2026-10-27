<!-- Look: the theme and motion, each light, dark, on or off, or as the system. -->
<script lang="ts">
  import { Section } from '../../module/index.ts';
  import type { Shell } from '../lib/shell.svelte.ts';

  let { shell }: { shell: Shell } = $props();
</script>

<Section id="look" title="Look" testid="section-look" bind:open={shell.open.look}>
  <label class="gv-field"
    >Theme
    <select bind:value={shell.theme}>
      <option value="system">As the system</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
  <label class="gv-field"
    >Motion
    <select bind:value={shell.motion}>
      <option value="system">As the system</option>
      <option value="on">On</option>
      <option value="off">Off</option>
    </select>
  </label>
</Section>
