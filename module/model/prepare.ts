// What a loaded graph gives the model before layout (specification 5.2 and 5.7): the graph the
// viewer shows, which the profile's projection makes when it has one; its units' places,
// relations and kinds; the model's own issues of the stored graph; and the superseded units.
import { keyId, type Graph } from '../core/index.ts';
import type { ModelIssue } from './contracts.ts';
import { findKinds, type Kinds } from './kinds.ts';
import type { Profile } from './profile.ts';
import { consolidate, type Topology } from './topology.ts';

export interface Prepared {
  stored: Graph;
  graph: Graph;
  ids: string[];
  index: Map<string, number>;
  topology: Topology;
  kinds: Kinds;
  /** The model's own issues, of the stored graph: the interface checks', then the profile's checks'. */
  issues: ModelIssue[];
  /** Whether each unit of the shown graph is superseded, by its row or by the profile. */
  superseded: Uint8Array;
}

function shape(g: Graph, p: Profile) {
  const ids = g.units.map(keyId);
  const index = new Map(ids.map((id, i) => [id, i]));
  const topology = consolidate(g, index);
  return { ids, index, topology, kinds: findKinds(g, topology.relations, p.kinds) };
}

export function prepare(stored: Graph, p: Profile): Prepared {
  const own = shape(stored, p);
  const issues: ModelIssue[] = [
    ...own.kinds.issues,
    ...p.checks.flatMap((c) => c.find(stored, own.kinds, own.topology.relations)),
  ];
  const graph = p.project ? p.project(stored, own.kinds) : stored;
  const shown = graph === stored ? own : shape(graph, p);
  const superseded = Uint8Array.from(graph.units, (k) =>
    graph.unitInfo.get(keyId(k))?.superseded || p.superseded?.(stored, k) ? 1 : 0,
  );
  return { stored, graph, ...shown, issues, superseded };
}
