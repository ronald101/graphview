import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const here = import.meta.dirname;
export default defineConfig({
  root: here,
  server: { fs: { allow: [resolve(here, '..')] } },
  build: {
    outDir: resolve(here, '../dist/trial'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: Object.fromEntries(['sigma', 'g6', 'sigma-min', 'g6-min'].map((n) => [n, resolve(here, `${n}.html`)])),
    },
  },
});
