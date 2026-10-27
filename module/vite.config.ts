import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const here = import.meta.dirname;

// The module as a library (specification 10.3): one ES module with its CSS and workers.
// Svelte, graphology and three.js stay outside, as dependencies of the host.
export default defineConfig({
  plugins: [svelte()],
  worker: { format: 'es' },
  build: {
    outDir: resolve(here, '../dist/module'),
    emptyOutDir: true,
    lib: { entry: resolve(here, 'index.ts'), formats: ['es'], fileName: 'graphview', cssFileName: 'graphview' },
    rollupOptions: {
      external: (id) => /^(svelte|graphology|three)(\/|$)|^graphology-/.test(id),
    },
  },
});
