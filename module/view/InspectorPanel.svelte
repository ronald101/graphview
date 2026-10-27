<!-- The inspector (specification 7.4): a unit, one keypair (a chevron), or both keypairs of a
     relation (its line). Each kind has its own section in inspector/; types show by their labels. -->
<script lang="ts">
  import type { GraphModel } from '../model/model.ts';
  import { sectionFor, type UnitSections } from './inspector/sections.ts';
  import { watch } from './watch.svelte.ts';

  /** sections: the host's sections for its own kinds of unit, by kind. */
  let { model, sections = {} }: { model: GraphModel; sections?: UnitSections } = $props();
  const w = watch(() => model, ['inspect', 'types', 'root']);

  const shown = $derived.by(() => {
    void w.v;
    return model.graph ? model.inspected : null;
  });
</script>

<div class="gv-panel-body" data-testid="inspector">
  {#if !shown}
    <p class="gv-note">Click a unit, a chevron or a line.</p>
  {:else}
    {@const Shown = sectionFor(model, shown, sections)}
    <Shown {model} inspected={shown} version={w.v} />
  {/if}
</div>
