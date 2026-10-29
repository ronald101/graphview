// The shell (specification section 8): the top bar, the host tools and the viewer's side bar with
// their sections, the examples and families of the Generate section, broken rules, the bench page,
// and no private names in the build.
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { loadGraph, tokens } from '../../module/core/index.ts';
import {
  close,
  expected,
  frames,
  graphFile,
  index,
  open,
  pixel,
  read,
  rgb,
  SAMPLE,
  SAMPLE_SOURCE,
  snap,
  words,
} from './helpers.ts';
import { leaks, PRIVATE_TERMS } from '../unit/privateWords.ts';

const exampleId = (fixture: string) => (fixture === SAMPLE_SOURCE ? SAMPLE : fixture);

test("§8.2 Top bar: Host, graphview and the headline; the view's controls are in the viewer's bar", async ({
  page,
}) => {
  await open(page);
  const top = page.getByRole('banner');
  await expect(top.getByRole('button', { name: 'Host', exact: true })).toBeVisible();
  await expect(top.getByRole('heading', { name: 'graphview' })).toBeVisible();
  await expect(top.getByRole('button')).toHaveCount(1);
  await expect(top.getByRole('checkbox')).toHaveCount(0);
  await expect(top.getByRole('combobox')).toHaveCount(0);
  const bar = page.getByRole('toolbar', { name: 'View' });
  for (const b of ['2D', '3D', 'Fit', 'Panels', 'Settings'])
    await expect(bar.getByRole('button', { name: b, exact: true })).toBeVisible();
  await expect(bar.getByRole('checkbox', { name: 'Hulls' })).toBeChecked();
  await expect(bar.getByRole('button', { name: /^(Load|Generate)/ })).toHaveCount(0);
  await expect(page.getByTestId('headline')).toHaveText(
    `Sample graph, 81 units, 84 relations, ${words(expected(SAMPLE_SOURCE).issues.length, 'issue', 'issues')}`,
  );
});

test('§7.1 and §8.1 Sections and sidebars: they open and close, starting as drawn; the canvas takes the room', async ({
  page,
}) => {
  await open(page);
  const width = async () => (await page.getByTestId('canvas').boundingBox())!.width;
  const w0 = await width();
  await expect(page.locator('#host')).toHaveCSS('width', '300px');
  await expect(page.locator('#gv-view-panels')).toHaveCSS('width', '360px');
  await expect(page.getByRole('banner')).toHaveCSS('height', '48px');
  await page.getByRole('button', { name: 'Host', exact: true }).click();
  await expect(page.locator('#host')).toBeHidden();
  await page.getByRole('button', { name: 'Panels', exact: true }).click();
  await expect(page.locator('#gv-view-panels')).toBeHidden();
  await expect.poll(width).toBeGreaterThan(w0 + 600);
  await page.getByRole('button', { name: 'Host', exact: true }).click();
  await page.getByRole('button', { name: 'Panels', exact: true }).click();
  // The host's sections, then the viewer's, each open (true) or closed (false) at the start.
  const sections = page.locator('[data-testid^="section-"]');
  expect(await sections.evaluateAll((els) => els.map((e) => [e.getAttribute('data-testid'), e.dataset.open]))).toEqual([
    ['section-data', 'true'],
    ['section-generate', 'true'],
    ['section-root', 'true'],
    ['section-paths', 'true'],
    ['section-inspector', 'true'],
    ['section-filters', 'false'],
    ['section-types', 'false'],
    ['section-display', 'false'],
    ['section-issues', 'true'],
    ['section-pinned', 'true'],
  ]);
  for (const id of [
    'data',
    'generate',
    'root',
    'paths',
    'inspector',
    'filters',
    'types',
    'display',
    'issues',
    'pinned',
  ]) {
    const section = page.getByTestId(`section-${id}`);
    const toggle = section.locator('h2 button');
    const was = (await toggle.getAttribute('aria-expanded')) === 'true';
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', String(!was));
    await expect(section.locator('.gv-section-body')).toBeVisible({ visible: !was });
  }
});

