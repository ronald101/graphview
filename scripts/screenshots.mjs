// Takes the eighteen screenshots of the visual review, gate G19 (specification 11.5).
// Usage: npm run build:shell, then npx vite preview --config shell/vite.config.ts --port 4173,
// then node scripts/screenshots.mjs [prefix]. Pictures go to docs/screenshots/.
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173/graphview/';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const local = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: existsSync(local) ? local : undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/** Opens the shell with the sample graph, motion off. */
async function shell(theme, width = 1440, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: theme });
  await page.goto(BASE);
  await page.waitForFunction(() => window.graphview?.ready() > 0, null, { timeout: 60000 });
  await page.evaluate((t) => window.graphview.setLook({ motion: 'off', theme: t }), theme);
  await settled(page);
  return page;
}
const settled = (page) => page.evaluate(() => window.graphview.canvas().whenSettled());
const run = async (page, fn, ...args) => {
  await page.evaluate(fn, args);
  await settled(page);
};
const example = (page, id, withAttributes = false) =>
  run(page, ([i, w]) => window.graphview.loadExample(i, w), id, withAttributes);
const mode3d = (page) => run(page, () => window.graphview.model.setMode('3d'));

/** Turns the 3D camera around its target, so that the depth planes show. */
function oblique() {
  const c = window.graphview.canvas();
  const cam = c.getCamera();
  const d = Math.hypot(...cam.position.map((x, i) => x - cam.target[i]));
  c.setCamera([cam.target[0] + d * 0.45, cam.target[1] - d * 0.4, cam.target[2] + d * 0.8], cam.target);
}

const views = [
  ['01-sample-2d-light', async () => shell('light')],
  ['02-sample-2d-dark', async () => shell('dark')],
  [
    '03-root-1-planes-2d-light',
    async () => {
      const p = await shell('light');
      await run(p, () => window.graphview.model.setRoot(1));
      return p;
    },
  ],
  [
    '04-keypair-76-80-inspector-light',
    async () => {
      const p = await shell('light');
      await run(p, () => window.graphview.model.inspect({ kind: 'keypair', from: 76, to: 80 }));
      return p;
    },
  ],
  [
    '05-paths-79-77-one-longer-dark',
    async () => {
      const p = await shell('dark');
      await run(p, async () => {
        const m = window.graphview.model;
        await m.setRoot(79);
        const r = await m.setTarget(77);
        m.choosePath({ length: r.lengths[1].length, index: 0 });
      });
      return p;
    },
  ],
  [
    '06-broken-mixed-issues-light',
    async () => {
      const p = await shell('light');
      await example(p, 'broken-mixed');
      return p;
    },
  ],
  [
    '07-superseded-light',
    async () => {
      const p = await shell('light');
      await example(p, 'superseded');
      return p;
    },
  ],
  [
    '08-random-10k-dark',
    async () => {
      const p = await shell('dark');
      await example(p, 'random-10k');
      await p.waitForTimeout(3000);
      return p;
    },
  ],
  [
    '09-generate-small-world-explained-light',
    async () => {
      const p = await shell('light');
      await p.getByTestId('graph-choice').selectOption('family:small-world');
      const ready = p.evaluate(() => window.graphview.nextReady());
      await p.getByTestId('generate').click();
      await ready;
      await p.getByTestId('explanation').locator('summary').click();
      await p.getByTestId('section-data').locator('h2 button').click();
      await settled(p);
      return p;
    },
  ],
  [
    '10-text-keys-labels-light',
    async () => {
      const p = await shell('light');
      await example(p, 'text-keys');
      return p;
    },
  ],
  [
    '11-shell-800-drawers-light',
    async () => {
      const p = await shell('light', 800, 900);
      await p.getByRole('button', { name: 'Controls', exact: true }).click();
      return p;
    },
  ],
  [
    '12-3d-sample-hulls-light',
    async () => {
      const p = await shell('light');
      await mode3d(p);
      return p;
    },
  ],
  [
    '13-3d-root-1-depth-light',
    async () => {
      const p = await shell('light');
      await mode3d(p);
      await run(p, () => window.graphview.model.setRoot(1));
      await run(p, oblique);
      return p;
    },
  ],
  [
    '14-3d-path-79-77-dark',
    async () => {
      const p = await shell('dark');
      await mode3d(p);
      await run(p, async () => {
        await window.graphview.model.setRoot(79);
        await window.graphview.model.setTarget(77);
      });
      await run(p, oblique);
      return p;
    },
  ],
  [
    '15-generate-types-communities-light',
    async () => {
      const p = await shell('light');
      await p.getByTestId('graph-choice').selectOption('family:communities');
      await p.getByRole('checkbox', { name: 'Add types, weights and times' }).check();
      const ready = p.evaluate(() => window.graphview.nextReady());
      await p.getByTestId('generate').click();
      await ready;
      await p.getByTestId('section-data').locator('h2 button').click();
      await settled(p);
      return p;
    },
  ],
  [
    '16-3d-filters-communities-light',
    async () => {
      const p = await shell('light');
      await run(p, () =>
        window.graphview.generate('communities', { n: 40, g: 4, pIn: 0.3, pOut: 0.02 }, 3, undefined, true),
      );
      await mode3d(p);
      await p.getByTestId('section-filters').locator('h2 button').click();
      await run(p, () => window.graphview.model.setFilters({ threshold: 0.6, to: Date.UTC(2026, 8, 1) }));
      return p;
    },
  ],
  [
    '17-interfaces-full-close-2d-light',
    async () => {
      const p = await shell('light');
      await example(p, 'interfaces-full');
      await run(p, () => {
        const c = window.graphview.canvas();
        const u = c.getScene().units.find((x) => x.key === 10);
        c.setCamera([u.x, u.y, u.z + 220], [u.x, u.y, u.z]);
      });
      return p;
    },
  ],
  [
    '18-3d-grid-interfaces-root-6-dark',
    async () => {
      const p = await shell('dark');
      await run(p, () => window.graphview.generate('grid', { rows: 4, columns: 5 }, 7, undefined, true, 0.5));
      await mode3d(p);
      await run(p, () => window.graphview.model.setRoot(6));
      // Turned, and close to an interface between two types, so that its two halves show.
      await run(p, () => {
        const c = window.graphview.canvas();
        const u = c.getScene().units.find((x) => x.key === 'i2');
        const d = 420;
        c.setCamera([u.x + d * 0.45, u.y - d * 0.4, u.z + d * 0.8], [u.x, u.y, u.z]);
      });
      return p;
    },
  ],
];

const only = process.argv[2];
for (const [name, make] of views) {
  if (only && !name.startsWith(only)) continue;
  const page = await make();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(name);
  await page.close();
}
await browser.close();
