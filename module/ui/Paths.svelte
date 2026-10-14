<!-- The path explorer (specification V17). -->
<script lang="ts">
  import type { Controller } from './controller.ts';

  let { c, version }: { c: Controller; version: number } = $props();
  let list: HTMLElement | undefined = $state();

  let res = $derived.by(() => {
    void version;
    return c.pathResult;
  });
  let ends = $derived.by(() => {
    void version;
    return c.view.paths.ends;
  });
  let extra = $derived.by(() => {
    void version;
    return c.view.paths.extra;
  });
  let lit = $derived.by(() => {
    void version;
    return c.view.paths.lit;
  });
  let showAll = $derived.by(() => {
    void version;
    return c.view.paths.showAll;
  });

  function keys(e: KeyboardEvent) {
    if (e.key === '+' || e.key === '=') {
      c.setPathExtra(Math.min(6, extra + 1));
      e.preventDefault();
    } else if (e.key === '-' || e.key === '−') {
      c.setPathExtra(Math.max(0, extra - 1));
      e.preventDefault();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && list) {
      const items = [...list.querySelectorAll<HTMLButtonElement>('button[data-path]')];
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = items[Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))];
      next.focus();
      next.click();
      e.preventDefault();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="gv-panel" aria-labelledby="gv-paths-h" onkeydown={keys} data-testid="paths-panel">
  <h2 id="gv-paths-h">Paths</h2>
  {#if c.pathFrom !== null && !ends}
    <p>From {c.name(c.pathFrom)}: select the other end.</p>
  {/if}
  {#if ends}
    <p>From <strong>{c.name(ends[0])}</strong> to <strong>{c.name(ends[1])}</strong></p>
    <label class="gv-field"
      >Extra steps <span class="gv-num" data-testid="extra">{extra}</span>
      <input
        type="range"
        min="0"
        max="6"
        value={extra}
        aria-label="Extra steps"
        oninput={(e) => c.setPathExtra(Number((e.target as HTMLInputElement).value))}
      />
    </label>
    {#if res && res.reason === 'same-unit'}
      <p>The two ends are the same unit.</p>
    {:else if res && res.reason === 'unreachable'}
      <p>No path leads from the first unit to the second.</p>
    {:else if res}
      <p data-testid="paths-total">
        {#if res.stopped}At least {res.total.toLocaleString('en')}: counting stopped{:else}{res.total.toLocaleString(
            'en',
          )}
          {res.total === 1 ? 'path' : 'paths'}{/if}
      </p>
      <div bind:this={list}>
        {#each res.lengths as l (l.length)}
          <div class="gv-length" data-length={l.length} data-count={l.count} data-exact={l.exact}>
            <h3>
              Length {l.length}:
              <span class="gv-num">
                {#if l.exact}{l.count.toLocaleString('en')}{:else}at least {l.count.toLocaleString('en')}: counting
                  stopped{/if}
              </span>
            </h3>
            {#if l.count > 0}
              <button
                type="button"
                class="gv-small"
                aria-pressed={showAll === l.length}
                onclick={() => c.showAll(showAll === l.length ? null : l.length)}>Show all</button
              >
            {/if}
            <ul class="gv-list">
              {#each l.paths.slice(0, 50) as p, i (i)}
                <li>
                  <button
                    type="button"
                    class="gv-link gv-path"
                    data-path="{l.length}:{i}"
                    aria-pressed={lit?.length === l.length && lit.index === i}
                    onmouseenter={() => c.litPath({ length: l.length, index: i }, false)}
                    onmouseleave={() => c.litPath(null, false)}
                    onfocus={() => c.litPath({ length: l.length, index: i }, false)}
                    onclick={() => c.litPath({ length: l.length, index: i }, true)}
                    >{p.map((k) => c.name(k)).join(' → ')}</button
                  >
                </li>
              {/each}
              {#if l.paths.length > 50}<li class="gv-note">and {l.paths.length - 50} more listed</li>{/if}
            </ul>
          </div>
        {/each}
      </div>
    {:else}
      <p class="gv-note">Counting paths.</p>
    {/if}
    <button type="button" onclick={() => c.clearPaths()}>Close paths</button>
  {:else if c.pathFrom === null}
    <p class="gv-note">Select two units, or use Paths from here.</p>
  {/if}
</section>