test('§8.1 Page layout: at 900 pixels or less the sidebars start closed and open over the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await open(page);
  await expect(page.locator('#host')).toBeHidden();
  await expect(page.locator('#gv-view-panels')).toBeHidden();
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  await page.getByRole('button', { name: 'Host', exact: true }).click();
  await expect(page.locator('#host')).toBeVisible();
  await page.getByRole('button', { name: 'Panels', exact: true }).click();
  await expect(page.locator('#gv-view-panels')).toBeVisible();
  // Over the canvas: it keeps its size.
  expect((await page.getByTestId('canvas').boundingBox())!.width).toBe(canvas.width);
  // The boundary: at 900 pixels the drawers still apply; one pixel more shows both sidebars.
  for (const [width, hidden] of [
    [900, true],
    [901, false],
  ] as const) {
    await page.setViewportSize({ width, height: 700 });
    await open(page);
    await expect(page.locator('#host')).toBeVisible({ visible: !hidden });
    await expect(page.locator('#gv-view-panels')).toBeVisible({ visible: !hidden });
  }
});

test('§8.4 Generate: the menu groups examples, examples with issues, refused files and families', async ({ page }) => {
  await open(page);
  const choice = page.getByTestId('graph-choice');
  const groups = await choice.locator('optgroup').evaluateAll((els) => els.map((e) => e.getAttribute('label')));
  expect(groups).toEqual(['Examples', 'Examples with issues', 'Files the viewer refuses', 'Families']);
  // The fixtures, then the shell's own examples (8.10).
  const own = readdirSync(new URL('../../shell/examples/', import.meta.url)).filter((n) => n.endsWith('.json'));
  expect(await choice.locator('option[value^="example:"]').count()).toBe(index().length + own.length);
  expect(await choice.locator('option[value^="family:"]').count()).toBe(12);
});

test('§8.4 Generate: choosing an example or a family changes nothing until Generate', async ({ page }) => {
  await open(page);
  const headline = page.getByTestId('headline');
  const before = await headline.textContent();
  await page.getByTestId('graph-choice').selectOption('example:petersen');
  await page.waitForTimeout(300);
  await expect(headline).toHaveText(before!);
  await page.getByTestId('generate').click();
  await expect(headline).toHaveText('Petersen graph, 10 units, 15 relations, no issues');
  await page.getByTestId('graph-choice').selectOption('family:small-world');
  await page.waitForTimeout(300);
  await expect(headline).toContainText('Petersen graph');
  await page.getByTestId('generate').click();
  await expect(headline).toContainText('30 units, 60 relations, no issues');
});

for (const f of index()) {
  test(`§8.10 Examples: the example ${f.fixture} loads`, async ({ page }) => {
    test.setTimeout(180000);
    await open(page);
    await page.getByTestId('graph-choice').selectOption(`example:${exampleId(f.fixture)}`);
    await page.getByTestId('generate').click();
    const exp = expected(f.fixture);
    const headline = page.getByTestId('headline');
    if (exp.load === 'refused') {
      await expect(headline).toHaveText('Refused file', { timeout: 60000 });
      await expect(page.getByTestId('refused')).toHaveAttribute('data-code', exp.code);
      // The canvas shows the core's own words for the refusal.
      const r = loadGraph(graphFile(f.fixture));
      expect(r.ok).toBe(false);
      if (!r.ok) await expect(page.getByTestId('refused')).toContainText(r.message);
      return;
    }
    const text = `${words(exp.counts.units, 'unit', 'units')}, ${words(exp.counts.relations, 'relation', 'relations')}, ${words(exp.issues.length, 'issue', 'issues')}`;
    await expect(headline).toContainText(text, { timeout: 60000 });
  });
}

