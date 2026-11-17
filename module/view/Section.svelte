<!-- A section that opens and closes: a heading with a disclosure button, and its content. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Unique on the page: it names the heading and the content. */
    id: string;
    title: string;
    open?: boolean;
    testid?: string;
    /** The section's name among its side bar's sections, for those who look it up. */
    section?: string;
    /** How much the section holds now, shown beside its title; nothing for null. */
    count?: number | null;
    children: Snippet;
  }
  let { id, title, open = $bindable(true), testid, section, count = null, children }: Props = $props();
</script>

<section class="gv-section" aria-labelledby="{id}-h" data-testid={testid} data-section={section} data-open={open}>
  <h2 id="{id}-h" class="gv-section-h">
    <button type="button" aria-expanded={open} aria-controls="{id}-body" onclick={() => (open = !open)}>
      <span class="gv-chevron" aria-hidden="true"></span>{title}
    </button>
    {#if count !== null}<span class="gv-badge gv-num" data-testid="section-count">{count}</span>{/if}
  </h2>
  <div id="{id}-body" class="gv-section-body" hidden={!open}>
    {@render children()}
  </div>
</section>
