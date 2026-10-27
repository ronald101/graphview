import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['tests/gates/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    testTimeout: 60000,
  },
});
