<!-- Data issues (specification 7.8): every breach of the graph rules, in plain words. -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import IssueIcon from './IssueIcon.svelte';
  import { watch } from './watch.svelte.ts';
  import { issueWords } from './words.ts';

  let { model }: { model: GraphModel } = $props();
  const w = watch(() => model, []);
  const issues = $derived.by(() => {
    void w.v;
    return model.issues;
  });
</script>

<div class="gv-panel-body" data-testid="issues-panel">
  {#if issues.length === 0}
    <p class="gv-note">No issues.</p>
  {:else}
    <ol class="gv-issues">
      {#each issues as i, n (n)}
        <li data-code={i.code}>
          <IssueIcon /><span>{issueWords(i, (k) => model.label(k), model.profile.checks)}</span>
        </li>
      {/each}
    </ol>
  {/if}
</div>
