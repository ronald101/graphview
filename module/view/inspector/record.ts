// What the inspector shows of keypairs and types (specification 7.4), by the settings of the group "Panels".
import { keypairId, type Key } from '../../core/index.ts';
import type { GraphModel } from '../../model/model.ts';
import { say } from '../words.ts';

export const fmt = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

/** A type by its name, with its own value beside it when renamed, always, or never. */
export function typeName(t: { id: string; label: string } | null, m?: GraphModel): string {
  if (t === null) return m ? say(m, 'none') : 'none';
  const when = m?.settings.get('panels.inspector.typeValue') ?? 'when-renamed';
  return when === 'always' || (when === 'when-renamed' && t.label !== t.id) ? `${t.label} (${t.id})` : t.label;
}

/** A unit's or keypair's other attributes: without the type field unless the setting keeps it. */
export const otherAttrs = (m: GraphModel, attrs: Record<string, unknown> | undefined, typeField: string | null) =>
  Object.entries(attrs ?? {}).filter(([k]) => !m.settings.get('panels.inspector.hideTypeField') || k !== typeField);

/** One keypair as the inspector shows it: whether it exists, its type and its other attributes. */
export function keypairRecord(m: GraphModel, a: Key, b: Key) {
  const info = m.graph?.keypairInfo.get(keypairId(a, b));
  return {
    from: a,
    to: b,
    exists: info !== undefined,
    type: m.keypairType(a, b),
    attrs: otherAttrs(m, info?.attrs, m.schema.keypairTypeField),
  };
}

export type KeypairRecord = ReturnType<typeof keypairRecord>;
