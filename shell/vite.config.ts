import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { exampleId } from './lib/sample.ts';

const here = import.meta.dirname;
const fixtures = resolve(here, '../fixtures');

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

// The shell: a static single-page app under /graphview/ (specification 10.3).
export default defineConfig({
  root: here,
  base: '/graphview/',
  plugins: [svelte(), examples()],
  server: { fs: { allow: [resolve(here, '..')] } },
  worker: { format: 'es' },
  build: {
    outDir: resolve(here, '../dist/shell'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
