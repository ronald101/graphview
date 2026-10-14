// The examples: every fixture, grouped as valid, broken and refused (specification G2).
// Small fixtures are bundled as data; the random graph of 10,000 units loads on demand.
import index from '../../fixtures/index.json';

const small = import.meta.glob<unknown>(['../../fixtures/graphs/*.json', '!../../fixtures/graphs/random-10k.json'], {
  eager: true,
  import: 'default',
});
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
  units: number;
}

const meta = (doc: unknown) =>
  doc && typeof doc === 'object' && !Array.isArray(doc) && typeof (doc as { meta?: unknown }).meta === 'object'
    ? ((doc as { meta: Record<string, unknown> }).meta ?? {})
    : {};

// The random graph is not bundled as data, so its name and description are written here.
const LARGE: Record<string, { name: string; description: string }> = {
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

export const examples: Example[] = (index as { fixture: string; load: string; units: number; issues: number }[]).map(
  (e) => {
    const doc = small[`../../fixtures/graphs/${e.fixture}.json`];
    const m = meta(doc);
    const group = e.load === 'refused' ? 'refused' : e.issues > 0 ? 'broken' : 'valid';
    return {
      id: e.fixture,
      group,
      name: typeof m.name === 'string' ? m.name : e.fixture.replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase()),
      description: typeof m.description === 'string' ? m.description : (REFUSED[e.fixture] ?? ''),
      units: e.units,
    };
  },
);

/** The document of an example. */
export async function exampleDoc(id: string): Promise<unknown> {
  const key = `../../fixtures/graphs/${id}.json`;
  if (key in small) return structuredClone(small[key]);
  const url = urls[key];
  if (!url) throw new Error(`No example called ${id}`);
  return (await fetch(url)).json();
}
