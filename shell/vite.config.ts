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
 * The examples as a module of data, built from the fixtures at build time, then the shell's own
 * examples in shell/examples. The largest graph loads on demand instead.
 */
function examples(): Plugin {
  const id = 'virtual:examples';
  const resolved = `\0${id}`;
  return {
    name: 'graphview-examples',
    resolveId: (source) => (source === id ? resolved : undefined),
    load(source) {
      if (source !== resolved) return;
      const indexFile = resolve(fixtures, 'index.json');
      this.addWatchFile(indexFile);
      const index = JSON.parse(readFileSync(indexFile, 'utf8')) as {
        fixture: string;
        load: string;
        units: number | null;
        issues: number;
      }[];
      const list: unknown[] = [];
      const docs: Record<string, unknown> = {};
      for (const e of index) {
        const group = e.load === 'refused' ? 'refused' : e.issues > 0 ? 'broken' : 'valid';
        if (e.fixture === 'random-10k') {
          list.push({ id: e.fixture, group, units: e.units, onDemand: true });
          continue;
        }
        const file = resolve(fixtures, 'graphs', `${e.fixture}.json`);
        this.addWatchFile(file);
        const name = exampleId(e.fixture);
        docs[name] = JSON.parse(readFileSync(file, 'utf8'));
        list.push({ id: name, group, units: e.units, onDemand: false });
      }
      // The shell's own examples: interface graphs, which the fixtures do not hold. A name that
      // starts with broken- shows among the examples with issues.
      const own = resolve(here, 'examples');
      for (const name of readdirSync(own)
        .filter((n) => n.endsWith('.json'))
        .sort()) {
        const file = resolve(own, name);
        this.addWatchFile(file);
        const id = name.replace(/\.json$/, '');
        docs[id] = JSON.parse(readFileSync(file, 'utf8'));
        const group = id.startsWith('broken-') ? 'broken' : 'valid';
        list.push({ id, group, units: (docs[id] as { vertices: unknown[] }).vertices.length, onDemand: false });
      }
      return `export default ${JSON.stringify({ list, docs })};`;
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
