// The shell (specification Part G): loading, examples, generators, breaking rules, parameters, saving and sharing.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expected, frames, index, open, scene, setView, viewState } from './helpers.ts';

const words = (n: number, one: string, many: string) =>
  n === 0 ? `no ${many}` : `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

test.describe('shell', () => {
  for (const f of index()) {
    test(`G2 examples: ${f.fixture} loads from the Examples menu`, async ({ page }) => {
      test.setTimeout(180000);
      await open(page, 'pair');
      await page.getByRole('combobox', { name: 'Examples' }).selectOption(f.fixture);
      const exp = expected(f.fixture);
      const headline = page.getByTestId('headline');
      if (exp.load === 'refused') {
        await expect(headline).toHaveText('Refused file', { timeout: 60000 });
        await expect(page.getByTestId('refused')).toHaveAttribute('data-code', exp.code);
        return;
      }
      const text = `${words(exp.counts.units, 'unit', 'units')}, ${words(exp.counts.relations, 'relation', 'relations')}, ${words(exp.issues.length, 'issue', 'issues')}`;
      await expect(headline).toContainText(text, { timeout: 60000 });
    });
  }

  test('G2 examples: the menu groups them as valid, broken and refused', async ({ page }) => {
    await open(page, 'pair');
    const groups = await page
      .locator('select[aria-label="Examples"] optgroup')
      .evaluateAll((els) => els.map((e) => e.getAttribute('label')));
    expect(groups).toEqual(['Valid', 'Broken', 'Refused']);
    expect(await page.locator('select[aria-label="Examples"] option:not([disabled])').count()).toBe(27);
  });

  test('G2 loading: a file picked from disk loads', async ({ page }) => {
    await open(page, 'pair');
    await page
      .getByLabel('Open a file')
      .setInputFiles(new URL('../../fixtures/graphs/petersen.json', import.meta.url).pathname);
    await expect(page.getByTestId('headline')).toContainText('Petersen graph, 10 units, 15 relations, no issues');
  });

  test('G2 loading: when a web address is refused, the shell says so and names the address', async ({ page }) => {
    await open(page, 'pair');
    const url = 'http://localhost:9/nothing.json';
    await page.getByPlaceholder('Web address').fill(url);
    await page.getByRole('button', { name: 'Fetch' }).click();
    await expect(page.getByTestId('message')).toContainText(url);
  });

  test('G2 loading: a web address that answers loads', async ({ page }) => {
    await open(page, 'pair');
    const url = 'http://localhost:4173/graphview/data/triangle.json';
    await page.route(url, (route) =>
      route.fulfill({
        body: readFileSync(new URL('../../fixtures/graphs/triangle.json', import.meta.url)),
        contentType: 'application/json',
      }),
    );
    await page.getByPlaceholder('Web address').fill(url);
    await page.getByRole('button', { name: 'Fetch' }).click();
    await expect(page.getByTestId('headline')).toContainText('3 units, 3 relations, no issues');
  });

  test('G3 generate: a small-world graph from the generate panel', async ({ page }) => {
    await open(page, 'pair');
    await page.locator('#generate select').first().selectOption('small-world');
    await page.locator('#generate').getByRole('button', { name: 'Generate' }).click();
    await expect(page.getByTestId('headline')).toContainText('Small world, seed 1, 30 units, 60 relations, no issues');
  });

  test('G3 generate: random by degrees shows the degrees reached next to the ones asked', async ({ page }) => {
    await open(page, 'pair');
    await page.locator('#generate select').first().selectOption('random-degrees');
    await page.locator('#generate').getByRole('button', { name: 'Generate' }).click();
    await expect(page.getByTestId('reached')).toContainText('Reached:');
  });

  test('G4 break the rules: the graph shows "Not Rosetta data" and its issues', async ({ page }) => {
    await open(page, 'pair');
    await page.evaluate(() =>
      (window as any).graphview.generate('path', { n: 6 }, 1, {
        dropReverse: 0.5,
        unknownKeys: 1,
        repeatRows: 2,
        loneUnits: 1,
      }),
    );
    await expect(page.getByTestId('not-rosetta')).toHaveText('Not Rosetta data');
    const codes = await page
      .getByTestId('issues-panel')
      .locator('li[data-code]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-code')));
    expect(codes).toContain('missing-reverse');
    expect(codes).toContain('unknown-unit');
    expect(codes).toContain('orphan');
  });

  test('G5 parameters: a change redraws at once, the JSON view shows the whole, and reset restores the defaults', async ({
    page,
  }) => {
    await open(page, 'triangle');
    await page.locator('#look select').first().selectOption('dark');
    await expect(page.locator('.gv')).toHaveAttribute('data-theme', 'dark');
    await page.locator('#parameters summary').click();
    await expect(page.getByTestId('json')).toContainText('"theme": "dark"');
    await setView(page, { focus: 2 });
    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    await frames(page);
    expect((await viewState(page)).focus).toBe(null);
    await expect(page.getByTestId('json')).toContainText('"theme": "system"');
  });

  test('G6 save graph: the download holds the rows as held, with the stored fingerprint', async ({ page }) => {
    await open(page, 'broken-mixed');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save graph' }).click();
    const saved = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
    const original = JSON.parse(
      readFileSync(new URL('../../fixtures/graphs/broken-mixed.json', import.meta.url), 'utf8'),
    );
    expect(saved.vertices).toEqual(original.vertices);
    expect(saved.edges).toEqual(original.edges);
    expect(saved.meta.fingerprint).toBe(expected('broken-mixed').fingerprint.stored);
  });

  test('G6 share link: opening it restores the example and the view state', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, 'petersen');
    await setView(page, {
      focus: 3,
      radius: 1,
      selection: { units: [3], keypairs: [] },
      camera: { x: 5, y: 5, zoom: 2, angle: 15 },
    });
    await page.getByRole('button', { name: 'Share link' }).click();
    const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
    const before = await viewState(page);
    const fresh = await context.newPage();
    await fresh.goto(link);
    await fresh.waitForFunction(() => (window as any).graphview?.view && (window as any).graphview.settled() > 0);
    await frames(fresh);
    const after = await viewState(fresh);
    expect(after).toEqual(before);
    expect((await scene(fresh)).fingerprint).toBe(expected('petersen').fingerprint.stored);
  });

  test('G6 share link: a generated graph travels as its generator, parameters and seed', async ({ page, context }) => {
    await open(page, 'pair');
    await page.evaluate(() => (window as any).graphview.generate('tree', { n: 12, b: 3 }, 9));
    await expect(page.getByTestId('headline')).toContainText('12 units');
    await page.getByRole('button', { name: 'Share link' }).click();
    const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
    expect(decodeURIComponent(link)).toContain('"family":"tree"');
    const fp = (await scene(page)).fingerprint;
    const fresh = await context.newPage();
    await fresh.goto(link);
    await fresh.waitForFunction(() => (window as any).graphview?.view && (window as any).graphview.settled() > 0);
    expect((await scene(fresh)).fingerprint).toBe(fp);
  });

  test('G7 bench: the page shows the browser and the graphics information', async ({ page }) => {
    await page.goto('./#bench');
    await expect(page.getByTestId('browser')).toContainText('Chrome');
    await expect(page.getByTestId('graphics')).toContainText('WebGL');
  });

  test('F6 shell: below 960 pixels the columns become drawers', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 700 });
    await open(page, 'pair');
    await expect(page.locator('#left')).toBeHidden();
    await page.getByRole('button', { name: 'Controls' }).click();
    await expect(page.locator('#left')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Graph panels' })).toBeHidden();
    await page.getByRole('button', { name: 'Panels' }).click();
    await expect(page.getByRole('complementary', { name: 'Graph panels' })).toBeVisible();
  });
});
