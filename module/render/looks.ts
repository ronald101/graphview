// How each kind of unit looks (specification 6.17 and 5.7): its shape, whether it joins hulls,
// and the colours of its two halves. A host may hand the scene its own looks and shapes; a kind
// without a look draws as plain.
import type { GraphModel } from '../model/model.ts';
import { OTHER } from '../model/typeRegistry.ts';
import { UNIT_SHAPES, type UnitShape } from './shapes.ts';

export interface Look {
  /** The name of its shape (shapes.ts). */
  shape: string;
  /** Whether its units join the hulls of their type (6.9). */
  hulls: boolean;
  /** The palette slots of a unit's two halves, by unit index; without it, halfSlots decides. */
  halves?: (m: GraphModel, i: number) => [number, number];
}

export interface Looks {
  /** A look for each kind, by kind id; plain's serves the kinds without one. */
  kinds: Record<string, Look>;
  /** The shapes the unit shader holds. */
  shapes: UnitShape[];
}

export const PUBLIC_LOOKS: Looks = {
  kinds: { plain: { shape: 'disc', hulls: true }, interface: { shape: 'divided', hulls: false } },
  shapes: UNIT_SHAPES,
};

export const lookOf = (looks: Looks, kind: string): Look =>
  looks.kinds[kind] ?? looks.kinds.plain ?? PUBLIC_LOOKS.kinds.plain;

/**
 * The palette slots of a unit's two halves. A unit without ends shows its type on both. A unit
 * with ends shows the types of its two ends, the first end's on its side; with one end, that
 * end's on both. No end or more than two, and an end that has ends itself, show the context colour.
 */
export function halfSlots(m: GraphModel, i: number): [number, number] {
  const slots = m.types.unitSlot;
  const slot = (j: number) => (m.kinds.ends.has(j) ? OTHER : (slots[j] ?? OTHER));
  const e = m.kinds.ends.get(i);
  if (!e) return [slots[i] ?? OTHER, slots[i] ?? OTHER];
  if (e.length === 2) return [slot(e[0]), slot(e[1])];
  return e.length === 1 ? [slot(e[0]), slot(e[0])] : [OTHER, OTHER];
}

/** The two halves' palette slots of every unit, each by its kind's look. */
export function halvesOf(m: GraphModel, looks: Looks = PUBLIC_LOOKS): Float32Array {
  const out = new Float32Array(2 * m.ids.length);
  for (let i = 0; i < m.ids.length; i++) {
    const [a, b] = (lookOf(looks, m.kinds.of[i]).halves ?? halfSlots)(m, i);
    out[2 * i] = a;
    out[2 * i + 1] = b;
  }
  return out;
}
