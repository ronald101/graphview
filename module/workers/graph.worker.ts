// Web worker: degrees of separation from a root, and path sets
// (specification 5.4). The graph arrives once and stays.
import { loadGraph, pathSet, ringIndex, type Graph, type Key, type PathLimits } from '../core/index.ts';

let graph: Graph | null = null;

type Request =
  | { id: number; kind: 'graph'; units: Key[]; keypairs: [Key, Key][] }
  | { id: number; kind: 'distances'; root: Key }
  | { id: number; kind: 'paths'; from: Key; to: Key; extra: number; limits: PathLimits };

self.onmessage = (e: MessageEvent<Request>) => {
  const r = e.data;
  const reply = (out: unknown) => (self as unknown as Worker).postMessage({ id: r.id, out });
  if (r.kind === 'graph') {
    const loaded = loadGraph({
      format: 'graphview-graph/1',
      vertices: r.units.map((key) => ({ key })),
      edges: r.keypairs.map(([from, to]) => ({ from, to })),
    });
    graph = loaded.ok ? loaded.graph : null;
    return reply(true);
  }
  if (!graph) return reply(null);
  if (r.kind === 'distances') return reply(ringIndex(graph, r.root));
  return reply(pathSet(graph, r.from, r.to, r.extra, r.limits));
};
