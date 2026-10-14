import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const here = import.meta.dirname;

// The shell: a static single-page app under /graphview/ (specification I3).
export default defineConfig({
  root: here,
  base: '/graphview/',
  plugins: [svelte()],
  server: { fs: { allow: [resolve(here, '..')] } },
  worker: { format: 'es' },
  build: {
    outDir: resolve(here, '../dist/shell'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
