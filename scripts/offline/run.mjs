// Offline test runner: runs Vitest-style test files with Node's own TypeScript support.
// Usage: node scripts/offline/run.mjs <test files...>
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

register('./hooks.mjs', import.meta.url);
const { registry } = await import('./vitest-shim.mjs');

let passed = 0;
const failed = [];
for (const file of process.argv.slice(2)) {
  const start = registry.length;
  await import(pathToFileURL(resolve(file)).href);
  for (const t of registry.slice(start)) {
    const name = `${file} > ${t.name}`;
    try {
      await t.fn();
      passed++;
    } catch (err) {
      failed.push(name);
      console.log(`FAIL ${name}\n     ${String(err.message).split('\n').join('\n     ')}`);
    }
  }
}
console.log(`\n${passed} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
