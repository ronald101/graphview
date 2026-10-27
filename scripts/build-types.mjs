// Writes the module's type declarations into dist/module/types (specification 10.3).
import { createRequire } from 'node:module';
import { emitDts } from 'svelte2tsx';

const require = createRequire(import.meta.url);
await emitDts({
  libRoot: new URL('../module', import.meta.url).pathname,
  declarationDir: new URL('../dist/module/types', import.meta.url).pathname,
  svelteShimsPath: require.resolve('svelte2tsx/svelte-shims-v4.d.ts'),
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
});
console.log('types written to dist/module/types');
// The build configuration is not part of the module's interface.
const { rmSync } = await import('node:fs');
rmSync(new URL('../dist/module/types/vite.config.d.ts', import.meta.url), { force: true });
