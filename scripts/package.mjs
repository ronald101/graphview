// Finishes dist/package after svelte-package (specification 10.3): the workers' addresses name the
// built .js files, the module's own build configuration leaves, and no import still names a .ts file.
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = new URL('../dist/package/', import.meta.url).pathname;

// new URL('./x.worker.ts', import.meta.url) is an address, not an import: TypeScript leaves it as it is.
const workers = join(out, 'workers/index.js');
writeFileSync(workers, readFileSync(workers, 'utf8').replace(/(new URL\('\.\/[\w.-]+)\.ts'/g, "$1.js'"));

for (const name of readdirSync(out)) if (name.startsWith('vite.config')) rmSync(join(out, name));

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
const left = files(out)
  .filter((f) => /\.(js|svelte)$/.test(f))
  .filter((f) => /(from\s*|import\s*\(\s*|new URL\(\s*)['"]\.{1,2}\/[^'"]+\.ts['"]/.test(readFileSync(f, 'utf8')));
if (left.length) {
  console.error(`These files still name .ts files: ${left.map((f) => f.slice(out.length)).join(', ')}`);
  process.exit(1);
}
console.log('dist/package is ready');
