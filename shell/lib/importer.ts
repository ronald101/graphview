// Reads graph files in the common "id, source, target" shape (specification 3.7)
// and turns them into graphview-graph/1. Files that name their format pass unchanged.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const VERTEX_FIELDS = new Set(['id', 'key', 'label', 'name', 'pos', 'x', 'y', 'superseded']);
const EDGE_FIELDS = new Set(['id', 'source', 'target', 'from', 'to', 'superseded']);

function rest(row: Record<string, unknown>, known: Set<string>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const attrs = isObject(row.attrs) ? row.attrs : {};
  for (const [k, v] of Object.entries(row)) if (!known.has(k) && k !== 'attrs') out[k] = v;
  const all = { ...attrs, ...out };
  return Object.keys(all).length ? all : undefined;
}

/** Converts a document when it has no format and its rows use id, source and target. */
export function importDoc(input: unknown): { doc: unknown; converted: boolean } {
  if (!isObject(input) || 'format' in input) return { doc: input, converted: false };
  const vertices = Array.isArray(input.vertices) ? input.vertices : Array.isArray(input.nodes) ? input.nodes : null;
  const edges = Array.isArray(input.edges) ? input.edges : Array.isArray(input.links) ? input.links : null;
  if (!vertices || !edges) return { doc: input, converted: false };
  const looksLikeIds =
    vertices.some((v) => isObject(v) && 'id' in v && !('key' in v)) ||
    edges.some((e) => isObject(e) && ('source' in e || 'target' in e));
  if (!looksLikeIds) return { doc: input, converted: false };
  const doc = {
    format: 'graphview-graph/1',
    meta: {
      name: typeof input.name === 'string' ? input.name : 'Imported graph',
      source: 'converted from rows with id, source and target',
      ...(isObject(input.meta) ? input.meta : {}),
    },
    // Rows that are not objects pass through, so that the loader reports them as bad rows.
    vertices: vertices.map((v) => {
      if (!isObject(v)) return v;
      const row: Record<string, unknown> = { key: 'key' in v ? v.key : v.id };
      const label = typeof v.label === 'string' ? v.label : typeof v.name === 'string' ? v.name : undefined;
      if (label !== undefined) row.label = label;
      const attrs = rest(v, VERTEX_FIELDS);
      if (attrs) row.attrs = attrs;
      if (isObject(v.pos)) row.pos = v.pos;
      else if (typeof v.x === 'number' && typeof v.y === 'number') row.pos = { x: v.x, y: v.y };
      if (v.superseded === true) row.superseded = true;
      return row;
    }),
    edges: edges.map((e) => {
      if (!isObject(e)) return e;
      const row: Record<string, unknown> = {};
      if ('from' in e || 'source' in e) row.from = 'from' in e ? e.from : e.source;
      if ('to' in e || 'target' in e) row.to = 'to' in e ? e.to : e.target;
      const attrs = rest(e, EDGE_FIELDS);
      if (attrs) row.attrs = attrs;
      if (e.superseded === true) row.superseded = true;
      return row;
    }),
  };
  return { doc, converted: true };
}
