// The examples: every fixture, grouped as valid, broken and refused (specification 8.10). They come
// from the build; the random graph of 10,000 units loads on demand.
import data from 'virtual:examples';

const urls = import.meta.glob<string>('../../fixtures/graphs/random-10k.json', {
  query: '?url',
  import: 'default',
  eager: true,
});

export interface Example {
  id: string;
  group: 'valid' | 'broken' | 'refused';
  name: string;
  description: string;
  units: number | null;
}

const meta = (doc: unknown) =>
  doc && typeof doc === 'object' && !Array.isArray(doc) && typeof (doc as { meta?: unknown }).meta === 'object'
    ? ((doc as { meta: Record<string, unknown> }).meta ?? {})
    : {};

// The random graph is not bundled as data, so its name and description are written here.
const ON_DEMAND: Record<string, { name: string; description: string }> = {
  'random-10k': {
    name: 'Random graph of 10,000 units',
    description: 'A random spanning tree plus random relations, with random positions. Loads on demand.',
  },
};

const REFUSED: Record<string, string> = {
  'load-error-not-object': 'The file is not a JSON object.',
  'load-error-format': 'The format field is wrong.',
  'load-error-vertices': 'The vertices are not a list.',
  'load-error-edges': 'The edges are not a list.',
};

export const examples: Example[] = data.list.map((e) => {
  const m = meta(data.docs[e.id]);
  return {
    id: e.id,
    group: e.group,
    units: e.units,
    name:
      typeof m.name === 'string'
        ? m.name
        : (ON_DEMAND[e.id]?.name ?? e.id.replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase())),
    description:
      typeof m.description === 'string' ? m.description : (ON_DEMAND[e.id]?.description ?? REFUSED[e.id] ?? ''),
  };
});

/** The document of an example. */
export async function exampleDoc(id: string): Promise<unknown> {
  if (id in data.docs) return structuredClone(data.docs[id]);
  const url = urls[`../../fixtures/graphs/${id}.json`];
  if (!url) throw new Error(`No example called ${id}`);
  return (await fetch(url)).json();
}
