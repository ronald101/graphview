// Relations through interfaces: a seeded share of a graph's relations gets an interface, a unit of
// the interface kind, between its two units. The keypair (a, b) becomes (a, i) and (i, b), both
// with the row's other fields, attributes and superseded mark included; its reverse (b, a) becomes
// (b, i) and (i, a). The interface is superseded when every row of its relation is.
import { isKey, keyId, keypairId, type Key } from '../../module/index.ts';
import { mulberry32 } from './random.ts';

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);

/** An edge row the transform can carry: two keys that differ. */
const isEdge = (e: unknown): e is Row & { from: Key; to: Key } =>
  isRow(e) && isKey(e.from) && isKey(e.to) && keyId(e.from) !== keyId(e.to);

const placeOf = (row: Row | undefined): { x: number; y: number } | null => {
  const p = row?.pos;
  return isRow(p) && typeof p.x === 'number' && typeof p.y === 'number' ? { x: p.x, y: p.y } : null;
};

/**
 * The document with a share of its relations, from 0 to 1, through interfaces. Each relation, in
 * the order of its first row, draws once from the seed. An interface's key is the first free text
 * of i1, i2 and so on; it sits halfway between its units when both have a position.
 */
export function throughInterfaces<T>(doc: T, share: number, seed: number): T {
  if (!(share > 0) || !isRow(doc) || !Array.isArray(doc.vertices) || !Array.isArray(doc.edges)) return doc;
  const rng = mulberry32(seed ^ 0x1b873593);
  const vertices = doc.vertices as unknown[];
  const edges = doc.edges as unknown[];
  const rowOf = new Map<string, Row>();
  for (const v of vertices) if (isRow(v) && isKey(v.key) && !rowOf.has(keyId(v.key))) rowOf.set(keyId(v.key), v);

  // The relations in the order of their first rows, and whether each goes through an interface.
  const relationOf = new Map<string, number>();
  const relations: { a: Key; b: Key; through: boolean; superseded: boolean }[] = [];
  for (const e of edges) {
    if (!isEdge(e)) continue;
    let r = relationOf.get(keypairId(e.from, e.to));
    if (r === undefined) {
      r = relations.length;
      relations.push({ a: e.from, b: e.to, through: rng.next() < share, superseded: true });
      relationOf.set(keypairId(e.from, e.to), r);
      relationOf.set(keypairId(e.to, e.from), r);
    }
    if (e.superseded !== true) relations[r].superseded = false;
  }

  // A fresh key is named by no row, edges included.
  const taken = new Set(rowOf.keys());
  for (const e of edges) if (isRow(e)) for (const k of [e.from, e.to]) if (isKey(k)) taken.add(keyId(k));
  let n = 0;
  const fresh = (): string => {
    while (taken.has(keyId(`i${++n}`)));
    return `i${n}`;
  };
  const added: Row[] = [];
  const middle = new Map<number, string>();
  relations.forEach((r, i) => {
    if (!r.through) return;
    const key = fresh();
    middle.set(i, key);
    const row: Row = { key, label: key, interface: true };
    const [pa, pb] = [placeOf(rowOf.get(keyId(r.a))), placeOf(rowOf.get(keyId(r.b)))];
    if (pa && pb) row.pos = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    if (r.superseded) row.superseded = true;
    added.push(row);
  });

  const out: unknown[] = [];
  for (const e of edges) {
    const i = isEdge(e) ? middle.get(relationOf.get(keypairId(e.from, e.to))!) : undefined;
    if (i === undefined) out.push(e);
    else out.push({ ...(e as Row), to: i }, { ...(e as Row), from: i });
  }
  return { ...doc, vertices: [...vertices, ...added], edges: out } as T;
}
