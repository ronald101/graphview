// The relation drawings (specification 6.18): the chevrons each drawing draws, where each points, and
// the perspective each carries. By keypairs, every keypair is a chevron pointing along it. By
// perspectives, a relation through an interface with two ends keeps the chevrons of its two keypairs
// toward the interface, each carrying the perspective of the unit it points at; an interface with one
// end keeps the chevron back to that end. Direct relations, relations between two interfaces, and
// interfaces with other numbers of ends draw by keypairs.
import type { Graph, Key } from '../core/index.ts';
import type { Kinds } from './kinds.ts';
import type { Chevron, Relation } from './topology.ts';

export type Drawing = 'keypairs' | 'perspectives';

/** A perspective as a chevron carries it: through its interface, from the unit it starts at to the other end. */
export interface DrawnPerspective {
  iface: Key;
  from: Key;
  to: Key;
  type: string | null;
}

/** A chevron as the drawing draws it: on its keypair (from, to), pointing at a unit. */
export interface DrawnChevron extends Chevron {
  from: Key;
  to: Key;
  /** The unit it points at. */
  points: Key;
  /** The perspective it carries, in the perspective drawing. */
  perspective: DrawnPerspective | null;
}

/**
 * The chevrons of a drawing, in the order of the model's chevrons. `typeOf(iface, from, to)` gives a
 * perspective's pair type.
 */
export function drawnChevrons(
  g: Graph,
  relations: readonly Relation[],
  chevrons: readonly Chevron[],
  kinds: Kinds,
  drawing: Drawing,
  typeOf: (iface: Key, from: Key, to: Key) => string | null,
): DrawnChevron[] {
  const out: DrawnChevron[] = [];
  const through = (iface: Key, from: Key, to: Key): DrawnPerspective => ({
    iface,
    from,
    to,
    type: typeOf(iface, from, to),
  });
  for (const ch of chevrons) {
    const rel = relations[ch.rel];
    const [a, b] = ch.forward ? [rel.a, rel.b] : [rel.b, rel.a];
    const [from, to] = ch.forward ? [rel.ka, rel.kb] : [rel.kb, rel.ka];
    const keypair: DrawnChevron = { ...ch, from, to, points: to, perspective: null };
    const ea = kinds.ends.get(a);
    const eb = kinds.ends.get(b);
    if (drawing === 'keypairs' || (ea && eb) || (!ea && !eb)) {
      out.push(keypair);
    } else if (eb) {
      // From an end into its interface: with two ends it carries the other end's perspective and points at it.
      if (eb.length === 2) {
        const other = g.units[eb[0] === a ? eb[1] : eb[0]];
        out.push({ ...keypair, points: other, perspective: through(to, other, from) });
      } else if (eb.length !== 1) out.push(keypair);
    } else if (ea) {
      // From an interface back to an end: with one end it carries that end's perspective of itself.
      if (ea.length === 1) out.push({ ...keypair, perspective: through(from, to, to) });
      else if (ea.length !== 2) out.push(keypair);
    }
  }
  return out;
}
