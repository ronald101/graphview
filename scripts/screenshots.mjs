// Takes the eleven screenshots of gate G19 (specification J3) from the shell's production build.
// Usage: npm run build:shell, then npx vite preview --config shell/vite.config.ts --port 4173,
// then node scripts/screenshots.mjs. Pictures go to docs/screenshots/.
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173/graphview/';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const local = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: existsSync(local) ? local : undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function shell(theme, width = 1440, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: theme });
  await page.goto(BASE);
  await page.waitForFunction(() => window.graphview?.view && window.graphview.settled() > 0, null, { timeout: 60000 });
  await page.evaluate((t) => window.graphview.setLook({ motion: 'off', theme: t }), theme);
  return page;
}
const settle = (page, ms = 600) => page.waitForTimeout(ms);
const run = (page, fn, ...args) => page.evaluate(fn, args);

const views = [
  ['01-database-force-light', async () => shell('light')],
  ['02-database-force-dark', async () => shell('dark')],
  [
    '03-rings-unit-1-light',
    async () => {
      const p = await shell('light');
      await run(p, async () => {
        const v = window.graphview.view;
        await v.setViewState({ focus: 1, layout: { ...v.getViewState().layout, name: 'rings' } });
        await v.fit('all');
      });
      return p;
    },
  ],
  [
    '04-keypair-76-80-details-light',
    async () => {
      const p = await shell('light');
      await run(p, async () => {
        const v = window.graphview.view;
        await v.setViewState({ selection: { units: [], keypairs: [[76, 80]] } });
        await v.fit('selection');
      });
      return p;
    },
  ],
  [
    '05-paths-79-77-lit-dark',
    async () => {
      const p = await shell('dark');
      await run(p, async () => {
        const v = window.graphview.view;
        await v.showPaths(79, 77, 4);
        await v.setViewState({ paths: { ends: [79, 77], extra: 4, lit: { length: 6, index: 0 }, showAll: null } });
        await v.fit('all');
      });
      return p;
    },
  ],
  [
    '06-broken-mixed-issues-light',
    async () => {
      const p = await shell('light');
      await run(p, () => window.graphview.loadExample('broken-mixed'));
      return p;
    },
  ],
  [
    '07-superseded-faded-light',
    async () => {
      const p = await shell('light');
      await run(p, () => window.graphview.loadExample('superseded'));
      return p;
    },
  ],
  [
    '08-random-10k-dark',
    async () => {
      const p = await shell('dark');
      await run(p, () => window.graphview.loadExample('random-10k'));
      await settle(p, 8000);
      return p;
    },
  ],
  [
    '09-generate-small-world-light',
    async () => {
      const p = await shell('light');
      await run(p, () => window.graphview.generate('small-world', { n: 30, k: 4, beta: 0.1 }, 1));
      await p.waitForFunction(() => window.graphview.settled() > 1);
      await p.locator('#generate').scrollIntoViewIfNeeded();
      return p;
    },
  ],
  [
    '10-text-keys-labels-light',
    async () => {
      const p = await shell('light');
      await run(p, () => window.graphview.loadExample('text-keys'));
      return p;
    },
  ],
  [
    '11-shell-800-drawers-light',
    async () => {
      const p = await shell('light', 800, 900);
      await p.getByRole('button', { name: 'Controls' }).click();
      return p;
    },
  ],
];

const only = process.argv[2];
for (const [name, make] of views) {
  if (only && !name.startsWith(only)) continue;
  const page = await make();
  await settle(page);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(name);
  await page.close();
}
await browser.close();
