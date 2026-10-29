<!-- The inspector's unit: its key, label, type, depth and other attributes. -->
<script lang="ts">
  import { keyId } from '../../core/index.ts';
  import { plane } from '../../model/depth.ts';
  import { keyText, say } from '../words.ts';
  import { fmt, otherAttrs, typeName } from './record.ts';
  import type { SectionProps, UnitShown } from './sections.ts';

  let { model, inspected, version }: SectionProps<UnitShown> = $props();
  const t = (text: string, vars?: Record<string, string | number>) => say(model, text, vars);

  const PLANES = ['first plane', 'second plane', 'third plane'];

  const view = $derived.by(() => {
    void version;
    const key = inspected.key;
    const u = model.graph?.unitInfo.get(keyId(key));
    const idx = model.index.get(keyId(key));
    const d = model.degrees && idx !== undefined ? model.degrees[idx] : null;
    const p = d === null ? 0 : plane(d, model.depth);
    return {
      label: u?.label ?? null,
      type: model.unitType(key),
      depth:
        d === null
          ? t('no root')
          : d < 0
            ? t('out of reach')
            : d === 0
              ? t('the root')
              : t('degree {degree}, {plane}', { degree: d, plane: t(p < 3 ? PLANES[p] : 'far back planes') }),
      attrs: otherAttrs(model, u?.attrs, model.schema.unitTypeField),
    };
  });
</script>

<dl class="gv-dl" data-kind="unit">
  <dt>{t('Key')}</dt>
  <dd class="gv-num">{keyText(inspected.key)}</dd>
  <dt>{t('Label')}</dt>
  <dd>{view.label ?? t('none')}</dd>
  <dt>{t('Type')}</dt>
  <dd data-field="type">{typeName(view.type, model)}</dd>
  <dt>{t('Depth')}</dt>
  <dd>{view.depth}</dd>
  {#each view.attrs as [k, v] (k)}<dt>{k}</dt>
    <dd data-field={k}>{fmt(v)}</dd>{/each}
</dl>
