// Resolve hooks for the offline runner: "vitest" maps to the stand-in, and
// extensionless or folder imports find their .ts file, as Vite would.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SHIM = new URL('./vitest-shim.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'vitest') return { url: SHIM, shortCircuit: true };
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL?.startsWith('file:')) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    const isDir = existsSync(base) && statSync(base).isDirectory();
    if (!existsSync(base) || isDir) {
      for (const candidate of isDir ? [base + '/index.ts'] : [base + '.ts', base + '/index.ts']) {
        if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return next(specifier, context);
}
