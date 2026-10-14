<!-- The data issues panel (specification V21). -->
<script lang="ts">
  import { keyId, type Key } from '../core/index.ts';
  import type { Controller } from './controller.ts';
  import IssueIcon from './IssueIcon.svelte';
  import { issueWords, refusalWords } from './words.ts';

  let { c, version }: { c: Controller; version: number } = $props();

  let items = $derived.by(() => {
    void version;
    return c.refused ? [] : c.issueItems();
  });

  /** The unit an issue can fly to, if something of it is drawn. */
  function target(i: (typeof items)[number]): Key | null {
    const drawn = (k: Key) => c.positions.has(keyId(k));
    if (i.code === 'orphan') return drawn(i.key) ? i.key : null;
    if (i.code === 'missing-reverse') return drawn(i.keypair[0]) ? i.keypair[0] : null;
    if (i.code === 'repeated-key') return drawn(i.key) ? i.key : null;
    if (i.code === 'loop') return drawn(i.keypair[0]) ? i.keypair[0] : null;
    if (i.code === 'unknown-unit' || i.code === 'repeated-keypair') {
      for (const k of i.keypair) if (drawn(k)) return k;
    }
    return null;
  }
</script>

<section class="gv-panel" aria-labelledby="gv-issues-h" data-testid="issues-panel">
  <h2 id="gv-issues-h">Data issues</h2>
  {#if c.refused}
    <p class="gv-refusal" data-code={c.refused.code}>
      <IssueIcon /> Refused: {refusalWords(c.refused.code)} <span class="gv-num">({c.refused.code})</span>
    </p>
  {:else if items.length === 0}
    <p class="gv-note">No issues.</p>
  {:else}
    <ol class="gv-issues">
      {#each items as i, n (n)}
        {@const to = target(i)}
        <li data-code={i.code}>
          <IssueIcon />
          {#if to !== null}
            <button type="button" class="gv-link" onclick={() => (c.select([to], []), c.flyTo(to))}
              >{issueWords(i, (k) => c.name(k))}</button
            >
          {:else}
            <span>{issueWords(i, (k) => c.name(k))}</span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>
