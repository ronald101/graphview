// Loading, issues and the current graph (specification 3.3 and 3.5).
import { fingerprintOf } from './fingerprint.ts';
import { isKey, keyId, keypairId, normKey } from './keys.ts';
import type { Graph, Issue, Key, KeypairInfo, LoadResult, UnitInfo } from './types.ts';

export const FORMAT = 'graphview-graph/1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: Record<string, unknown>, field: string) => Object.prototype.hasOwnProperty.call(o, field);

function attrsOf(row: Record<string, unknown>): Record<string, unknown> | undefined {
  return isObject(row.attrs) ? row.attrs : undefined;
}

function posOf(row: Record<string, unknown>): { x: number; y: number } | undefined {
  const p = row.pos;
  if (!isObject(p)) return undefined;
  const { x, y } = p;
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : undefined;
}

/** Refuses the whole file, or accepts rows one by one and lists every issue in the order of B2. */
export function loadGraph(doc: unknown): LoadResult {
  if (!isObject(doc)) return { ok: false, code: 'not-object', message: 'The file is not a JSON object.' };
  if (doc.format !== FORMAT) return { ok: false, code: 'format', message: `The file is not in the format ${FORMAT}.` };
  if (!Array.isArray(doc.vertices))
    return { ok: false, code: 'vertices', message: 'The file has no list of vertices.' };
  if (!Array.isArray(doc.edges)) return { ok: false, code: 'edges', message: 'The file has no list of edges.' };

  const issues: Issue[] = [];
  const units: Key[] = [];
  const unitInfo = new Map<string, UnitInfo>();
  doc.vertices.forEach((row: unknown, i: number) => {
    if (!isObject(row) || !has(row, 'key')) return issues.push({ code: 'bad-row', list: 'vertices', row: i });
    if (!isKey(row.key)) return issues.push({ code: 'bad-key', list: 'vertices', row: i });
    const k = normKey(row.key);
    const id = keyId(k);
    if (unitInfo.has(id)) return issues.push({ code: 'repeated-key', list: 'vertices', row: i, key: k });
    const info: UnitInfo = { superseded: row.superseded === true };
    if (row.interface === true) info.interface = true;
    if (typeof row.label === 'string') info.label = row.label;
    const attrs = attrsOf(row);
    if (attrs) info.attrs = attrs;
    const pos = posOf(row);
    if (pos) info.pos = pos;
    unitInfo.set(id, info);
    units.push(k);
  });

  const keypairs: [Key, Key][] = [];
  const keypairInfo = new Map<string, KeypairInfo>();
  doc.edges.forEach((row: unknown, j: number) => {
    if (!isObject(row) || !has(row, 'from') || !has(row, 'to'))
      return issues.push({ code: 'bad-row', list: 'edges', row: j });
    if (!isKey(row.from) || !isKey(row.to)) return issues.push({ code: 'bad-key', list: 'edges', row: j });
    const a = normKey(row.from);
    const b = normKey(row.to);
    const ia = keyId(a);
    const ib = keyId(b);
    if (ia === ib) return issues.push({ code: 'loop', list: 'edges', row: j, keypair: [a, b] });
    if (!unitInfo.has(ia) || !unitInfo.has(ib))
      return issues.push({ code: 'unknown-unit', list: 'edges', row: j, keypair: [a, b] });
    const pid = ia + '\t' + ib;
    if (keypairInfo.has(pid)) return issues.push({ code: 'repeated-keypair', list: 'edges', row: j, keypair: [a, b] });
    const info: KeypairInfo = { superseded: row.superseded === true };
    const attrs = attrsOf(row);
    if (attrs) info.attrs = attrs;
    keypairInfo.set(pid, info);
    keypairs.push([a, b]);
  });

  for (const [a, b] of keypairs) {
    if (!keypairInfo.has(keypairId(b, a))) issues.push({ code: 'missing-reverse', keypair: [a, b] });
  }
  const touched = new Set<string>();
  for (const [a, b] of keypairs) {
    touched.add(keyId(a));
    touched.add(keyId(b));
  }
  for (const k of units) if (!touched.has(keyId(k))) issues.push({ code: 'orphan', key: k });

  const meta = isObject(doc.meta) ? doc.meta : {};
  const graph: Graph = { units, keypairs, unitInfo, keypairInfo, meta };
  if (typeof meta.fingerprint === 'string' && meta.fingerprint !== fingerprintOf(units, keypairs)) {
    issues.push({ code: 'fingerprint-mismatch', stated: meta.fingerprint });
  }
  return { ok: true, graph, issues };
}

/** The stored graph without superseded units, superseded keypairs, and keypairs touching a superseded unit. */
export function currentGraph(graph: Graph): Graph {
  const gone = (k: Key) => graph.unitInfo.get(keyId(k))?.superseded === true;
  const units = graph.units.filter((k) => !gone(k));
  const keypairs = graph.keypairs.filter(
    ([a, b]) => !gone(a) && !gone(b) && graph.keypairInfo.get(keypairId(a, b))?.superseded !== true,
  );
  return { ...graph, units, keypairs };
}

/** The fingerprint of the graph's accepted units and keypairs (B3). */
export function fingerprint(graph: Graph): string {
  return fingerprintOf(graph.units, graph.keypairs);
}