test('§8.5 Families: random by degrees shows the degrees reached next to the ones asked', async ({ page }) => {
  await open(page);
  await page.getByTestId('graph-choice').selectOption('family:random-degrees');
  await page.getByTestId('generate').click();
  await expect(page.getByTestId('reached')).toContainText('Reached:');
});

test('§8.6 Breaking the rules: breaking them on purpose shows the banner and the issues', async ({ page }) => {
  await open(page, 'path-4');
  await expect(page.getByTestId('rules-banner')).toHaveCount(0);
  await page.evaluate(() =>
    (window as any).graphview.generate('path', { n: 6 }, 1, {
      dropReverse: 0.5,
      unknownKeys: 1,
      repeatRows: 2,
      loneUnits: 1,
    }),
  );
  await expect(page.getByTestId('rules-banner')).toContainText('breaks the graph rules');
  const codes = await page
    .getByTestId('issues-panel')
    .locator('li[data-code]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-code')));
  for (const c of ['missing-reverse', 'unknown-unit', 'orphan']) expect(codes).toContain(c);
  expect((await read<{ meta: { breaks: unknown } }>(page, 'doc')).meta.breaks).toEqual({
    dropReverse: 0.5,
    unknownKeys: 1,
    repeatRows: 2,
    loneUnits: 1,
  });
});

test("§8.9 Types and look: the viewer's theme takes effect at once, in the page and in the picture, with the tokens of §4.6", async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByLabel('Filter the settings').fill('theme.scheme');
  const surface = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--gv-surface').trim());
  for (const theme of ['dark', 'light'] as const) {
    await dialog.getByTestId('setting-theme.scheme').getByRole('combobox').selectOption(theme);
    await expect.poll(surface).toBe(tokens[theme].surface);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await frames(page);
    expect(close(await pixel(page, 3, 3), rgb(tokens[theme].surface), 3)).toBe(true);
  }
});

test('§8.15 The test hook: window.graphview holds the model, the canvas and the commands', async ({ page }) => {
  await open(page);
  const hook = await page.evaluate(() => {
    const g = (window as any).graphview;
    const c = g.canvas();
    return {
      shell: ['ready', 'nextReady', 'loadExample', 'generate', 'setLook'].filter((k) => typeof g[k] === 'function'),
      canvas: ['clickAt', 'pickAt', 'fit', 'getScene', 'whenSettled', 'getCamera', 'setCamera', 'picture'].filter(
        (k) => typeof c[k] === 'function',
      ),
      model: typeof g.model.load,
    };
  });
  expect(hook).toEqual({
    shell: ['ready', 'nextReady', 'loadExample', 'generate', 'setLook'],
    canvas: ['clickAt', 'pickAt', 'fit', 'getScene', 'whenSettled', 'getCamera', 'setCamera', 'picture'],
    model: 'function',
  });
});

test('§8.14 The bench page: it shows the browser and the graphics information', async ({ page }) => {
  await page.goto('./#bench');
  await expect(page.getByTestId('browser')).toContainText('Chrome');
  await expect(page.getByTestId('graphics')).toContainText('WebGL');
});

test('§11.1 Fixtures: the built shell carries no private term', async ({ page }) => {
  expect(PRIVATE_TERMS.full.size).toBeGreaterThan(100);
  // Every text file of the server build, which the browser tests run against (8.17), at any depth.
  const dir = new URL('../../dist/server/', import.meta.url);
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(
    (f) => /\.(js|css|html|json)$/.test(f) && statSync(new URL(f, dir)).isFile(),
  );
  expect(files).toContain('prerendered/graphview/index.html');
  expect(files).toContain('prerendered/graphview/examples/sample.json');
  expect(files.filter((f) => f.startsWith('client/') && f.endsWith('.js')).length).toBeGreaterThan(5);
  for (const f of files) {
    expect(leaks(readFileSync(new URL(f, dir), 'utf8')), f).toEqual([]);
  }
  await open(page);
  const labels = (await snap(page)).labels.map((l) => l.text);
  expect(labels.every((t) => /^unit_\d+$/.test(t))).toBe(true);
});
