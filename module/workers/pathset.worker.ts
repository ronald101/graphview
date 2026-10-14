// Web worker for path sets, so that the page stays responsive (specification C5).
import { loadGraph, pathSet, type Key, type PathLimits } from '../core/index.ts';

interface Request {
  id: number;
  units: Key[];
  keypairs: [Key, Key][];
  from: Key;
  to: Key;
  extra: number;
  limits: PathLimits;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const r = e.data;
  // The graph in use arrives as plain rows: units and keypairs, nothing superseded.
  const loaded = loadGraph({
    format: 'graphview-graph/1',
    vertices: r.units.map((key) => ({ key })),
    edges: r.keypairs.map(([from, to]) => ({ from, to })),
  });
  if (!loaded.ok) return;
  const result = pathSet(loaded.graph, r.from, r.to, r.extra, r.limits);
  (self as unknown as Worker).postMessage({ id: r.id, result });
};
