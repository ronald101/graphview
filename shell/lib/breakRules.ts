// Breaking the rules on purpose (specification G4): test data for graphmath's rule switch.
import { mulberry32 } from './random.ts';
import type { GraphDoc } from './generate.ts';

export interface BreakOptions {
  /** Share of relations, from 0 to 1, that lose their reverse keypair. */
  dropReverse: number;
  /** Number of keypairs added with an unknown key. */
  unknownKeys: number;
  /** Number of rows repeated, vertices and edges alternately. */
  repeatRows: number;
  /** Number of units added without a relation. */
  loneUnits: number;
}

export const NO_BREAKS: BreakOptions = { dropReverse: 0, unknownKeys: 0, repeatRows: 0, loneUnits: 0 };

export function breaks(options: BreakOptions): boolean {
  return options.dropReverse > 0 || options.unknownKeys > 0 || options.repeatRows > 0 || options.loneUnits > 0;
}

/** Returns a broken copy of a generated graph, marked "not Rosetta data". */
export function breakRules(doc: GraphDoc, options: BreakOptions, seed: number): GraphDoc {
  if (!breaks(options)) return doc;
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const n = doc.vertices.length;
  const vertices: { key: number }[] = doc.vertices.map((v) => ({ ...v }));
  let edges = doc.edges.map((e) => ({ ...e }));

  // Drop the second keypair of a share of the relations.
  const pairs = edges.filter((e) => e.from < e.to);
  const drop = new Set(
    rng
      .shuffle([...pairs])
      .slice(0, Math.round(pairs.length * Math.min(1, Math.max(0, options.dropReverse))))
      .map((e) => `${e.to}\t${e.from}`),
  );
  edges = edges.filter((e) => !drop.has(`${e.from}\t${e.to}`));

  // Repeat valid rows only, so that each repeat gives exactly one repeated-key or repeated-keypair.
  const valid = edges.length;
  for (let i = 0; i < options.repeatRows; i++) {
    if (i % 2 === 0 || valid === 0) vertices.push({ ...vertices[rng.below(n)] });
    else edges.push({ ...edges[rng.below(valid)] });
  }
  for (let i = 0; i < options.loneUnits; i++) vertices.push({ key: n + 1 + i });
  const unknown = n + options.loneUnits + 1;
  for (let i = 0; i < options.unknownKeys; i++) {
    edges.push({ from: 1 + rng.below(n), to: unknown + i });
  }
  return { ...doc, meta: { ...doc.meta, rosetta: false, breaks: { ...options } }, vertices, edges };
}
