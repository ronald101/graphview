<!-- Types (specification 7.7): unit types, and keypair types in complementary pairs
     side by side. Every colour and every name can be changed; the model keeps them. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { TypeInfo } from '../model/contracts.ts';
  import type { GraphModel } from '../model/model.ts';
  import { watch } from './watch.svelte.ts';

  interface Props {
    model: GraphModel;
    /** Shown first under "Units by type", such as a field for how many types to add. */
    unitExtra?: Snippet;
    keypairExtra?: Snippet;
  }
  let { model, unitExtra, keypairExtra }: Props = $props();
  const w = watch(() => model, ['types']);

  const view = $derived.by(() => {
    void w.v;
    const byId = new Map(model.types.keypair.map((t) => [t.id, t]));
    return {
      // A profile's classes, when it gives them, decide unit types instead of a field.
      unitField: model.profile.classOf ? null : model.schema.unitTypeField,
      keypairField: model.schema.keypairTypeField,
      unit: model.types.unit,
      pairs: model.types.pairs.map((p) => ({
        forward: byId.get(p.forward)!,
        backward: p.backward === null ? null : (byId.get(p.backward) ?? null),
        symmetric: p.backward === p.forward,
      })),
    };
  });

  const value = (e: Event) => (e.target as HTMLInputElement).value;
</script>

{#snippet cell(kind: 'unit' | 'keypair', t: TypeInfo)}
  <span class="gv-type" data-type={t.id}>
    <input
      type="color"
      value={t.colour.toLowerCase()}
      aria-label="Colour of the {kind} type {t.label}"
      oninput={(e) => model.setTypeColour(kind, t.id, value(e))}
    />
    <input
      type="text"
      class="gv-type-name"
      value={t.label}
      aria-label="Name of the {kind} type {t.id}"
      onchange={(e) => model.setTypeLabel(kind, t.id, value(e))}
    />
  </span>
{/snippet}

<div class="gv-panel-body" data-testid="types-panel">
  <h3>Units by type{view.unitField ? ` (${view.unitField})` : ''}</h3>
  {@render unitExtra?.()}
  {#if view.unit.length}
    <ul class="gv-types" data-testid="unit-types">
      {#each view.unit as t (t.id)}
        <li>{@render cell('unit', t)}<span class="gv-num gv-count" title="units">{t.count}</span></li>
      {/each}
    </ul>
  {:else}
    <p class="gv-note">The units of this graph have no types.</p>
  {/if}
  <h3>Keypairs by type{view.keypairField ? ` (${view.keypairField})` : ''}</h3>
  {@render keypairExtra?.()}
  {#if view.pairs.length}
    <table class="gv-pairs" data-testid="keypair-types">
      <thead>
        <tr><th scope="col">Type</th><th scope="col">Complement</th></tr>
      </thead>
      <tbody>
        {#each view.pairs as p (p.forward.id)}
          <tr>
            <td>{@render cell('keypair', p.forward)}</td>
            <td>
              {#if p.symmetric}<span class="gv-note">the same type</span>
              {:else if p.backward}{@render cell('keypair', p.backward)}
              {:else}<span class="gv-note">none</span>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="gv-note">The keypairs of this graph have no types.</p>
  {/if}
</div>
