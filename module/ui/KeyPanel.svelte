<!-- The key: the colours in use and what they mean (specification V18 and D5). -->
<script lang="ts">
  import type { Controller } from './controller.ts';
  import IssueIcon from './IssueIcon.svelte';

  let { c, version }: { c: Controller; version: number } = $props();

  let rows = $derived.by(() => {
    void version;
    const t = c.colours;
    const out: { colour: string; text: string; dashed?: boolean }[] = [];
    const col = c.look.relations.colour;
    if (typeof col === 'object') {
      const attr = c.attrColours();
      const hues = [t.outgoing, t.incoming, t.path];
      for (const [v, i] of attr ?? []) {
        let shown = v;
        try {
          shown = String(JSON.parse(v));
        } catch {
          /* keep */
        }
        out.push({ colour: hues[i], text: `${col.attr}: ${shown}` });
      }
      out.push({ colour: t.context, text: `${col.attr}: any other value` });
    } else {
      out.push({ colour: t.context, text: 'Relations at rest' });
      if (col === 'around-selection' && c.view.selection.units.length) {
        out.push({ colour: t.outgoing, text: 'Outgoing keypairs of the selection' });
        out.push({ colour: t.incoming, text: 'Incoming keypairs of the selection' });
      }
    }
    if (c.pathResult && (c.view.paths.lit || c.view.paths.showAll !== null || c.pathHover))
      out.push({ colour: t.path, text: 'Lit path' });
    if (c.issues.length) out.push({ colour: t.issue, text: 'Data issue, dashed and marked', dashed: true });
    return out;
  });
</script>

<section class="gv-panel" aria-labelledby="gv-key-h" data-testid="key-panel">
  <h2 id="gv-key-h">Key</h2>
  <ul class="gv-key">
    {#each rows as r (r.text)}
      <li>
        <svg width="28" height="10" aria-hidden="true"
          ><line
            x1="2"
            y1="5"
            x2="26"
            y2="5"
            stroke={r.colour}
            stroke-width="2"
            stroke-dasharray={r.dashed ? '5 4' : undefined}
          /></svg
        >
        {#if r.dashed}<IssueIcon />{/if}
        <span>{r.text}</span>
      </li>
    {/each}
  </ul>
  {#if c.look.relations.draw === 'halves'}
    <p class="gv-note">
      The half of a line next to a unit shows that unit's outgoing keypair; its chevron points away from the unit.
    </p>
  {/if}
</section>
