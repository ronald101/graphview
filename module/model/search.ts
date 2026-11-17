// The search (specification 6.19): every unit by its label, its key as JSON text, its class and type,
// and the texts and numbers of its attributes, in lower case. An exact label or key ranks first; then
// labels that start with the text; then labels with a word that starts with it; then labels that
// contain it; then other values that contain it. Ties go to more relations, then to file order.
import { keyId, type Graph } from '../core/index.ts';
import type { SearchResult } from './contracts.ts';

/** What the search reads of the units, by index. */
export interface SearchFacts {
  label(i: number): string;
  classOf(i: number): string | null;
  typeOf(i: number): string | null;
  relations(i: number): number;
}

const words = (s: string) => s.split(/[^\p{L}\p{N}]+/u);

/** The units that match a text, by rank, at most `limit`. */
export function searchUnits(g: Graph, text: string, facts: SearchFacts, limit: number): SearchResult[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const found: (SearchResult & { i: number })[] = [];
  g.units.forEach((k, i) => {
    const label = facts.label(i).toLowerCase();
    const json = JSON.stringify(k).toLowerCase();
    const bare = String(k).toLowerCase();
    let hit: [number, string] | null = null;
    if (label === q) hit = [0, 'label'];
    else if (json === q || bare === q) hit = [0, 'key'];
    else if (label.startsWith(q)) hit = [1, 'label'];
    else if (words(label).some((w) => w.startsWith(q))) hit = [2, 'label'];
    else if (label.includes(q)) hit = [3, 'label'];
    else {
      const attrs = Object.entries(g.unitInfo.get(keyId(k))?.attrs ?? {}).flatMap(([name, v]) =>
        typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? [[name, String(v)] as const] : [],
      );
      const values: (readonly [string, string | null])[] = [
        ['key', json],
        ['class', facts.classOf(i)],
        ['type', facts.typeOf(i)],
        ...attrs,
      ];
      const v = values.find(([, x]) => x !== null && x.toLowerCase().includes(q));
      if (v) hit = [4, v[0]];
    }
    if (hit) found.push({ key: k, rank: hit[0], where: hit[1], i });
  });
  found.sort((p, r) => p.rank - r.rank || facts.relations(r.i) - facts.relations(p.i) || p.i - r.i);
  return found.slice(0, limit).map(({ key, rank, where }) => ({ key, rank, where }));
}
