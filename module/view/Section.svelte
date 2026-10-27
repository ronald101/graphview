<!-- A section that opens and closes: a heading with a disclosure button, and its content. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Unique on the page: it names the heading and the content. */
    id: string;
    title: string;
    open?: boolean;
    testid?: string;
    children: Snippet;
  }
  let { id, title, open = $bindable(true), testid, children }: Props = $props();
</script>

<section class="gv-section" aria-labelledby="{id}-h" data-testid={testid} data-open={open}>
  <h2 id="{id}-h" class="gv-section-h">
    <button type="button" aria-expanded={open} aria-controls="{id}-body" onclick={() => (open = !open)}>
      <span class="gv-chevron" aria-hidden="true"></span>{title}
    </button>
  </h2>
  <div id="{id}-body" class="gv-section-body" hidden={!open}>
    {@render children()}
  </div>
</section>
