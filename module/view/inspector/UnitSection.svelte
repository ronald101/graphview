<!-- The inspector's unit: its key, label, type, depth and other attributes. -->
<script lang="ts">
  import { keyId } from '../../core/index.ts';
  import { plane } from '../../model/depth.ts';
  import { keyText } from '../words.ts';
  import { fmt, typeName } from './record.ts';
  import type { SectionProps, UnitShown } from './sections.ts';

  let { model, inspected, version }: SectionProps<UnitShown> = $props();

  const PLANES = ['first plane', 'second plane', 'third plane'];

  const view = $derived.by(() => {
    void version;
    const key = inspected.key;
    const u = model.graph?.unitInfo.get(keyId(key));
    const idx = model.index.get(keyId(key));
    const d = model.degrees && idx !== undefined ? model.degrees[idx] : null;
    return {
      label: u?.label ?? null,
      type: model.unitType(key),
      depth:
        d === null
          ? 'no root'
          : d < 0
            ? 'out of reach'
            : d === 0
              ? 'the root'
              : `degree ${d}, ${plane(d) < 3 ? PLANES[plane(d)] : 'far back planes'}`,
      attrs: Object.entries(u?.attrs ?? {}).filter(([k]) => k !== model.schema.unitTypeField),
    };
  });
</script>

<dl class="gv-dl" data-kind="unit">
  <dt>Key</dt>
  <dd class="gv-num">{keyText(inspected.key)}</dd>
  <dt>Label</dt>
  <dd>{view.label ?? 'none'}</dd>
  <dt>Type</dt>
  <dd data-field="type">{typeName(view.type)}</dd>
  <dt>Depth</dt>
  <dd>{view.depth}</dd>
  {#each view.attrs as [k, v] (k)}<dt>{k}</dt>
    <dd data-field={k}>{fmt(v)}</dd>{/each}
</dl>
