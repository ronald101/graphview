import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { exampleId } from './lib/sample.ts';

const here = import.meta.dirname;
const root = resolve(here, '..');
const fixtures = resolve(root, 'fixtures');

/**
 * The examples, built from the fixtures at build time, then the shell's own examples in shell/examples:
 * "virtual:examples" lists them for the page, and "virtual:example-docs" holds their documents for the
 * route that serves them (specification 8.10).
 */
function examples(): Plugin {
  const LIST = 'virtual:examples';
  const DOCS = 'virtual:example-docs';
  return {
    name: 'graphview-examples',
    resolveId: (source) => (source === LIST || source === DOCS ? `\0${source}` : undefined),
    load(source) {
      if (source !== `\0${LIST}` && source !== `\0${DOCS}`) return;
      const read = (file: string) => {
        this.addWatchFile(file);
        return JSON.parse(readFileSync(file, 'utf8')) as unknown;
      };
      const meta = (doc: unknown) => {
        const m = (doc as { meta?: unknown } | null)?.meta;
        return m && typeof m === 'object' ? (m as { name?: unknown; description?: unknown }) : {};
      };
      const text = (v: unknown) => (typeof v === 'string' ? v : null);
      const index = read(resolve(fixtures, 'index.json')) as {
        fixture: string;
        load: string;
        units: number | null;
        issues: number;
      }[];
      const list: unknown[] = [];
      const docs: Record<string, unknown> = {};
      const add = (id: string, group: string, units: number | null, doc: unknown) => {
        docs[id] = doc;
        const m = meta(doc);
        list.push({ id, group, units, name: text(m.name), description: text(m.description) });
      };
      for (const e of index) {
        const group = e.load === 'refused' ? 'refused' : e.issues > 0 ? 'broken' : 'valid';
        add(exampleId(e.fixture), group, e.units, read(resolve(fixtures, 'graphs', `${e.fixture}.json`)));
      }
      // The shell's own examples: interface graphs, which the fixtures do not hold. A name that
      // starts with broken- shows among the examples with issues.
      const own = resolve(here, 'examples');
      for (const name of readdirSync(own)
        .filter((n) => n.endsWith('.json'))
        .sort()) {
        const doc = read(resolve(own, name)) as { vertices: unknown[] };
        const id = name.replace(/\.json$/, '');
        add(id, id.startsWith('broken-') ? 'broken' : 'valid', doc.vertices.length, doc);
      }
      return `export default ${JSON.stringify(source === `\0${LIST}` ? list : docs)};`;
    },
  };
}

// The shell: a SvelteKit app under /graphview that plays the host (specification 8.17). The mode
// "static" builds the static demo into dist/shell; any other mode builds the app with its server into
// dist/server.
export default defineConfig(({ mode }) => ({
  root,
  plugins: [
    sveltekit({
      adapter:
        mode === 'static'
          ? // The settings route needs a server: the static demo leaves it out and keeps settings in the browser.
            adapterStatic({ pages: 'dist/shell', assets: 'dist/shell', strict: false })
          : adapterNode({ out: 'dist/server' }),
      files: { src: 'shell', assets: 'shell/static' },
      paths: { base: '/graphview' },
    }),
    examples(),
  ],
  server: { fs: { allow: [root] } },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1500 },
}));
