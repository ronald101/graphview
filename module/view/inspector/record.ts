// What the inspector shows of keypairs and types (specification 7.4).
import { keypairId, type Key } from '../../core/index.ts';
import type { GraphModel } from '../../model/model.ts';

export const fmt = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

export const typeName = (t: { id: string; label: string } | null) =>
  t === null ? 'none' : t.label === t.id ? t.label : `${t.label} (${t.id})`;

/** One keypair as the inspector shows it: whether it exists, its type and its other attributes. */
export function keypairRecord(m: GraphModel, a: Key, b: Key) {
  const info = m.graph?.keypairInfo.get(keypairId(a, b));
  return {
    from: a,
    to: b,
    exists: info !== undefined,
    type: m.keypairType(a, b),
    attrs: Object.entries(info?.attrs ?? {}).filter(([k]) => k !== m.schema.keypairTypeField),
  };
}

export type KeypairRecord = ReturnType<typeof keypairRecord>;
