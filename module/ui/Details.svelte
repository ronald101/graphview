<!-- The details panel (specification V20): a selected unit, or a selected keypair with its partner. -->
<script lang="ts">
  import { keyId, keypairId, type Key } from '../core/index.ts';
  import type { Controller } from './controller.ts';
  import { keyText } from './words.ts';

  let { c, version }: { c: Controller; version: number } = $props();

  const fmt = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

  let info = $derived.by(() => {
    void version;
    const { units, keypairs } = c.view.selection;
    if (units.length === 1 && keypairs.length === 0) {
      const k = units[0];
      const id = keyId(k);
      const u = c.graph?.unitInfo.get(id);
      return {
        kind: 'unit' as const,
        key: k,
        label: u?.label ?? null,
        attrs: Object.entries(u?.attrs ?? {}),
        relations: c.degree.get(id) ?? 0,
        out: c.out.get(id) ?? [],
        inc: c.inc.get(id) ?? [],
        ring: c.view.focus !== null ? (c.distance.get(id) ?? null) : undefined,
        pinned: c.isPinned(id),
        isFocus: c.view.focus !== null && keyId(c.view.focus) === id,
      };
    }
    if (keypairs.length === 1 && units.length === 0) {
      const [a, b] = keypairs[0];
      const rel = c.relationOf.get(keypairId(a, b));
      const col = (from: Key, to: Key, exists: boolean) => ({
        from,
        to,
        exists,
        attrs: (exists ? c.graph?.keypairInfo.get(keypairId(from, to))?.attrs : undefined) ?? {},
      });
      const first = col(a, b, true);
      const second = col(b, a, rel ? (keyId(rel.a) === keyId(a) ? rel.ba : rel.ab) : false);
      const fields = [...new Set([...Object.keys(first.attrs), ...Object.keys(second.attrs)])];
      return { kind: 'keypair' as const, cols: [first, second], fields };
    }
    if (units.length || keypairs.length)
      return { kind: 'many' as const, units: units.length, keypairs: keypairs.length };
    return { kind: 'none' as const };
  });

  const differs = (x: unknown, y: unknown) => JSON.stringify(x) !== JSON.stringify(y);
</script>

<section class="gv-panel" aria-labelledby="gv-details-h">
  <h2 id="gv-details-h">Details</h2>
  {#if info.kind === 'unit'}
    <dl class="gv-dl" data-testid="unit-details">
      <dt>Key</dt>
      <dd class="gv-num">{keyText(info.key)}</dd>
      <dt>Label</dt>
      <dd>{info.label ?? 'none'}</dd>
      <dt>Relations</dt>
      <dd class="gv-num">{info.relations}</dd>
      {#if info.ring !== undefined}
        <dt>Ring</dt>
        <dd class="gv-num">{info.ring === null ? 'beyond reach' : info.ring}</dd>
      {/if}
    </dl>
    <div class="gv-buttons">
      <button type="button" onclick={() => c.setFocus(info.key)} disabled={info.isFocus}>Focus here</button>
      <button
        type="button"
        onclick={() => (
          (c.pathFrom = info.key),
          c.say(`Paths from ${c.name(info.key)}: select the other end`),
          c.notify()
        )}>Paths from here</button
      >
      <button type="button" onclick={() => c.pin(info.key, !info.pinned)}>{info.pinned ? 'Unpin' : 'Pin'}</button>
    </div>
    <h3>Outgoing keypairs</h3>
    {#if info.out.length}
      <ul class="gv-list">
        {#each info.out as b, i (i)}
          <li>
            <button type="button" class="gv-link" onclick={() => c.select([], [[info.key, b]])}>to {c.name(b)}</button>
          </li>
        {/each}
      </ul>
    {:else}<p class="gv-note">None.</p>{/if}
    <h3>Incoming keypairs</h3>
    {#if info.inc.length}
      <ul class="gv-list">
        {#each info.inc as a, i (i)}
          <li>
            <button type="button" class="gv-link" onclick={() => c.select([], [[a, info.key]])}>from {c.name(a)}</button
            >
          </li>
        {/each}
      </ul>
    {:else}<p class="gv-note">None.</p>{/if}
    {#if info.attrs.length}
      <h3>Attributes</h3>
      <dl class="gv-dl">
        {#each info.attrs as [k, v] (k)}<dt>{k}</dt>
          <dd>{fmt(v)}</dd>{/each}
      </dl>
    {/if}
  {:else if info.kind === 'keypair'}
    <div class="gv-pair" data-testid="keypair-details">
      {#each info.cols as col, i (i)}
        <div class="gv-col" class:gv-current={i === 0} data-col={i}>
          {#if i === 0}
            <h3>Selected keypair</h3>
          {:else if col.exists}
            <h3>
              <button type="button" class="gv-link" onclick={() => c.select([], [[col.from, col.to]])}
                >Its reverse</button
              >
            </h3>
          {:else}
            <h3>Its reverse: missing</h3>
          {/if}
          <dl class="gv-dl">
            <dt>From</dt>
            <dd>{c.name(col.from)}</dd>
            <dt>To</dt>
            <dd>{c.name(col.to)}</dd>
            {#each info.fields as f (f)}
              {@const v = col.attrs[f]}
              {@const diff = differs(info.cols[0].attrs[f], info.cols[1].attrs[f])}
              <dt>{f}</dt>
              <dd class:gv-differs={diff} data-field={f} data-differs={diff}>
                {v === undefined ? 'none' : fmt(v)}{#if diff}<span
                    class="gv-mark"
                    title="Differs from the other keypair"><span class="gv-sr">, differs</span>≠</span
                  >{/if}
              </dd>
            {/each}
          </dl>
        </div>
      {/each}
    </div>
  {:else if info.kind === 'many'}
    <p>{info.units} units and {info.keypairs} keypairs selected.</p>
  {:else}
    <p class="gv-note">Select a unit or a half of a relation.</p>
  {/if}
  {#if c.view.focus !== null}
    <h3>Focus</h3>
    <p>{c.name(c.view.focus)}</p>
    <label class="gv-field"
      >Radius <span class="gv-num">{c.view.radius === null ? 'none' : c.view.radius}</span>
      <input
        type="range"
        min="0"
        max="10"
        value={c.view.radius ?? 10}
        aria-label="Radius"
        oninput={(e) => {
          const v = Number((e.target as HTMLInputElement).value);
          c.setFocus(c.view.focus, v >= 10 ? null : v);
        }}
      />
    </label>
    <label class="gv-field"
      ><input
        type="checkbox"
        checked={c.view.beyond === 'hide'}
        onchange={(e) => (
          (c.view.beyond = (e.target as HTMLInputElement).checked ? 'hide' : 'fade'),
          c.restyle(),
          c.changed()
        )}
      /> Hide units beyond the radius</label
    >
    <button type="button" onclick={() => c.setFocus(null, null)}>Clear focus</button>
  {/if}
</section>
